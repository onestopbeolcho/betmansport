"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';
import { useAuth } from '../context/AuthContext';
import { useDictionarySafe } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';

interface SlipItem {
    id: string;
    match_name: string;
    selection: string;
    odds: number;
    team_home: string;
    team_away: string;
}

interface Slip {
    id: number;
    items: SlipItem[];
    stake: number;
    total_odds: number;
    potential_return: number;
    status: string;
    created_at: string;
}

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    matchName?: string;
    timestamp: Date;
}

export default function MyPage() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const t = dict?.mypage || {} as any;
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const QUICK_PROMPTS = [
        { label: t.qpValueBet || 'Value Picks', icon: '🎯', query: t.qpValueBetQuery || 'Recommend matches with the biggest value gaps today' },
        { label: t.qpRiskAnalysis || 'Risk Analysis', icon: '⚡', query: t.qpRiskQuery || 'Analyze the most stable analysis strategy right now' },
        { label: t.qpHighWinRate || 'High Win Rate', icon: '📊', query: t.qpHighWinQuery || 'What are the highest win probability matches today?' },
        { label: t.qpComboOptimizer || 'Combo Optimizer', icon: '🧮', query: t.qpComboQuery || "Recommend the optimal combination from today's matches" },
    ];

    // Slips state
    const [slips, setSlips] = useState<Slip[]>([]);
    const [slipsLoading, setSlipsLoading] = useState(true);
    const [showSlips, setShowSlips] = useState(false);

    // AI Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 1,
            role: 'assistant',
            content: t.aiGreeting || "Hello! I'm the **Scorenix AI Analysis Assistant**. 🤖\n\nAsk me anything about teams, matches, or strategies.\n\n**Examples:**\n- \"Analyze Manchester City\"\n- \"Recommend high value gap matches\"\n- \"Real Madrid vs Barcelona win rate\"",
            timestamp: new Date(),
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Update greeting when dictionary loads
    useEffect(() => {
        if (t.aiGreeting) {
            setMessages(prev => {
                if (prev.length === 1 && prev[0].id === 1) {
                    return [{ ...prev[0], content: t.aiGreeting }];
                }
                return prev;
            });
        }
    }, [t.aiGreeting]);

    // Auto-scroll chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Fetch slips
    useEffect(() => {
        const fetchSlips = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setSlipsLoading(false);
                return;
            }
            try {
                const res = await fetch(`${API}/api/portfolio/slips/my`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSlips(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setSlipsLoading(false);
            }
        };
        fetchSlips();
    }, []);

    // Chat submit
    const handleChatSubmit = async (query?: string) => {
        const text = query || chatInput.trim();
        if (!text || chatLoading) return;

        const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await fetch(`${API}/api/analysis/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text }),
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.response,
                matchName: data.match_name,
                timestamp: new Date(),
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: t.aiError || "Cannot connect to analysis server. Please try again later.",
                timestamp: new Date(),
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    // Stats computed from slips
    const totalSlips = slips.length;
    const wonSlips = slips.filter(s => s.status === 'won').length;
    const lostSlips = slips.filter(s => s.status === 'lost').length;
    const hitRate = totalSlips > 0 ? Math.round((wonSlips / Math.max(wonSlips + lostSlips, 1)) * 100) : 0;
    const totalAnalyses = messages.filter(m => m.role === 'user').length;

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
                            <span className="text-xl">🤖</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                                {t.pageTitle || 'AI Portfolio'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {user?.email?.split('@')[0] || 'Guest'}{t.pageSubtitle || "'s Personal AI Analysis Dashboard"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* AI Performance Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[
                        {
                            label: t.statAnalyses || "Today's Analyses",
                            value: totalAnalyses,
                            icon: '🧠',
                            gradient: 'from-[#00d4ff]/20 to-[#00d4ff]/5',
                            border: 'border-[rgba(0,212,255,0.2)]',
                            color: '#00d4ff',
                        },
                        {
                            label: t.statHitRate || 'AI Hit Rate',
                            value: `${hitRate}%`,
                            icon: '🎯',
                            gradient: 'from-[#4ade80]/20 to-[#4ade80]/5',
                            border: 'border-[rgba(74,222,128,0.2)]',
                            color: '#4ade80',
                        },
                        {
                            label: t.statCombos || 'Saved Combos',
                            value: totalSlips,
                            icon: '📋',
                            gradient: 'from-[#8b5cf6]/20 to-[#8b5cf6]/5',
                            border: 'border-[rgba(139,92,246,0.2)]',
                            color: '#8b5cf6',
                        },
                        {
                            label: t.statWonLost || 'Won / Lost',
                            value: `${wonSlips} / ${lostSlips}`,
                            icon: '📊',
                            gradient: 'from-[#f59e0b]/20 to-[#f59e0b]/5',
                            border: 'border-[rgba(245,158,11,0.2)]',
                            color: '#f59e0b',
                        },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl border ${stat.border} p-4 bg-gradient-to-br ${stat.gradient}`}
                            style={{ background: 'var(--bg-surface)' }}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`}></div>
                            <div className="relative">
                                <div className="text-lg mb-1">{stat.icon}</div>
                                <div className="text-2xl font-black font-mono" style={{ color: stat.color }}>
                                    {stat.value}
                                </div>
                                <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                                    {stat.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* AI Prompt Interface - Main Section */}
                <div className="rounded-2xl border border-[var(--border-default)] overflow-hidden mb-8" style={{ background: 'var(--bg-surface)' }}>
                    {/* Chat Header */}
                    <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center shadow-lg">
                                <span className="text-base">🤖</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white">{t.aiMatchAnalyst || 'AI Match Analyst'}</h2>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>
                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.realtimeRunning || 'Real-time analysis running'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] px-3 py-1 rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)]" style={{ color: 'var(--accent-primary)' }}>
                            Gemini AI
                        </div>
                    </div>

                    {/* Quick Prompt Buttons */}
                    <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap gap-2" style={{ background: 'rgba(0,212,255,0.02)' }}>
                        <span className="text-[10px] font-bold self-center mr-1" style={{ color: 'var(--text-muted)' }}>{t.quickQuestions || '💡 Quick Questions:'}</span>
                        {QUICK_PROMPTS.map((qp, i) => (
                            <button
                                key={i}
                                onClick={() => handleChatSubmit(qp.query)}
                                disabled={chatLoading}
                                className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.05)] transition-all disabled:opacity-30"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {qp.icon} {qp.label}
                            </button>
                        ))}
                    </div>

                    {/* Chat Messages Area */}
                    <div
                        ref={chatScrollRef}
                        className="p-5 space-y-4 overflow-y-auto"
                        style={{ height: '420px' }}
                    >
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                                        <span className="text-xs">🤖</span>
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-[rgba(0,212,255,0.15)] to-[rgba(139,92,246,0.1)] text-white rounded-br-sm border border-[rgba(0,212,255,0.2)]'
                                    : 'rounded-bl-sm border border-[var(--border-subtle)]'
                                    }`}
                                    style={msg.role === 'assistant' ? { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' } : {}}
                                >
                                    {msg.matchName && msg.role === 'assistant' && (
                                        <div className="text-[10px] font-bold mb-2 px-2 py-1 rounded-md inline-block"
                                            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>
                                            ⚽ {msg.matchName}
                                        </div>
                                    )}
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_strong]:text-[var(--accent-primary)]">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span className="font-medium">{msg.content}</span>
                                    )}
                                    <div className="text-[9px] mt-2 opacity-40">
                                        {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center mr-2 flex-shrink-0">
                                    <span className="text-xs">🤖</span>
                                </div>
                                <div className="rounded-2xl rounded-bl-sm p-4 border border-[var(--border-subtle)]" style={{ background: 'var(--bg-elevated)' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.aiAnalyzing || 'AI analyzing...'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Input */}
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }}
                        className="px-5 py-4 border-t border-[var(--border-subtle)]"
                        style={{ background: 'var(--bg-elevated)' }}
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={t.chatPlaceholder || "Ask about teams, matches, strategies..."}
                                className="flex-1 bg-white/[0.04] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[rgba(0,212,255,0.3)] text-white placeholder:text-[var(--text-muted)] transition-all"
                                disabled={chatLoading}
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim() || chatLoading}
                                className="p-3 rounded-xl disabled:opacity-20 transition-all hover:scale-105 hover:shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                                {t.chatDisclaimer || 'Pinnacle + Betman real-time odds based · Gemini AI analysis · Results are for reference only'}
                            </span>
                        </div>
                    </form>
                </div>

                {/* Analysis History & Saved Slips */}
                <div className="rounded-2xl border border-[var(--border-default)] overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <button
                        onClick={() => setShowSlips(!showSlips)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        style={{ background: 'var(--bg-elevated)' }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">📋</span>
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {t.savedCombosTitle || 'Saved Combos & Analysis History'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>
                                {totalSlips} {t.items || 'items'}
                            </span>
                        </div>
                        <svg
                            className={`w-4 h-4 transition-transform ${showSlips ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--text-muted)' }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showSlips && (
                        <div className="p-5 border-t border-[var(--border-subtle)]">
                            {slipsLoading ? (
                                <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                    <div className="animate-spin inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-2"></div>
                                    <p className="text-xs">{t.loading || 'Loading...'}</p>
                                </div>
                            ) : slips.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-2 opacity-30">📊</div>
                                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t.noCombos || 'No saved combos yet.'}</p>
                                    <a href={`/${currentLang}/bets`} className="btn-primary text-xs px-4 py-2 inline-block rounded-lg">
                                        {t.goToAnalysis || 'Go to Odds Analysis →'}
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {slips.map((slip) => (
                                        <div key={slip.id} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden hover:border-[rgba(0,212,255,0.2)] transition-all">
                                            <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: 'var(--bg-elevated)' }}>
                                                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {t.combo || 'Combo'} #{slip.id}
                                                    <span className="font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
                                                        {new Date(slip.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold font-mono gradient-text">{slip.total_odds.toFixed(2)}x</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${slip.status === 'active' ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' :
                                                        slip.status === 'won' ? 'bg-[rgba(34,197,94,0.15)] text-[#4ade80]' :
                                                            slip.status === 'lost' ? 'bg-[rgba(239,68,68,0.15)] text-[#f87171]' :
                                                                'bg-white/5 text-[var(--text-muted)]'
                                                        }`}>
                                                        {slip.status === 'active' ? (t.statusActive || 'Active') : slip.status === 'won' ? (t.statusWon || 'Won') : slip.status === 'lost' ? (t.statusLost || 'Lost') : slip.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="px-4 py-2 space-y-1">
                                                {slip.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1">
                                                        <div>
                                                            <span className="font-medium mr-1.5" style={{ color: 'var(--accent-primary)' }}>
                                                                [{item.selection === 'Home' ? 'W' : item.selection === 'Away' ? 'L' : 'D'}]
                                                            </span>
                                                            <span style={{ color: 'var(--text-secondary)' }}>{item.match_name}</span>
                                                        </div>
                                                        <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{item.odds.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Not logged in CTA */}
                {!user && (
                    <div className="mt-8 glass-card text-center py-8 border-dashed">
                        <div className="text-3xl mb-3">🔐</div>
                        <p className="text-sm mb-1 font-bold" style={{ color: 'var(--text-primary)' }}>
                            {t.loginCta || 'Sign in and start AI analysis'}
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                            {t.loginCtaDesc || 'Your personalized portfolio and AI analysis records will be saved'}
                        </p>
                        <a href={`/${currentLang}/login`}
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                        >
                            {t.loginCtaBtn || 'Sign In / Sign Up →'}
                        </a>
                    </div>
                )}
            </main>
        </div>
    );
}
