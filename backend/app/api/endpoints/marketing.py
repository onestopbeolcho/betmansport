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
    with_image: bool = True  # Instagram/Facebook/X 카드뉴스 이미지 기본 포함 (True)


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
    with_image: bool = True  # Instagram/Facebook/X 1080x1080 카드뉴스 이미지 기본 포함


@router.post("/publish_rotation")
async def publish_rotation_post(req: RotationPublishRequest = RotationPublishRequest()):
    """
    시간대별/지정 타입별 SNS 로테이션 발행 실행 (X/Twitter + Facebook + Instagram 동시 발행).
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
            if hour % 2 == 0:
                post_type = "prediction"
            else:
                post_type = "winning"

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

        # 한글 팀명 보강
        from app.services.team_mapper import TeamMapper
        mapper = TeamMapper()
        for p in pred_dicts:
            th = p.get("team_home") or ""
            ta = p.get("team_away") or ""
            if not p.get("team_home_ko") or p.get("team_home_ko") == th:
                p["team_home_ko"] = mapper.get_korean_name(th) or th
            if not p.get("team_away_ko") or p.get("team_away_ko") == ta:
                p["team_away_ko"] = mapper.get_korean_name(ta) or ta

        # 오늘 이미 발행된 match_id 목록 조회 (중복 경기 발행 원천 차단)
        published_today_ids = set()
        today_prefix = now_kst.strftime("%Y-%m-%d")
        for h_item in _publish_history:
            if str(h_item.get("published_at", "")).startswith(today_prefix):
                published_today_ids.add(h_item.get("match_id"))
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore as gc_firestore
            db = get_firestore_db()
            recent_docs = (
                db.collection("sns_published")
                .order_by("published_at", direction=gc_firestore.Query.DESCENDING)
                .limit(15)
                .stream()
            )
            for d in recent_docs:
                d_dict = d.to_dict() or {}
                if str(d_dict.get("published_at", "")).startswith(today_prefix):
                    published_today_ids.add(d_dict.get("match_id"))
        except Exception as e_dedup:
            logger.warning(f"SNS dedup check skipped: {e_dedup}")

        # A. 지난 예측 결과 (적중 인증)
        if post_type in ["winning", "winning_proof"]:
            try:
                hits = await get_recent_ai_predictions(limit=10, status="HIT")
                unposted_hits = [h for h in (hits or []) if f"hit_{h.get('match_id', '')}" not in published_today_ids]
                if unposted_hits:
                    text = await generate_winning_proof_sns(unposted_hits[:5])
                    best_hit = unposted_hits[0]
                    if req.with_image:
                        from app.services.card_generator import generate_winning_card_and_upload
                        image_url = await generate_winning_card_and_upload(best_hit)
                    match_id = f"hit_{best_hit.get('match_id', '')}"
                    confidence = best_hit.get("confidence", 80)
                else:
                    logger.info("No unposted HIT history found, falling back to match prediction...")
                    post_type = "prediction"
            except Exception as e:
                logger.error(f"Winning proof rotation error: {e}")
                post_type = "prediction"

        # B. 어디가 이길 것 같은지 (오늘/내일 승리 예상 픽 — 당일 중복 경기 제외)
        if post_type in ["prediction", "top_picks", "preview"] or not text:
            post_type = "prediction"
            if pred_dicts:
                import random
                sorted_preds = sorted(pred_dicts, key=lambda x: x.get("confidence", 0), reverse=True)
                unposted_preds = [p for p in sorted_preds if p.get("match_id") not in published_today_ids]
                pool = unposted_preds[:10] if unposted_preds else sorted_preds[:10]
                selected_pred = random.choice(pool) if pool else pred_dicts[0]
                
                posts = await generate_sns_content([selected_pred])
                if posts:
                    text = posts[0]["text"]
                    match_id = posts[0]["match_id"]
                    confidence = posts[0]["confidence"]
                    
                    if req.with_image:
                        from app.services.card_generator import generate_card_and_upload
                        image_url = await generate_card_and_upload(selected_pred)
            else:
                text = await generate_generic_promo()
                match_id = "generic_promo"

        # 3. Buffer 실제 발행
        if not text:
            raise HTTPException(status_code=500, detail="Failed to generate SNS content")

        result = await buffer_service.publish_post(
            text=text,
            image_url=image_url,
        )

        # 이력 저장 (메모리 + Firestore 영구 기록)
        pub_entry = {
            "match_id": match_id,
            "text": text[:140] + ("..." if len(text) > 140 else ""),
            "image_url": image_url or "",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "success": result.get("success", False),
            "channels": result.get("published", 0),
            "posts": result.get("posts", []),
            "rotation_type": post_type,
        }
        _publish_history.append(pub_entry)

        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            doc_id = f"{datetime.now(KST).strftime('%Y%m%d_%H%M%S')}_{match_id[:30]}"
            db.collection("sns_published").document(doc_id).set(pub_entry)
        except Exception as e_db:
            logger.warning(f"Failed to save sns_published to Firestore: {e_db}")

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
    """최근 발행 이력 (Firestore + 메모리 병합 최신 20건)"""
    try:
        from app.db.firestore import get_firestore_db
        from google.cloud import firestore as gc_firestore
        db = get_firestore_db()
        docs = list(
            db.collection("sns_published")
            .order_by("published_at", direction=gc_firestore.Query.DESCENDING)
            .limit(20)
            .stream()
        )
        if docs:
            items = [d.to_dict() for d in docs]
            return {"history": items, "total": len(items)}
    except Exception as e:
        logger.warning(f"Firestore sns_published read error: {e}")

    return {
        "history": _publish_history[-20:][::-1],
        "total": len(_publish_history),
    }
