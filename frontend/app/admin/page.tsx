"use client";
import React, { useState, useEffect } from 'react';

// Define the shape of the config object
interface SystemConfig {
    pinnacle_api_key: string;
    betman_user_agent: string;
    scrape_interval_minutes: number;
}

export default function AdminPage() {
    const [config, setConfig] = useState<SystemConfig>({
        pinnacle_api_key: '',
        betman_user_agent: '',
        scrape_interval_minutes: 10,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Fetch current config on mount
    useEffect(() => {
        fetch('/api/admin/config')
            .then(res => {
                if (!res.ok) throw new Error('Failed to load config');
                return res.json();
            })
            .then(data => setConfig(data))
            .catch(err => console.error("Error loading config:", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: name === 'scrape_interval_minutes' ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!res.ok) throw new Error('Failed to save config');

            setMessage('설정이 성공적으로 저장되었습니다!');
        } catch (err) {
            setMessage('설정 저장에 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">관리자 설정 (Admin)</h1>

                {message && (
                    <div className={`p-4 mb-4 rounded ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            피나클(Pinnacle) API 키
                        </label>
                        <input
                            type="password"
                            name="pinnacle_api_key"
                            value={config.pinnacle_api_key}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="API Key를 입력하세요"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            배트맨 User-Agent (크롤링용)
                        </label>
                        <input
                            type="text"
                            name="betman_user_agent"
                            value={config.betman_user_agent}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            데이터 수집 주기 (분)
                        </label>
                        <input
                            type="number"
                            name="scrape_interval_minutes"
                            value={config.scrape_interval_minutes}
                            onChange={handleChange}
                            min="1"
                            max="60"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 px-4 rounded-md text-white font-medium ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? '저장 중...' : '설정 저장'}
                    </button>
                </form>
            </div>
        </div>
    );
}
