"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

interface ComboMatch {
  match_id: string;
  league: string;
  home: string;
  away: string;
  start_time: string;
  selection: string;
  odds: number;
}

interface ComboData {
  expected_value_percent: number;
  total_odds: number;
  kelly_fraction: number;
  matches: ComboMatch[];
}

export default function VipComboPanel() {
  const { user, token } = useAuth();
  const [combos, setCombos] = useState<ComboData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // API 호출 전 권한 체크 (안전 장치)
    if (!user || user.tier !== "vip") {
      setLoading(false);
      return;
    }

    const fetchCombos = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:8000/api/vip/combo/auto-optimize", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error("Failed to fetch VIP combos");
        }
        
        const data = await res.json();
        if (data.status === "success" && data.combos) {
          setCombos(data.combos);
        } else {
          setCombos([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchCombos();
    }
  }, [user, token]);

  if (!user || user.tier !== "vip") {
    return (
      <div className="relative rounded-2xl border border-gray-800 bg-gray-900/50 p-6 overflow-hidden">
        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold font-outfit text-white mb-2">VIP Exclusive AI Portfolio</h3>
          <p className="text-gray-300 mb-6 max-w-md">
            Unlock AI-optimized combinations with Kelly Criterion stake sizing. Maximize your EV (Expected Value) dynamically.
          </p>
          <a href="/pricing" className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all">
            Upgrade to VIP
          </a>
        </div>
        
        {/* Placeholder Blurred Content */}
        <div className="opacity-30 blur-sm pointer-events-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🤖</span> AI Portfolio Recommendations
            </h3>
          </div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-amber-400 font-bold">Combo #{i}</span>
                  <span className="text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded">EV: +15.4%</span>
                </div>
                <div className="h-12 bg-gray-700 rounded mb-2"></div>
                <div className="h-12 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
            <span className="text-amber-400">⚡</span> AI Optimized Portfolios
          </h2>
          <p className="text-gray-400 text-sm mt-1">Machine learning generated combinations with Kelly criterion allocation.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 text-sm text-center">
          {error}
        </div>
      ) : combos.length === 0 ? (
        <div className="p-8 text-center bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-gray-400">No profitable combinations found at the moment. The AI is scanning for new values.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {combos.map((combo, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx} 
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 bg-gray-800/80 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    #{idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Target EV: <span className="text-green-400">+{combo.expected_value_percent.toFixed(1)}%</span></h3>
                    <p className="text-xs text-gray-400">Total Odds: {combo.total_odds.toFixed(2)}x</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Recommended Stake</div>
                  <div className="font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg">
                    Kelly: {(combo.kelly_fraction * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {combo.matches.map((match, mIdx) => (
                  <div key={mIdx} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">{match.league}</span>
                      <span className="text-sm font-medium text-gray-100">{match.home} vs {match.away}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-400">Selection</span>
                        <span className="text-sm font-bold text-blue-400 capitalize">{match.selection}</span>
                      </div>
                      <div className="w-16 text-center bg-gray-800 rounded py-1 px-2 border border-gray-700">
                        <span className="text-sm font-bold text-white">{match.odds.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
