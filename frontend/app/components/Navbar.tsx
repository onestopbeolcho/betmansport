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
    const [storeModeActive, setStoreModeActive] = useState(false);
    const [storeName, setStoreName] = useState("");
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
        { href: `/${currentLang}`, label: "발매 게임별 AI 리포트", icon: "📋", desc: "승무패 · 승5패 · 스페셜N · 프로토 승부식 통합 리포트" },
        { href: `/${currentLang}#community-lounge`, label: "승부예측 커뮤니티 & 매장찾기", icon: "💬", desc: "회차별 유저 예측 토론방 & 우리 동네 판매점 리포트 비치 현황" },
        { href: `/${currentLang}/store/print-report/current`, label: "판매점 A4 출력센터(B2B)", icon: "🖨️", desc: "오프라인 매장 전용 A4 원클릭 분석지 인쇄" },
        { href: `/${currentLang}/analysis`, label: t.aiPredict || "7-Factor 전력 DB", icon: "📊", desc: "구단별 포아송 기대득점 및 전술 데이터" },
        { href: `/${currentLang}/pricing`, label: "열람권 / 판매점 구독", icon: "💳", desc: "오프라인 판매점 월간 구독 및 온라인 열람권" },
    ];

    useEffect(() => {
        const syncStoreState = () => {
            try {
                const isStore = localStorage.getItem("scorenix_store_mode") === "true";
                const sName = localStorage.getItem("scorenix_b2b_store_name") || "공식 제휴 판매점";
                setStoreModeActive(isStore);
                setStoreName(sName);
            } catch {
                // ignore
            }
        };
        syncStoreState();
        window.addEventListener("storage", syncStoreState);
        window.addEventListener("scorenix-store-mode-change", syncStoreState);
        return () => {
            window.removeEventListener("storage", syncStoreState);
            window.removeEventListener("scorenix-store-mode-change", syncStoreState);
        };
    }, [pathname]);

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

    const exitStoreMode = () => {
        try {
            localStorage.removeItem("scorenix_store_mode");
            localStorage.removeItem("scorenix_store_kiosk");
            setStoreModeActive(false);
            window.dispatchEvent(new Event("scorenix-store-mode-change"));
        } catch {
            // ignore
        }
    };

    const linkClass = (path: string) => {
        const cleanPath = path.split('#')[0];
        const isActive = path.includes('#')
            ? false
            : cleanPath === `/${currentLang}`
            ? pathname === `/${currentLang}`
            : pathname.startsWith(cleanPath);
        return `group relative px-3 py-2 text-sm font-bold transition-all rounded-lg ${isActive
            ? 'text-[#0046b8] bg-blue-50 border border-blue-200/80'
            : 'text-slate-700 hover:text-[#0046b8] hover:bg-slate-50'
            }`;
    };

    const mobileLinkClass = (path: string) => {
        const cleanPath = path.split('#')[0];
        const isActive = path.includes('#')
            ? false
            : cleanPath === `/${currentLang}`
            ? pathname === `/${currentLang}`
            : pathname.startsWith(cleanPath);
        return `flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${isActive
            ? 'bg-blue-50 text-[#0046b8] border border-blue-200'
            : 'text-slate-700 hover:bg-slate-50 border border-transparent'
            }`;
    };

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
            {/* 상단 공식 유틸리티 바 */}
            <div className="bg-[#003996] text-white text-[11px]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium truncate">
                        <span className="px-1.5 py-0.5 rounded bg-white/15 font-extrabold text-[10px]">전국 6,500개 판매점 연동</span>
                        <span>베트맨 발매 게임 AI 통합 리포트 · 오프라인 판매점 PC 전광판 &amp; A4 벽보 출력 솔루션</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-white/90 font-medium shrink-0">
                        {storeModeActive ? (
                            <span className="text-amber-300 font-extrabold">
                                🏪 [{storeName}] 판매점 모드 작동 중
                            </span>
                        ) : (
                            <a href={`/${currentLang}/login?mode=store`} className="text-amber-300 font-extrabold hover:underline">
                                🏪 판매점(점주) 전용 로그인 →
                            </a>
                        )}
                        <span>|</span>
                        <a href={`/${currentLang}/store/print-report/current`} className="hover:text-white hover:underline">
                            🖨️ A4 벽보 인쇄센터
                        </a>
                        <span>|</span>
                        <span className="text-white/75">건전이용상담 1336</span>
                    </div>
                </div>
            </div>

            {/* 메인 내비게이션 바 */}
            <nav data-tour="tour-nav" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
                <div className="flex items-center space-x-6">
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
                    <div className="hidden lg:flex items-center space-x-1">
                        {navLinks.map(link => (
                            <a key={link.href} href={link.href} className={linkClass(link.href)}>
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* 판매점 모드 배지 또는 판매점 로그인 바로가기 버튼 */}
                    {storeModeActive ? (
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                            <span>🏪 {storeName} (매장모드)</span>
                            <button
                                onClick={exitStoreMode}
                                className="ml-1 px-1.5 py-0.5 rounded bg-white border border-emerald-300 text-[10px] text-slate-600 hover:text-rose-600 cursor-pointer"
                            >
                                종료
                            </button>
                        </div>
                    ) : (
                        <a
                            href={`/${currentLang}/login?mode=store`}
                            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold transition"
                        >
                            🏪 판매점 로그인
                        </a>
                    )}

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
                                            <a href={`/${currentLang}/login?mode=store`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all" onClick={() => setProfileOpen(false)}>
                                                <span className="text-base">🏪</span> 판매점 모드 전환
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
                                <a href={`/${currentLang}/login`} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition">
                                    회원 로그인
                                </a>
                                <a href={`/${currentLang}/register`} className="px-3 py-1.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-bold transition shadow-xs">
                                    회원가입
                                </a>
                            </div>
                        )
                    )}

                    {/* Mobile Hamburger */}
                    <button
                        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
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
                <div className={`absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 lg:hidden transition-all duration-200 ${mobileOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
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

                        <div className="border-t border-slate-200 pt-2 mt-2 flex flex-col gap-2">
                            <a href={`/${currentLang}/login?mode=store`} className="block text-center py-2.5 text-sm font-extrabold rounded-xl bg-amber-50 border border-amber-300 text-amber-900" onClick={() => setMobileOpen(false)}>
                                🏪 판매점(점주) 전용 로그인 (PC전광판/인쇄)
                            </a>
                            {!user && (
                                <div className="grid grid-cols-2 gap-2">
                                    <a href={`/${currentLang}/login`} className="block text-center py-2.5 text-sm font-bold rounded-xl border border-slate-300 text-slate-700" onClick={() => setMobileOpen(false)}>
                                        회원 로그인
                                    </a>
                                    <a href={`/${currentLang}/register`} className="block text-center py-2.5 text-sm font-bold rounded-xl bg-[#0046b8] text-white" onClick={() => setMobileOpen(false)}>
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
