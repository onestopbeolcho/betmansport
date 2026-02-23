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
    }
}

export default function BetCard({ data }: BetProps) {
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        setSaved(true);
    };

    const translatePick = (pick: string) => {
        if (pick === 'Home') return '홈 승';
        if (pick === 'Draw') return '무승부';
        if (pick === 'Away') return '원정 승';
        return pick;
    };

    return (
        <div className="glass-card p-5 hover:border-[rgba(0,212,255,0.3)] transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-base font-bold text-white">{data.match_name}</h3>
                    <span className="badge mt-1 inline-block">축구</span>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black gradient-text">{(data.expected_value * 100 - 100).toFixed(2)}%</div>
                    <div className="text-[10px] text-[var(--text-muted)]">기대 수익률</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">추천 픽</div>
                    <div className="text-base font-bold text-white">{translatePick(data.bet_type)}</div>
                    <div className="text-sm font-bold text-[var(--accent-primary)]">@ {data.domestic_odds.toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">실제 확률</div>
                    <div className="text-base font-bold text-white">{(data.true_probability * 100).toFixed(1)}%</div>
                    <div className="text-xs text-[var(--text-muted)]">해외: {data.pinnacle_odds.toFixed(2)}</div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">켈리 비율</span>
                    <div className="text-lg font-black text-white">{(data.kelly_pct * 100).toFixed(2)}%</div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)]">비과세 한도</span>
                    <div className="text-base font-bold text-[var(--accent-secondary)]">
                        {data.max_tax_free_stake ? `${data.max_tax_free_stake.toLocaleString()}원` : '-'}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button
                    onClick={handleSave}
                    disabled={saved}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}
                >
                    {saved ? '✅ 저장됨' : '+ 포트폴리오 담기'}
                </button>
                <button className="btn-primary text-sm px-4 py-1.5">배트맨 →</button>
            </div>
        </div>
    );
}
