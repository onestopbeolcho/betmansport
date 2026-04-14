"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import ProAnalysisPanel from '../../components/ProAnalysisPanel';
import { useDictionarySafe } from '../../context/DictionaryContext';

interface AIPrediction {
    match_id: string;
    confidence: number;
    recommendation: string;
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    team_home?: string;
    team_away?: string;
    team_home_ko?: string;
    team_away_ko?: string;
    match_time?: string;
    league?: string;
    factors: { name: string; weight: number; score: number; detail: string; }[];
    home_rank: number;
    away_rank: number;
    home_form: string;
    away_form: string;
    injuries_home: string[];
    injuries_away: string[];
    api_prediction_pct?: { home: number; draw: number; away: number };
}

interface MatchDetail {
    match_id: string;
    home: string;
    away: string;
    standings: any;
    recent_matches: any;
    lineups: any;
    injuries: any;
}

export default function PredictionPage() {
    const params = useParams();
    const router = useRouter();
    const match_id = params?.match_id as string;
    const dict = useDictionarySafe();
    const tm = (dict as any)?.market || {} as Record<string, string>;
    const tc = (dict as any)?.common || {} as Record<string, string>;

    const [loading, setLoading] = useState(true);
    const [prediction, setPrediction] = useState<AIPrediction | null>(null);
    const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
    const [error, setError] = useState<string>('');

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

    useEffect(() => {
        if (!match_id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch AI Prediction
                const predRes = await fetch(`${API_BASE_URL}/api/ai/predictions/${encodeURIComponent(match_id)}`);
                if (predRes.ok) {
                    const predData = await predRes.json();
                    setPrediction(predData);
                } else if (predRes.status === 404) {
                    setError('경기 데이터를 찾을 수 없습니다. (Match not found)');
                }

                // Fetch Match Details (optional)
                const detailRes = await fetch(`${API_BASE_URL}/api/ai/match-detail/${encodeURIComponent(match_id)}`);
                if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    setMatchDetail(detailData);
                }
            } catch (err) {
                console.error("Failed to fetch prediction details", err);
                setError('데이터를 불러오는데 실패했습니다. (Failed to load data)');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [match_id, API_BASE_URL]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
                <Navbar />
                <main className="flex-grow max-w-4xl mx-auto px-4 py-12 w-full flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-4" />
                        <p style={{ color: 'var(--text-muted)' }}>{tc.loading || 'Loading predict data...'}</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !prediction) {
        return (
            <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
                <Navbar />
                <main className="flex-grow max-w-4xl mx-auto px-4 py-12 w-full text-center">
                    <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/10 mb-6">
                        <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{error || 'Match not found.'}</p>
                    </div>
                    <button 
                        onClick={() => router.push('/market')}
                        className="px-6 py-2.5 rounded-full font-bold transition-all text-white shadow-lg"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {tm.backToMarket || 'Go to Market'}
                    </button>
                </main>
            </div>
        );
    }

    const teamHome = prediction.team_home_ko || prediction.team_home || match_id.split('_')[0];
    const teamAway = prediction.team_away_ko || prediction.team_away || match_id.split('_')[1];

    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
            <Navbar />
            
            <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full pb-32">
                {/* ── Match Header ── */}
                <div className="relative overflow-hidden rounded-3xl mb-8 p-6 sm:p-10 text-center border" style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, rgba(139,92,246,0.05) 100%)',
                    borderColor: 'rgba(0,212,255,0.15)',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                }}>
                    <div className="flex justify-center items-center gap-2 mb-4">
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-white/80 tracking-widest uppercase">
                            {prediction.league || 'AI Prediction'}
                        </span>
                        {prediction.match_time && (
                            <span className="text-xs text-white/50">{new Date(prediction.match_time).toLocaleString('ko-KR')}</span>
                        )}
                    </div>
                    
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1 text-right">
                            <h2 className="text-2xl sm:text-4xl font-black text-white">{teamHome}</h2>
                        </div>
                        <div className="text-lg sm:text-2xl font-light text-white/40">VS</div>
                        <div className="flex-1 text-left">
                            <h2 className="text-2xl sm:text-4xl font-black text-white">{teamAway}</h2>
                        </div>
                    </div>
                </div>

                {/* ── Highlight AI Prediction Result ── */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold mb-4 text-white/80">AI 승부 예측 결과</h3>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                        <div className="p-4 sm:p-6 rounded-2xl border transition-all" style={{
                            background: prediction.recommendation === 'HOME' ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
                            borderColor: prediction.recommendation === 'HOME' ? 'rgba(0,212,255,0.4)' : 'var(--border-subtle)',
                        }}>
                            <div className="text-sm text-white/50 mb-1">{teamHome} (Home)</div>
                            <div className="text-3xl font-black" style={{ color: prediction.recommendation === 'HOME' ? '#00d4ff' : 'var(--text-primary)' }}>
                                {prediction.home_win_prob}%
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 rounded-2xl border transition-all" style={{
                            background: prediction.recommendation === 'DRAW' ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)',
                            borderColor: prediction.recommendation === 'DRAW' ? 'rgba(255,255,255,0.4)' : 'var(--border-subtle)',
                        }}>
                            <div className="text-sm text-white/50 mb-1">무승부 (Draw)</div>
                            <div className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                                {prediction.draw_prob}%
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 rounded-2xl border transition-all" style={{
                            background: prediction.recommendation === 'AWAY' ? 'rgba(139,92,246,0.1)' : 'var(--bg-card)',
                            borderColor: prediction.recommendation === 'AWAY' ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)',
                        }}>
                            <div className="text-sm text-white/50 mb-1">{teamAway} (Away)</div>
                            <div className="text-3xl font-black" style={{ color: prediction.recommendation === 'AWAY' ? '#8b5cf6' : 'var(--text-primary)' }}>
                                {prediction.away_win_prob}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Detailed AI Analysis Panel ── */}
                <div className="mb-10 p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                     <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-2xl">🧠</span> 상세 인공지능 분석
                     </h3>
                     <ProAnalysisPanel 
                         prediction={{
                             ...prediction,
                             home_rank: matchDetail?.standings?.home?.rank || prediction.home_rank || 0,
                             away_rank: matchDetail?.standings?.away?.rank || prediction.away_rank || 0,
                             home_form: matchDetail?.recent_matches?.home?.form || prediction.home_form || '',
                             away_form: matchDetail?.recent_matches?.away?.form || prediction.away_form || '',
                             injuries_home: (matchDetail?.injuries?.home || []).map((i:any) => i.player_name),
                             injuries_away: (matchDetail?.injuries?.away || []).map((i:any) => i.player_name),
                         }}
                         homeTeam={teamHome}
                         awayTeam={teamAway}
                         injuries={matchDetail?.injuries || { home: [], away: [] }}
                         userTier="pro"
                     />
                </div>

                {/* ── Call to Action Buttons ── */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button 
                        onClick={() => router.push('/market')}
                        className="w-full sm:w-auto flex-1 px-8 py-4 rounded-2xl font-black text-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                        style={{ background: 'var(--accent-primary)', color: 'white', boxShadow: '0 4px 20px rgba(0,212,255,0.2)' }}
                    >
                        🗳️ 이 경기 투표하고 포인트 받기
                    </button>
                    <button 
                        onClick={() => router.push('/analysis')}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg transition-colors border flex items-center justify-center gap-2"
                        style={{ background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                        💡 다른 경기 AI 예측 더보기
                    </button>
                </div>
            </main>
        </div>
    );
}
