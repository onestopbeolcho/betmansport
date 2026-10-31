from fastapi import APIRouter, HTTPException
import logging
from datetime import datetime, timezone

from app.services.gemini_service import generate_blogger_content
from app.services.blogger_service import blogger_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/post")
async def trigger_daily_blogger_post():
    """
    Trigger generation of Blogger SEO post based on active Betman official round matches.
    Can be called manually or from Cloud Scheduler.
    Runs synchronously to prevent Cloud Run sleep.
    """
    if not blogger_service.blog_id:
        raise HTTPException(status_code=500, detail="Blogger Blog ID is not configured.")

    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        matches = []
        # 1순위: 베트맨 공식 발매 회차 경기 로드
        try:
            from app.services.proto_round_service import get_betman_marketing_matches
            matches = await get_betman_marketing_matches(limit=8)
            if matches:
                logger.info(f"✅ Loaded {len(matches)} official Betman matches for Blogger")
        except Exception as e_bet:
            logger.warning(f"Betman matches load warning for Blogger: {e_bet}")

        # 2순위: 폴백
        if not matches:
            doc = db.collection("daily_portfolios").document(today_str).get()
            if not doc.exists:
                logger.warning(f"No daily_portfolios found for {today_str}. Fetching from pinnacle")
                from app.services.pinnacle_api import pinnacle_service
                raw_matches = await pinnacle_service.fetch_odds()
                matches = [m.model_dump() if hasattr(m, 'model_dump') else m.__dict__ for m in raw_matches]
            else:
                data = doc.to_dict()
                matches = data.get("matches", [])

        if not matches:
            logger.warning("No matches found to post on Blogger.")
            return {"status": "error", "message": "No matches found"}

        from app.services.team_mapper import TeamMapper
        mapper = TeamMapper()
        for m in matches:
            th = m.get("team_home") or ""
            ta = m.get("team_away") or ""
            if not m.get("team_home_ko") or m.get("team_home_ko") == th:
                m["team_home_ko"] = mapper.get_korean_name(th) or th
            if not m.get("team_away_ko") or m.get("team_away_ko") == ta:
                m["team_away_ko"] = mapper.get_korean_name(ta) or ta

        valid = [m for m in matches if m.get("team_home") and m.get("team_away")]
        valid.sort(key=lambda x: float(x.get("confidence", 0) or 0), reverse=True)

        from firebase_admin import firestore
        import asyncio
        import re
        published_count = 0
        skipped_count = 0
        max_per_run = 2  # 하루 2건 고신뢰 베트맨 경기 집중 발행
        urls = []

        for match in valid:
            if published_count >= max_per_run:
                break
            match_id = match.get("match_id")
            if not match_id:
                t_home = match.get("team_home") or "home"
                t_away = match.get("team_away") or "away"
                match_id = f"{t_home}_{t_away}"

            match_time = match.get("match_time") or today_str
            if "T" in match_time:
                date_param = match_time.split("T")[0]
            elif " " in match_time:
                date_param = match_time.split(" ")[0]
            else:
                date_param = match_time

            safe_date = re.sub(r'[^a-zA-Z0-9_-]', '-', str(date_param))
            safe_match_id = re.sub(r'[/\\]', '_', str(match_id))
            pub_doc_id = f"{safe_date}_{safe_match_id}"
            legacy_doc_id = f"{today_str}_{safe_match_id}"
            pub_doc_ref = db.collection("blogger_published").document(pub_doc_id)
            if pub_doc_ref.get().exists or db.collection("blogger_published").document(legacy_doc_id).get().exists:
                logger.info(f"Match {match_id} ({date_param}) already published on Blogger. Skipping to prevent duplicate.")
                skipped_count += 1
                continue

            def to_en_slug(name: str) -> str:
                if not name:
                    return "team"
                name = re.sub(r'[^a-zA-Z0-9\s-]', '', name.lower().strip())
                name = re.sub(r'[\s]+', '-', name)
                return name.strip('-') or "team"

            t_home_en = match.get("team_home") or "home"
            t_away_en = match.get("team_away") or "away"
            t_home_ko = match.get("team_home_ko") or t_home_en
            t_away_ko = match.get("team_away_ko") or t_away_en
            slug = f"{to_en_slug(t_home_en)}-vs-{to_en_slug(t_away_en)}"
            url_path = f"{safe_date}/{slug}"

            if published_count > 0:
                await asyncio.sleep(2.5)
            logger.info(f"Generating Blogger content for match: {slug}")
            content_res = await generate_blogger_content(match, url_path)
            if not content_res:
                logger.error(f"Failed to generate HTML content from Gemini for {slug}")
                continue

            round_title = match.get("round_title", "축구토토 승무패 · 프로토 승부식")
            game_no_label = match.get("game_no_label", "핵심매치")
            seo_title = f"[{round_title} · {game_no_label}] {t_home_ko} vs {t_away_ko} AI 1·2순위 밸런스 및 승률 예측"
            content_res["title"] = seo_title

            logger.info(f"Publishing {seo_title} to Blogger...")
            res = await blogger_service.publish_post(
                title=content_res["title"],
                content=content_res["html"]
            )

            if res:
                published_url = res.get("url", "")
                logger.info(f"Successfully posted to blogger. URL: {published_url}")
                pub_doc_ref.set({
                    "match_id": match_id,
                    "match_date": date_param,
                    "published_at": firestore.SERVER_TIMESTAMP,
                    "url": published_url,
                    "title": seo_title
                })
                published_count += 1
                urls.append(published_url)
            else:
                logger.error(f"Blogger API failed for {seo_title}")

        return {
            "status": "success",
            "total_matches": len(valid),
            "published": published_count,
            "skipped": skipped_count,
            "urls": urls
        }

    except Exception as e:
        logger.error(f"Blogger pipeline error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
