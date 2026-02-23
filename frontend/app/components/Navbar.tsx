"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useDictionary } from '../context/DictionaryContext';
import { i18n, languageNames } from '../lib/i18n-config';
import NotificationBell from './NotificationBell';

export default function Navbar() {
    const pathname = usePathname();
    const { user, logout, loading } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);

    // Detect current locale from pathname (check longer codes first: zh-CN before zh)
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
        { href: `/${currentLang}`, label: t.home || "홈", icon: "⚡", desc: t.homeDesc || "서비스 소개" },
        { href: `/${currentLang}/bets`, label: t.valueBet || "밸류벳", icon: "📊", desc: t.valueBetDesc || "고평가 데이터 탐지" },
        { href: `/${currentLang}/market`, label: t.aiPredict || "AI예측", icon: "🧠", desc: t.aiPredictDesc || "4대 API 종합분석" },
        { href: `/${currentLang}/mypage`, label: t.portfolio || "내 포트폴리오", icon: "💼", desc: t.portfolioDesc || "분석 내역 · 수익" },
        { href: `/${currentLang}/manual`, label: t.guide || "이용가이드", icon: "📖", desc: t.guideDesc || "사이트 사용법" },
    ];

    const switchLocale = (newLang: string) => {
        // Replace current locale in path (use regex for exact match)
        const escapedLang = currentLang.replace('-', '\\-');
        const regex = new RegExp(`^/${escapedLang}(?=/|$)`);
        const newPath = pathname.replace(regex, `/${newLang}`);
        window.location.href = newPath || `/${newLang}`;
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangOpen(false);
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
        return `group relative px-3 py-1.5 text-sm font-semibold transition-all rounded-lg ${isActive
            ? 'text-[var(--accent-primary)] bg-[rgba(0,212,255,0.08)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
            }`;
    };

    const mobileLinkClass = (path: string) => {
        const isActive = path === `/${currentLang}` ? pathname === `/${currentLang}` : pathname.startsWith(path);
        return `flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${isActive
            ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)] border border-[rgba(0,212,255,0.2)]'
            : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white border border-transparent'
            }`;
    };

    return (
        <nav className="glass-heavy sticky top-0 z-50 border-b border-[var(--glass-border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
                <div className="flex items-center space-x-8">
                    <Link href={`/${currentLang}`} className="flex items-center space-x-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:shadow-[var(--glow-cyan-strong)] transition-shadow">
                            SN
                        </div>
                        <span className="text-lg font-extrabold tracking-tight gradient-text hidden sm:block">Scorenix</span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navLinks.map(link => (
                            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                                {link.label}
                                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                    {link.icon} {link.desc}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* 🌐 Language Selector */}
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span>{languageNames[currentLang]?.flag || '🌐'}</span>
                            <span className="hidden sm:inline">{languageNames[currentLang]?.nativeName || currentLang}</span>
                            <svg className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {langOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 glass-heavy rounded-xl border border-[var(--border-default)] z-50 shadow-2xl overflow-hidden animate-fade-up max-h-[60vh] overflow-y-auto">
                                {i18n.locales.map((code) => {
                                    const lang = languageNames[code];
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => { switchLocale(code); setLangOpen(false); }}
                                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all ${currentLang === code
                                                ? 'text-[var(--accent-primary)] bg-[rgba(0,212,255,0.08)]'
                                                : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="text-base">{lang?.flag}</span>
                                            <span className="font-medium">{lang?.nativeName}</span>
                                            {currentLang === code && <span className="ml-auto text-xs">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 🔔 Notification Bell (logged-in users only) */}
                    {!loading && user && <NotificationBell />}

                    {!loading && (
                        user ? (
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] text-white flex items-center justify-center text-xs font-bold">
                                        {user.nickname?.charAt(0)?.toUpperCase() || '👤'}
                                    </div>
                                    <span className="hidden sm:block text-sm font-semibold text-white/80 max-w-[80px] truncate">
                                        {user.nickname}
                                    </span>
                                    <svg className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-60 glass-heavy rounded-xl border border-[var(--border-default)] z-50 shadow-2xl animate-fade-up overflow-hidden">
                                        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                                            <p className="text-sm font-bold text-white">{user.nickname}</p>
                                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{user.email}</p>
                                            <span className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(0,212,255,0.12)] text-[var(--accent-primary)] uppercase tracking-wider">{user.role}</span>
                                        </div>
                                        <div className="py-1">
                                            <Link href={`/${currentLang}/mypage`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all" onClick={() => setProfileOpen(false)}>
                                                <span className="text-base">💼</span> {t.portfolio || '내 포트폴리오'}
                                            </Link>
                                            <Link href={`/${currentLang}/pricing`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all" onClick={() => setProfileOpen(false)}>
                                                <span className="text-base">💎</span> {t.subscription || '구독 관리'}
                                            </Link>
                                        </div>
                                        <div className="border-t border-[var(--border-subtle)] py-1">
                                            <button
                                                onClick={() => { logout(); setProfileOpen(false); }}
                                                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                                            >
                                                <span className="text-base">🚪</span> {t.logout || '로그아웃'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="hidden sm:flex items-center space-x-2">
                                <Link href={`/${currentLang}/login`} className="btn-ghost text-sm !py-1.5 !px-4">
                                    {t.login || '로그인'}
                                </Link>
                                <Link href={`/${currentLang}/register`} className="btn-primary text-sm !py-1.5 !px-4">
                                    {t.register || '회원가입'}
                                </Link>
                            </div>
                        )
                    )}

                    {/* Mobile Hamburger */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-[var(--border-subtle)]"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        <div className="w-5 h-5 relative flex flex-col justify-center items-center">
                            <span className={`block w-5 h-0.5 bg-white/70 rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'}`}></span>
                            <span className={`block w-5 h-0.5 bg-white/70 rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-0' : 'opacity-100'}`}></span>
                            <span className={`block w-5 h-0.5 bg-white/70 rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'}`}></span>
                        </div>
                    </button>
                </div>

                {/* Mobile Dropdown */}
                <div className={`absolute top-16 left-0 right-0 glass-heavy border-b border-[var(--border-default)] z-50 md:hidden transition-all duration-300 ${mobileOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                    <div className="px-4 py-3 space-y-1 stagger-children">
                        {navLinks.map(link => (
                            <Link key={link.href} href={link.href} className={mobileLinkClass(link.href)} onClick={() => setMobileOpen(false)}>
                                <span>{link.icon}</span>
                                <div className="flex flex-col">
                                    <span>{link.label}</span>
                                    <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{link.desc}</span>
                                </div>
                            </Link>
                        ))}

                        {/* Mobile Language Switcher */}
                        <div className="pt-2 border-t border-[var(--border-subtle)]">
                            <div className="grid grid-cols-3 gap-1.5 px-4 py-2">
                                {i18n.locales.map((code) => {
                                    const lang = languageNames[code];
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => { switchLocale(code); setMobileOpen(false); }}
                                            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all ${currentLang === code
                                                ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)] border border-[rgba(0,212,255,0.2)]'
                                                : 'text-[var(--text-secondary)] bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <span>{lang?.flag}</span>
                                            <span>{lang?.nativeName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-3 mt-2 border-t border-[var(--border-subtle)]">
                            {user ? (
                                <>
                                    <div className="px-4 py-2.5 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] text-white flex items-center justify-center text-xs font-bold">
                                            {user.nickname?.charAt(0)?.toUpperCase() || '👤'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{user.nickname}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { logout(); setMobileOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-bold text-red-400 rounded-xl hover:bg-red-500/10 transition-all flex items-center gap-2"
                                    >
                                        🚪 {t.logout || '로그아웃'}
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-2 pb-2">
                                    <Link href={`/${currentLang}/login`} className="block px-4 py-3 text-sm font-bold text-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all" onClick={() => setMobileOpen(false)}>
                                        {t.login || '로그인'}
                                    </Link>
                                    <Link href={`/${currentLang}/register`} className="block px-4 py-3 text-sm font-bold text-center rounded-xl btn-primary" onClick={() => setMobileOpen(false)}>
                                        {t.register || '회원가입'}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
