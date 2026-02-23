import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app } from './firebase';

// VAPID Key — 웹 Push에 필요한 키 (Firebase Console → Cloud Messaging → Web Push certificates)
// 이 키는 Firebase Console에서 생성해야 합니다
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '';

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

/**
 * FCM 지원 여부 확인
 */
export async function isFCMSupported(): Promise<boolean> {
    try {
        return await isSupported();
    } catch {
        return false;
    }
}

/**
 * FCM Messaging 인스턴스 가져오기
 */
async function getMessagingInstance() {
    if (messagingInstance) return messagingInstance;
    const supported = await isFCMSupported();
    if (!supported) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
}

/**
 * 알림 권한 요청 + FCM 토큰 발급
 */
export async function requestNotificationPermission(): Promise<string | null> {
    try {
        // 1. 브라우저 지원 확인
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return null;
        }

        // 2. 권한 요청
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission denied');
            return null;
        }

        // 3. Service Worker 등록
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);

        // 4. FCM 토큰 발급
        const messaging = await getMessagingInstance();
        if (!messaging) return null;

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        console.log('FCM Token:', token);
        return token;
    } catch (error) {
        console.error('Failed to get FCM token:', error);
        return null;
    }
}

/**
 * FCM 토큰을 Firestore에 저장 (사용자별)
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
    try {
        const db = getFirestore(app);
        await setDoc(doc(db, 'fcm_tokens', userId), {
            token,
            userId,
            platform: 'web',
            userAgent: navigator.userAgent,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            active: true,
        }, { merge: true });
        console.log('FCM token saved for user:', userId);
    } catch (error) {
        console.error('Failed to save FCM token:', error);
    }
}

/**
 * 알림 설정 저장 (사용자 선호)
 */
export interface NotificationPreferences {
    valueBetAlert: boolean;     // 밸류벳 발견 알림
    dailyPick: boolean;         // 오늘의 추천 알림
    oddsChange: boolean;        // 배당 급변동 알림
    resultAlert: boolean;       // 적중 결과 알림
    marketingAlert: boolean;    // 마케팅 알림
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
    valueBetAlert: true,
    dailyPick: true,
    oddsChange: false,
    resultAlert: true,
    marketingAlert: false,
};

export async function saveNotificationPreferences(
    userId: string,
    prefs: NotificationPreferences
): Promise<void> {
    try {
        const db = getFirestore(app);
        await setDoc(doc(db, 'notification_prefs', userId), {
            ...prefs,
            userId,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    } catch (error) {
        console.error('Failed to save notification preferences:', error);
    }
}

/**
 * 포그라운드 메시지 수신 리스너
 */
export async function onForegroundMessage(
    callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): Promise<(() => void) | null> {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Foreground] Message received:', payload);
        callback({
            title: payload.notification?.title || 'Scorenix',
            body: payload.notification?.body || '',
            data: payload.data,
        });
    });

    return unsubscribe;
}
