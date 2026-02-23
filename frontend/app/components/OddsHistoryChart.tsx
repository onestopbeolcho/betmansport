"use client";
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface HistoryItem {
    timestamp: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
}

interface Props {
    data: HistoryItem[];
}

const OddsHistoryChart: React.FC<Props> = ({ data }) => {
    if (!data || data.length < 2) {
        return (
            <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--text-muted)' }}>
                데이터가 충분하지 않습니다 (최소 2개 시점 필요)
            </div>
        );
    }

    const formattedData = data.map(item => ({
        ...item,
        time: new Date(item.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }));

    return (
        <div className="w-full h-64 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-xs font-bold mb-2 pl-2" style={{ color: 'var(--text-muted)' }}>배당 흐름 (최근순)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(18,18,24,0.95)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        }}
                        itemStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}
                        labelStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }} />
                    <Line
                        type="monotone"
                        dataKey="home_odds"
                        name="홈승"
                        stroke="#00d4ff"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#00d4ff' }}
                        activeDot={{ r: 4 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="draw_odds"
                        name="무승부"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="away_odds"
                        name="원정승"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#8b5cf6' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default OddsHistoryChart;
