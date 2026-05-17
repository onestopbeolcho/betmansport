import httpx
import logging
from typing import Optional, List
import os

logger = logging.getLogger(__name__)

class WordPressService:
    def __init__(self):
        # Configuration is loaded dynamically via os.getenv from Firestore
        self.wp_url = os.getenv("WORDPRESS_URL", "")
        self.wp_username = os.getenv("WORDPRESS_USERNAME", "")
        self.wp_app_password = os.getenv("WORDPRESS_APP_PASSWORD", "")

    async def publish_post(
        self, 
        title: str, 
        content: str, 
        categories: Optional[List[int]] = None, 
        tags: Optional[List[int]] = None, 
        status: str = "publish"
    ) -> Optional[dict]:
        """
        Publish a post to WordPress using REST API with Application Password (Basic Auth).
        
        Args:
            title: The title of the post.
            content: HTML content of the post.
            categories: List of category IDs (integers).
            tags: List of tag IDs (integers).
            status: Post status, defaults to "publish" (others: "draft", "pending", "private").
            
        Returns:
            The created post data as a dictionary if successful, None otherwise.
        """
        url = self.wp_url or os.getenv("WORDPRESS_URL", "")
        username = self.wp_username or os.getenv("WORDPRESS_USERNAME", "")
        app_password = self.wp_app_password or os.getenv("WORDPRESS_APP_PASSWORD", "")

        if not url or not username or not app_password:
            logger.error("WordPress connection details (URL, Username, App Password) are not configured.")
            return None

        # Clean URL
        url = url.rstrip('/')
        api_endpoint = f"{url}/wp-json/wp/v2/posts"

        # Prepare payload
        payload = {
            "title": title,
            "content": content,
            "status": status,
        }

        if categories:
            payload["categories"] = categories
        if tags:
            payload["tags"] = tags

        try:
            # Basic Authentication with application password (username and app password)
            # httpx supports Basic Auth via the 'auth' parameter
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    api_endpoint,
                    auth=(username, app_password),
                    json=payload,
                    timeout=20.0
                )

                if resp.status_code in [200, 201]:
                    data = resp.json()
                    logger.info(f"✅ Successfully published post to WordPress: {data.get('link')}")
                    return data
                else:
                    logger.error(
                        f"❌ Failed to publish WordPress post. Status={resp.status_code}, Response={resp.text}"
                    )
                    return None
        except Exception as e:
            logger.error(f"⚠️ Exception occurred while posting to WordPress: {e}")
            return None

wordpress_service = WordPressService()
