
"use client";
import React, { useState, useEffect } from 'react';

export default function DeadlineBanner() {
    const [timeLeft, setTimeLeft] = useState('');
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const nextSaturday = new Date(now);
            const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
            nextSaturday.setDate(now.getDate() + daysUntilSat);
            nextSaturday.setHours(14, 0, 0, 0);

            if (nextSaturday <= now) {
                nextSaturday.setDate(nextSaturday.getDate() + 7);
            }

            const diff = nextSaturday.getTime() - now.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="relative border-b border-[var(--border-subtle)] overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 animate-gradient"
                style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.06) 0%, rgba(139,92,246,0.06) 50%, rgba(0,212,255,0.06) 100%)', backgroundSize: '200% 100%' }} />
            <div className="relative max-w-7xl mx-auto px-4 py-2 flex items-center justify-center text-xs gap-2">
                <span className="text-[var(--text-muted)]">⏱ 이번 매치데이 마감까지</span>
                <span className="text-[var(--accent-primary)] font-bold font-mono tracking-wider">{timeLeft}</span>
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
