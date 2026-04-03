"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface TourStep {
    /** data-tour 속성의 값 또는 CSS selector */
    target: string;
    /** 말풍선 제목 */
    title: string;
    /** 친절한 1인칭 설명 */
    description: string;
    /** 아이콘 (이모지) */
    icon?: string;
    /** 말풍선 위치 (모바일에서는 자동으로 bottom 강제) */
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    /** 추가 힌트 (작은 글씨) */
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

export default function OnboardingTour({
    steps,
    tourId,
    delay = 1500,
    forceStart = false,
    onComplete,
    onSkip,
}: OnboardingTourProps) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
    const [animating, setAnimating] = useState(false);
    const [positioned, setPositioned] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    // 투어 시작 판단
    useEffect(() => {
        if (forceStart) {
            setCurrentStep(0);
            const timer = setTimeout(() => setIsActive(true), delay);
            return () => clearTimeout(timer);
        }
        const key = `tour_completed_${tourId}`;
        if (typeof window !== 'undefined' && !localStorage.getItem(key)) {
            const timer = setTimeout(() => setIsActive(true), delay);
            return () => clearTimeout(timer);
        }
    }, [forceStart, tourId, delay]);

    // 스크롤 잠금
    useEffect(() => {
        if (isActive) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            return () => {
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
            };
        }
    }, [isActive]);

    // 요소 위치 찾기 + 스크롤
    const findAndScroll = useCallback(() => {
        if (!isActive || steps.length === 0) return;
        setPositioned(false);

        const step = steps[currentStep];
        if (step.placement === 'center') {
            setSpotlightRect(null);
            setPositioned(true);
            return;
        }

        let el = document.querySelector(`[data-tour="${step.target}"]`);
        if (!el) el = document.querySelector(step.target);

        if (!el) {
            // 요소 못 찾으면 center 모드로 fallback
            setSpotlightRect(null);
            setPositioned(true);
            return;
        }

        // 스크롤을 body overflow 임시 해제하고 수행
        document.body.style.overflow = 'auto';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 스크롤 완료 후 위치 계산 (800ms 대기 — 동적 컨텐츠 로딩 고려)
        setTimeout(() => {
            document.body.style.overflow = 'hidden';
            const rect = el!.getBoundingClientRect();
            setSpotlightRect(rect);
            setPositioned(true);

            // 레이아웃 시프트 대비 200ms 후 한번 더 측정
            setTimeout(() => {
                const recheck = el!.getBoundingClientRect();
                if (Math.abs(recheck.top - rect.top) > 5 || Math.abs(recheck.left - rect.left) > 5) {
                    setSpotlightRect(recheck);
                }
            }, 200);
        }, 800);
    }, [isActive, currentStep, steps]);

    useEffect(() => {
        findAndScroll();
    }, [findAndScroll]);

    // 리사이즈 시 재계산
    useEffect(() => {
        if (!isActive) return;
        const handleResize = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const step = steps[currentStep];
                if (step.placement === 'center') return;
                let el = document.querySelector(`[data-tour="${step.target}"]`);
                if (!el) el = document.querySelector(step.target);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    setSpotlightRect(rect);
                }
            });
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(rafRef.current);
        };
    }, [isActive, currentStep, steps]);

    const goNext = () => {
        if (currentStep < steps.length - 1) {
            setAnimating(true);
            setTimeout(() => {
                setCurrentStep(s => s + 1);
                setAnimating(false);
            }, 250);
        } else {
            completeTour();
        }
    };

    const goPrev = () => {
        if (currentStep > 0) {
            setAnimating(true);
            setTimeout(() => {
                setCurrentStep(s => s - 1);
                setAnimating(false);
            }, 250);
        }
    };

    const completeTour = () => {
        setIsActive(false);
        setCurrentStep(0);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`tour_completed_${tourId}`, 'true');
        }
        onComplete?.();
    };

    const skipTour = () => {
        setIsActive(false);
        setCurrentStep(0);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`tour_completed_${tourId}`, 'true');
        }
        onSkip?.();
    };

    if (!isActive || steps.length === 0) return null;

    const step = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const isCenter = step.placement === 'center' || !spotlightRect;

    // 스포트라이트 스타일
    const pad = 8;
    const spotStyle: React.CSSProperties = spotlightRect ? {
        position: 'fixed',
        top: spotlightRect.top - pad,
        left: spotlightRect.left - pad,
        width: spotlightRect.width + pad * 2,
        height: Math.min(spotlightRect.height + pad * 2, window.innerHeight * 0.25), // 화면의 25%로 제한해서 정확하게 지시
        borderRadius: '12px',
        zIndex: 99999,
        pointerEvents: 'none' as const,
        transition: 'all 0.4s ease',
    } : { display: 'none' };

    // 모바일 전용: fixed bottom sheet 방식
    const tooltipStyle: React.CSSProperties = isCenter
        ? {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100001,
            width: isMobile ? 'calc(100vw - 32px)' : '380px',
            maxWidth: '420px',
        }
        : isMobile
            ? {
                // 모바일: 화면 하단 고정 (bottom sheet 방식)
                position: 'fixed',
                bottom: '16px',
                left: '16px',
                right: '16px',
                zIndex: 100001,
                width: 'auto',
            }
            : (() => {
                // 데스크톱: 요소 아래에 위치
                const tooltipW = 380;
                let top = spotlightRect!.bottom + pad + 16;
                let left = spotlightRect!.left + spotlightRect!.width / 2;

                // 아래 공간 부족하면 위로
                if (top + 250 > window.innerHeight) {
                    top = spotlightRect!.top - pad - 260;
                }

                // 좌우 넘침 방지
                if (left - tooltipW / 2 < 16) left = tooltipW / 2 + 16;
                if (left + tooltipW / 2 > window.innerWidth - 16) left = window.innerWidth - tooltipW / 2 - 16;

                return {
                    position: 'fixed' as const,
                    top: `${top}px`,
                    left: `${left}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 100001,
                    width: `${tooltipW}px`,
                    maxWidth: `${tooltipW}px`,
                };
            })();

    return (
        <>
            {/* Dark Overlay — 터치 스크롤 방지 */}
            <div
                className="fixed inset-0"
                style={{ background: 'rgba(0,0,0,0.75)', zIndex: 99998 }}
                onClick={skipTour}
                onTouchMove={e => e.preventDefault()}
            />

            {/* Spotlight */}
            {spotlightRect && (
                <div style={spotStyle}>
                    <div className="absolute inset-0 rounded-xl" style={{
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
                        border: '2px solid rgba(0,212,255,0.5)',
                    }} />
                    <div className="absolute inset-0 rounded-xl" style={{
                        boxShadow: '0 0 24px rgba(0,212,255,0.25)',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                </div>
            )}

            {/* Tooltip */}
            {positioned && (
                <div
                    ref={tooltipRef}
                    className={`transition-all duration-300 ${animating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
                    style={tooltipStyle}
                    onTouchMove={e => e.stopPropagation()}
                >
                    <div className="relative rounded-2xl overflow-hidden" style={{
                        background: 'linear-gradient(145deg, #1a1a2e 0%, #16162a 100%)',
                        border: '1px solid rgba(0,212,255,0.25)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.1)',
                    }}>
                        {/* Progress Bar */}
                        <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div
                                className="h-full transition-all duration-500 rounded-r-full"
                                style={{
                                    width: `${progress}%`,
                                    background: 'linear-gradient(90deg, #00d4ff, #8b5cf6)',
                                }}
                            />
                        </div>

                        <div className="p-4 sm:p-5">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-lg text-lg flex-shrink-0"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
                                            border: '1px solid rgba(0,212,255,0.25)',
                                        }}>
                                        {step.icon || '💡'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {steps.map((_, i) => (
                                            <div key={i} className="transition-all duration-300" style={{
                                                width: i === currentStep ? '16px' : '5px',
                                                height: '5px',
                                                borderRadius: '3px',
                                                background: i === currentStep
                                                    ? 'linear-gradient(90deg, #00d4ff, #8b5cf6)'
                                                    : i < currentStep
                                                        ? 'rgba(0,212,255,0.4)'
                                                        : 'rgba(255,255,255,0.1)',
                                            }} />
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={skipTour}
                                    className="text-[10px] px-2.5 py-1 rounded-full flex-shrink-0"
                                    style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}
                                >
                                    Skip ✕
                                </button>
                            </div>

                            {/* Content */}
                            <h3 className="text-sm sm:text-base font-bold mb-1.5" style={{ color: '#fff' }}>
                                {step.title}
                            </h3>
                            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {step.description}
                            </p>
                            {step.hint && (
                                <p className="text-[10px] sm:text-[11px] mt-2 px-2.5 py-1.5 rounded-lg" style={{
                                    color: 'rgba(0,212,255,0.85)',
                                    background: 'rgba(0,212,255,0.06)',
                                    border: '1px solid rgba(0,212,255,0.12)',
                                }}>
                                    💡 {step.hint}
                                </p>
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <button
                                    onClick={goPrev}
                                    disabled={currentStep === 0}
                                    className="text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                                    style={{
                                        color: currentStep === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
                                        background: currentStep === 0 ? 'transparent' : 'rgba(255,255,255,0.05)',
                                        minHeight: '36px',
                                    }}
                                >
                                    ← Prev
                                </button>

                                <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    {currentStep + 1} / {steps.length}
                                </span>

                                <button
                                    onClick={goNext}
                                    className="text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95"
                                    style={{
                                        background: currentStep === steps.length - 1
                                            ? 'linear-gradient(135deg, #00d4ff, #8b5cf6)'
                                            : 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.2))',
                                        color: '#fff',
                                        border: '1px solid rgba(0,212,255,0.3)',
                                        boxShadow: currentStep === steps.length - 1
                                            ? '0 4px 20px rgba(0,212,255,0.3)'
                                            : 'none',
                                        minHeight: '36px',
                                    }}
                                >
                                    {currentStep === steps.length - 1 ? 'Get Started 🚀' : 'Next →'}
                                </button>
                            </div>
                        </div>

                        {/* Decorative glow */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 pointer-events-none" style={{
                            background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
                        }} />
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * 투어 다시 보기를 위한 버튼 컴포넌트
 */
export function TourRestartButton({
    tourId,
    onRestart,
    label = 'Replay Tutorial',
}: {
    tourId: string;
    onRestart: () => void;
    label?: string;
}) {
    const handleRestart = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(`tour_completed_${tourId}`);
        }
        onRestart();
    };

    return (
        <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{
                background: 'rgba(0,212,255,0.08)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(0,212,255,0.2)',
                backdropFilter: 'blur(8px)',
            }}
        >
            <span>📖</span>
            {label}
        </button>
    );
}
