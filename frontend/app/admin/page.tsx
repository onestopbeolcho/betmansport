"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

interface UserRecord {
    id: string;
    email?: string;
    nickname?: string;
    full_name?: string;
    phone?: string;
    auth_provider?: string;
    role?: string;
    tier?: string;
    subscription_plan?: string;
    subscription_expires_at?: string;
    created_at?: string;
}

interface PaymentRecord {
    id: string;
    user_id: string;
    user_email?: string;
    user_nickname?: string;
    user_phone?: string;
    plan_id?: string;
    amount?: number;
    currency?: string;
    payment_method?: string;
    status: string;
    source?: string;
    created_at?: string;
    portone_payment_id?: string;
    is_duplicate_log?: boolean;
}

interface OverviewSummary {
    total_users: number;
    today_signups: number;
    paid_subscribers: number;
    unique_payments_count: number;
    total_revenue_krw: number;
}

interface AccuracyData {
    total_graded: number;
    hit: number;
    miss: number;
    accuracy_percent: number;
}

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'simulator' | 'accuracy' | 'notifications'>('users');
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const [summary, setSummary] = useState<OverviewSummary>({
        total_users: 0,
        today_signups: 0,
        paid_subscribers: 0,
        unique_payments_count: 0,
        total_revenue_krw: 0,
    });
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [tierFilter, setTierFilter] = useState<'ALL' | 'PAID' | 'FREE'>('ALL');
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // 가상 결제 시뮬레이터 상태
    const [simPlanId, setSimPlanId] = useState<'round_pass' | 'pro' | 'vip'>('round_pass');
    const [simTargetUserId, setSimTargetUserId] = useState<string>('');
    const [simLoading, setSimLoading] = useState(false);
    const [simResult, setSimResult] = useState<string>('');

    // AI 적중률 상태
    const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
    const [accuracyLoading, setAccuracyLoading] = useState(false);

    // 푸시 알림 상태
    const [notifType, setNotifType] = useState('daily_pick');
    const [notifBody, setNotifBody] = useState('');
    const [notifSending, setNotifSending] = useState(false);
    const [notifResult, setNotifResult] = useState('');

    const loadOverview = useCallback(async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
        if (!token) {
            setDataLoading(false);
            return;
        }
        setDataLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch(`${API}/api/admin/overview?limit=250`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSummary(data.summary || {
                    total_users: (data.users || []).length,
                    today_signups: 0,
                    paid_subscribers: 0,
                    unique_payments_count: (data.payments || []).length,
                    total_revenue_krw: 0,
                });
                setUsers(data.users || []);
                setPayments(data.payments || []);
                if (!simTargetUserId && data.users?.length > 0) {
                    setSimTargetUserId(user?.id || data.users[0].id);
                }
            } else {
                // fallback to legacy endpoints if overview isn't deployed yet
                const [uRes, pRes] = await Promise.all([
                    fetch(`${API}/api/admin/users?limit=200`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API}/api/admin/payments?limit=200`, { headers: { 'Authorization': `Bearer ${token}` } }),
                ]);
                if (!uRes.ok) {
                    const errData = await uRes.json().catch(() => ({}));
                    throw new Error(errData.detail || '관리자 권한이 필요합니다.');
                }
                const uData = await uRes.json();
                const pData = pRes.ok ? await pRes.json() : { payments: [] };
                const uList: UserRecord[] = uData.users || [];
                const pList: PaymentRecord[] = pData.payments || [];
                const paidCount = uList.filter((u) => ['pro', 'premium', 'vip'].includes((u.tier || u.role || '').toLowerCase())).length;
                const seenIds = new Set<string>();
                let rev = 0;
                pList.forEach((p) => {
                    const pid = p.portone_payment_id || p.id;
                    if (!seenIds.has(pid) && ['completed', 'paid'].includes((p.status || '').toLowerCase())) {
                        seenIds.add(pid);
                        rev += Number(p.amount || 0);
                    }
                });
                setUsers(uList);
                setPayments(pList);
                setSummary({
                    total_users: uList.length,
                    today_signups: 0,
                    paid_subscribers: paidCount,
                    unique_payments_count: seenIds.size,
                    total_revenue_krw: rev,
                });
            }
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.');
        } finally {
            setDataLoading(false);
        }
    }, [API, simTargetUserId, user?.id]);

    const loadAccuracy = useCallback(() => {
        setAccuracyLoading(true);
        fetch(`${API}/api/ai/accuracy?days=30`)
            .then((res) => res.json())
            .then((data) => setAccuracyData(data))
            .catch(() => {})
            .finally(() => setAccuracyLoading(false));
    }, [API]);

    useEffect(() => {
        if (!authLoading) {
            loadOverview();
        }
    }, [authLoading, loadOverview]);

    useEffect(() => {
        if (activeTab === 'accuracy' && !accuracyData) {
            loadAccuracy();
        }
    }, [activeTab, accuracyData, loadAccuracy]);

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
                await loadOverview();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || '회원 등급 변경에 실패했습니다.');
            }
        } catch {
            alert('회원 등급 변경 중 오류가 발생했습니다.');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleSimulatePayment = async () => {
        setSimLoading(true);
        setSimResult('');
        try {
            const res = await fetch(`${API}/api/admin/simulate-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                    user_id: simTargetUserId || user?.id,
                    plan_id: simPlanId,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || '가상 결제 실행 실패');
            }
            setSimResult(`✅ ${data.message} (결제번호: ${data.payment?.portone_payment_id})`);
            await loadOverview();
        } catch (err: unknown) {
            setSimResult(`❌ ${err instanceof Error ? err.message : '오류가 발생했습니다.'}`);
        } finally {
            setSimLoading(false);
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        try {
            const res = await fetch(`${API}/api/admin/payments/${paymentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
            });
            if (res.ok) {
                await loadOverview();
            }
        } catch {
            // ignore
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

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const filteredUsers = users.filter((u) => {
        const tier = (u.tier || u.role || 'free').toLowerCase();
        if (tierFilter === 'PAID' && !['pro', 'premium', 'vip'].includes(tier)) return false;
        if (tierFilter === 'FREE' && ['pro', 'premium', 'vip'].includes(tier)) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (u.email || '').toLowerCase().includes(q) ||
            (u.nickname || '').toLowerCase().includes(q) ||
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.phone || '').toLowerCase().includes(q)
        );
    });

    const planLabelMap: Record<string, string> = {
        round_pass: '1회차 즉시 열람권 (3,900원)',
        pro: '개인 월 무제한 패스 (29,900원)',
        vip: 'VIP 프로 퀀트 패스 (39,000원)',
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <Navbar />

            <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-grow w-full space-y-5">
                {/* 상단 헤더 */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">
                            ⚙️ SCORENIX 통합 관리자 센터 (모바일/PC 실시간 연동)
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black mt-1.5">
                            실시간 가입 회원 · 결제 매출 · 가상 결제 검증
                        </h1>
                        <p className="text-xs text-slate-300 mt-0.5">
                            스마트폰에서 언제든 신규 가입자, 유료 결제 내역, 수동 등급 변경 및 가상 결제 테스트를 관리하세요.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={loadOverview}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold border border-white/20 cursor-pointer"
                        >
                            🔄 실시간 새로고침
                        </button>
                        <Link
                            href="/ko"
                            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 !text-slate-950 text-xs font-black"
                        >
                            홈으로 →
                        </Link>
                    </div>
                </div>

                {/* 미로그인 또는 권한 안내 */}
                {!authLoading && !user && (
                    <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center space-y-3">
                        <p className="text-base font-black text-slate-900">관리자 계정으로 로그인이 필요합니다.</p>
                        <p className="text-xs text-slate-600">
                            대표님 계정(miso87254591@gmail.com / miso4591@naver.com / 010-8725-4591)으로 로그인하시면 즉시 열립니다.
                        </p>
                        <Link
                            href="/ko/login?redirect=/admin"
                            className="inline-block px-6 py-3 rounded-xl bg-[#0046b8] !text-white text-xs font-black"
                        >
                            관리자 로그인하러 가기 →
                        </Link>
                    </div>
                )}

                {errorMsg && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* 4대 핵심 KPI 요약 카드 (모바일 2x2 격자) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-extrabold text-slate-500">👥 총 가입 회원수</div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                            {summary.total_users.toLocaleString()}명
                        </div>
                        <div className="text-[11px] font-bold text-[#0046b8] mt-1">
                            오늘 신규 +{summary.today_signups}명
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-extrabold text-slate-500">💎 유료 멤버십 회원</div>
                        <div className="text-2xl sm:text-3xl font-black text-[#0046b8] mt-1">
                            {summary.paid_subscribers.toLocaleString()}명
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-1">
                            PRO / VIP 활성 계정
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-extrabold text-slate-500">💳 누적 결제 건수</div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                            {summary.unique_payments_count.toLocaleString()}건
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 mt-1">
                            전체 로그 {payments.length}건
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-extrabold text-slate-500">💰 누적 결제 매출</div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
                            {summary.total_revenue_krw.toLocaleString()}원
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 mt-1">
                            KG이니시스 승인 합계
                        </div>
                    </div>
                </div>

                {/* 모바일 터치 최적화 탭 바 */}
                <div className="flex overflow-x-auto gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs no-scrollbar">
                    {[
                        { id: 'users', label: `👥 가입 회원 (${users.length})` },
                        { id: 'payments', label: `💳 결제 내역 (${payments.length})` },
                        { id: 'simulator', label: '🧪 가상결제 테스트' },
                        { id: 'accuracy', label: '🎯 AI 적중률' },
                        { id: 'notifications', label: '🔔 푸시 발송' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as typeof activeTab)}
                            className={`px-3.5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${
                                activeTab === t.id
                                    ? 'bg-[#0046b8] text-white shadow-xs'
                                    : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── 탭 1: 가입 회원 목록 (모바일 카드 + PC 테이블) ── */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                            <div className="flex items-center gap-1.5">
                                {(['ALL', 'PAID', 'FREE'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setTierFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                                            tierFilter === f
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-white border border-slate-300 text-slate-700'
                                        }`}
                                    >
                                        {f === 'ALL' ? `전체 (${users.length})` : f === 'PAID' ? `유료회원 (${summary.paid_subscribers})` : '무료회원'}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="이메일 / 이름 / 전화번호 검색"
                                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0046b8]"
                            />
                        </div>

                        {dataLoading ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-500">회원 목록을 불러오는 중...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-500">조건에 맞는 회원이 없습니다.</div>
                        ) : (
                            <>
                                {/* 모바일 전용 카드 리스트 (가로 스크롤 제로) */}
                                <div className="md:hidden divide-y divide-slate-200">
                                    {filteredUsers.map((u, idx) => {
                                        const currentTier = (u.tier || u.role || 'free').toLowerCase();
                                        const isPaid = ['pro', 'premium', 'vip'].includes(currentTier);
                                        return (
                                            <div key={u.id || idx} className="p-4 space-y-2.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-black text-slate-900 truncate">
                                                            {u.email || '-'}
                                                        </div>
                                                        <div className="text-xs text-slate-600 font-semibold mt-0.5">
                                                            {u.nickname || u.full_name || '이름 미입력'}
                                                            {u.phone ? ` · 📱 ${u.phone}` : ''}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black ${
                                                            currentTier === 'premium' || currentTier === 'vip'
                                                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                                                : isPaid
                                                                ? 'bg-blue-100 text-[#0046b8] border border-blue-300'
                                                                : u.role === 'admin'
                                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}
                                                    >
                                                        {currentTier.toUpperCase()}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                                                    <span>가입: {formatDate(u.created_at)}</span>
                                                    <span>만료: {formatDate(u.subscription_expires_at)}</span>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 pt-1">
                                                    <span className="text-[11px] font-bold text-slate-600">즉시 등급 변경:</span>
                                                    <select
                                                        value={currentTier}
                                                        disabled={updatingUserId === u.id}
                                                        onChange={(e) => handleTierChange(u.id, e.target.value)}
                                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-slate-900"
                                                    >
                                                        <option value="free">FREE (일반)</option>
                                                        <option value="pro">PRO (30일 무제한)</option>
                                                        <option value="premium">VIP PREMIUM (30일)</option>
                                                        <option value="admin">ADMIN (관리자)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* PC 전용 테이블 */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-extrabold">
                                                <th className="py-3 px-4">이메일 / 닉네임</th>
                                                <th className="py-3 px-4">연락처</th>
                                                <th className="py-3 px-4">현재 등급</th>
                                                <th className="py-3 px-4">구독 만료일</th>
                                                <th className="py-3 px-4">가입일시</th>
                                                <th className="py-3 px-4 text-right">수동 등급 변경</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {filteredUsers.map((u, idx) => {
                                                const currentTier = (u.tier || u.role || 'free').toLowerCase();
                                                const isPaid = ['pro', 'premium', 'vip'].includes(currentTier);
                                                return (
                                                    <tr key={u.id || idx} className="hover:bg-blue-50/40">
                                                        <td className="py-3 px-4">
                                                            <div className="font-black text-slate-900">{u.email || '-'}</div>
                                                            <div className="text-[11px] text-slate-500">{u.nickname || u.full_name || '-'}</div>
                                                        </td>
                                                        <td className="py-3 px-4 font-semibold text-slate-700">
                                                            {u.phone || '-'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span
                                                                className={`px-2.5 py-1 rounded-md text-[11px] font-black ${
                                                                    currentTier === 'premium' || currentTier === 'vip'
                                                                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                                                        : isPaid
                                                                        ? 'bg-blue-100 text-[#0046b8] border border-blue-300'
                                                                        : u.role === 'admin'
                                                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                        : 'bg-slate-100 text-slate-700'
                                                                }`}
                                                            >
                                                                {currentTier.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600">{formatDate(u.subscription_expires_at)}</td>
                                                        <td className="py-3 px-4 text-slate-600">{formatDate(u.created_at)}</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <select
                                                                value={currentTier}
                                                                disabled={updatingUserId === u.id}
                                                                onChange={(e) => handleTierChange(u.id, e.target.value)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-slate-900 cursor-pointer"
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
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── 탭 2: 결제 내역 ── */}
                {activeTab === 'payments' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-sm font-black text-slate-900">전체 결제 내역 ({payments.length}건)</h2>
                                <p className="text-[11px] text-slate-500">포트원(KG이니시스) 실시간 승인 및 가상 결제 검증 내역입니다.</p>
                            </div>
                            <button
                                onClick={() => setActiveTab('simulator')}
                                className="px-3 py-1.5 rounded-lg bg-[#0046b8] text-white text-xs font-extrabold cursor-pointer"
                            >
                                🧪 가상 결제 테스트하기
                            </button>
                        </div>

                        {payments.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-500">결제 내역이 없습니다.</div>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {payments.map((p, idx) => {
                                    const isPaid = ['completed', 'paid'].includes((p.status || '').toLowerCase());
                                    const isSim = (p.portone_payment_id || '').startsWith('SIM_') || p.source === 'admin_simulation';
                                    return (
                                        <div key={p.id || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                            isPaid
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                                                        }`}
                                                    >
                                                        {isPaid ? '결제완료' : p.status}
                                                    </span>
                                                    {isSim && (
                                                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                                                            🧪 가상결제 테스트
                                                        </span>
                                                    )}
                                                    {p.is_duplicate_log && (
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                            웹훅 교차기록
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-black text-slate-900">
                                                        {planLabelMap[p.plan_id || ''] || p.plan_id || '멤버십 결제'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-600 font-semibold">
                                                    구매자: <strong className="text-slate-900">{p.user_email || p.user_id}</strong>
                                                    {p.user_nickname && p.user_nickname !== '-' ? ` (${p.user_nickname})` : ''}
                                                    {p.user_phone && p.user_phone !== '-' ? ` · ${p.user_phone}` : ''}
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    거래번호: {p.portone_payment_id || p.id} · {formatDate(p.created_at)}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3">
                                                <div className="text-base font-black text-[#0046b8]">
                                                    {Number(p.amount || 0).toLocaleString()}원
                                                </div>
                                                {isSim && (
                                                    <button
                                                        onClick={() => handleDeletePayment(p.id)}
                                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer"
                                                    >
                                                        삭제
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── 탭 3: 가상 결제 시뮬레이터 (원클릭 결제 파이프라인 검증) ── */}
                {activeTab === 'simulator' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                        <div>
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0046b8] border border-blue-200 text-[11px] font-black">
                                🧪 원클릭 가상 결제 &amp; 등급 해금 검증기
                            </span>
                            <h2 className="text-lg font-black text-slate-900 mt-2">
                                실제 카드 승인 없이 결제 DB 적재 및 이용권 해금을 즉시 테스트합니다
                            </h2>
                            <p className="text-xs text-slate-600 mt-1">
                                아래에서 대상 회원과 요금제를 선택한 뒤 <strong>[가상 결제 승인 실행]</strong>을 누르면, 실제 결제 완료 시와 동일하게 Firestore <code>payments</code> 컬렉션에 기록되고 회원의 <code>tier</code>가 즉시 승격되어 전 경기 AI 픽 잠금이 해제됩니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                                <label className="text-xs font-extrabold text-slate-700">대상 회원 선택</label>
                                <select
                                    value={simTargetUserId}
                                    onChange={(e) => setSimTargetUserId(e.target.value)}
                                    className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900"
                                >
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.email} ({u.nickname || u.full_name || '이름없음'}) — 현재 {(u.tier || u.role || 'free').toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-extrabold text-slate-700">테스트할 요금제 선택</label>
                                <select
                                    value={simPlanId}
                                    onChange={(e) => setSimPlanId(e.target.value as 'round_pass' | 'pro' | 'vip')}
                                    className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900"
                                >
                                    <option value="round_pass">⚡ 이번 회차 즉시 열람권 (3,900원 / PRO 5일)</option>
                                    <option value="pro">📱 개인 올인원 월 무제한 패스 (29,900원 / PRO 30일)</option>
                                    <option value="vip">👑 VIP 프로 퀀트 패스 (39,000원 / PREMIUM 30일)</option>
                                </select>
                            </div>
                        </div>

                        {simResult && (
                            <div
                                className={`p-3.5 rounded-xl text-xs font-bold border ${
                                    simResult.startsWith('✅')
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                            >
                                {simResult}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                            <button
                                onClick={handleSimulatePayment}
                                disabled={simLoading}
                                className="flex-1 py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white text-sm font-black shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {simLoading ? '가상 결제 처리 중...' : '🧪 가상 결제 승인 실행 (DB 적재 + 등급 즉시 해금)'}
                            </button>
                            <Link
                                href="/ko/payment/request?plan=round_pass&billing=once"
                                className="px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 !text-amber-300 text-sm font-black text-center"
                            >
                                💳 실제 KG이니시스 결제창 열기 →
                            </Link>
                        </div>
                    </div>
                )}

                {/* ── 탭 4: AI 적중률 검증 ── */}
                {activeTab === 'accuracy' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-black text-slate-900">🎯 AI 예측 적중률 검증 (최근 30일)</h2>
                            <button
                                onClick={async () => {
                                    setAccuracyLoading(true);
                                    try {
                                        const res = await fetch(`${API}/api/ai/grade-predictions`, { method: 'POST' });
                                        const data = await res.json();
                                        alert(`수동 채점 완료: ${data.graded || 0}건 처리됨`);
                                        loadAccuracy();
                                    } catch {
                                        alert('채점 실행 중 오류가 발생했습니다.');
                                        setAccuracyLoading(false);
                                    }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#0046b8] text-white text-xs font-extrabold cursor-pointer"
                            >
                                ⚡ 수동 채점 실행
                            </button>
                        </div>

                        {accuracyLoading ? (
                            <div className="py-10 text-center text-xs text-slate-500">로딩 중...</div>
                        ) : !accuracyData ? (
                            <div className="py-10 text-center text-xs text-slate-500">집계된 데이터가 없습니다.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-xs text-slate-500 font-bold">총 정산 경기</div>
                                    <div className="text-xl font-black text-slate-900 mt-1">{accuracyData.total_graded}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <div className="text-xs text-emerald-700 font-bold">적중 (Hit)</div>
                                    <div className="text-xl font-black text-emerald-700 mt-1">{accuracyData.hit}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                                    <div className="text-xs text-rose-700 font-bold">미적중 (Miss)</div>
                                    <div className="text-xl font-black text-rose-700 mt-1">{accuracyData.miss}건</div>
                                </div>
                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                                    <div className="text-xs text-[#0046b8] font-bold">적중률</div>
                                    <div className="text-xl font-black text-[#0046b8] mt-1">{accuracyData.accuracy_percent}%</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 탭 5: 푸시 알림 발송 ── */}
                {activeTab === 'notifications' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                        <h2 className="text-base font-black text-slate-900">🔔 전체 회원 웹 푸시 알림 발송</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 mb-1">알림 유형</label>
                                <select
                                    value={notifType}
                                    onChange={(e) => setNotifType(e.target.value)}
                                    className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900"
                                >
                                    <option value="daily_pick">⭐ 오늘의 AI 추천 픽 안내</option>
                                    <option value="value_bet">🎯 고가치(Value) 배당 포착 알림</option>
                                    <option value="odds_change">📈 급격한 배당 변동 감지</option>
                                    <option value="result">🏆 경기 적중 결과 알림</option>
                                    <option value="marketing">📢 공지사항 / 이벤트</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 mb-1">알림 메시지 내용</label>
                                <textarea
                                    value={notifBody}
                                    onChange={(e) => setNotifBody(e.target.value)}
                                    className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 min-h-[90px]"
                                    placeholder="예: 프로토 승부식 신규 회차 AI 핵심 픽이 업데이트되었습니다!"
                                />
                            </div>
                            {notifResult && (
                                <div className="p-3 rounded-xl bg-blue-50 text-[#0046b8] text-xs font-bold">
                                    {notifResult}
                                </div>
                            )}
                            <button
                                onClick={handleSendNotification}
                                disabled={notifSending || !notifBody.trim()}
                                className="w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white text-sm font-black disabled:opacity-50 cursor-pointer"
                            >
                                {notifSending ? '발송 중...' : '📤 푸시 알림 발송하기'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
