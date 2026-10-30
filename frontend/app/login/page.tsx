"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { i18n } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';
import Navbar from '../components/Navbar';

type LoginMode = 'member' | 'store';
type LoginTab = 'email' | 'phone';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f4f6f9]" />}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const initialMode = searchParams.get('mode') === 'store' ? 'store' : 'member';

    const { login, googleLogin, sendPhoneCode, verifyPhoneCode } = useAuth();
    const dict = useDictionarySafe();
    const t = dict?.auth || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const [loginMode, setLoginMode] = useState<LoginMode>(initialMode);
    const [tab, setTab] = useState<LoginTab>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 판매점 전용 로그인 상태
    const [storeName, setStoreName] = useState('');
    const [storeRegion, setStoreRegion] = useState('서울/수도권');
    const [storePhone, setStorePhone] = useState('');
    const [storeLaunchType, setStoreLaunchType] = useState<'pc_kiosk' | 'a4_print'>('pc_kiosk');

    useEffect(() => {
        if (searchParams.get('mode') === 'store') {
            setLoginMode('store');
        }
        try {
            const savedName = localStorage.getItem('scorenix_b2b_store_name');
            const savedRegion = localStorage.getItem('scorenix_b2b_store_region');
            if (savedName) setStoreName(savedName);
            if (savedRegion) setStoreRegion(savedRegion);
        } catch {
            // ignore
        }
    }, [searchParams]);

    const navigateAfterLogin = () => {
        if (redirectTo) {
            router.push(redirectTo);
        } else {
            router.push(`/${currentLang}`);
        }
    };

    const handleStoreModeLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim()) {
            setError('매장 상호명(예: 행운복권방)을 입력해주세요.');
            return;
        }
        try {
            localStorage.setItem('scorenix_store_mode', 'true');
            localStorage.setItem('scorenix_b2b_store_name', storeName.trim());
            localStorage.setItem('scorenix_b2b_store_region', storeRegion);
            localStorage.setItem('scorenix_b2b_store_phone', storePhone.trim());
            localStorage.setItem('scorenix_round_pass_unlocked', 'true');
            if (storeLaunchType === 'pc_kiosk') {
                localStorage.setItem('scorenix_store_kiosk', 'true');
                router.push(`/${currentLang}`);
            } else {
                localStorage.setItem('scorenix_store_kiosk', 'false');
                router.push(`/${currentLang}/store/print-report/current`);
            }
        } catch {
            router.push(`/${currentLang}`);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await googleLogin();
            if (loginMode === 'store' && storeName.trim()) {
                localStorage.setItem('scorenix_store_mode', 'true');
                localStorage.setItem('scorenix_b2b_store_name', storeName.trim());
                localStorage.setItem('scorenix_round_pass_unlocked', 'true');
            }
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message || 'Google 로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        if (!phone.trim()) {
            setError('휴대폰 번호를 입력해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const formatted = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`;
            await sendPhoneCode(formatted, 'recaptcha-container');
            setCodeSent(true);
        } catch (err: any) {
            setError(err.message || '인증번호 발송에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await verifyPhoneCode(otp);
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message || '인증번호가 올바르지 않습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <Navbar />
            <div className="flex-grow flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-lg">
                    <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-extrabold">
                            SCORENIX 스포츠데이터연구소 통합 인증센터
                        </span>
                        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                            {loginMode === 'store' ? '🏪 전국 판매점(점주) 전용 로그인' : '👤 일반 회원 로그인'}
                        </h2>
                        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                            {loginMode === 'store'
                                ? '매장 내 PC 모니터 전광판 모드 실행 및 A4 고객용 분석 리포트 원클릭 인쇄를 지원합니다.'
                                : '승부예측 커뮤니티 참여 및 단골 판매점 리포트 비치 신청을 이용하실 수 있습니다.'}
                        </p>
                    </div>

                    {/* 일반 회원 vs 판매점(점주) 모드 선택 탭 */}
                    <div className="mt-6 grid grid-cols-2 gap-2 bg-slate-200/80 p-1.5 rounded-xl border border-slate-300">
                        <button
                            type="button"
                            onClick={() => { setLoginMode('member'); setError(''); }}
                            className={`py-3 px-4 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                                loginMode === 'member'
                                    ? 'bg-white text-[#0046b8] shadow-sm border border-blue-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            👤 일반 개인 회원 로그인
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginMode('store'); setError(''); }}
                            className={`py-3 px-4 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                                loginMode === 'store'
                                    ? 'bg-[#0046b8] text-white shadow-sm'
                                    : 'text-slate-700 hover:text-slate-900'
                            }`}
                        >
                            🏪 판매점(점주) 전용 모드
                        </button>
                    </div>
                </div>

                <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                        {loginMode === 'store' ? (
                            /* ─── 🏪 판매점(점주) 전용 로그인 & 즉시 실행 폼 ─── */
                            <form onSubmit={handleStoreModeLogin} className="space-y-5">
                                <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-4 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold text-[#0046b8]">
                                            🎁 전국 프로토 판매점 점주님 2주 무료 체험 오픈
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-[#0046b8] text-white text-[10px] font-bold">
                                            즉시 실행 가능
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        매장 상호명을 입력하고 로그인하시면 <strong>① 매장 PC 모니터 전광판 모드(전 경기 자동 순환 &amp; 잠금 100% 해제)</strong>와 <strong>② A4 벽보 원클릭 인쇄 기능</strong>이 즉시 활성화됩니다.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                                        매장 상호명 (필수 — 전광판 상단 및 A4 인쇄물에 표시됩니다)
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={storeName}
                                        onChange={(e) => setStoreName(e.target.value)}
                                        placeholder="예: 역삼 행운복권방 / 빛가람 스포츠토토 판매점"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                                            매장 소재 지역
                                        </label>
                                        <select
                                            value={storeRegion}
                                            onChange={(e) => setStoreRegion(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                        >
                                            <option value="서울/수도권">서울 / 수도권</option>
                                            <option value="경기/인천">경기 / 인천</option>
                                            <option value="대전/충청/강원">대전 / 충청 / 강원</option>
                                            <option value="광주/전남/전북">광주 / 전남 / 전북</option>
                                            <option value="부산/대구/울산/경상">부산 / 대구 / 경상 / 제주</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                                            점주님 연락처 (선택)
                                        </label>
                                        <input
                                            type="tel"
                                            value={storePhone}
                                            onChange={(e) => setStorePhone(e.target.value)}
                                            placeholder="010-0000-0000"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-2">
                                        로그인 후 바로 실행할 매장 화면 선택
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setStoreLaunchType('pc_kiosk')}
                                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                                                storeLaunchType === 'pc_kiosk'
                                                    ? 'bg-blue-50 border-2 border-[#0046b8]'
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <div className="text-xs font-black text-slate-900">🖥️ 매장 PC 전광판 모드</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                매장 모니터에 띄워두고 손님들이 전 경기를 보게 하는 화면
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStoreLaunchType('a4_print')}
                                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                                                storeLaunchType === 'a4_print'
                                                    ? 'bg-blue-50 border-2 border-[#0046b8]'
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <div className="text-xs font-black text-slate-900">🖨️ A4 벽보 원클릭 인쇄</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                매장 게시판 부착용 A4 1장 요약 리포트 즉시 출력
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {error && <p className="text-rose-600 text-xs font-bold text-center">{error}</p>}

                                <button
                                    type="submit"
                                    className="w-full py-3.5 px-4 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white font-black text-sm shadow-sm transition cursor-pointer"
                                >
                                    🏪 판매점 모드로 즉시 시작하기 (전 경기 잠금 해제)
                                </button>
                            </form>
                        ) : (
                            /* ─── 👤 일반 회원 로그인 폼 ─── */
                            <>
                                <button
                                    onClick={handleGoogleSignIn}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold transition-all bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 mb-5 disabled:opacity-50 cursor-pointer"
                                >
                                    <svg width="18" height="18" viewBox="0 0 48 48">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    {t.googleLogin || 'Google 계정으로 1초 로그인'}
                                </button>

                                <div className="flex items-center gap-3 mb-5">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-xs font-bold text-slate-400">또는 이메일 / 휴대폰 로그인</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                <div className="flex mb-5 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                    <button
                                        onClick={() => { setTab('email'); setError(''); }}
                                        className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                            tab === 'email'
                                                ? 'bg-white text-[#0046b8] border-b-2 border-[#0046b8]'
                                                : 'text-slate-500'
                                        }`}
                                    >
                                        이메일 로그인
                                    </button>
                                    <button
                                        onClick={() => { setTab('phone'); setError(''); setCodeSent(false); }}
                                        className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                            tab === 'phone'
                                                ? 'bg-white text-[#0046b8] border-b-2 border-[#0046b8]'
                                                : 'text-slate-500'
                                        }`}
                                    >
                                        휴대폰 번호 로그인
                                    </button>
                                </div>

                                {tab === 'email' && (
                                    <form className="space-y-4" onSubmit={handleEmailLogin}>
                                        <div>
                                            <label htmlFor="email" className="block text-xs font-extrabold text-slate-700 mb-1">
                                                이메일 주소
                                            </label>
                                            <input
                                                id="email" type="email" autoComplete="email" required
                                                value={email} onChange={(e) => setEmail(e.target.value)}
                                                placeholder="example@email.com"
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="password" className="block text-xs font-extrabold text-slate-700 mb-1">
                                                비밀번호
                                            </label>
                                            <input
                                                id="password" type="password" autoComplete="current-password" required
                                                value={password} onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                            />
                                        </div>

                                        {error && <p className="text-rose-600 text-xs font-bold text-center">{error}</p>}

                                        <button
                                            type="submit" disabled={loading}
                                            className="w-full py-3 px-4 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
                                        >
                                            {loading ? '로그인 중...' : '로그인'}
                                        </button>
                                    </form>
                                )}

                                {tab === 'phone' && (
                                    <div className="space-y-4">
                                        {!codeSent ? (
                                            <>
                                                <div>
                                                    <label htmlFor="phone" className="block text-xs font-extrabold text-slate-700 mb-1">
                                                        휴대폰 번호
                                                    </label>
                                                    <input
                                                        id="phone" type="tel" required
                                                        value={phone} onChange={(e) => setPhone(e.target.value)}
                                                        placeholder="010-1234-5678"
                                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                                    />
                                                </div>

                                                {error && <p className="text-rose-600 text-xs font-bold text-center">{error}</p>}

                                                <button
                                                    type="button" onClick={handleSendCode} disabled={loading}
                                                    className="w-full py-3 px-4 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
                                                >
                                                    {loading ? '발송 중...' : '인증번호 받기'}
                                                </button>
                                            </>
                                        ) : (
                                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                                <div>
                                                    <label htmlFor="otp" className="block text-xs font-extrabold text-slate-700 mb-1">
                                                        인증번호 6자리
                                                    </label>
                                                    <input
                                                        id="otp" type="text" maxLength={6} required
                                                        value={otp} onChange={(e) => setOtp(e.target.value)}
                                                        placeholder="000000"
                                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-lg text-center tracking-widest font-mono text-slate-900 focus:outline-none focus:border-[#0046b8]"
                                                    />
                                                </div>

                                                {error && <p className="text-rose-600 text-xs font-bold text-center">{error}</p>}

                                                <button
                                                    type="submit" disabled={loading}
                                                    className="w-full py-3 px-4 rounded-xl bg-[#0046b8] hover:bg-[#00358e] text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
                                                >
                                                    {loading ? '확인 중...' : '인증 및 로그인'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}

                                <div className="mt-5 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                                    계정이 없으신가요?{' '}
                                    <a href={`/${currentLang}/register`} className="font-extrabold text-[#0046b8] hover:underline">
                                        10초 무료 회원가입
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div id="recaptcha-container"></div>
            </div>
        </div>
    );
}
