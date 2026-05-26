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
            await ai_pred_module.get_ai_predictions_internal()
            
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


class RotationPublishRequest(BaseModel):
    post_type: Optional[str] = None  # preview, winning, educational, top_picks, generic
    with_image: bool = True


@router.post("/publish_rotation")
async def publish_rotation_post(req: RotationPublishRequest = RotationPublishRequest()):
    """
    시간대별/지정 타입별 SNS 로테이션 발행 실행.
    """
    from app.services.buffer_service import buffer_service
    from app.services.gemini_service import (
        generate_sns_content,
        generate_winning_proof_sns,
        generate_educational_sns,
        generate_top_picks_sns,
        generate_generic_promo
    )
    from app.api.endpoints import ai_predictions as ai_pred_module
    from app.models.prediction_db import get_recent_ai_predictions

    if not buffer_service.is_configured:
        raise HTTPException(status_code=503, detail="BUFFER_ACCESS_TOKEN not configured")

    try:
        # 1. KST 시간대 자동 분석 또는 지정 타입 결정
        from datetime import datetime, timezone, timedelta
        KST = timezone(timedelta(hours=9))
        now_kst = datetime.now(KST)
        hour = now_kst.hour

        post_type = req.post_type
        if not post_type:
            # 08:00 - 10:59 -> top_picks
            if 8 <= hour < 11:
                post_type = "top_picks"
            # 12:00 - 14:59 -> educational
            elif 12 <= hour < 15:
                post_type = "educational"
            # 16:00 - 18:59 -> winning
            elif 16 <= hour < 19:
                post_type = "winning"
            # 그 외 시간대 -> preview
            else:
                post_type = "preview"

        logger.info(f"📱 SNS Rotation triggering: type={post_type} (KST Hour: {hour})")

        # 2. 타입별 실행 및 데이터 매핑
        text = None
        image_url = None
        match_id = "rotation"
        confidence = 0

        # 캐시된 경기 예측 로드
        if not ai_pred_module._predictions_cache:
            await ai_pred_module.get_ai_predictions_internal()
        predictions = ai_pred_module._predictions_cache
        pred_dicts = [p.dict() if hasattr(p, "dict") else p for p in predictions]

        if post_type == "top_picks":
            # 상위 3개 고신뢰도 리스트
            high_conf = [p for p in pred_dicts if p.get("confidence", 0) >= 55]
            if high_conf:
                text = await generate_top_picks_sns(high_conf)
                match_id = "top_picks"
            else:
                post_type = "educational"  # 경기가 없으면 교육글로 대체

        if post_type == "educational":
            # 정보성/브랜드 빌딩 칼럼
            text = await generate_educational_sns()
            match_id = "educational"

        elif post_type == "winning":
            # 적중 인증형
            try:
                hits = await get_recent_ai_predictions(limit=5, status="HIT")
                if hits:
                    text = await generate_winning_proof_sns(hits)
                    # 가장 최근 적중된 경기의 카드 생성 시도
                    if req.with_image:
                        from app.services.card_generator import generate_card_and_upload
                        # hits[0]를 card_generator 형식으로 변환/전달
                        best_hit = hits[0]
                        # factors가 없으면 기본으로 넣어줌
                        if "factors" not in best_hit:
                            best_hit["factors"] = [{"name": "AI 예측 적중", "score": best_hit.get("confidence", 80)}]
                        image_url = await generate_card_and_upload(best_hit)
                    match_id = f"hit_{hits[0].get('match_id', '')}"
                    confidence = hits[0].get("confidence", 0)
                else:
                    post_type = "preview"  # 적중 이력이 없으면 경기 프리뷰로 대체
            except Exception as e:
                logger.error(f"Winning proof rotation error: {e}")
                post_type = "preview"

        if post_type == "preview":
            # 개별 경기 상세 분석형 (호기심 유발)
            high_conf = [p for p in pred_dicts if p.get("confidence", 0) >= 55]
            if high_conf:
                import random
                high_conf = sorted(high_conf, key=lambda x: x.get("confidence", 0), reverse=True)[:20]
                selected_pred = random.choice(high_conf)
                
                posts = await generate_sns_content([selected_pred])
                if posts:
                    text = posts[0]["text"]
                    match_id = posts[0]["match_id"]
                    confidence = posts[0]["confidence"]
                    
                    if req.with_image:
                        from app.services.card_generator import generate_card_and_upload
                        image_url = await generate_card_and_upload(selected_pred)
            else:
                post_type = "generic"

        if post_type == "generic" or not text:
            # 최종 폴백: 일반 홍보글
            text = await generate_generic_promo()
            match_id = "generic_promo"

        # 3. Buffer 실제 발행
        if not text:
            raise HTTPException(status_code=500, detail="Failed to generate SNS content")

        result = await buffer_service.publish_post(
            text=text,
            image_url=image_url,
        )

        # 이력 저장
        _publish_history.append({
            "match_id": match_id,
            "text": text[:100] + "...",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "success": result.get("success", False),
            "channels": result.get("published", 0),
            "rotation_type": post_type,
        })

        return {
            "success": result.get("success", False),
            "rotation_type": post_type,
            "text": text,
            "image_url": image_url,
            "buffer_result": result,
        }

    except Exception as e:
        logger.error(f"SNS rotation publish error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── 이력 ───

@router.get("/history")
async def get_publish_history():
    """최근 발행 이력 (최신 20건)"""
    return {
        "history": _publish_history[-20:][::-1],
        "total": len(_publish_history),
    }
