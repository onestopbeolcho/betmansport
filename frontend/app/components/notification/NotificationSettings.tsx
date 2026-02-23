"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    requestNotificationPermission,
    saveFCMToken,
    saveNotificationPreferences,
    isFCMSupported,
    DEFAULT_PREFERENCES,
    type NotificationPreferences,
} from '../../../lib/fcm';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

interface NotificationSettingItemProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    icon: string;
    pro?: boolean;
    tier?: string;
}

function NotificationSettingItem({ label, description, checked, onChange, icon, pro, tier }: NotificationSettingItemProps) {
    const isLocked = pro && tier !== 'pro' && tier !== 'premium';

    return (
        <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{icon}</span>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                        {pro && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,212,255,0.2))', color: 'var(--accent-primary)' }}>
                                PRO
                            </span>
                        )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isLocked ? false : checked}
                    onChange={(e) => !isLocked && onChange(e.target.checked)}
                    disabled={!!isLocked}
                />
                <div className={`w-11 h-6 rounded-full transition-all duration-300 peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)]/20
                    ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    ${checked && !isLocked
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6]'
                        : 'bg-white/10'
                    }`}
                >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 mt-0.5
                        ${checked && !isLocked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                    />
                </div>
            </label>
        </div>
    );
}

export default function NotificationSettings() {
    const { user } = useAuth();
    const [supported, setSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check support & load prefs
    useEffect(() => {
        isFCMSupported().then(setSupported);
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const loadPrefs = async () => {
            try {
                const db = getFirestore(app);
                const snap = await getDoc(doc(db, 'notification_prefs', user.id));
                if (snap.exists()) {
                    const data = snap.data() as NotificationPreferences;
                    setPrefs({ ...DEFAULT_PREFERENCES, ...data });
                }
            } catch (err) {
                console.error('Failed to load prefs:', err);
            }
            setLoading(false);
        };
        loadPrefs();
    }, [user]);

    const handleEnableNotifications = useCallback(async () => {
        const token = await requestNotificationPermission();
        if (token && user) {
            await saveFCMToken(user.id, token);
            setPermission('granted');
        }
    }, [user]);

    const handleSave = useCallback(async () => {
        if (!user) return;
        setSaving(true);
        try {
            await saveNotificationPreferences(user.id, prefs);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save:', err);
        }
        setSaving(false);
    }, [user, prefs]);

    const updatePref = (key: keyof NotificationPreferences, val: boolean) => {
        setPrefs((prev) => ({ ...prev, [key]: val }));
    };

    if (!user) return null;

    return (
        <div className="card-glass rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                🔔 알림 설정
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                밸류벳 발견 시 실시간 알림을 받으세요
            </p>

            {/* Permission Status */}
            {!supported ? (
                <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm font-medium text-red-400">⚠️ 이 브라우저는 Push 알림을 지원하지 않습니다</p>
                    <p className="text-xs mt-1 text-red-400/60">Chrome, Firefox, Edge 브라우저를 사용해 주세요</p>
                </div>
            ) : permission !== 'granted' ? (
                <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
                                알림이 비활성화 상태입니다
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                알림을 켜면 밸류벳 발견 시 즉시 알려드립니다
                            </p>
                        </div>
                        <button
                            onClick={handleEnableNotifications}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                        >
                            알림 켜기
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl p-3 mb-6 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <span className="text-green-400">✅</span>
                    <p className="text-sm text-green-400 font-medium">알림이 활성화되어 있습니다</p>
                </div>
            )}

            {/* Settings List */}
            {!loading && (
                <div>
                    <NotificationSettingItem
                        icon="🎯"
                        label="밸류벳 발견 알림"
                        description="EV 5% 이상의 가치 베팅이 발견되면 즉시 알림"
                        checked={prefs.valueBetAlert}
                        onChange={(v) => updatePref('valueBetAlert', v)}
                        tier={user.tier}
                    />
                    <NotificationSettingItem
                        icon="⭐"
                        label="오늘의 추천 Pick"
                        description="매일 엄선된 추천 픽이 발행되면 알림"
                        checked={prefs.dailyPick}
                        onChange={(v) => updatePref('dailyPick', v)}
                        tier={user.tier}
                    />
                    <NotificationSettingItem
                        icon="📈"
                        label="배당 급변동 알림"
                        description="관심 경기의 배당이 크게 변동되면 알림"
                        checked={prefs.oddsChange}
                        onChange={(v) => updatePref('oddsChange', v)}
                        pro
                        tier={user.tier}
                    />
                    <NotificationSettingItem
                        icon="🏆"
                        label="적중 결과 알림"
                        description="추천 픽의 경기 결과가 나오면 알림"
                        checked={prefs.resultAlert}
                        onChange={(v) => updatePref('resultAlert', v)}
                        tier={user.tier}
                    />
                    <NotificationSettingItem
                        icon="📢"
                        label="소식 및 업데이트"
                        description="새로운 기능, 이벤트 등 서비스 소식"
                        checked={prefs.marketingAlert}
                        onChange={(v) => updatePref('marketingAlert', v)}
                        tier={user.tier}
                    />
                </div>
            )}

            {/* Save Button */}
            {permission === 'granted' && (
                <div className="mt-6 flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                    >
                        {saving ? '저장 중...' : '설정 저장'}
                    </button>
                    {saved && (
                        <span className="text-sm text-green-400 font-medium animate-fade-up">
                            ✅ 저장 완료!
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
