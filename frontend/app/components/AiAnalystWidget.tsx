
"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { usePathname } from 'next/navigation';
import { useDictionarySafe } from '../context/DictionaryContext';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
}

export default function AiAnalystWidget() {
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const t = dict?.mypage || {} as any;
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, role: 'assistant', content: t.aiWidgetGreeting || "Hello! I'm the Sports Analysis AI. Please tell me a match or team name." }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    // Hide on mypage — inline AI prompt is embedded there instead
    const isMyPage = pathname.includes('/mypage');

    // Update greeting when dictionary loads
    useEffect(() => {
        if (t.aiWidgetGreeting) {
            setMessages(prev => {
                if (prev.length === 1 && prev[0].id === 1) {
                    return [{ ...prev[0], content: t.aiWidgetGreeting }];
                }
                return prev;
            });
        }
    }, [t.aiWidgetGreeting]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { id: Date.now(), role: 'user' as const, content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/analysis/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg.content }),
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.response }]);
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: t.aiWidgetError || "An error occurred. Please try again later." }]);
        } finally { setLoading(false); }
    };

    return isMyPage ? null : (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="rounded-2xl p-4 shadow-2xl flex items-center space-x-2 transition-all hover:scale-105 animate-pulse-glow"
                    style={{
                        background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                        boxShadow: '0 0 30px rgba(0,212,255,0.3), 0 8px 32px rgba(0,0,0,0.4)',
                    }}
                >
                    <span className="text-xl">🤖</span>
                    <span className="font-bold text-sm text-white pr-1">{t.aiWidgetBtn || 'AI Analysis'}</span>
                </button>
            )}

            {isOpen && (
                <div className="glass-heavy w-96 h-[500px] flex flex-col overflow-hidden shadow-2xl animate-fade-up rounded-2xl border border-[var(--border-default)]">
                    {/* Header */}
                    <div className="p-4 flex justify-between items-center border-b border-[var(--border-subtle)]" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
                                <span className="text-lg">🤖</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-white">{t.aiWidgetTitle || 'AI 경기 분석가'}</h3>
                                <p className="text-[10px] text-[var(--text-muted)]">{t.aiWidgetSubtitle || '실시간 데이터 기반 분석'}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all">✕</button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-[rgba(0,212,255,0.12)] text-[var(--accent-primary)] rounded-br-none border border-[rgba(0,212,255,0.2)]'
                                    : 'glass-card text-white/70 rounded-bl-none'
                                    }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm prose-invert"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                                    ) : msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="glass-card rounded-xl rounded-bl-none p-3">
                                    <div className="flex space-x-1.5">
                                        <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--border-subtle)]" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t.aiWidgetPlaceholder || "Team or match to analyze..."}
                                className="flex-1 bg-white/[0.04] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent-primary)] text-white placeholder:text-[var(--text-muted)] transition-colors"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="p-2.5 rounded-xl disabled:opacity-30 transition-all hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-center mt-1.5">
                            <span className="text-[9px] text-[var(--text-muted)] opacity-50">{t.aiWidgetDisclaimer || 'AI analysis is for reference only'}</span>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
