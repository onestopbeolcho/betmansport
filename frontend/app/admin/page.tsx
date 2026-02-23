"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemConfig {
    pinnacle_api_key: string;
    betman_user_agent: string;
    scrape_interval_minutes: number;
}

export default function AdminPage() {
    const [config, setConfig] = useState<SystemConfig>({
        pinnacle_api_key: '',
        betman_user_agent: '',
        scrape_interval_minutes: 10,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Notification state
    const [notifType, setNotifType] = useState('marketing');
    const [notifBody, setNotifBody] = useState('');
    const [notifSending, setNotifSending] = useState(false);
    const [notifResult, setNotifResult] = useState('');

    useEffect(() => {
        fetch('/api/admin/config')
            .then(res => {
                if (!res.ok) throw new Error('Failed to load config');
                return res.json();
            })
            .then(data => setConfig(data))
            .catch(err => console.error("Error loading config:", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: name === 'scrape_interval_minutes' ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!res.ok) throw new Error('Failed to save config');

            setMessage('설정이 성공적으로 저장되었습니다!');
        } catch (err) {
            setMessage('설정 저장에 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (!notifBody.trim()) return;
        setNotifSending(true);
        setNotifResult('');
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API}/api/notifications/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                    notification_type: notifType,
                    body: notifBody,
                    url: '/',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNotifResult(`✅ 발송 완료! (전송: ${data.sent || 0}, 스킵: ${data.skipped || 0})`);
                setNotifBody('');
            } else {
                setNotifResult('❌ 발송 실패');
            }
        } catch (err) {
            setNotifResult('❌ 발송 중 오류 발생');
            console.error(err);
        }
        setNotifSending(false);
    };

    const inputStyle = {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
    };

    const notifTypes = [
        { value: 'value_bet', label: '🎯 밸류벳 발견' },
        { value: 'daily_pick', label: '⭐ 오늘의 추천' },
        { value: 'odds_change', label: '📈 배당 변동' },
        { value: 'result', label: '🏆 적중 결과' },
        { value: 'marketing', label: '📢 소식/이벤트' },
    ];

    return (
        <div className="min-h-screen p-8" style={{ background: 'var(--bg-primary)' }}>
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                        <span className="gradient-text">⚙️ 관리자 설정</span>
                    </h1>
                    <Link href="/" className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
                        ← 홈으로
                    </Link>
                </div>

                <div className="glass-card p-6">
                    {message && (
                        <div className="p-4 mb-4 rounded-xl text-sm font-medium"
                            style={message.includes('성공')
                                ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                            }>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Odds API 키
                            </label>
                            <input
                                type="password"
                                name="pinnacle_api_key"
                                value={config.pinnacle_api_key}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl text-sm transition"
                                style={inputStyle}
                                placeholder="API Key를 입력하세요"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                배트맨 User-Agent (크롤링용)
                            </label>
                            <input
                                type="text"
                                name="betman_user_agent"
                                value={config.betman_user_agent}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl text-sm transition"
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                데이터 수집 주기 (분)
                            </label>
                            <input
                                type="number"
                                name="scrape_interval_minutes"
                                value={config.scrape_interval_minutes}
                                onChange={handleChange}
                                min="1"
                                max="60"
                                className="w-full px-4 py-3 rounded-xl text-sm transition"
                                style={inputStyle}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50"
                        >
                            {loading ? '저장 중...' : '설정 저장'}
                        </button>
                    </form>
                </div>

                {/* 🔔 Push 알림 발송 */}
                <div className="glass-card p-6 mt-6">
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                        🔔 Push 알림 발송
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                알림 유형
                            </label>
                            <select
                                value={notifType}
                                onChange={(e) => setNotifType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm"
                                style={inputStyle}
                            >
                                {notifTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                알림 내용
                            </label>
                            <textarea
                                value={notifBody}
                                onChange={(e) => setNotifBody(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                                style={{ ...inputStyle, minHeight: '80px' }}
                                placeholder="알림 메시지를 입력하세요"
                            />
                        </div>

                        {notifResult && (
                            <div className="p-3 rounded-lg text-sm font-medium"
                                style={notifResult.includes('✅')
                                    ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                                    : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }
                                }>
                                {notifResult}
                            </div>
                        )}

                        <button
                            onClick={handleSendNotification}
                            disabled={notifSending || !notifBody.trim()}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                        >
                            {notifSending ? '발송 중...' : '📤 전체 사용자에게 발송'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
