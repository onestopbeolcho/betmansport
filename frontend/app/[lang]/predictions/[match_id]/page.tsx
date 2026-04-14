import ClientPage from '../../../predictions/[match_id]/ClientPage';
import { Metadata } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://scorenix-backend-n5dv44kdaa-du.a.run.app';

export async function generateStaticParams() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/predictions`);
        if (res.ok) {
            const data = await res.json();
            return (data.predictions || []).map((p: any) => ({
                match_id: p.match_id,
            }));
        }
    } catch (e) {
        console.error("Failed to fetch predictions for static build", e);
    }
    return [];
}

export async function generateMetadata({ params }: { params: { match_id: string; lang: string } }): Promise<Metadata> {
    const { match_id } = params;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/predictions/${encodeURIComponent(match_id)}`);
        
        if (res.ok) {
            const data = await res.json();
            const home = data.team_home_ko || data.team_home || match_id.split('_')[0];
            const away = data.team_away_ko || data.team_away || match_id.split('_')[1];
            
            return {
                title: `${home} vs ${away} AI 승부 예측 - 스코어닉스 (Scorenix)`,
                description: `미리 보는 승부! 스코어닉스(Scorenix) AI가 분석한 ${home} 대 ${away} 승률과 상세 데이터를 확인해보세요. 홈 승률: ${data.home_win_prob}%, 원정 승률: ${data.away_win_prob}%`,
                openGraph: {
                    title: `${home} vs ${away} - AI 스포츠 분석 | 스코어닉스`,
                    description: `${home} vs ${away} 경기의 AI 승률과 추천 픽, 최근 폼 등 결장자 정보를 확인하세요. 지금 투표하고 포인트를 획득하세요!`,
                    type: 'website',
                },
                twitter: {
                    card: 'summary_large_image',
                    title: `${home} vs ${away} AI 예측 결과`,
                    description: `스코어닉스의 전문적인 AI 승부 예측 결과를 확인하세요!`,
                }
            };
        }
    } catch (e) {
        console.error("Metadata fetch error for match:", match_id, e);
    }
    
    return {
        title: '경기 AI 예측 - 스코어닉스 (Scorenix)',
        description: '스코어닉스(Scorenix)에서 제공하는 고도화된 AI 스포츠 승부 예측을 확인하세요.',
    };
}

export default function Page() {
    return <ClientPage />;
}
