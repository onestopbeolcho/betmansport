
"use client";
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';
import HeroSection from '../components/HeroSection';
import MatchVoting from '../components/MatchVoting';
import Leaderboard from '../components/Leaderboard';
import OnboardingTour, { TourRestartButton } from '../components/OnboardingTour';
import { homeTourSteps } from '../lib/tourSteps';

export default function Home() {
    const [tourForceStart, setTourForceStart] = useState(false);

    return (
        <div className="min-h-screen flex flex-col relative" data-tour="tour-welcome" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow w-full relative z-10">
                <HeroSection />
                <MatchVoting />
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                    <Leaderboard />
                </section>
            </main>

            {/* Tour Restart FAB */}
            <div className="fixed bottom-6 right-4 z-50 sm:right-6">
                <TourRestartButton
                    tourId="home"
                    onRestart={() => setTourForceStart(true)}
                    label="가이드 투어"
                />
            </div>

            {/* Onboarding Tour */}
            <OnboardingTour
                steps={homeTourSteps}
                tourId="home"
                delay={2000}
                forceStart={tourForceStart}
                onComplete={() => setTourForceStart(false)}
                onSkip={() => setTourForceStart(false)}
            />
        </div>
    );
}
