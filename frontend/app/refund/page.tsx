"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RefundRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/pricing');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="text-center">
                <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Redirecting to sponsorship page...</p>
            </div>
        </div>
    );
}
