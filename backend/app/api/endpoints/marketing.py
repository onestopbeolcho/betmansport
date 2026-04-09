"""
Marketing API — SNS 콘텐츠 자동 생성 및 Buffer 발행
- 미리보기 (preview): Gemini로 콘텐츠 생성만
- 발행 (publish): Buffer API로 실제 SNS 발행
- 이력 조회, 채널 상태 확인
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)

# 발행 이력 (메모리 캐시 — 프로덕션에서는 Firestore 전환 권장)
_publish_history: list = []


class PublishRequest(BaseModel):
    post_index: Optional[int] = None  # 특정 게시물만 발행 (0-based). None이면 전체.
    scheduled_at: Optional[str] = None  # ISO 8601 예약 발행 시간
    with_image: bool = True  # 분석 카드 이미지 자동 첨부


class ManualPostRequest(BaseModel):
    text: str
    profile_ids: Optional[List[str]] = None
    image_url: Optional[str] = None  # 이미지 URL 직접 지정


# ─── 채널 상태 ───

@router.get("/channels")
async def get_buffer_channels():
    """Buffer에 연결된 SNS 채널 목록 조회"""
    from app.services.buffer_service import buffer_service

    if not buffer_service.is_configured:
        raise HTTPException(status_code=503, detail="BUFFER_ACCESS_TOKEN not configured. Set it in Cloud Run env vars.")

    channels = await buffer_service.get_channels(force_refresh=True)
    return {
        "configured": True,
        "channels": channels,
        "total": len(channels),
    }


# ─── 미리보기 ───

@router.get("/preview")
async def preview_sns_content():
    """
    오늘의 Top 3 고신뢰 경기를 기반으로 SNS 콘텐츠 미리보기.
    Buffer로 발행하지 않고 Gemini 생성 결과만 반환.
    """
    from app.services.gemini_service import generate_sns_content
    from app.api.endpoints.ai_predictions import _predictions_cache

    try:
        # 기존 예측 캐시에서 가져오기
        predictions = _predictions_cache

        if not predictions:
            return {
                "posts": [],
                "message": "현재 예측 데이터가 없습니다. /scheduler/collect_odds 먼저 실행하세요.",
            }

        # dict 변환
        pred_dicts = [p.dict() if hasattr(p, "dict") else p for p in predictions]

        # SNS 콘텐츠 생성
        posts = await generate_sns_content(pred_dicts)

        return {
            "posts": posts,
            "total_predictions": len(predictions),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"SNS preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── 발행 ───

@router.post("/publish")
async def publish_sns_content(req: PublishRequest = PublishRequest()):
    """
    Gemini로 생성한 SNS 콘텐츠를 Buffer를 통해 발행.
    post_index 지정 시 해당 게시물만, 미지정 시 전체 발행.
    """
    from app.services.buffer_service import buffer_service
    from app.services.gemini_service import generate_sns_content
    from app.api.endpoints.ai_predictions import _predictions_cache

    if not buffer_service.is_configured:
        raise HTTPException(status_code=503, detail="BUFFER_ACCESS_TOKEN not configured")

    try:
        # 콘텐츠 생성
        from app.api.endpoints import ai_predictions as ai_pred_module
        
        if not ai_pred_module._predictions_cache:
            logger.info("Predictions cache is empty. Forcing prediction generation...")
            await ai_pred_module.get_ai_predictions()
            
        predictions = ai_pred_module._predictions_cache
        
        if not predictions:
            raise HTTPException(status_code=404, detail="No predictions available for publishing")
            
        pred_dicts = [p.dict() if hasattr(p, "dict") else p for p in predictions]
        from app.services.gemini_service import generate_sns_content
        posts = await generate_sns_content(pred_dicts)

        # 발행 대상 선택
        if req.post_index is not None:
            if req.post_index >= len(posts):
                raise HTTPException(status_code=400, detail=f"post_index {req.post_index} out of range (0-{len(posts)-1})")
            targets = [posts[req.post_index]]
        else:
            targets = posts

        # Buffer 발행
        results = []
        for i, post in enumerate(targets):
            # 이미지 카드 생성
            image_url = None
            if req.with_image:
                try:
                    from app.services.card_generator import generate_card_and_upload
                    # 원본 예측 데이터에서 해당 경기 매칭
                    match_pred = None
                    for p in pred_dicts:
                        pid = p.get("match_id", "")
                        if pid == post.get("match_id"):
                            match_pred = p
                            break
                    if match_pred:
                        image_url = await generate_card_and_upload(match_pred)
                        logger.info(f"Card image generated: {image_url}")
                except Exception as e:
                    logger.warning(f"Card generation skipped: {e}")

            result = await buffer_service.publish_post(
                text=post["text"],
                scheduled_at=req.scheduled_at,
                image_url=image_url,
            )
            results.append({
                "match_id": post["match_id"],
                "confidence": post["confidence"],
                "buffer_result": result,
            })

            # 이력 저장
            _publish_history.append({
                "match_id": post["match_id"],
                "text": post["text"][:100] + "...",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "success": result.get("success", False),
                "channels": result.get("published", 0),
            })

        success_count = sum(1 for r in results if r["buffer_result"].get("success"))
        return {
            "published": success_count,
            "total": len(targets),
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SNS publish error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── 수동 게시물 발행 ───

@router.post("/publish_manual")
async def publish_manual_post(req: ManualPostRequest):
    """관리자가 직접 텍스트를 입력하여 SNS 발행"""
    from app.services.buffer_service import buffer_service

    if not buffer_service.is_configured:
        raise HTTPException(status_code=503, detail="BUFFER_ACCESS_TOKEN not configured")

    result = await buffer_service.publish_post(
        text=req.text,
        channel_ids=req.profile_ids,
        image_url=req.image_url,
    )

    _publish_history.append({
        "match_id": "manual",
        "text": req.text[:100] + "..." if len(req.text) > 100 else req.text,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "success": result.get("success", False),
        "channels": result.get("published", 0),
    })

    return result


# ─── 이력 ───

@router.get("/history")
async def get_publish_history():
    """최근 발행 이력 (최신 20건)"""
    return {
        "history": _publish_history[-20:][::-1],
        "total": len(_publish_history),
    }
