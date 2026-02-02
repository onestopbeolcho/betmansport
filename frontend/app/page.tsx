"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BetCard from './components/BetCard';

interface BetData {
  match_name: string;
  bet_type: string;
  domestic_odds: number;
  pinnacle_odds: number;
  true_probability: number;
  expected_value: number;
  kelly_pct: number;
  timestamp: string;
}

export default function Home() {
  const [bets, setBets] = useState<BetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bets');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setBets(data);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-black text-indigo-600 tracking-tighter">SMART PROTO</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-500 hover:text-gray-900 font-medium">
                관리자
              </Link>
              <Link href="/pricing" className="px-4 py-2 rounded-md bg-gray-900 text-white font-medium hover:bg-gray-800 transition">
                구독하기
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">실시간 가치 투자 기회</h1>
            <p className="mt-2 text-gray-500">해외 배당률과의 차이를 분석하여 수익 기회를 포착합니다.</p>
          </div>
          <button
            onClick={fetchBets}
            disabled={loading}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-all"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 mr-2 border-2 border-gray-400 border-t-indigo-600 rounded-full"></span>
            ) : (
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            )}
            배당률 새로고침 A
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bets.length > 0 ? (
            bets.map((bet, idx) => (
              <BetCard key={idx} data={bet} />
            ))
          ) : (
            !loading && (
              <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500 text-lg">현재 발견된 가치 투자 기회가 없습니다.</p>
                <p className="text-sm text-gray-400 mt-2">잠시 후 다시 새로고침 해주세요.</p>
              </div>
            )
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">
            면책 조항: 본 서비스는 통계적 참고 자료를 제공할 뿐이며, 실제 투자의 책임은 사용자 본인에게 있습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
