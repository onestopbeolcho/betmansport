"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    requestNotificationPermission,
    saveFCMToken,
    onForegroundMessage,
    isFCMSupported,
} from '../../lib/fcm';

interface ToastNotification {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    url?: string;
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [notifications, setNotifications] = useState<ToastNotification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showToast, setShowToast] = useState<ToastNotification | null>(null);
    const [supported, setSupported] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const unreadCount = notifications.length;

    // Check FCM support
    useEffect(() => {
        isFCMSupported().then(setSupported);
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    // Listen for foreground messages
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        if (permission === 'granted' && supported) {
            onForegroundMessage((payload) => {
                const notif: ToastNotification = {
                    id: Date.now().toString(),
                    title: payload.title,
                    body: payload.body,
                    timestamp: Date.now(),
                    url: payload.data?.url,
                };
                setNotifications((prev) => [notif, ...prev].slice(0, 20));
                setShowToast(notif);

                // Auto-hide toast after 5 seconds
                setTimeout(() => setShowToast(null), 5000);
            }).then((unsub) => {
                unsubscribe = unsub;
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [permission, supported]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEnableNotifications = useCallback(async () => {
        if (!supported) return;
        setLoading(true);
        try {
            const token = await requestNotificationPermission();
            if (token) {
                setPermission('granted');
                if (user) {
                    await saveFCMToken(user.id, token);
                }
            } else {
                setPermission(Notification.permission);
            }
        } catch (err) {
            console.error('Failed to enable notifications:', err);
        }
        setLoading(false);
    }, [supported, user]);

    const clearNotifications = () => {
        setNotifications([]);
        setShowDropdown(false);
    };

    const formatTime = (ts: number) => {
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return '방금';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return `${Math.floor(diff / 86400)}일 전`;
    };

    if (!supported) return null;

    return (
        <>
            {/* Notification Bell Button */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => {
                        if (permission !== 'granted') {
                            handleEnableNotifications();
                        } else {
                            setShowDropdown(!showDropdown);
                        }
                    }}
                    disabled={loading}
                    className="relative p-2 rounded-lg transition-all duration-200 hover:bg-white/5"
                    style={{ color: 'var(--text-secondary)' }}
                    title={permission === 'granted' ? '알림' : '알림 켜기'}
                >
                    {/* Bell Icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>

                    {/* Permission indicator */}
                    {permission !== 'granted' && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                    )}

                    {/* Unread badge */}
                    {permission === 'granted' && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}

                    {/* Loading spinner */}
                    {loading && (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-white/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                        </span>
                    )}
                </button>

                {/* Dropdown */}
                {showDropdown && permission === 'granted' && (
                    <div className="absolute right-0 top-12 w-80 rounded-xl shadow-2xl overflow-hidden z-50 border"
                        style={{
                            background: 'var(--bg-card)',
                            borderColor: 'var(--border-subtle)',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                        }}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>알림</span>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearNotifications}
                                    className="text-xs transition-colors hover:text-white"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    모두 지우기
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="py-10 text-center">
                                    <div className="text-3xl mb-2">🔔</div>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>새로운 알림이 없습니다</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>밸류벳 발견 시 알려드릴게요!</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className="px-4 py-3 border-b transition-colors hover:bg-white/5 cursor-pointer"
                                        style={{ borderColor: 'var(--border-subtle)' }}
                                        onClick={() => {
                                            if (notif.url) window.location.href = notif.url;
                                            setShowDropdown(false);
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))' }}>
                                                🎯
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                                    {notif.body}
                                                </p>
                                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                    {formatTime(notif.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Toast Notification (Foreground) */}
            {showToast && (
                <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
                    <div
                        className="w-80 rounded-xl p-4 shadow-2xl border cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                            background: 'linear-gradient(135deg, rgba(6,6,10,0.98), rgba(20,20,30,0.98))',
                            borderColor: 'var(--accent-primary)',
                            boxShadow: '0 0 30px rgba(0,212,255,0.2)',
                        }}
                        onClick={() => {
                            if (showToast.url) window.location.href = showToast.url;
                            setShowToast(null);
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                                style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}>
                                🎯
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white">{showToast.title}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{showToast.body}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowToast(null); }}
                                className="text-white/40 hover:text-white transition-colors text-lg leading-none"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
