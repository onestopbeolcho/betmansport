"use client";
import React from 'react';
import StandingsPage from '../[lang]/standings/page';
import Footer from '../components/Footer';

export default function RootStandingsPage() {
    return (
        <>
            <StandingsPage />
            <Footer lang="ko" />
        </>
    );
}
