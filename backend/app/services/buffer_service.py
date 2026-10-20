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
        self._channels_cache: List[Dict] = []
        self._org_id: Optional[str] = None
        self._cache_time: Optional[datetime] = None

    @property
    def access_token(self) -> str:
        return os.getenv("BUFFER_ACCESS_TOKEN", "")

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

        org_query = """
        query GetOrgs {
            account {
                id
                organizations {
                    id
                    name
                }
            }
        }
        """
        ch_query = """
        query GetCh($org: OrganizationId!) {
            channels(input: { organizationId: $org }) {
                id
                name
                service
                avatar
            }
        }
        """
        try:
            result = await self._graphql(org_query)
            if not result:
                return []
            if "errors" in result and result["errors"]:
                logger.error(f"Buffer GraphQL org query errors: {result['errors']}")
            data = result.get("data") or {}
            account = data.get("account") or {}
            orgs = account.get("organizations") or []

            channels = []
            for org in orgs:
                if not org or not org.get("id"):
                    continue
                self._org_id = org.get("id")
                ch_res = await self._graphql(ch_query, {"org": self._org_id})
                ch_list = (ch_res.get("data") or {}).get("channels") or []
                for ch in ch_list:
                    ch_name = ch.get("name", "")
                    ch_service = (ch.get("service") or "").lower()
                    # 페이스북 제외 및 비공식 계정(jisanpan) 제외 — 인스타그램(instagram) 및 스레드(threads) 우선 활성화
                    if ch_service == "facebook" or "jisanpan" in ch_name.lower():
                        is_enabled = False
                    elif ch_service in ("instagram", "threads") or "scorenix" in ch_name.lower():
                        is_enabled = True
                    else:
                        is_enabled = False

                    channels.append({
                        "id": ch.get("id"),
                        "name": ch_name,
                        "service": ch.get("service", ""),
                        "avatar": ch.get("avatar", ""),
                        "disabled": not is_enabled,
                        "org_id": self._org_id,
                    })

            self._channels_cache = channels
            self._cache_time = datetime.now(timezone.utc)
            logger.info(f"✅ Buffer channels loaded: {len(channels)} channels")
            return channels

        except Exception as e:
            logger.error(f"Buffer channels error: {e}")
            return []

    def _compact_for_twitter(self, text: str) -> str:
        """Twitter/X 280자 제한에 맞춰 핵심 요약본 자동 생성"""
        lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
        if not lines:
            return "⚡ Scorenix AI 스포츠 승률 분석 리포트 👉 https://scorenix.com/ko/analysis"
        core = "\n".join(lines[:4])
        if len(core) > 115:
            core = core[:112] + "..."
        if "scorenix.com" not in core:
            core += "\n👉 https://scorenix.com/ko/analysis"
        return core

    def _compact_for_threads(self, text: str) -> str:
        """Threads(스레드) 500자 제한에 맞춰 핵심 분석 + 공식 사이트/유튜브/인스타그램/블로그 상호 링크 보존"""
        cross_footer = (
            "\n\n🔗 공식 채널"
            "\n🌐 AI분석: https://scorenix.com/ko/analysis"
            "\n🎬 유튜브: https://www.youtube.com/@스코어닉스"
            "\n📸 인스타: https://www.instagram.com/scorenix_official/"
            "\n✍️ 블로그: https://official-scorenix.blogspot.com"
        )
        max_body_len = 490 - len(cross_footer)
        clean = (text or "").strip()
        if not clean:
            return "⚡ Scorenix AI 3-Pillar 스포츠 승률 분석 리포트" + cross_footer

        # 기존 본문에 중복된 링크 안내 문구 정리 후 핵심 본문만 추출
        body_lines = []
        for ln in clean.splitlines():
            s = ln.strip()
            if any(k in s for k in ["instagram.com/scorenix", "youtube.com/@", "threads.com/@", "official-scorenix.blogspot", "🔗 공식 채널", "인스타는 프로필 링크"]):
                continue
            if s.startswith("👉") and "scorenix.com" in s:
                continue
            body_lines.append(ln)
        body = "\n".join(body_lines).strip()

        if len(body) > max_body_len:
            body = body[:max_body_len - 3].rsplit("\n", 1)[0].strip() + "..."
        return body + cross_footer

    def _format_for_instagram(self, text: str) -> str:
        """Instagram 캡션용: 공식 사이트 + 유튜브 쇼츠 + 쓰레드 + 구글 블로그 상호 링크 블록 자동 포함"""
        clean = (text or "").strip()
        cross_block = (
            "\n\n━━━━━━━━━━━━━━━━━━\n"
            "🔗 [스코어닉스 공식 채널 네트워크]\n"
            "🌐 일일 무료 AI 샘플 & +EV 밸류 리포트: https://scorenix.com/ko/analysis (프로필 링크 클릭!)\n"
            "☕ Basic Pass (월 3,900원 커피 한 잔 값): https://scorenix.com/ko/pricing\n"
            "🎬 공식 유튜브 쇼츠: https://www.youtube.com/@스코어닉스\n"
            "🧵 공식 쓰레드: https://www.threads.com/@scorenix_official\n"
            "✍️ 공식 구글 블로그: https://official-scorenix.blogspot.com"
        )
        if "youtube.com/@스코어닉스" in clean and "threads.com/@scorenix_official" in clean:
            return clean
        return clean + cross_block

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
        채널별로 개별 게시물 생성 (Instagram, Threads 동시 지원).
        """
        if not self.is_configured:
            return {"success": False, "error": "BUFFER_ACCESS_TOKEN not configured"}

        # 채널 ID가 없으면 전체 활성 채널 (disabled=False인 채널만)
        if not channel_ids:
            channels = await self.get_channels(force_refresh=True)
            channel_ids = [c["id"] for c in channels if not c.get("disabled")]
            if not channel_ids:
                return {"success": False, "error": "No active Buffer channels found (Instagram/Threads)"}

        # createPost mutation
        mutation = """
        mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
                ... on PostActionSuccess {
                    post {
                        id
                        text
                        status
                        externalLink
                        error {
                            message
                        }
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

            share_mode = "customScheduled" if scheduled_at else "shareNow"
            if service == "twitter":
                channel_text = self._compact_for_twitter(text)
            elif service == "threads":
                channel_text = self._compact_for_threads(text)
            elif service == "instagram":
                channel_text = self._format_for_instagram(text)
            else:
                channel_text = text

            post_input: Dict = {
                "text": channel_text,
                "channelId": ch_id,
                "schedulingType": "automatic",
                "mode": share_mode,
                "needsApproval": False,
                "assets": [{"image": {"url": image_url}}] if image_url else [],
            }

            # 채널별 metadata
            if service == "instagram":
                post_input["metadata"] = {"instagram": {"type": "post", "shouldShareToFeed": True}}
            elif service == "threads":
                post_input["metadata"] = {"threads": {"type": "post"}}

            # 예약 발행 시간
            if scheduled_at:
                post_input["dueAt"] = scheduled_at

            if image_url:
                logger.info(f"📸 Attaching image to channel {ch_id} ({service}): {image_url[:80]}...")

            variables = {"input": post_input}

            try:
                result = await self._graphql(mutation, variables)
                logger.info(f"createPost result for {ch_id} ({service}): {str(result)[:500]}")

                if "errors" in result and result["errors"]:
                    error_msg = result["errors"][0].get("message", "Unknown error")
                    logger.error(f"Buffer publish error (ch={ch_id}): {error_msg}")
                    errors.append({"channel_id": ch_id, "service": service, "error": error_msg})
                    continue

                data = (result.get("data") or {}).get("createPost") or {}

                # MutationError 체크
                if "message" in data:
                    logger.error(f"Buffer mutation error (ch={ch_id}): {data['message']}")
                    errors.append({"channel_id": ch_id, "service": service, "error": data["message"]})
                    continue

                post = data.get("post", {})
                post_id = post.get("id", "")
                post_status = post.get("status", "")
                ext_link = post.get("externalLink") or ""
                post_err = (post.get("error") or {}).get("message") if isinstance(post.get("error"), dict) else None
                logger.info(f"✅ Published to channel {ch_id} ({service}): post_id={post_id} status={post_status} link={ext_link}")
                results.append({
                    "channel_id": ch_id,
                    "service": service,
                    "post_id": post_id,
                    "status": post_status,
                    "external_link": ext_link,
                    "error": post_err,
                })

            except Exception as e:
                logger.error(f"Buffer publish error (ch={ch_id}): {e}")
                errors.append({"channel_id": ch_id, "service": service, "error": str(e)})

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
