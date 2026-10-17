"use client";
import React from 'react';

export interface TourStep {
    target: string;
    title: string;
    description: string;
    icon?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    hint?: string;
}

interface OnboardingTourProps {
    steps: TourStep[];
    tourId: string;
    delay?: number;
    forceStart?: boolean;
    onComplete?: () => void;
    onSkip?: () => void;
}

export default function OnboardingTour(_props: OnboardingTourProps) {
    return null;
}

export function TourRestartButton(_props: { tourId: string; onRestart?: () => void; label?: string }) {
    return null;
}
