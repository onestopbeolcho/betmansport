from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging
from datetime import datetime, timezone
import random

from app.services.gemini_service import generate_blogger_content
from app.services.blogger_service import blogger_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/post")
async def trigger_daily_blogger_post():
    """
    Trigger generation of Blogger SEO post. Finds one high-value match and posts it.
    Can be called manually or from Cloud Scheduler.
    Runs synchronously to prevent Cloud Run sleep.
    """
    if not blogger_service.blog_id:
        raise HTTPException(status_code=500, detail="Blogger Blog ID is not configured.")

    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc = db.collection("daily_portfolios").document(today_str).get()
        
        matches = []
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
            
        # Filter valid matches (e.g. valid names)
        valid = [m for m in matches if m.get("team_home_ko") and m.get("team_away_ko")]
        if not valid:
            valid = matches

        from firebase_admin import firestore
        published_count = 0
        skipped_count = 0
        urls = []

        # Loop through ALL valid matches of today to post each one individually
        for match in valid:
            match_id = match.get("match_id")
            if not match_id:
                t_home = match.get("team_home") or "home"
                t_away = match.get("team_away") or "away"
                match_id = f"{t_home}_{t_away}"

            # Firestore-based duplicate check to ensure 0 duplicates
            pub_doc_id = f"{today_str}_{match_id}"
            pub_doc_ref = db.collection("blogger_published").document(pub_doc_id)
            if pub_doc_ref.get().exists:
                logger.info(f"Match {match_id} already published today on Blogger. Skipping to prevent duplicate.")
                skipped_count += 1
                continue

            match_time = match.get("match_time") or today_str
            if "T" in match_time:
                date_param = match_time.split("T")[0]
            elif " " in match_time:
                date_param = match_time.split(" ")[0]
            else:
                date_param = match_time

            import re
            def to_slug(name: str) -> str:
                if not name:
                    return "unknown"
                name = re.sub(r'[^a-zA-Z0-9가-힣\s-]', '', name)
                name = re.sub(r'[\s]+', '-', name)
                return name.lower()

            t_home_ko = match.get("team_home_ko") or match.get("team_home")
            t_away_ko = match.get("team_away_ko") or match.get("team_away")
            slug = f"{to_slug(t_home_ko)}-vs-{to_slug(t_away_ko)}"
            url_path = f"{date_param}/{slug}"

            # Generate SEO HTML via Gemini
            logger.info(f"Generating Blogger content for match: {slug}")
            content_res = await generate_blogger_content(match, url_path)
            if not content_res:
                logger.error(f"Failed to generate HTML content from Gemini for {slug}")
                continue

            # Format SEO title exactly as requested: [YYYY년 MM월 DD일] 홈팀 vs 원정팀 경기 분석 및 AI 승률 예측
            try:
                date_obj = datetime.strptime(date_param, "%Y-%m-%d")
                formatted_date = f"{date_obj.year}년 {date_obj.month}월 {date_obj.day}일"
            except Exception:
                formatted_date = date_param
            
            seo_title = f"[{formatted_date}] {t_home_ko} vs {t_away_ko} 경기 분석 및 AI 승률 예측"
            
            # Update Gemini response title to our standard format
            content_res["title"] = seo_title

            # Post to blogger
            logger.info(f"Publishing {seo_title} to Blogger...")
            res = await blogger_service.publish_post(
                title=content_res["title"],
                content=content_res["html"]
            )

            if res:
                published_url = res.get("url", "")
                logger.info(f"Successfully posted to blogger. URL: {published_url}")
                # Save to Firestore to prevent future duplicates
                pub_doc_ref.set({
                    "match_id": match_id,
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
