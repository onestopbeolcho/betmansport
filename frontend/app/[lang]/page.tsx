
"use client";
import React from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';
import HeroSection from '../components/HeroSection';
import MatchVoting from '../components/MatchVoting';
import Leaderboard from '../components/Leaderboard';
import AiAnalystWidget from '../components/AiAnalystWidget';

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow w-full relative z-10">
                <HeroSection />
                <MatchVoting />
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                    <Leaderboard />
                </section>
            </main>

            <AiAnalystWidget />
        </div>
    );
}
