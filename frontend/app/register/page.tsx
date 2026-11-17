"use client";
import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useDictionarySafe } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function RegisterPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { register, googleLogin } = useAuth();
    const dict = useDictionarySafe();
    const t = dict?.auth || {} as any;
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const [step, setStep] = useState(1); // 1: Terms, 2: Form

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Phone format helper
    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 11;

    // Consent checkboxes
    const [agreeAll, setAgreeAll] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [agreeAdult, setAgreeAdult] = useState(false);
    const [agreeGambling, setAgreeGambling] = useState(false);

    // Expanded terms
    const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

    const handleAgreeAll = () => {
        const next = !agreeAll;
        setAgreeAll(next);
        setAgreeTerms(next);
        setAgreePrivacy(next);
        setAgreeAdult(next);
        setAgreeGambling(next);
    };

    const updateAgreeAll = (terms: boolean, privacy: boolean, adult: boolean, gambling: boolean) => {
        setAgreeAll(terms && privacy && adult && gambling);
    };

    const canProceed = agreeTerms && agreePrivacy && agreeAdult && agreeGambling;

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Birth year validation
        const year = parseInt(birthYear);
        const currentYear = new Date().getFullYear();
        if (!year || year > currentYear - 18 || year < 1920) {
            setError(t.ageError || '만 18세 이상만 가입하실 수 있습니다.');
            return;
        }

        if (password !== confirmPassword) {
            setError(t.passwordMismatch || '비밀번호가 일치하지 않습니다.');
            return;
        }

        if (password.length < 6) {
            setError(t.weakPassword || '비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (!fullName.trim()) {
            setError('이름을 입력해주세요.');
            return;
        }

        if (!isPhoneValid) {
            setError('휴대폰 번호를 정확히 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            await register(email, password, nickname, fullName.trim(), phoneDigits);
            router.push(`/${currentLang}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await googleLogin();
            router.push(`/${currentLang}`);
        } catch (err: any) {
            setError(err.message || 'Google 로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        color: '#0f172a',
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <DeadlineBanner />
            <Navbar />
            <div className="flex-grow flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-lg">
                    <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-extrabold">
                            SCORENIX 스포츠데이터연구소 회원가입
                        </span>
                        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                            {t.registerTitle || '무료 회원가입'}
                        </h2>
                        <p className="mt-1.5 text-sm text-slate-600">
                            {t.hasAccount || '이미 계정이 있으신가요?'}{' '}
                            <a href={`/${currentLang}/login`} className="font-extrabold text-[#0046b8] hover:underline">
                                {t.loginLink || '로그인하기 →'}
                            </a>
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-3 mt-5">
                        <div
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition ${
                                step === 1 ? 'text-[#0046b8]' : 'text-slate-600'
                            }`}
                            style={{
                                background: step === 1 ? '#eff6ff' : '#ffffff',
                                border: `1px solid ${step === 1 ? '#93c5fd' : '#cbd5e1'}`,
                            }}
                        >
                            <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                                style={{
                                    background: step >= 1 ? '#0046b8' : '#e2e8f0',
                                    color: step >= 1 ? '#ffffff' : '#475569',
                                }}
                            >
                                1
                            </span>
                            {t.stepTerms || '약관 동의'}
                        </div>
                        <div className="w-6 h-px bg-slate-300"></div>
                        <div
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition ${
                                step === 2 ? 'text-[#0046b8]' : 'text-slate-600'
                            }`}
                            style={{
                                background: step === 2 ? '#eff6ff' : '#ffffff',
                                border: `1px solid ${step === 2 ? '#93c5fd' : '#cbd5e1'}`,
                            }}
                        >
                            <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                                style={{
                                    background: step >= 2 ? '#0046b8' : '#e2e8f0',
                                    color: step >= 2 ? '#ffffff' : '#475569',
                                }}
                            >
                                2
                            </span>
                            {t.stepInfo || '정보 입력'}
                        </div>
                    </div>
                </div>

                <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-6 px-5 sm:px-8">

                        {/* ═══════ STEP 1: Terms & Consent ═══════ */}
                        {step === 1 && (
                            <div className="space-y-4">
                                {/* Legal Disclaimer Banner */}
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl flex-shrink-0">⚠️</span>
                                        <div>
                                            <h3 className="text-sm font-extrabold text-amber-900">
                                                {t.serviceNoticeTitle || '스포츠 데이터 분석 서비스 안내'}
                                            </h3>
                                            <p className="text-xs mt-1 leading-relaxed text-slate-700">
                                                {t.serviceNoticeDesc1 || '본 서비스는 공공 스포츠 데이터 기반의'}{' '}
                                                <strong className="text-slate-900 font-extrabold underline decoration-amber-400">
                                                    {t.serviceNoticeDesc2 || 'AI 경기 분석 도구'}
                                                </strong>
                                                입니다.{' '}
                                                {t.serviceNoticeDesc3 || '글로벌 데이터와 AI 알고리즘을 활용한'}{' '}
                                                <strong className="text-[#0046b8] font-extrabold">
                                                    {t.serviceNoticeDesc4 || '스포츠 통계 데이터 분석 · 승부예측 리포트 서비스'}
                                                </strong>
                                                를 제공합니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Agree All */}
                                <button
                                    type="button"
                                    onClick={handleAgreeAll}
                                    className="w-full flex items-center gap-3 p-4 rounded-xl transition-all cursor-pointer text-left"
                                    style={{
                                        background: agreeAll ? '#eff6ff' : '#f8fafc',
                                        border: `2px solid ${agreeAll ? '#0046b8' : '#cbd5e1'}`,
                                    }}
                                >
                                    <div
                                        className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                                        style={{
                                            borderColor: agreeAll ? '#0046b8' : '#64748b',
                                            background: agreeAll ? '#0046b8' : '#ffffff',
                                        }}
                                    >
                                        {agreeAll && (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-slate-900">
                                        {t.agreeAll || '전체 약관에 모두 동의합니다'}
                                    </span>
                                </button>

                                <div className="space-y-2">
                                    {/* Terms of Service */}
                                    <TermItem
                                        checked={agreeTerms}
                                        onChange={(v) => { setAgreeTerms(v); updateAgreeAll(v, agreePrivacy, agreeAdult, agreeGambling); }}
                                        label={`${t.termRequired || '[필수]'} ${t.termsOfService || '서비스 이용약관 동의'}`}
                                        isExpanded={expandedTerm === 'terms'}
                                        onToggle={() => setExpandedTerm(expandedTerm === 'terms' ? null : 'terms')}
                                        viewLabel={t.viewTerm || '보기'}
                                        hideLabel={t.hideTerm || '접기'}
                                        content={`제1조 (목적)\n본 약관은 Scorenix(이하 "서비스")의 이용 조건 및 절차를 규정합니다.\n\n제2조 (서비스 내용)\n- 글로벌 스포츠 데이터 통계 비교 분석\n- 통계 기반 최적 배분 분석\n- AI 기반 조합 최적화\n- AI 기반 경기 분석 리포트\n\n제3조 (이용 제한)\n- 본 서비스는 만 18세 이상만 이용 가능합니다.\n- 불법 목적의 이용은 금지됩니다.\n\n제4조 (면책)\n- 분석 결과는 참고 자료이며, 이용에 따른 결과에 대한 책임은 이용자에게 있습니다.`}
                                    />

                                    {/* Privacy Policy */}
                                    <TermItem
                                        checked={agreePrivacy}
                                        onChange={(v) => { setAgreePrivacy(v); updateAgreeAll(agreeTerms, v, agreeAdult, agreeGambling); }}
                                        label={`${t.termRequired || '[필수]'} ${t.privacyPolicy || '개인정보 수집 및 이용 동의'}`}
                                        isExpanded={expandedTerm === 'privacy'}
                                        onToggle={() => setExpandedTerm(expandedTerm === 'privacy' ? null : 'privacy')}
                                        viewLabel={t.viewTerm || '보기'}
                                        hideLabel={t.hideTerm || '접기'}
                                        content={`수집 항목: 이메일, 닉네임, 이름, 휴대폰 번호, 생년(연도)\n수집 목적: 회원 관리, 서비스 제공, 성인 인증, 결제 정보 연동\n보유 기간: 회원 탈퇴 시까지\n\n※ 비밀번호는 암호화되어 저장되며, 관리자도 원문을 확인할 수 없습니다.\n※ 개인정보는 서비스 외 목적으로 제3자에게 제공되지 않습니다.`}
                                    />

                                    {/* Adult Verification */}
                                    <TermItem
                                        checked={agreeAdult}
                                        onChange={(v) => { setAgreeAdult(v); updateAgreeAll(agreeTerms, agreePrivacy, v, agreeGambling); }}
                                        label={`${t.termRequired || '[필수]'} ${t.adultVerification || '만 18세 이상 성인 인증 동의'}`}
                                        isExpanded={expandedTerm === 'adult'}
                                        onToggle={() => setExpandedTerm(expandedTerm === 'adult' ? null : 'adult')}
                                        viewLabel={t.viewTerm || '보기'}
                                        hideLabel={t.hideTerm || '접기'}
                                        content={`스포츠토토 관련 서비스는 「국민체육진흥법」에 따라 만 18세 이상만 이용할 수 있습니다.\n\n본인은 만 18세 이상의 성인임을 확인하며, 허위 정보 입력 시 모든 법적 책임은 본인에게 있음을 동의합니다.\n\n가입 시 입력하는 출생연도를 통해 연령을 확인합니다.`}
                                    />

                                    {/* Gambling Disclaimer */}
                                    <TermItem
                                        checked={agreeGambling}
                                        onChange={(v) => { setAgreeGambling(v); updateAgreeAll(agreeTerms, agreePrivacy, agreeAdult, v); }}
                                        label={`${t.termRequired || '[필수]'} ${t.legalCompliance || '건전 스포츠 데이터 분석 이용 서약'}`}
                                        isExpanded={expandedTerm === 'gambling'}
                                        onToggle={() => setExpandedTerm(expandedTerm === 'gambling' ? null : 'gambling')}
                                        viewLabel={t.viewTerm || '보기'}
                                        hideLabel={t.hideTerm || '접기'}
                                        content={`1. 본 서비스는 스포츠 데이터 분석 및 AI 승부예측 도구입니다.\n2. 수집된 데이터를 바탕으로 통계적 분석 정보를 제공합니다.\n3. 분석 결과는 참고 자료이며, 이용에 따른 책임은 본인에게 있습니다.\n4. 「국민체육진흥법」 등 관련 법규를 준수합니다.\n5. 문의사항: 고객센터를 이용해주세요.\n\n※ 본 서비스는 스포츠 데이터 분석 정보 제공 목적입니다.`}
                                    />
                                </div>

                                {/* Proceed Button */}
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    disabled={!canProceed}
                                    className="w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer shadow-xs"
                                >
                                    {t.agreeAndContinue || '약관 동의 후 다음 단계로 이동 →'}
                                </button>
                            </div>
                        )}

                        {/* ═══════ STEP 2: Registration Form ═══════ */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-1 text-xs font-extrabold text-slate-600 hover:text-[#0046b8] mb-2 transition cursor-pointer"
                                >
                                    {t.backToTerms || '← 약관 동의 화면으로 돌아가기'}
                                </button>

                                {/* Google Sign-In */}
                                <button
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-extrabold transition-all hover:bg-slate-50 cursor-pointer"
                                    style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 48 48">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    {t.googleSignUp || 'Google 계정으로 3초 만에 가입하기'}
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-xs font-bold text-slate-500">{t.or || '또는 이메일로 가입'}</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                {/* Email Registration Form */}
                                <form className="space-y-4" onSubmit={handleRegister}>
                                    <div>
                                        <label htmlFor="fullName" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            이름 (실명) <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="fullName" type="text" required
                                            value={fullName} onChange={(e) => setFullName(e.target.value)}
                                            placeholder="홍길동"
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="phoneReg" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            휴대폰 번호 <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="phoneReg" type="tel" required
                                            value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                                            placeholder="010-0000-0000"
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={{
                                                ...inputStyle,
                                                border: `1px solid ${phoneNumber && !isPhoneValid ? '#ef4444' : '#cbd5e1'}`,
                                            }}
                                        />
                                        <p className="text-[11px] mt-1 text-slate-500">결제 및 구독 확인 시 구매자 정보로 자동 연동됩니다</p>
                                    </div>

                                    <div>
                                        <label htmlFor="nickname" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            {t.nicknameLabel || t.displayNameLabel || '닉네임'} <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="nickname" type="text" required
                                            value={nickname} onChange={(e) => setNickname(e.target.value)}
                                            placeholder={t.nicknamePlaceholder || t.displayNamePlaceholder || '커뮤니티에서 사용할 닉네임'}
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="email" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            {t.emailLabel || '이메일 주소'} <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="email" type="email" autoComplete="email" required
                                            value={email} onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t.emailPlaceholder || 'example@email.com'}
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="birthYear" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            {t.birthYearLabel || '출생연도 (4자리)'} <span className="text-[11px] font-normal text-slate-500">{t.birthYearHint || '(만 18세 이상 성인 확인)'}</span>
                                        </label>
                                        <input
                                            id="birthYear" type="number" required
                                            value={birthYear} onChange={(e) => setBirthYear(e.target.value)}
                                            placeholder={t.birthYearPlaceholder || '예: 1985'}
                                            min={1920} max={new Date().getFullYear() - 18}
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            {t.passwordLabel || '비밀번호'} <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="password" type="password" autoComplete="new-password" required
                                            value={password} onChange={(e) => setPassword(e.target.value)}
                                            placeholder={t.passwordPlaceholderReg || '6자 이상 입력'}
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="confirmPassword" className="block text-xs font-extrabold mb-1 text-slate-800">
                                            {t.confirmPasswordLabel || '비밀번호 확인'} <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            id="confirmPassword" type="password" autoComplete="new-password" required
                                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder={t.confirmPlaceholder || '비밀번호 재입력'}
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm font-medium transition focus:outline-none focus:border-[#0046b8] focus:bg-white"
                                            style={inputStyle}
                                        />
                                    </div>

                                    {error && (
                                        <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                                            <span>⚠️</span>
                                            <span className="text-sm font-bold text-rose-700">{error}</span>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-sm font-black disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                                                {t.signingUp || '가입 처리 중...'}
                                            </span>
                                        ) : (t.signUpButton || t.registerButton || '회원가입 완료')}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Bottom Info */}
                    <div className="mt-4 p-4 rounded-xl text-center bg-white border border-slate-200">
                        <p className="text-xs leading-relaxed text-slate-600">
                            {t.bottomNotice1 || '📊 SCORENIX 스포츠 데이터 분석 · AI 승부예측 리포트'}<br />
                            {t.bottomNotice2 || '본 서비스는 공공 스포츠 데이터를 기반으로 객관적인 통계 지표를 제공합니다.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}


/* ─── Term Item Component ─── */
interface TermItemProps {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    isExpanded: boolean;
    onToggle: () => void;
    content: string;
    viewLabel?: string;
    hideLabel?: string;
}

function TermItem({ checked, onChange, label, isExpanded, onToggle, content, viewLabel = '보기', hideLabel = '접기' }: TermItemProps) {
    return (
        <div
            className="rounded-xl overflow-hidden transition-all"
            style={{
                background: checked ? '#eff6ff' : '#ffffff',
                border: `1px solid ${checked ? '#93c5fd' : '#e2e8f0'}`,
            }}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <button
                    type="button"
                    onClick={() => onChange(!checked)}
                    className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer"
                    style={{
                        borderColor: checked ? '#0046b8' : '#64748b',
                        background: checked ? '#0046b8' : '#ffffff',
                    }}
                >
                    {checked && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
                <span
                    className="text-xs font-bold flex-1 cursor-pointer"
                    onClick={() => onChange(!checked)}
                    style={{ color: checked ? '#0f172a' : '#334155' }}
                >
                    {label}
                </span>
                <button
                    type="button"
                    onClick={onToggle}
                    className="text-xs font-extrabold transition-all px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                    {isExpanded ? hideLabel : viewLabel}
                </button>
            </div>
            {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                    <div className="p-3 rounded-lg text-xs leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-200 text-slate-700">
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}
