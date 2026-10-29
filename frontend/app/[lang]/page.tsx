
"use client";
import React from 'react';
import Navbar from '../components/Navbar';
import ProtoRoundDashboard from '../components/ProtoRoundDashboard';

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col relative bg-[#f4f6f9]">
            <Navbar />

            <main className="flex-grow w-full relative z-10">
                <ProtoRoundDashboard />
            </main>
        </div>
    );
}


