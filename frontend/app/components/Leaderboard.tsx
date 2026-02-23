
"use client";
import React, { useEffect, useState } from 'react';

interface LeaderboardItem {
    rank: number;
    user_id: string;
    points: number;
    accuracy: number;
    tier: string;
}

export default function Leaderboard() {
    const [users, setUsers] = useState<LeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('/api/prediction/leaderboard');
            if (res.ok) setUsers(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchLeaderboard(); }, []);

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Master': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'Expert': return 'bg-[rgba(0,212,255,0.15)] text-[var(--accent-primary)] border-[rgba(0,212,255,0.3)]';
            case 'Pro': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-white/5 text-[var(--text-muted)] border-[var(--border-subtle)]';
        }
    };

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-center" style={{ background: 'var(--bg-elevated)' }}>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>🏆</span> 분석가 랭킹
                </h3>
                <span className="badge">실시간</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="text-[11px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)]">
                            <th className="px-5 py-3 w-16 text-center">순위</th>
                            <th className="px-5 py-3">분석가</th>
                            <th className="px-5 py-3 text-center">등급</th>
                            <th className="px-5 py-3 text-center">적중률</th>
                            <th className="px-5 py-3 text-center">XP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                        {loading ? (
                            <tr><td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">랭킹 로딩 중...</td></tr>
                        ) : users.map((user) => (
                            <tr key={user.user_id} className="hover:bg-white/[0.02] transition-all">
                                <td className="px-5 py-3 text-center font-bold text-[var(--text-muted)]">
                                    {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : user.rank}
                                </td>
                                <td className="px-5 py-3 font-bold text-white/80">{user.user_id}</td>
                                <td className="px-5 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTierColor(user.tier)}`}>{user.tier}</span>
                                </td>
                                <td className="px-5 py-3 text-center font-mono text-[var(--text-secondary)]">{user.accuracy}%</td>
                                <td className="px-5 py-3 text-center font-bold text-[var(--accent-primary)]">{user.points.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 text-center text-[10px] text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
                * Master 등급에 도전하세요!
            </div>
        </div>
    );
}
