import React from 'react';

interface BetProps {
    data: {
        match_name: string;
        bet_type: string;
        domestic_odds: number;
        pinnacle_odds: number;
        true_probability: number;
        expected_value: number;
        kelly_pct: number;
    }
}

export default function BetCard({ data }: BetProps) {
    const isHighValue = data.expected_value > 1.10; // Highlight huge value

    // 한글 변환 헬퍼
    const translatePick = (pick: string) => {
        if (pick === 'Home') return '승 (홈)';
        if (pick === 'Draw') return '무승부';
        if (pick === 'Away') return '패 (원정)';
        return pick;
    };

    return (
        <div className={`p-6 rounded-xl shadow-lg border-l-4 ${isHighValue ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-indigo-500' : 'bg-white border-green-500'} hover:shadow-xl transition-shadow`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{data.match_name}</h3>
                    <div className="flex items-center mt-1 space-x-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">축구</span>
                        <span className="text-sm text-gray-500">오늘 경기</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">{(data.expected_value * 100 - 100).toFixed(2)}%</div>
                    <div className="text-xs text-gray-500">기대 수익률</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase">추천 픽</div>
                    <div className="text-lg font-bold text-gray-900">{translatePick(data.bet_type)}</div>
                    <div className="text-sm font-semibold text-green-600">@ {data.domestic_odds.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase">실제 확률</div>
                    <div className="text-lg font-bold text-gray-900">{(data.true_probability * 100).toFixed(1)}%</div>
                    <div className="text-xs text-gray-400">해외: {data.pinnacle_odds.toFixed(2)}</div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">추천 배팅금 (켈리)</span>
                    <span className="text-2xl font-extrabold text-gray-800">{(data.kelly_pct * 100).toFixed(2)}%</span>
                </div>
                <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors">
                    배트맨 바로가기
                </button>
            </div>
        </div>
    );
}
