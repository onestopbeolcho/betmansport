"use client";
import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import DeadlineBanner from '../../../components/DeadlineBanner';
import { useAuth } from '../../../context/AuthContext';
import { useDictionary } from '../../../context/DictionaryContext';
import { i18n } from '../../../lib/i18n-config';
import * as PortOne from '@portone/browser-sdk/v2';

const PLANS: Record<string, Record<string, { name: string; orderLabel: string; price: number; features: string[] }>> = {
    ko: {
        round_pass: {
            name: "이번 회차 즉시 열람권 (단건 결제)",
            orderLabel: "스코어닉스 프로토·승무패 회차별 데이터 리포트 열람권",
            price: 3900,
            features: [
                "현재 발매 회차 승무패 14경기 경합 구간 복수 지표 전체 오픈",
                "프로토 승부식 AI 확신도 85%+ 핵심 주력 픽 전체 잠금 해제",
                "베트맨 공시 배당 대비 +EV 데이터 가치 Top 5 제공",
                "5일간 모든 발매 게임 리포트 무제한 열람 (자동 정기결제 없음)",
            ],
        },
        pro: {
            name: "개인 올인원 월 무제한 패스 (전 회차 모바일 구독권)",
            orderLabel: "스코어닉스 데이터 분석 리포트 월 구독권 (Pro Pass)",
            price: 29900,
            features: [
                "한 달간 발행되는 모든 베트맨 회차(승무패·승5패·스페셜N·프로토) 무제한 열람",
                "매장 방문 없이 스마트폰에서 마감 직전 실시간 배당 변동 및 결장자 반영 픽 확인",
                "AI 확신도 85%+ 핵심 우위 픽 & 7-Factor 팀 전력·포아송 기대득점(xG) 리포트",
            ],
        },
        vip: {
            name: "VIP 프로 퀀트 & 14경기 예산별 분석 패스",
            orderLabel: "스코어닉스 통합 퀀트 데이터 멤버십 (VIP Quant)",
            price: 39000,
            features: [
                "개인 올인원 월 무제한 패스(월 29,900원)의 전 기능 100% 포함",
                "승무패·승5패 14경기 복수 마킹 시뮬레이터 무제한",
                "글로벌 배당 왜곡 감지 실시간 알림 & 백테스트 원본 지표 전체 열람",
            ],
        },
        store_b2b: {
            name: "공식 프로토 판매점 점주 전용 상생 파트너 (100% 무상 지원)",
            orderLabel: "스코어닉스 공식 판매점 상생 파트너십",
            price: 0,
            features: [
                "전국 6,277개 공식 판매점 점주님께 A4 벽보 원클릭 인쇄 100% 평생 무료 지원",
                "우리 매장 상호명 커스텀 헤더 및 하단 전용 QR코드 자동 삽입",
                "매장 내 PC 모니터 전광판 모드(20초 자동 순환) 무료 제공",
            ],
        },
    },
    en: {
        round_pass: {
            name: "Single Round AI Report Pass",
            orderLabel: "Scorenix Single Round Data Report Pass",
            price: 299,
            features: [
                "Unlock all 85%+ confidence AI Killer Picks for this round",
                "Top 5 +EV Value Bet matches unlocked",
            ],
        },
        pro: {
            name: "Monthly Unlimited Pass (All Rounds)",
            orderLabel: "Scorenix Digital Data Report Membership (Monthly)",
            price: 2199,
            features: [
                "Unlimited access to all Proto & Toto rounds for 30 days",
                "Real-time pre-kickoff odds movement & lineup updates on mobile",
                "Poisson xG & 7-Factor tactical index breakdown",
            ],
        },
        vip: {
            name: "VIP Pro Quant & 14-Match Simulator Pass",
            orderLabel: "Scorenix Digital Data Report Membership (VIP Quant)",
            price: 2900,
            features: [
                "All Monthly Unlimited Pass features included",
                "14-Match pool OMR simulator",
                "Real-time odds distortion alerts & raw backtest logs",
            ],
        },
        store_b2b: {
            name: "Official Retail Store Free Partner (100% Free)",
            orderLabel: "Scorenix Official Store Partner",
            price: 0,
            features: [
                "100% Free A4 1-Click Print/PDF Reports for official retail stores",
            ],
        },
    },
};

export default function PaymentRequestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
                <div className="inline-block w-8 h-8 border-2 border-[#0046b8] border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PaymentRequestContent />
        </Suspense>
    );
}

function PaymentRequestContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname() || '';
    const planId = searchParams.get('plan') || 'pro';
    const billingParam = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly';
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const currency = currentLang === 'en' ? 'USD' : 'KRW';
    const planSet = PLANS[currentLang] || PLANS.ko;
    const plan = planSet[planId] || planSet.pro;
    const { user, token } = useAuth();

    const finalAmount = billingParam === 'annual' && currency === 'KRW' && planId !== 'round_pass'
        ? Math.round(plan.price * 0.8) * 12
        : plan.price;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch { dict = null; }
    const t = dict?.payment || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(true);
    const [agreedAge, setAgreedAge] = useState(true);
    const nameInputRef = React.useRef<HTMLInputElement>(null);
    const phoneInputRef = React.useRef<HTMLInputElement>(null);
    const didAutoFillRef = React.useRef(false);

    React.useEffect(() => {
        if (user && !didAutoFillRef.current) {
            didAutoFillRef.current = true;
            const rawName = (user.full_name || '').trim();
            // 전화번호/숫자 형태가 아닌 실제 이름일 때만 1회 초기값 세팅
            if (rawName && !/^[0-9+\-\s]+$/.test(rawName)) {
                setBuyerName(rawName);
            }
            const rawPhone = user.phone || (/^[0-9+\-\s]{10,}$/.test(user.nickname || '') ? user.nickname : '') || '';
            if (rawPhone) {
                const digits = rawPhone.replace(/\D/g, '');
                const cleanDigits = digits.startsWith('8210') ? '0' + digits.slice(2) : digits;
                if (cleanDigits.length >= 10) {
                    setPhoneNumber(`${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 7)}-${cleanDigits.slice(7, 11)}`);
                }
            }
        }
    }, [user]);

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 11;

    const formatPrice = (amount: number) => {
        if (currency === 'USD') return `$${(amount / 100).toFixed(2)}`;
        return `${amount.toLocaleString()}원`;
    };

    const handleCheckout = async () => {
        if (!user) { setError(t.errorLogin || '로그인이 필요합니다.'); return; }
        if (!buyerName.trim()) {
            setError('구매자 성명을 입력해 주세요.');
            nameInputRef.current?.focus();
            return;
        }
        if (!isPhoneValid) {
            setError('휴대폰 번호(10~11자리 숫자)를 정확히 입력해 주세요.');
            phoneInputRef.current?.focus();
            return;
        }
        if (!agreedTerms || !agreedAge) {
            setError(t.errorAgree || '아래 필수 이용약관 및 만 19세 이상 동의 항목에 체크해 주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
            const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';
            const paymentId = `SPI_${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const response = await PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId,
                orderName: plan.orderLabel,
                totalAmount: finalAmount,
                currency: currency === 'USD' ? 'CURRENCY_USD' : 'CURRENCY_KRW',
                payMethod: 'CARD',
                customer: {
                    fullName: buyerName.trim() || undefined,
                    email: user.email || undefined,
                    phoneNumber: phoneDigits || undefined,
                },
                redirectUrl: `${window.location.origin}/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}`,
            });

            if (response?.code) {
                throw new Error(response.message || `결제가 취소되었거나 실패했습니다. (${response.code})`);
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ payment_id: paymentId, plan_id: planId, billing: billingParam }),
            });

            if (!verifyRes.ok) {
                const data = await verifyRes.json().catch(() => ({}));
                throw new Error(data.detail || '결제 검증에 실패했습니다.');
            }

            window.location.href = `/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}&status=success`;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : (t.errorGeneral || '결제 처리 중 오류가 발생했습니다.'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-10 sm:py-14 flex-grow w-full">
                <div className="text-center mb-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-extrabold">
                        KG이니시스 보안 결제 센터
                    </span>
                    <h1 className="text-2xl font-black mt-2 text-slate-900">
                        데이터 분석 리포트 열람권 결제
                    </h1>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    {/* 선택한 요금제 요약 */}
                    <div className="text-center p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                        <p className="text-xs font-extrabold text-[#0046b8]">선택한 디지털 리포트 이용권</p>
                        <p className="text-lg font-black mt-1 text-slate-900">{plan.name}</p>
                        <p className="text-3xl font-black mt-2 text-[#0046b8]">
                            {formatPrice(finalAmount)}
                            <span className="text-sm font-bold text-slate-500 ml-1">
                                {planId === 'round_pass' ? '/ 1회차 (단건)' : billingParam === 'annual' ? '/ 연 (20% 할인)' : '/ 월'}
                            </span>
                        </p>
                    </div>

                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                        {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-[#0046b8] font-black">✓</span>
                                <span className="font-medium">{f}</span>
                            </li>
                        ))}
                    </ul>

                    {/* ── 구매자 정보 (KG이니시스 필수) ── */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        <p className="text-xs font-extrabold text-slate-800">구매자 정보 (KG이니시스 필수)</p>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">
                                👤 구매자 성명 <span className="text-rose-600">*</span>
                            </label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                name="buyer_name"
                                autoComplete="name"
                                value={buyerName}
                                onChange={(e) => { setBuyerName(e.target.value); if (error) setError(''); }}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-slate-50 text-slate-900 border border-slate-300 focus:outline-none focus:border-[#0046b8] focus:bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">
                                📱 휴대폰 번호 <span className="text-rose-600">*</span>
                            </label>
                            <input
                                ref={phoneInputRef}
                                type="tel"
                                name="buyer_tel"
                                autoComplete="tel"
                                value={phoneNumber}
                                onChange={(e) => { setPhoneNumber(formatPhone(e.target.value)); if (error) setError(''); }}
                                placeholder="010-0000-0000"
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-slate-50 text-slate-900 border focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                style={{
                                    borderColor: phoneNumber && !isPhoneValid ? '#ef4444' : '#cbd5e1',
                                }}
                            />
                        </div>
                    </div>

                    {/* ── 필수 법적 면책 조항 고지 ── */}
                    <div className="p-3.5 rounded-xl text-xs leading-relaxed bg-slate-50 border border-slate-200 text-slate-600">
                        ⚖️ <strong className="text-slate-800">필수 고지:</strong> 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다.
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0046b8]" />
                            <span className="text-xs text-slate-700 font-medium">
                                <Link href={`/${currentLang}/terms`} className="underline text-[#0046b8] font-bold">이용약관</Link>,{' '}
                                <Link href={`/${currentLang}/privacy`} className="underline text-[#0046b8] font-bold">개인정보처리방침</Link>,{' '}
                                <Link href={`/${currentLang}/refund`} className="underline text-[#0046b8] font-bold">환불 정책</Link>,{' '}
                                <Link href={`/${currentLang}/disclaimer`} className="underline text-[#0046b8] font-bold">면책 고지</Link>에 동의합니다.
                            </span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={agreedAge} onChange={(e) => setAgreedAge(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0046b8]" />
                            <span className="text-xs text-slate-700 font-medium">
                                만 19세 이상이며, 본 상품이 디지털 통계 데이터 리포트 이용권임을 확인합니다.
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 leading-relaxed">
                            ⚠️ {error}
                        </div>
                    )}

                    {!user ? (
                        <Link
                            href={`/${currentLang}/login?redirect=${encodeURIComponent(pathname + '?' + searchParams.toString())}`}
                            className="block w-full py-3.5 text-sm font-black text-center rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white transition shadow-xs"
                        >
                            로그인 후 결제 진행하기 →
                        </Link>
                    ) : (
                        <button
                            onClick={handleCheckout}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    결제창 호출 중...
                                </>
                            ) : (
                                `💳 ${formatPrice(finalAmount)} 결제하기`
                            )}
                        </button>
                    )}

                    <p className="text-center text-xs text-slate-500">
                        결제 완료 즉시 전 경기 리포트 잠금이 해제됩니다 ·{' '}
                        <Link href={`/${currentLang}/pricing`} className="underline text-[#0046b8] font-bold">
                            다른 요금제 보기
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
