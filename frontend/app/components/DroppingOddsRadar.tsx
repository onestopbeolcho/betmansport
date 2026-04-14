"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useDictionarySafe } from "../context/DictionaryContext";
import { motion, AnimatePresence } from "framer-motion";

interface DroppingAlert {
  league: string;
  home: string;
  away: string;
  start_time: string;
  team_type: "home" | "away";
  initial_odds: number;
  current_odds: number;
  drop_percent: number;
  bookmaker: string;
}

export default function DroppingOddsRadar() {
  const { user, token } = useAuth();
  const t = useDictionarySafe()?.vip || {};
  const [alerts, setAlerts] = useState<DroppingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.tier !== "vip") {
      setLoading(false);
      return;
    }

    const fetchDroppingOdds = async () => {
      try {
        setLoading(true);
        // 기본 10% 이상 하락 경기 조회
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";
        const res = await fetch(`${API_URL}/api/vip/market/dropping-odds?threshold=5.0`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error("Failed to fetch dropping odds");
        }
        
        const data = await res.json();
        if (data.status === "success" && data.alerts) {
          setAlerts(data.alerts);
        } else {
          setAlerts([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDroppingOdds();
    }
  }, [user, token]);

  if (!user || user.tier !== "vip") {
    // Blank or minimal loading state for non-VIP if rendered outside blurred container
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl relative overflow-hidden">
      {/* 펄스 레이더 효과 배경 */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 border border-rose-500/10 rounded-full animate-ping opacity-20 pointer-events-none"></div>
      <div className="absolute top-8 right-8 w-48 h-48 border border-rose-500/20 rounded-full animate-ping opacity-20 pointer-events-none" style={{ animationDelay: '0.5s' }}></div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
            <span className="text-rose-500 relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            {t.radarTitle || "급락 배당 레이더"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{t.radarDesc || "스마트 머니 감지. 급격한 배당 변동(5% 이상 하락)을 탐지합니다."}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-full text-xs font-bold">
          {t.radarLive || "LIVE"}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 text-sm text-center">
          {error}
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 text-center bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-gray-400">{t.noAlerts || "현재 급격한 변동이 감지된 경기가 없습니다. 레이더가 모니터링 중입니다."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {alerts.map((alert, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={`${alert.home}-${alert.away}`} 
                className="bg-gray-800 rounded-xl border border-rose-900/50 p-4 relative overflow-hidden group hover:border-rose-500/50 transition-colors"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">{alert.league}</span>
                      <span className="text-xs text-gray-400">{new Date(alert.start_time).toLocaleString()}</span>
                    </div>
                    <div className="text-white font-medium">
                      <span className={alert.team_type === "home" ? "text-rose-400 font-bold" : ""}>{alert.home}</span>
                      <span className="mx-2 text-gray-500">vs</span>
                      <span className={alert.team_type === "away" ? "text-rose-400 font-bold" : ""}>{alert.away}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-2 border border-gray-700 w-fit">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1">{t.initialOdds || "초기 배당"}</span>
                      <span className="text-gray-400 line-through text-sm">{alert.initial_odds.toFixed(2)}</span>
                    </div>
                    <div className="text-rose-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-rose-400 font-bold mb-1">{t.currentOdds || "현재 배당"}</span>
                      <span className="text-white font-bold text-lg">{alert.current_odds.toFixed(2)}</span>
                    </div>
                    <div className="bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded px-2 py-1 flex items-center justify-center">
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="font-bold text-sm">{alert.drop_percent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
