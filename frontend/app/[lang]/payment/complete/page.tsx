"use client";
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { useAuth } from '../../../context/AuthContext';
import { i18n } from '../../../lib/i18n-config';

export default function PaymentCompletePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
            </div>
        }>
            <PaymentCompleteContent />
        </Suspense>
    );
}

function PaymentCompleteContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const { token } = useAuth();

    const paymentId = searchParams.get('paymentId') || '';
    const planId = searchParams.get('planId') || 'pro';
    const status = searchParams.get('status');
    const code = searchParams.get('code');
    const message = searchParams.get('message');

    const [verifying, setVerifying] = useState(true);
    const [result, setResult] = useState<'success' | 'fail' | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [planName, setPlanName] = useState('');
    const [expiresAt, setExpiresAt] = useState('');

    useEffect(() => {
        // 이미 프론트에서 검증 완료 후 status=success로 온 경우
        if (status === 'success') {
            setResult('success');
            setPlanName(planId === 'vip' ? 'VIP' : 'Pro Investor');
            setVerifying(false);
            return;
        }

        // 리다이렉트 방식: 오류 코드가 있으면 실패
        if (code) {
            setResult('fail');
            setErrorMsg(message || '결제가 취소되었거나 오류가 발생했습니다.');
            setVerifying(false);
            return;
        }

        // paymentId가 있으면 서버에서 검증
        if (paymentId && token) {
            verifyPayment();
        } else {
            setResult('fail');
            setErrorMsg('결제 정보가 없습니다.');
            setVerifying(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const verifyPayment = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${apiUrl}/api/payments/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ payment_id: paymentId, plan_id: planId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || '결제 검증에 실패했습니다.');
            }

            const data = await res.json();
            setResult('success');
            setPlanName(data.plan || (planId === 'vip' ? 'VIP' : 'Pro Investor'));
            setExpiresAt(data.expires_at || '');
        } catch (err) {
            setResult('fail');
            setErrorMsg(err instanceof Error ? err.message : '결제 검증 중 오류가 발생했습니다.');
        }
        setVerifying(false);
    };

    const formatDate = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-20 flex-grow flex items-center">
                <div className="w-full glass-card p-8 text-center">
                    {verifying ? (
                        /* ── 검증 중 ── */
                        <div className="space-y-4">
                            <div className="w-16 h-16 mx-auto border-3 border-t-transparent rounded-full animate-spin"
                                style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                결제를 확인하고 있습니다...
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                잠시만 기다려주세요
                            </p>
                        </div>
                    ) : result === 'success' ? (
                        /* ── 성공 ── */
                        <div className="space-y-6">
                            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(0,212,255,0.2))' }}>
                                <span className="text-4xl">🎉</span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                                    결제 완료!
                                </h1>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    구독이 성공적으로 활성화되었습니다
                                </p>
                            </div>

                            <div className="p-4 rounded-xl space-y-2"
                                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(0,212,255,0.2)' }}>
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--text-muted)' }}>구독 플랜</span>
                                    <span className="font-bold gradient-text">{planName}</span>
                                </div>
                                {expiresAt && (
                                    <div className="flex justify-between text-sm">
                                        <span style={{ color: 'var(--text-muted)' }}>이용 기간</span>
                                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                            ~ {formatDate(expiresAt)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--text-muted)' }}>결제 ID</span>
                                    <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {paymentId.slice(0, 20)}...
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Link href={`/${currentLang}/bets/view`}
                                    className="btn-primary block w-full py-3 text-sm font-bold text-center">
                                    🎯 AI 분석 시작하기
                                </Link>
                                <Link href={`/${currentLang}`}
                                    className="block w-full py-2.5 text-sm font-medium text-center rounded-xl transition"
                                    style={{ color: 'var(--text-muted)' }}>
                                    홈으로 돌아가기
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* ── 실패 ── */
                        <div className="space-y-6">
                            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(239,68,68,0.15)' }}>
                                <span className="text-4xl">❌</span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                                    결제 실패
                                </h1>
                                <p className="text-sm" style={{ color: '#f87171' }}>
                                    {errorMsg}
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Link href={`/${currentLang}/payment/request?plan=${planId}`}
                                    className="btn-primary block w-full py-3 text-sm font-bold text-center">
                                    다시 시도하기
                                </Link>
                                <Link href={`/${currentLang}/pricing`}
                                    className="block w-full py-2.5 text-sm font-medium text-center rounded-xl transition"
                                    style={{ color: 'var(--text-muted)' }}>
                                    요금제 페이지로 돌아가기
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
