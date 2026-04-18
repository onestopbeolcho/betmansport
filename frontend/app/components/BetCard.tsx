import React, { useState } from 'react';

interface BetProps {
    data: {
        match_name: string;
        bet_type: string;
        domestic_odds: number;
        pinnacle_odds: number;
        true_probability: number;
        expected_value: number;
        kelly_pct: number;
        max_tax_free_stake?: number;
        ai_insight?: string;
    }
}

export default function BetCard({ data }: BetProps) {
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        setSaved(true);
    };

    const translatePick = (pick: string) => {
        if (pick === 'Home') return 'Home Win';
        if (pick === 'Draw') return 'Draw';
        if (pick === 'Away') return 'Away Win';
        return pick;
    };

    return (
        <div className="glass-card p-5 hover:border-[rgba(0,212,255,0.3)] transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-base font-bold text-white">{data.match_name}</h3>
                    <span className="badge mt-1 inline-block">Soccer</span>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black gradient-text">{(data.expected_value * 100 - 100).toFixed(2)}%</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Expected Return</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Recommended Pick</div>
                    <div className="text-base font-bold text-white">{translatePick(data.bet_type)}</div>
                    <div className="text-sm font-bold text-[var(--accent-primary)]">@ {data.domestic_odds.toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">True Probability</div>
                    <div className="text-base font-bold text-white">{(data.true_probability * 100).toFixed(1)}%</div>
                    <div className="text-xs text-[var(--text-muted)]">Intl: {data.pinnacle_odds.toFixed(2)}</div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Kelly %</span>
                    <div className="text-lg font-black text-white">{(data.kelly_pct * 100).toFixed(2)}%</div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)]">Tax-Free Limit</span>
                    <div className="text-base font-bold text-[var(--accent-secondary)]">
                        {data.max_tax_free_stake ? `${data.max_tax_free_stake.toLocaleString()} KRW` : '-'}
                    </div>
                </div>
            </div>

            {data.ai_insight && (
                <div className="mt-4 p-3 rounded-lg bg-[rgba(0,212,255,0.05)] border border-[rgba(0,212,255,0.1)]">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">🤖</span>
                        <span className="text-xs font-bold text-[var(--accent-primary)]">AI Analysis Insight</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {/* If text contains markdown-like bold, we can just split or render as text for now. Since we are passing clean text with `**`, let's just strip or handle it simply. */}
                        {data.ai_insight.replace(/\*\*/g, '')}
                    </p>
                </div>
            )}

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button
                    onClick={handleSave}
                    disabled={saved}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}
                >
                    {saved ? '✅ Saved' : '+ Add to Portfolio'}
                </button>
                <button className="btn-primary text-sm px-4 py-1.5">Betman →</button>
            </div>
        </div>
    );
}
