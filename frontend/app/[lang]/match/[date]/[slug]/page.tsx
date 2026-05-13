import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import DeadlineBanner from '../../../../components/DeadlineBanner';
import ProAnalysisPanel from '../../../../components/ProAnalysisPanel';

// Since this is a server component, we use the absolute URL for backend calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';

interface MatchPageProps {
    params: {
        lang: string;
        date: string;       // e.g., "2026-03-21"
        slug: string;       // e.g., "1-fc-heidenheim-vs-bayer-leverkusen"
    };
}

async function getMatchData(date: string, slug: string) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/match-list`, { next: { revalidate: 3600 } });
        if (!res.ok) return null;
        const data = await res.json();
        const matches = data.matches || [];
        
        // Find matching by date and slug
        const match = matches.find((m: any) => m.date === date && m.slug === slug);
        if (!match) return null;

        // Fetch detailed AI prediction & match details
        const [predRes, detailRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/ai/predictions/${encodeURIComponent(match.match_id)}`, { next: { revalidate: 3600 } }).catch(() => null),
            fetch(`${API_BASE_URL}/api/ai/match-detail/${encodeURIComponent(match.match_id)}`, { next: { revalidate: 3600 } }).catch(() => null)
        ]);

        const prediction = predRes?.ok ? await predRes.json() : null;
        const detail = detailRes?.ok ? await detailRes.json() : null;

        return { match, prediction, detail };
    } catch (e) {
        console.error("Match data fetch error:", e);
        return null;
    }
}

export async function generateStaticParams() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/match-list`);
        if (!res.ok) return [{ lang: 'ko', date: '2026-01-01', slug: 'demo' }];
        const data = await res.json();
        const matches = data.matches || [];
        
        const params: any[] = [];
        for (const match of matches) {
            if (!match.date || !match.slug) continue;
            for (const lang of ['ko', 'en', 'ja', 'zh']) {
                params.push({
                    lang,
                    date: match.date,
                    slug: match.slug,
                });
            }
        }
        if (params.length === 0) return [{ lang: 'ko', date: '2026-01-01', slug: 'demo' }];
        return params;
    } catch (e) {
        console.error("generateStaticParams error:", e);
        return [{ lang: 'ko', date: '2026-01-01', slug: 'demo' }];
    }
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
    const data = await getMatchData(params.date, params.slug);
    
    if (!data || !data.match) {
        return {
            title: 'Match Not Found - Scorenix',
            description: 'The requested match data could not be found.',
        };
    }

    const { match } = data;
    const homeName = params.lang === 'ko' && match.home_ko ? match.home_ko : match.home;
    const awayName = params.lang === 'ko' && match.away_ko ? match.away_ko : match.away;
    
    const title = `${homeName} vs ${awayName} AI 데이터 분석 및 예측 - Scorenix`;
    const description = `${match.date} 진행되는 ${homeName} 대 ${awayName} 경기의 상세 배당 지표, AI 예측 확률, 라인업 및 H2H 전적을 Scorenix 데이터 분석 연구소에서 확인하세요.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'article',
            url: `https://scorenix.com/${params.lang}/match/${params.date}/${params.slug}`,
            siteName: 'Scorenix',
        },
        alternates: {
            canonical: `https://scorenix.com/${params.lang}/match/${params.date}/${params.slug}`
        }
    };
}

export default async function MatchDetailPage({ params }: MatchPageProps) {
    const data = await getMatchData(params.date, params.slug);
    
    if (!data || !data.match) {
        notFound();
    }

    const { match, prediction, detail } = data;
    const homeName = params.lang === 'ko' && match.home_ko ? match.home_ko : match.home;
    const awayName = params.lang === 'ko' && match.away_ko ? match.away_ko : match.away;

    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />
            
            <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
                {/* Header Section */}
                <div className="mb-8 p-6 rounded-2xl border" style={{ 
                    background: 'var(--bg-card)', 
                    borderColor: 'var(--border-color)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)' 
                }}>
                    <div className="text-center mb-6">
                        <div className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-3" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                            {match.league || 'Football'} • {match.date}
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black text-white flex flex-col sm:flex-row items-center justify-center gap-3">
                            <span style={{ color: '#00d4ff' }}>{homeName}</span>
                            <span className="text-sm font-bold opacity-50 px-3">VS</span>
                            <span style={{ color: '#8b5cf6' }}>{awayName}</span>
                        </h1>
                    </div>

                    {/* Odds Display */}
                    <div className="flex flex-wrap justify-center gap-4 mt-6">
                        <div className="flex-1 min-w-[100px] text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-xs text-white/50 mb-1">HOME</div>
                            <div className="text-xl font-bold" style={{ color: '#00d4ff' }}>{match.home_odds?.toFixed(2) || '-'}</div>
                            <div className="text-[10px] text-white/40 mt-1">{match.home_prob}%</div>
                        </div>
                        <div className="flex-1 min-w-[100px] text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-xs text-white/50 mb-1">DRAW</div>
                            <div className="text-xl font-bold font-mono text-white/80">{match.draw_odds?.toFixed(2) || '-'}</div>
                            <div className="text-[10px] text-white/40 mt-1">{match.draw_prob}%</div>
                        </div>
                        <div className="flex-1 min-w-[100px] text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-xs text-white/50 mb-1">AWAY</div>
                            <div className="text-xl font-bold" style={{ color: '#8b5cf6' }}>{match.away_odds?.toFixed(2) || '-'}</div>
                            <div className="text-[10px] text-white/40 mt-1">{match.away_prob}%</div>
                        </div>
                    </div>
                </div>

                {/* AI Prediction Section */}
                {prediction && (
                    <div className="mb-8 p-6 rounded-2xl border" style={{ 
                        background: 'linear-gradient(180deg, rgba(139,92,246,0.05) 0%, transparent 100%)',
                        borderColor: 'rgba(139,92,246,0.2)'
                    }}>
                        <ProAnalysisPanel 
                            prediction={prediction} 
                            homeTeam={homeName} 
                            awayTeam={awayName} 
                            historyData={detail?.history || []}
                            injuries={{
                                home: detail?.injuries?.home || [],
                                away: detail?.injuries?.away || []
                            }}
                            userTier="vip"
                        />
                        
                        {/* Go to Market Button */}
                        <div className="mt-8 text-center">
                            <a href={`/${params.lang}/market`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors text-white">
                                <span>전체 스코어닉스 분석 보기</span>
                                <span>→</span>
                            </a>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
