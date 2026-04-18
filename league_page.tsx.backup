"use client";

import React, { useState, useEffect } from "react";

interface LeagueUser {
    id: string;
    email: string;
    nickname: string;
    prediction_count: number;
    won: number;
    lost: number;
    total_roi: number;
    hit_rate: number;
}

export default function LeaguePage() {
    const [users, setUsers] = useState<LeagueUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"total_roi" | "hit_rate">("total_roi");

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
                const res = await fetch(`${apiUrl}/api/league/leaderboard?sort_by=${sortBy}&limit=50`);
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data.users || []);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [sortBy]);

    return (
        <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl pt-20">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                    🏆 Prediction League
                </h1>
                <p className="text-gray-400 mb-8">
                    Top AI sports analysts ranked by pure prediction skills. No money, just pure respect.
                </p>

                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setSortBy("total_roi")}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${
                            sortBy === "total_roi" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                    >
                        Total ROI
                    </button>
                    <button
                        onClick={() => setSortBy("hit_rate")}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${
                            sortBy === "hit_rate" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                    >
                        Accuracy (Hit Rate)
                    </button>
                </div>

                <div className="bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 animate-pulse">
                            Loading leaderboard...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            No predictions yet. Make your first pick to join the league!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-700 text-gray-300 text-sm">
                                    <tr>
                                        <th className="p-4 rounded-tl-lg">Rank</th>
                                        <th className="p-4">Analyst (User)</th>
                                        <th className="p-4 text-center">Picks</th>
                                        <th className="p-4 text-center">W-L</th>
                                        <th className="p-4 text-right">Hit Rate</th>
                                        <th className="p-4 text-right rounded-tr-lg">Total ROI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, index) => (
                                        <tr 
                                            key={user.id} 
                                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition"
                                        >
                                            <td className="p-4 font-bold text-gray-300">
                                                {index === 0 ? "🥇 1" : index === 1 ? "🥈 2" : index === 2 ? "🥉 3" : index + 1}
                                            </td>
                                            <td className="p-4 font-medium text-white flex items-center gap-2">
                                                {user.nickname}
                                            </td>
                                            <td className="p-4 text-center text-gray-400">{user.prediction_count}</td>
                                            <td className="p-4 text-center text-gray-400">{user.won}-{user.lost}</td>
                                            <td className="p-4 text-right text-indigo-400 font-medium">
                                                {user.hit_rate.toFixed(1)}%
                                            </td>
                                            <td className={`p-4 text-right font-bold ${user.total_roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                {user.total_roi > 0 ? "+" : ""}{user.total_roi.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
