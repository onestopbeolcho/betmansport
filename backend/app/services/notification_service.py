"""
FCM Push 알림 발송 서비스
Firestore에 저장된 FCM 토큰으로 Push 알림을 전송합니다.

알림 트리거:
1. 밸류벳 발견 시 → 구독 사용자에게 즉시 알림
2. 오늘의 추천 Pick 발행 시 → 전체 사용자
3. 적중 결과 알림 → 해당 사용자
"""
import logging
from typing import Optional
from app.db.firestore import get_firestore_db, _init_firebase

logger = logging.getLogger(__name__)


class FCMNotificationService:
    """FCM을 통한 Push 알림 발송"""

    # 알림 타입별 아이콘/제목 매핑
    NOTIFICATION_TYPES = {
        "value_bet": {
            "title_ko": "🎯 밸류벳 발견!",
            "title_en": "🎯 Value Bet Found!",
            "pref_key": "valueBetAlert",
        },
        "daily_pick": {
            "title_ko": "⭐ 오늘의 추천 Pick",
            "title_en": "⭐ Today's Pick",
            "pref_key": "dailyPick",
        },
        "odds_change": {
            "title_ko": "📈 배당 급변동!",
            "title_en": "📈 Odds Alert!",
            "pref_key": "oddsChange",
        },
        "result": {
            "title_ko": "🏆 적중 결과",
            "title_en": "🏆 Result Alert",
            "pref_key": "resultAlert",
        },
        "marketing": {
            "title_ko": "📢 Scorenix 소식",
            "title_en": "📢 Scorenix News",
            "pref_key": "marketingAlert",
        },
    }

    def _get_messaging(self):
        """Firebase Messaging 인스턴스 (지연 로딩)"""
        _init_firebase()
        from firebase_admin import messaging
        return messaging

    async def get_user_tokens(self, user_id: str) -> list[str]:
        """특정 사용자의 활성 FCM 토큰 조회"""
        try:
            db = get_firestore_db()
            doc = db.collection("fcm_tokens").document(user_id).get()
            if doc.exists:
                data = doc.to_dict()
                if data.get("active", False):
                    return [data["token"]]
            return []
        except Exception as e:
            logger.error(f"FCM 토큰 조회 실패 (user={user_id}): {e}")
            return []

    async def get_all_active_tokens(self) -> list[dict]:
        """모든 활성 사용자의 FCM 토큰 조회"""
        try:
            db = get_firestore_db()
            docs = db.collection("fcm_tokens").where("active", "==", True).stream()
            return [{"user_id": d.id, "token": d.to_dict()["token"]} for d in docs]
        except Exception as e:
            logger.error(f"전체 FCM 토큰 조회 실패: {e}")
            return []

    async def check_user_preference(self, user_id: str, pref_key: str) -> bool:
        """사용자의 알림 설정 확인"""
        try:
            db = get_firestore_db()
            doc = db.collection("notification_prefs").document(user_id).get()
            if doc.exists:
                return doc.to_dict().get(pref_key, True)  # 기본값: True
            return True  # 설정 없으면 기본 허용
        except Exception:
            return True

    async def send_to_user(
        self,
        user_id: str,
        notification_type: str,
        body: str,
        data: Optional[dict] = None,
        lang: str = "ko",
    ) -> bool:
        """특정 사용자에게 Push 알림 전송"""
        messaging = self._get_messaging()
        notif_config = self.NOTIFICATION_TYPES.get(notification_type, {})

        # 1. 사용자 알림 설정 확인
        pref_key = notif_config.get("pref_key", "")
        if pref_key:
            allowed = await self.check_user_preference(user_id, pref_key)
            if not allowed:
                logger.info(f"알림 비활성화됨 (user={user_id}, type={notification_type})")
                return False

        # 2. FCM 토큰 조회
        tokens = await self.get_user_tokens(user_id)
        if not tokens:
            logger.warning(f"FCM 토큰 없음 (user={user_id})")
            return False

        # 3. 제목 결정
        title_key = f"title_{lang}" if f"title_{lang}" in notif_config else "title_ko"
        title = notif_config.get(title_key, "Scorenix")

        # 4. 알림 전송
        for token in tokens:
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body,
                    ),
                    data={
                        "type": notification_type,
                        "url": data.get("url", "/") if data else "/",
                        **(data or {}),
                    },
                    webpush=messaging.WebpushConfig(
                        notification=messaging.WebpushNotification(
                            icon="/icons/icon-192.png",
                            badge="/icons/badge-72.png",
                            tag=f"scorenix-{notification_type}",
                            renotify=True,
                        ),
                        fcm_options=messaging.WebpushFCMOptions(
                            link=data.get("url", "/") if data else "/",
                        ),
                    ),
                    token=token,
                )
                response = messaging.send(message)
                logger.info(f"✅ FCM 전송 성공 (user={user_id}): {response}")
                return True
            except messaging.UnregisteredError:
                # 토큰 만료 → 비활성화
                logger.warning(f"FCM 토큰 만료 (user={user_id}), 비활성화 처리")
                await self._deactivate_token(user_id)
                return False
            except Exception as e:
                logger.error(f"❌ FCM 전송 실패 (user={user_id}): {e}")
                return False
        return False

    async def send_to_all(
        self,
        notification_type: str,
        body: str,
        data: Optional[dict] = None,
        lang: str = "ko",
    ) -> dict:
        """모든 활성 사용자에게 Push 알림 전송"""
        messaging = self._get_messaging()
        notif_config = self.NOTIFICATION_TYPES.get(notification_type, {})
        title_key = f"title_{lang}" if f"title_{lang}" in notif_config else "title_ko"
        title = notif_config.get(title_key, "Scorenix")

        # 전체 활성 토큰 조회
        token_entries = await self.get_all_active_tokens()
        if not token_entries:
            return {"sent": 0, "failed": 0, "skipped": 0}

        # 알림 설정 확인 후 필터링
        pref_key = notif_config.get("pref_key", "")
        filtered = []
        skipped = 0
        for entry in token_entries:
            if pref_key:
                allowed = await self.check_user_preference(entry["user_id"], pref_key)
                if not allowed:
                    skipped += 1
                    continue
            filtered.append(entry)

        if not filtered:
            return {"sent": 0, "failed": 0, "skipped": skipped}

        # 멀티캐스트 전송 (최대 500개씩)
        sent = 0
        failed = 0
        for i in range(0, len(filtered), 500):
            batch_tokens = [e["token"] for e in filtered[i:i+500]]
            try:
                message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=title,
                        body=body,
                    ),
                    data={
                        "type": notification_type,
                        "url": data.get("url", "/") if data else "/",
                        **(data or {}),
                    },
                    webpush=messaging.WebpushConfig(
                        notification=messaging.WebpushNotification(
                            icon="/icons/icon-192.png",
                            badge="/icons/badge-72.png",
                            tag=f"scorenix-{notification_type}",
                        ),
                    ),
                    tokens=batch_tokens,
                )
                response = messaging.send_each_for_multicast(message)
                sent += response.success_count
                failed += response.failure_count
                logger.info(f"📤 FCM 멀티캐스트: {response.success_count} 성공, {response.failure_count} 실패")
            except Exception as e:
                logger.error(f"❌ FCM 멀티캐스트 실패: {e}")
                failed += len(batch_tokens)

        return {"sent": sent, "failed": failed, "skipped": skipped}

    async def send_value_bet_alert(
        self,
        match_name: str,
        efficiency: float,
        bet_type: str,
        url: str = "/bets/view",
    ) -> dict:
        """밸류벳 발견 시 전체 구독자에게 알림"""
        body_ko = f"{match_name} — {bet_type} 배당효율 {efficiency:.1f}%"
        return await self.send_to_all(
            notification_type="value_bet",
            body=body_ko,
            data={"url": url, "match": match_name, "efficiency": str(efficiency)},
        )

    async def send_daily_pick_alert(self, pick_count: int) -> dict:
        """오늘의 추천 Pick 발행 알림"""
        body = f"오늘의 추천 {pick_count}경기가 발행되었습니다. 지금 확인하세요!"
        return await self.send_to_all(
            notification_type="daily_pick",
            body=body,
            data={"url": "/bets/view"},
        )

    async def send_result_alert(
        self,
        user_id: str,
        match_name: str,
        is_win: bool,
        profit: float,
    ) -> bool:
        """적중 결과 알림 (개인)"""
        if is_win:
            body = f"🎉 {match_name} 적중! +{profit:,.0f}원 수익"
        else:
            body = f"💪 {match_name} 미적중. 다음 기회를 노려보세요!"
        return await self.send_to_user(
            user_id=user_id,
            notification_type="result",
            body=body,
            data={"url": "/mypage"},
        )

    async def _deactivate_token(self, user_id: str):
        """만료된 FCM 토큰 비활성화"""
        try:
            db = get_firestore_db()
            db.collection("fcm_tokens").document(user_id).update({"active": False})
        except Exception as e:
            logger.error(f"토큰 비활성화 실패: {e}")


# 싱글턴 인스턴스
notification_service = FCMNotificationService()
