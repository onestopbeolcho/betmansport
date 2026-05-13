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

        # Select match with highest confidence or fallback to random
        valid_sorted = sorted(valid, key=lambda x: x.get("confidence", 0), reverse=True)
        top_match = valid_sorted[0] if valid_sorted else valid[0]
        
        match_time = top_match.get("match_time") or today_str
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

        t_home = top_match.get("team_home_ko") or top_match.get("team_home")
        t_away = top_match.get("team_away_ko") or top_match.get("team_away")
        slug = f"{to_slug(t_home)}-vs-{to_slug(t_away)}"
        
        url_path = f"{date_param}/{slug}"
        
        # Generate SEO HTML via Gemini
        logger.info(f"Generating Blogger content for match: {slug}")
        content_res = await generate_blogger_content(top_match, url_path)
        
        if not content_res:
            logger.error("Failed to generate HTML content from Gemini")
            return {"status": "error", "message": "Failed to generate Gemini content"}
            
        # Post to blogger
        logger.info("Publishing to Blogger...")
        res = await blogger_service.publish_post(
            title=content_res["title"],
            content=content_res["html"]
        )
        
        if res:
            logger.info(f"Successfully posted to blogger. URL: {res.get('url')}")
            return {"status": "success", "url": res.get("url")}
        else:
            logger.error("Blogger API failed.")
            return {"status": "error", "message": "Blogger API call failed"}

    except Exception as e:
        logger.error(f"Blogger pipeline error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
