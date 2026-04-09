"""
Buffer API Service — SNS 마케팅 콘텐츠 자동 발행
- Buffer REST API v1 (실제 발행)
- Buffer GraphQL API (채널 조회)
- Facebook, Instagram 동시 발행
- 예약 발행 지원
"""
import logging
import os
from typing import Optional, List, Dict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BUFFER_GRAPHQL_URL = "https://api.buffer.com"
BUFFER_REST_URL = "https://api.bufferapp.com/1"


class BufferService:
    def __init__(self):
        self.access_token = os.getenv("BUFFER_ACCESS_TOKEN", "")
        self._channels_cache: List[Dict] = []
        self._org_id: Optional[str] = None
        self._cache_time: Optional[datetime] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token)

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def _graphql(self, query: str, variables: Optional[Dict] = None) -> Dict:
        """Execute a GraphQL query/mutation against Buffer API"""
        import httpx
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                BUFFER_GRAPHQL_URL,
                headers=self._headers(),
                json=payload,
            )
            if res.status_code == 200:
                return res.json()
            else:
                logger.error(f"Buffer GraphQL error: {res.status_code} {res.text[:300]}")
                return {"errors": [{"message": f"HTTP {res.status_code}"}]}

    async def get_channels(self, force_refresh: bool = False) -> List[Dict]:
        """연결된 SNS 채널 목록 조회 (GraphQL)"""
        if not self.is_configured:
            logger.warning("BUFFER_ACCESS_TOKEN not configured")
            return []

        # Cache for 1 hour
        if (not force_refresh and self._channels_cache and self._cache_time and
                (datetime.now(timezone.utc) - self._cache_time).seconds < 3600):
            return self._channels_cache

        query = """
        query GetChannels {
            account {
                id
                organizations {
                    id
                    name
                    channels {
                        id
                        name
                        service
                        avatar
                    }
                }
            }
        }
        """
        try:
            result = await self._graphql(query)
            data = result.get("data", {})
            account = data.get("account", {})
            orgs = account.get("organizations", [])

            channels = []
            for org in orgs:
                self._org_id = org.get("id")
                for ch in org.get("channels", []):
                    channels.append({
                        "id": ch.get("id"),
                        "name": ch.get("name", ""),
                        "service": ch.get("service", ""),
                        "avatar": ch.get("avatar", ""),
                        "disabled": False,
                        "org_id": self._org_id,
                    })

            self._channels_cache = channels
            self._cache_time = datetime.now(timezone.utc)
            logger.info(f"✅ Buffer channels loaded: {len(channels)} channels")
            return channels

        except Exception as e:
            logger.error(f"Buffer channels error: {e}")
            return []

    async def publish_post(
        self,
        text: str,
        channel_ids: Optional[List[str]] = None,
        scheduled_at: Optional[str] = None,
        image_url: Optional[str] = None,
        now: bool = True,
    ) -> Dict:
        """
        Buffer GraphQL createPost mutation으로 SNS 채널에 실제 발행.
        채널별로 개별 게시물 생성.
        """
        if not self.is_configured:
            return {"success": False, "error": "BUFFER_ACCESS_TOKEN not configured"}

        # 채널 ID가 없으면 전체 활성 채널
        if not channel_ids:
            channels = await self.get_channels()
            channel_ids = [c["id"] for c in channels if not c.get("disabled")]
            if not channel_ids:
                return {"success": False, "error": "No active Buffer channels found"}

        # createPost mutation
        mutation = """
        mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
                ... on PostActionSuccess {
                    post {
                        id
                        text
                        status
                    }
                }
                ... on MutationError {
                    message
                }
            }
        }
        """

        results = []
        errors = []

        # 채널 서비스 타입 조회 (인스타그램 이미지 필수 체크용)
        channels_info = await self.get_channels()
        channel_services = {c["id"]: c.get("service", "") for c in channels_info}

        for ch_id in channel_ids:
            service = channel_services.get(ch_id, "").lower()

            # 인스타그램은 이미지 필수
            if service == "instagram" and not image_url:
                logger.warning(f"⚠️ Skipping Instagram channel {ch_id}: image required")
                errors.append({"channel_id": ch_id, "error": "Instagram requires an image"})
                continue

            # schedulingType + mode + metadata 모두 필수
            # mode: shareNow(즉시) | addToQueue(큐) | customScheduled(예약)
            share_mode = "customScheduled" if scheduled_at else "shareNow"

            post_input: Dict = {
                "text": text,
                "channelId": ch_id,
                "schedulingType": "automatic",
                "mode": share_mode,
            }

            # 채널별 metadata (type 필수)
            if service == "facebook":
                post_input["metadata"] = {"facebook": {"type": "post"}}
            elif service == "instagram":
                post_input["metadata"] = {"instagram": {"type": "post", "shouldShareToFeed": True}}

            # 예약 발행 시간
            if scheduled_at:
                post_input["dueAt"] = scheduled_at

            # 이미지 첨부
            if image_url:
                post_input["assets"] = {"images": [{"url": image_url}]}
                logger.info(f"📸 Attaching image to channel {ch_id}: {image_url[:80]}...")

            variables = {"input": post_input}

            try:
                result = await self._graphql(mutation, variables)
                logger.info(f"createPost result for {ch_id}: {str(result)[:500]}")

                if "errors" in result and result["errors"]:
                    error_msg = result["errors"][0].get("message", "Unknown error")
                    logger.error(f"Buffer publish error (ch={ch_id}): {error_msg}")
                    errors.append({"channel_id": ch_id, "error": error_msg})
                    continue

                data = result.get("data", {}).get("createPost", {})

                # MutationError 체크
                if "message" in data:
                    logger.error(f"Buffer mutation error (ch={ch_id}): {data['message']}")
                    errors.append({"channel_id": ch_id, "error": data["message"]})
                    continue

                post = data.get("post", {})
                post_id = post.get("id", "")
                logger.info(f"✅ Published to channel {ch_id}: post_id={post_id}")
                results.append({
                    "channel_id": ch_id,
                    "post_id": post_id,
                    "status": post.get("status", ""),
                })

            except Exception as e:
                logger.error(f"Buffer publish error (ch={ch_id}): {e}")
                errors.append({"channel_id": ch_id, "error": str(e)})

        if results:
            return {
                "success": True,
                "published": len(results),
                "posts": results,
                "errors": errors if errors else None,
            }
        else:
            return {
                "success": False,
                "error": "Failed to publish to all channels",
                "details": errors,
            }

    async def get_recent_posts(self, limit: int = 10) -> List[Dict]:
        """최근 생성된 게시물 목록 (GraphQL Ideas)"""
        if not self.is_configured or not self._org_id:
            await self.get_channels()
            if not self._org_id:
                return []

        query = """
        query GetIdeas($orgId: String!, $limit: Int) {
            ideas(organizationId: $orgId, first: $limit) {
                edges {
                    node {
                        id
                        content {
                            title
                            text
                        }
                        createdAt
                    }
                }
            }
        }
        """
        try:
            result = await self._graphql(query, {
                "orgId": self._org_id,
                "limit": limit,
            })
            edges = result.get("data", {}).get("ideas", {}).get("edges", [])
            return [
                {
                    "id": e["node"]["id"],
                    "text": e["node"]["content"].get("text", "")[:100],
                    "created_at": e["node"].get("createdAt", ""),
                }
                for e in edges
            ]
        except Exception as e:
            logger.error(f"Buffer ideas error: {e}")
            return []


# Global instance
buffer_service = BufferService()
