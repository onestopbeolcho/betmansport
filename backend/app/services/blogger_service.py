import httpx
import logging
from typing import Optional, List
from app.models.config import config

logger = logging.getLogger(__name__)

class BloggerService:
    def __init__(self):
        self.client_id = config.blogger_client_id
        self.client_secret = config.blogger_client_secret
        self.refresh_token = config.blogger_refresh_token
        self.blog_id = config.blogger_blog_id
        self.access_token = None

    async def _refresh_access_token(self) -> bool:
        """
        Refresh the Google OAuth 2.0 access token using the stored refresh token.
        """
        if not self.client_id or not self.client_secret or not self.refresh_token:
            logger.error("Blogger credentials not fully configured.")
            return False

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": self.refresh_token,
                        "grant_type": "refresh_token"
                    },
                    timeout=10.0
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    self.access_token = data.get("access_token")
                    logger.info("Successfully refreshed Blogger access token.")
                    return True
                else:
                    logger.error(f"Failed to refresh token: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Exception refreshing token: {e}")
            return False

    async def publish_post(self, title: str, content: str, labels: List[str] = None) -> Optional[dict]:
        """
        Publish an HTML post to Google Blogger.
        """
        if not self.blog_id:
            logger.error("Blogger Blog ID is not configured.")
            return None

        # Always refresh the token before posting to avoid expiration
        success = await self._refresh_access_token()
        if not success or not self.access_token:
            return None

        # Default tags if none provided
        labels = labels or ["축구데이터", "AI매치분석", "스코어닉스"]
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"https://www.googleapis.com/blogger/v3/blogs/{self.blog_id}/posts/",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "kind": "blogger#post",
                        "title": title,
                        "content": content,
                        "labels": labels
                    },
                    timeout=20.0
                )
                
                if resp.status_code in [200, 201]:
                    data = resp.json()
                    logger.info(f"Successfully published post to Blogger: {data.get('url')}")
                    return data
                else:
                    logger.error(f"Failed to publish post: {resp.text}")
                    return None
        except Exception as e:
            logger.error(f"Exception posting to blogger: {e}")
            return None

blogger_service = BloggerService()
