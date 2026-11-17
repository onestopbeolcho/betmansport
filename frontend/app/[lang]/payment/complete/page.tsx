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
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
                <div className="w-8 h-8 border-2 border-[#0046b8] border-t-transparent rounded-full animate-spin" />
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
    const { token, loading: authLoading } = useAuth();

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

    const getDefaultPlanLabel = (pid: string) => {
        if (pid === 'round_pass') return '이번 회차 즉시 열람권';
        if (pid === 'vip') return 'VIP 프로 퀀트 패스';
        return '개인 올인원 월 무제한 패스';
    };

    useEffect(() => {
        // 1. 이미 프론트에서 검증 완료 후 status=success로 온 경우
        if (status === 'success') {
            setResult('success');
            setPlanName(getDefaultPlanLabel(planId));
            setVerifying(false);
            return;
        }

        // 2. 모바일 리다이렉트 방식: PG 오류 코드가 있으면 실패 표시
        if (code) {
            setResult('fail');
            const rawMsg = message || '결제가 취소되었거나 승인 과정에서 오류가 발생했습니다.';
            if (rawMsg.includes('결제가능한 카드가 없습니다') || rawMsg.includes('[01]')) {
                setErrorMsg(`${rawMsg} (카드사 가맹점 심사 중일 수 있으니 [간편결제] 또는 [실시간 계좌이체/가상계좌]로 다시 시도해 주세요.)`);
            } else {
                setErrorMsg(rawMsg);
            }
            setVerifying(false);
            return;
        }

        // 3. AuthContext 토큰 로딩 중이면 대기 (모바일 리다이렉트 시 초기 마운트 레이스 컨디션 방지)
        if (authLoading) {
            return;
        }

        if (paymentId && token) {
            verifyPayment();
        } else if (!paymentId) {
            setResult('fail');
            setErrorMsg('결제 식별 정보(paymentId)가 없습니다.');
            setVerifying(false);
        } else {
            setResult('fail');
            setErrorMsg('로그인 세션이 만료되었습니다. 다시 로그인 후 마이페이지에서 확인해주세요.');
            setVerifying(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, token, paymentId, code, status]);

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
            setPlanName(data.plan || getDefaultPlanLabel(planId));
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
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-16 flex-grow flex items-center w-full">
                <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                    {verifying ? (
                        <div className="space-y-4">
                            <div className="w-14 h-14 mx-auto border-3 border-[#0046b8] border-t-transparent rounded-full animate-spin" />
                            <p className="text-lg font-black text-slate-900">
                                결제 승인 내역을 확인하고 있습니다...
                            </p>
                            <p className="text-xs text-slate-500">
                                잠시만 기다려주세요
                            </p>
                        </div>
                    ) : result === 'success' ? (
                        <div className="space-y-6">
                            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <span className="text-3xl">🎉</span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black text-slate-900 mb-1">
                                    결제가 완료되었습니다!
                                </h1>
                                <p className="text-xs sm:text-sm text-slate-600">
                                    데이터 리포트 열람 권한이 즉시 활성화되었습니다.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 text-left">
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-slate-500 font-bold">이용권 명칭</span>
                                    <span className="font-black text-[#0046b8]">{planName}</span>
                                </div>
                                {expiresAt && (
                                    <div className="flex justify-between text-xs sm:text-sm">
                                        <span className="text-slate-500 font-bold">이용 만료일</span>
                                        <span className="font-bold text-slate-900">
                                            ~ {formatDate(expiresAt)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-bold">거래 번호</span>
                                    <span className="font-mono text-slate-700">
                                        {paymentId.slice(0, 24)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2.5 pt-2">
                                <Link
                                    href={`/${currentLang}`}
                                    className="block w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-sm font-black text-center transition shadow-xs"
                                >
                                    📊 이번 회차 AI 통합 리포트 바로 보기 →
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                                <span className="text-3xl">⚠️</span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black text-slate-900 mb-2">
                                    결제가 완료되지 않았습니다
                                </h1>
                                <p className="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3.5 leading-relaxed">
                                    {errorMsg}
                                </p>
                            </div>

                            <div className="space-y-2.5 pt-2">
                                <Link
                                    href={`/${currentLang}/payment/request?plan=${planId}`}
                                    className="block w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-sm font-black text-center transition shadow-xs"
                                >
                                    다른 결제수단(간편결제·계좌이체)으로 다시 시도하기
                                </Link>
                                <Link
                                    href={`/${currentLang}/pricing`}
                                    className="block w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 text-center"
                                >
                                    요금제 안내로 돌아가기
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
