"use client";
import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useDictionary } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';
import NotificationBell from './NotificationBell';

export default function Navbar() {
    const pathname = usePathname();
    const { user, logout, loading } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch {
        dict = null;
    }
    const t = dict?.nav || {};

    const navLinks = [
        { href: `/${currentLang}`, label: "발매 게임별 AI 리포트", icon: "📋", desc: "승무패 · 승5패 · 스페셜N · 프로토 승부식 공식 경기 분석" },
        { href: `/${currentLang}/store/print-report/current`, label: "판매점 A4 출력센터(B2B)", icon: "🖨️", desc: "오프라인 매장 전용 A4 원클릭 분석지 인쇄" },
        { href: `/${currentLang}/analysis`, label: t.aiPredict || "7-Factor 전력 데이터베이스", icon: "📊", desc: "구단별 포아송 기대득점 및 전술 데이터" },
        { href: `/${currentLang}/standings`, label: "글로벌 리그 순위표", icon: "🏆", desc: "주요 리그 실시간 정규 순위 및 승점" },
        { href: `/${currentLang}/pricing`, label: "열람권 / 멤버십 안내", icon: "💳", desc: "회차당 1,500원 리포트 열람권 및 매장 정기구독" },
    ];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const linkClass = (path: string) => {
        const isActive = path === `/${currentLang}` ? pathname === `/${currentLang}` : pathname.startsWith(path);
        return `group relative px-3.5 py-2 text-sm font-bold transition-all rounded-lg ${isActive
            ? 'text-[#0046b8] bg-blue-50 border border-blue-200/80'
            : 'text-slate-700 hover:text-[#0046b8] hover:bg-slate-50'
            }`;
    };

    const mobileLinkClass = (path: string) => {
        const isActive = path === `/${currentLang}` ? pathname === `/${currentLang}` : pathname.startsWith(path);
        return `flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${isActive
            ? 'bg-blue-50 text-[#0046b8] border border-blue-200'
            : 'text-slate-700 hover:bg-slate-50 border border-transparent'
            }`;
    };

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
            {/* 상단 공식 유틸리티 바 (베트맨 포털 스타일) */}
            <div className="bg-[#003996] text-white text-[11px]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium truncate">
                        <span className="px-1.5 py-0.5 rounded bg-white/15 font-extrabold text-[10px]">공식일정 연동</span>
                        <span>베트맨(betman.co.kr) 발매 게임(승무패 · 승5패 · 스페셜N · 매치 · 프로토 승부식) AI 전력 데이터 분석 센터</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-white/85 font-medium shrink-0">
                        <a href={`/${currentLang}/store/print-report/current`} className="hover:text-white hover:underline">
                            🏪 전국 판매점 A4 인쇄센터
                        </a>
                        <span>|</span>
                        <a href={`/${currentLang}/manual`} className="hover:text-white hover:underline">
                            분석모델 안내
                        </a>
                        <span>|</span>
                        <span className="text-white/75">건전이용상담 1336</span>
                    </div>
                </div>
            </div>

            {/* 메인 내비게이션 바 */}
            <nav data-tour="tour-nav" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
                <div className="flex items-center space-x-7">
                    <a href={`/${currentLang}`} className="flex items-center space-x-2.5 group">
                        <div className="w-9 h-9 rounded-lg bg-[#0046b8] flex items-center justify-center text-white font-black text-sm shadow-xs">
                            SN
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black tracking-tight text-slate-900 leading-none">
                                SCORENIX
                            </span>
                            <span className="text-[10px] font-bold text-[#0046b8] tracking-tight mt-0.5">
                                스포츠데이터연구소
                            </span>
                        </div>
                    </a>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navLinks.map(link => (
                            <a key={link.href} href={link.href} className={linkClass(link.href)}>
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-2.5">
                    {!loading && user && <NotificationBell />}

                    {!loading && (
                        user ? (
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
                                >
                                    <div className="w-7 h-7 rounded-md bg-[#0046b8] text-white flex items-center justify-center text-xs font-bold">
                                        {user.nickname?.charAt(0)?.toUpperCase() || '👤'}
                                    </div>
                                    <span className="hidden sm:block text-sm font-bold text-slate-800 max-w-[90px] truncate">
                                        {user.nickname}
                                    </span>
                                    <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl border border-slate-200 z-50 shadow-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                            <p className="text-sm font-bold text-slate-900">{user.nickname}</p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                                            <span className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0046b8] uppercase tracking-wider">{user.role}</span>
                                        </div>
                                        <div className="py-1">
                                            <a href={`/${currentLang}/mypage`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all" onClick={() => setProfileOpen(false)}>
                                                <span className="text-base">💼</span> 내 분석 보관함 / 구독관리
                                            </a>
                                            <a href={`/${currentLang}/pricing`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all" onClick={() => setProfileOpen(false)}>
                                                <span className="text-base">💎</span> 열람권 및 플랜 안내
                                            </a>
                                        </div>
                                        <div className="border-t border-slate-100 py-1">
                                            <button
                                                onClick={() => { logout(); setProfileOpen(false); }}
                                                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all font-semibold"
                                            >
                                                <span className="text-base">🚪</span> 로그아웃
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="hidden sm:flex items-center space-x-2">
                                <a href={`/${currentLang}/login`} className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition">
                                    로그인
                                </a>
                                <a href={`/${currentLang}/register`} className="px-3.5 py-1.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-bold transition shadow-xs">
                                    회원가입
                                </a>
                            </div>
                        )
                    )}

                    {/* Mobile Hamburger */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        <div className="w-5 h-5 relative flex flex-col justify-center items-center">
                            <span className={`block w-5 h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'}`}></span>
                            <span className={`block w-5 h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-0' : 'opacity-100'}`}></span>
                            <span className={`block w-5 h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'}`}></span>
                        </div>
                    </button>
                </div>

                {/* Mobile Dropdown */}
                <div className={`absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 md:hidden transition-all duration-200 ${mobileOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                    <div className="px-4 py-3 space-y-1">
                        {navLinks.map(link => (
                            <a key={link.href} href={link.href} className={mobileLinkClass(link.href)} onClick={() => setMobileOpen(false)}>
                                <span>{link.icon}</span>
                                <div className="flex flex-col">
                                    <span>{link.label}</span>
                                    <span className="text-[11px] font-normal text-slate-500">{link.desc}</span>
                                </div>
                            </a>
                        ))}

                        <div className="pt-3 mt-2 border-t border-slate-100">
                            {user ? (
                                <>
                                    <div className="px-4 py-2.5 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#0046b8] text-white flex items-center justify-center text-xs font-bold">
                                            {user.nickname?.charAt(0)?.toUpperCase() || '👤'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{user.nickname}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { logout(); setMobileOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 rounded-xl hover:bg-red-50 transition-all flex items-center gap-2"
                                    >
                                        🚪 로그아웃
                                    </button>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 pb-2">
                                    <a href={`/${currentLang}/login`} className="block px-4 py-2.5 text-sm font-bold text-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>
                                        로그인
                                    </a>
                                    <a href={`/${currentLang}/register`} className="block px-4 py-2.5 text-sm font-bold text-center rounded-lg bg-[#0046b8] text-white" onClick={() => setMobileOpen(false)}>
                                        회원가입
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
}
