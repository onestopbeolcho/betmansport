from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging
from datetime import datetime, timezone
import re

from app.services.gemini_service import generate_blogger_content
from app.services.wordpress_service import wordpress_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/post")
async def trigger_daily_wordpress_post():
    """
    Trigger generation of WordPress SEO post. Finds one high-value match and posts it.
    Can be called manually or from Cloud Scheduler.
    Runs synchronously to prevent Cloud Run sleep.
    """
    if not wordpress_service.wp_url or not wordpress_service.wp_username or not wordpress_service.wp_app_password:
        raise HTTPException(
            status_code=500, 
            detail="WordPress connection details (URL, Username, App Password) are not configured."
        )

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
            logger.warning("No matches found to post on WordPress.")
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
        logger.info(f"Generating WordPress content for match: {slug}")
        content_res = await generate_blogger_content(top_match, url_path)
        
        if not content_res:
            logger.error("Failed to generate HTML content from Gemini")
            return {"status": "error", "message": "Failed to generate Gemini content"}
            
        # Post to WordPress
        logger.info("Publishing to WordPress...")
        res = await wordpress_service.publish_post(
            title=content_res["title"],
            content=content_res["html"],
            status="publish"  # Dynamically posts as a live published post
        )
        
        if res:
            logger.info(f"Successfully posted to WordPress. Link: {res.get('link')}")
            return {"status": "success", "link": res.get("link")}
        else:
            logger.error("WordPress REST API posting failed.")
            return {"status": "error", "message": "WordPress API call failed"}

    except Exception as e:
        logger.error(f"WordPress pipeline error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
