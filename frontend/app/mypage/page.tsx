"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

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

export default function MyPage() {
    const [slips, setSlips] = useState<Slip[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchSlips = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            try {
                const res = await fetch('/api/portfolio/slips/my', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSlips(data);
                } else {
                    console.error("Failed to fetch slips");
                    if (res.status === 401) router.push('/login');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchSlips();
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-extrabold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-3xl">💼</span>
                        나의 포트폴리오
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        저장된 조합과 분석 기록을 관리합니다.
                    </p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: '총 조합', value: slips.length, icon: '📋' },
                        { label: '진행 중', value: slips.filter(s => s.status === 'active').length, icon: '🔄', color: 'var(--accent-primary)' },
                        { label: '적중', value: slips.filter(s => s.status === 'won').length, icon: '✅', color: 'var(--status-success)' },
                        { label: '미적중', value: slips.filter(s => s.status === 'lost').length, icon: '❌', color: 'var(--status-danger)' },
                    ].map((stat, i) => (
                        <div key={i} className="glass-card p-4 text-center">
                            <div className="text-xl mb-1">{stat.icon}</div>
                            <div className="text-2xl font-black font-mono" style={{ color: stat.color || 'var(--text-primary)' }}>{stat.value}</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Saved Slips List */}
                <div>
                    <h3 className="text-base font-bold flex items-center mb-4" style={{ color: 'var(--text-primary)' }}>
                        💾 저장된 조합 리스트
                        <span className="ml-2 badge badge-value">{slips.length}</span>
                    </h3>

                    {loading ? (
                        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                            <div className="animate-spin inline-block w-8 h-8 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-3"></div>
                            <p>불러오는 중...</p>
                        </div>
                    ) : slips.length === 0 ? (
                        <div className="glass-card text-center py-12 border-dashed">
                            <div className="text-4xl mb-3 opacity-30">📊</div>
                            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>저장된 조합이 없습니다.</p>
                            <Link href="/market" className="btn-primary text-sm px-5 py-2 inline-block">
                                분석하러 가기 →
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {slips.map((slip) => (
                                <div key={slip.id} className="glass-card overflow-hidden hover:border-[rgba(0,212,255,0.3)] transition-all">
                                    {/* Slip header */}
                                    <div className="px-4 py-3 flex justify-between items-center border-b border-[var(--border-subtle)]" style={{ background: 'var(--bg-elevated)' }}>
                                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                            조합 #{slip.id}
                                            <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
                                                {new Date(slip.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${slip.status === 'active' ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' :
                                            slip.status === 'won' ? 'bg-[rgba(34,197,94,0.15)] text-[#4ade80]' :
                                                slip.status === 'lost' ? 'bg-[rgba(239,68,68,0.15)] text-[#f87171]' :
                                                    'bg-white/5 text-[var(--text-muted)]'
                                            }`}>
                                            {slip.status === 'active' ? '진행 중' : slip.status === 'won' ? '적중' : slip.status === 'lost' ? '미적중' : slip.status.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Slip items */}
                                    <div className="p-4 space-y-2">
                                        {slip.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm border-b border-[var(--border-subtle)] last:border-0 pb-2 last:pb-0">
                                                <div>
                                                    <span className="font-medium mr-2" style={{ color: 'var(--accent-primary)' }}>
                                                        [{item.selection === 'Home' ? '승' : item.selection === 'Away' ? '패' : '무'}]
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{item.match_name}</span>
                                                </div>
                                                <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{item.odds.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Slip footer */}
                                    <div className="flex justify-between items-center px-4 py-3 border-t border-[var(--border-subtle)]" style={{ background: 'var(--bg-surface)' }}>
                                        <div>
                                            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>총 배당률</span>
                                            <span className="text-lg font-black gradient-text font-mono">{slip.total_odds.toFixed(2)}배</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                                                예상 당첨금 ({slip.stake.toLocaleString()}원)
                                            </span>
                                            <span className="text-lg font-bold" style={{ color: 'var(--status-success)' }}>
                                                {slip.potential_return.toLocaleString()}원
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
