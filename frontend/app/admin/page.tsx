"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface User {
    id: string;
    email?: string;
    full_name?: string;
    role?: string;
    tier?: string;
    subscription_plan?: string;
    subscription_expires_at?: string;
    created_at: string;
}

interface Payment {
    id: string;
    user_id: string;
    plan_id?: string;
    amount?: number;
    currency?: string;
    status: string;
    created_at: string;
    portone_payment_id?: string;
    name?: string;
}

interface AccuracyData {
    total_graded: number;
    hit: number;
    miss: number;
    accuracy_percent: number;
}

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'accuracy' | 'notifications'>('users');
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    // --- Tab 1: Users ---
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // --- Tab 2: Payments ---
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    // --- Tab 3: Accuracy ---
    const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
    const [accuracyLoading, setAccuracyLoading] = useState(false);

    // --- Tab 4: Push Notifications ---
    const [notifType, setNotifType] = useState('daily_pick');
    const [notifBody, setNotifBody] = useState('');
    const [notifSending, setNotifSending] = useState(false);
    const [notifResult, setNotifResult] = useState('');

    const loadUsers = useCallback(() => {
        setUsersLoading(true);
        fetch(`${API}/api/admin/users?limit=100`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        })
            .then(res => res.json())
            .then(data => setUsers(data.users || []))
            .catch(err => console.error(err))
            .finally(() => setUsersLoading(false));
    }, [API]);

    const loadPayments = useCallback(() => {
        setPaymentsLoading(true);
        fetch(`${API}/api/admin/payments?limit=100`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        })
            .then(res => res.json())
            .then(data => setPayments(data.payments || []))
            .catch(err => console.error(err))
            .finally(() => setPaymentsLoading(false));
    }, [API]);

    const loadAccuracy = useCallback(() => {
        setAccuracyLoading(true);
        fetch(`${API}/api/ai/accuracy?days=30`)
            .then(res => res.json())
            .then(data => setAccuracyData(data))
            .catch(err => console.error(err))
            .finally(() => setAccuracyLoading(false));
    }, [API]);

    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            loadUsers();
        } else if (activeTab === 'payments' && payments.length === 0) {
            loadPayments();
        } else if (activeTab === 'accuracy' && !accuracyData) {
            loadAccuracy();
        }
    }, [activeTab, users.length, payments.length, accuracyData, loadUsers, loadPayments, loadAccuracy]);

    const handleTierChange = async (userId: string, newTier: string) => {
        setUpdatingUserId(userId);
        try {
            const res = await fetch(`${API}/api/admin/users/${userId}/tier`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({ tier: newTier, days: 30 }),
            });
            if (res.ok) {
                loadUsers();
            } else {
                alert('회원 등급 변경에 실패했습니다. 관리자 권한을 확인하세요.');
            }
        } catch (e) {
            console.error(e);
            alert('회원 등급 변경 중 오류가 발생했습니다.');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleSendNotification = async () => {
        if (!notifBody.trim()) return;
        setNotifSending(true);
        setNotifResult('');
        try {
            const res = await fetch(`${API}/api/notifications/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                    notification_type: notifType,
                    body: notifBody,
                    url: '/ko/analysis',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNotifResult(`✅ 발송 완료! (전송: ${data.sent || 0}건, 스킵: ${data.skipped || 0}건)`);
                setNotifBody('');
            } else {
                setNotifResult('❌ 발송 실패');
            }
        } catch {
            setNotifResult('❌ 발송 중 오류가 발생했습니다.');
        }
        setNotifSending(false);
    };

    const inputStyle = {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
    };

    const notifTypes = [
        { value: 'daily_pick', label: '⭐ 오늘의 AI 추천 픽 안내' },
        { value: 'value_bet', label: '🎯 고가치(Value) 배당 포착 알림' },
        { value: 'odds_change', label: '📈 급격한 배당 변동 감지' },
        { value: 'result', label: '🏆 경기 적중 결과 알림' },
        { value: 'marketing', label: '📢 공지사항 / 이벤트' },
    ];

    const tabClasses = (tab: string) =>
        `px-5 py-3 text-sm font-bold rounded-t-xl transition-all cursor-pointer ${
            activeTab === tab
                ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-t-2 border-t-[var(--accent-primary)] border-l border-l-[var(--border-subtle)] border-r border-r-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border-b border-b-[var(--border-subtle)]'
        }`;

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--bg-primary)' }}>
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                            <span className="gradient-text">⚙️ Scorenix 관리자 센터</span>
                        </h1>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                            회원 등급 관리 · 결제 내역 확인 · AI 적중률 검증 (마케팅/쇼츠/블로그는 Cloud Scheduler에서 100% 자동 실행 중)
                        </p>
                    </div>
                    <Link href="/ko/analysis" className="text-sm font-bold px-4 py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition" style={{ color: 'var(--accent-primary)' }}>
                        ← 사이트로 돌아가기
                    </Link>
                </div>

                {/* Tabs Header */}
                <div className="flex flex-wrap mb-6 border-b border-[var(--border-subtle)]">
                    <div onClick={() => setActiveTab('users')} className={tabClasses('users')}>👥 회원 관리</div>
                    <div onClick={() => setActiveTab('payments')} className={tabClasses('payments')}>💳 결제 내역</div>
                    <div onClick={() => setActiveTab('accuracy')} className={tabClasses('accuracy')}>🎯 AI 적중률 검증</div>
                    <div onClick={() => setActiveTab('notifications')} className={tabClasses('notifications')}>🔔 푸시 알림</div>
                </div>

                {/* Tab 1: Users */}
                {activeTab === 'users' && (
                    <div className="glass-card p-6 overflow-x-auto">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                    전체 회원 목록 ({users.length}명)
                                </h2>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    회원의 멤버십 등급(FREE / PRO / VIP PREMIUM)을 즉시 변경할 수 있습니다.
                                </p>
                            </div>
                            <button
                                onClick={loadUsers}
                                className="text-xs px-3 py-1.5 rounded-lg font-bold transition hover:opacity-80"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                            >
                                🔄 새로고침
                            </button>
                        </div>

                        {usersLoading ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : users.length === 0 ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>회원 데이터가 없습니다.</div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
                                        <th className="py-3 px-4 font-bold">이메일 / 이름</th>
                                        <th className="py-3 px-4 font-bold">현재 등급</th>
                                        <th className="py-3 px-4 font-bold">만료일</th>
                                        <th className="py-3 px-4 font-bold">가입일</th>
                                        <th className="py-3 px-4 font-bold text-right">등급 변경</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u, i) => {
                                        const currentTier = (u.tier || u.role || 'free').toLowerCase();
                                        const badgeClass =
                                            currentTier === 'premium' || currentTier === 'vip'
                                                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
                                                : currentTier === 'pro'
                                                ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40'
                                                : currentTier === 'admin'
                                                ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40'
                                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
                                        return (
                                            <tr key={u.id || i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition">
                                                <td className="py-3 px-4">
                                                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{u.email || '-'}</div>
                                                    {u.full_name && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.full_name}</div>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${badgeClass}`}>
                                                        {currentTier.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    {formatDate(u.subscription_expires_at)}
                                                </td>
                                                <td className="py-3 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    {formatDate(u.created_at)}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <select
                                                        value={currentTier}
                                                        disabled={updatingUserId === u.id}
                                                        onChange={(e) => handleTierChange(u.id, e.target.value)}
                                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer"
                                                        style={inputStyle}
                                                    >
                                                        <option value="free">FREE (일반)</option>
                                                        <option value="pro">PRO (30일)</option>
                                                        <option value="premium">VIP PREMIUM (30일)</option>
                                                        <option value="admin">ADMIN (관리자)</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Tab 2: Payments */}
                {activeTab === 'payments' && (
                    <div className="glass-card p-6 overflow-x-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                결제 내역 (최근 100건)
                            </h2>
                            <button
                                onClick={loadPayments}
                                className="text-xs px-3 py-1.5 rounded-lg font-bold transition hover:opacity-80"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                            >
                                🔄 새로고침
                            </button>
                        </div>

                        {paymentsLoading ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : payments.length === 0 ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>결제 내역이 없습니다.</div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
                                        <th className="py-3 px-4 font-bold">요금제</th>
                                        <th className="py-3 px-4 font-bold">결제 금액</th>
                                        <th className="py-3 px-4 font-bold">상태</th>
                                        <th className="py-3 px-4 font-bold">결제일시</th>
                                        <th className="py-3 px-4 font-bold text-right">회원 ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p, i) => {
                                        const isPaid = p.status === 'paid' || p.status === 'completed';
                                        return (
                                            <tr key={p.id || i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition">
                                                <td className="py-3 px-4 font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {p.name || (p.plan_id ? p.plan_id.toUpperCase() : '멤버십 구독')}
                                                </td>
                                                <td className="py-3 px-4 font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                    {p.amount?.toLocaleString()} {(p.currency || 'KRW').toUpperCase()}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isPaid ? 'bg-[#4ade80]/20 text-[#4ade80]' : p.status === 'failed' ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                                                        {p.status ? p.status.toUpperCase() : 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    {formatDate(p.created_at)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--text-subtle)' }}>
                                                    {p.user_id}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Tab 3: Accuracy */}
                {activeTab === 'accuracy' && (
                    <div className="glass-card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                AI 예측 적중률 검증 (최근 30일)
                            </h2>
                            <button
                                onClick={async () => {
                                    setAccuracyLoading(true);
                                    try {
                                        const res = await fetch(`${API}/api/ai/grade-predictions`, { method: 'POST' });
                                        const data = await res.json();
                                        alert(`수동 검증 완료: ${data.graded || 0}건 처리됨`);
                                        loadAccuracy();
                                    } catch {
                                        alert('검증 실행 중 오류가 발생했습니다.');
                                        setAccuracyLoading(false);
                                    }
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg font-bold transition bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            >
                                ⚡ 수동 검증(채점) 실행
                            </button>
                        </div>

                        {accuracyLoading ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : !accuracyData ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>데이터가 없습니다.</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                    <div className="text-xs text-[var(--text-secondary)] mb-1">총 정산 경기</div>
                                    <div className="text-xl font-bold">{accuracyData.total_graded}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                    <div className="text-xs text-[var(--text-secondary)] mb-1">적중 (Hit)</div>
                                    <div className="text-xl font-bold text-green-500">{accuracyData.hit}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                    <div className="text-xs text-[var(--text-secondary)] mb-1">미적중 (Miss)</div>
                                    <div className="text-xl font-bold text-red-500">{accuracyData.miss}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                    <div className="text-xs text-[var(--text-secondary)] mb-1">적중률</div>
                                    <div className="text-xl font-bold text-blue-500">{accuracyData.accuracy_percent}%</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: Push Notifications */}
                {activeTab === 'notifications' && (
                    <div className="glass-card p-6 border-l-4 border-l-[#8b5cf6]">
                        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            🔔 전체 회원 웹 푸시 알림 발송
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>알림 유형</label>
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
                                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>알림 메시지 내용</label>
                                <textarea
                                    value={notifBody}
                                    onChange={(e) => setNotifBody(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                                    style={{ ...inputStyle, minHeight: '90px' }}
                                    placeholder="예: 오늘 주말 EPL 빅매치 AI 분석 및 VIP 조합 픽이 업데이트되었습니다!"
                                />
                            </div>
                            {notifResult && (
                                <div
                                    className="p-3 rounded-lg text-sm font-medium"
                                    style={
                                        notifResult.includes('✅')
                                            ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                                            : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }
                                    }
                                >
                                    {notifResult}
                                </div>
                            )}
                            <button
                                onClick={handleSendNotification}
                                disabled={notifSending || !notifBody.trim()}
                                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-50 flex justify-center items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                            >
                                {notifSending ? '발송 중...' : '📤 푸시 알림 발송하기'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
