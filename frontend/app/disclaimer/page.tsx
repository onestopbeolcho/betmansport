"use client";
import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function DisclaimerPage() {
    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">

                {/* Hero Banner */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,59,48,0.2), rgba(255,149,0,0.2))',
                            border: '1px solid rgba(255,59,48,0.3)',
                        }}>
                        <span className="text-4xl">⚖️</span>
                    </div>
                    <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        분석 위험 고지 및 면책조항
                    </h1>
                    <p className="mt-3 text-lg" style={{ color: 'var(--text-muted)' }}>
                        책임 있는 이용 및 위험 고지
                    </p>
                </div>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    {/* 핵심 고지 */}
                    <section>
                        <div className="p-6 rounded-2xl" style={{
                            background: 'linear-gradient(135deg, rgba(255,59,48,0.1), rgba(255,59,48,0.05))',
                            border: '2px solid rgba(255,59,48,0.3)',
                        }}>
                            <h2 className="text-xl font-extrabold mb-4" style={{ color: '#FF3B30' }}>
                                🚨 핵심 고지사항
                            </h2>
                            <div className="space-y-4 text-base">
                                <p className="font-bold">
                                    1. 본 서비스는 <span style={{ color: '#FF3B30' }}>데이터 분석 도구입니다.</span>
                                </p>
                                <p>
                                    Scorenix는 공공 스포츠 데이터 기반 <strong>통계 분석 도구</strong>입니다.
                                    모든 분석, 예측, AI 결과는 참고용이며, 이용 판단은
                                    전적으로 이용자의 재량과 책임에 달려 있습니다.
                                </p>
                                <p className="font-bold">
                                    2. 분석 결과는 <span style={{ color: '#FF3B30' }}>정확성을 보장하지 않습니다.</span>
                                </p>
                                <p>
                                    AI 예측은 통계적 확률에 기반하며, 개별 경기 결과를 예측할 수 없습니다.
                                </p>
                                <p className="font-bold">
                                    3. 회사는 이용자의 결과에 대해 <span style={{ color: '#FF3B30' }}>책임을 지지 않습니다.</span>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Legal Usage */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>합법적 이용 안내</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="space-y-3">
                                <p>
                                    ✅ 본 서비스는 공공 스포츠 데이터를 기반으로 한 <strong>AI 통계 분석 도구</strong>입니다.
                                </p>
                                <p>
                                    ❌ 본 서비스를 불법적 목적으로 사용하는 것은 엄격히 금지됩니다.
                                </p>
                                <p>
                                    ⚠️ 이용자는 해당 국가 및 지역의 법률을 준수할 책임이 있습니다.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Age Restriction */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>연령 제한</h2>
                        <div className="flex items-center gap-4 p-4 rounded-xl" style={{
                            background: 'rgba(255,149,0,0.1)',
                            border: '1px solid rgba(255,149,0,0.3)',
                        }}>
                            <span className="text-4xl">🔞</span>
                            <div>
                                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>19세 미만 이용 불가</p>
                                <p className="mt-1">
                                    한국 법률에 따라 19세 미만은 본 서비스를 이용할 수 없습니다.
                                    회원가입 시 연령 확인에 동의하는 것으로 간주합니다.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Responsible Gaming */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>성숙한 이용 안내</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="space-y-3">
                                <p>• 분석 결과를 참고하되 합리적으로 판단하세요</p>
                                <p>• 감정적인 판단을 피하세요</p>
                                <p>• AI 분석은 확률 기반이며, 결과를 보장하지 않습니다</p>
                            </div>
                        </div>
                    </section>

                    {/* Helpline */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>도움이 필요하신가요?</h2>
                        <div className="p-4 rounded-xl" style={{
                            background: 'rgba(52,199,89,0.1)',
                            border: '1px solid rgba(52,199,89,0.3)',
                        }}>
                            <p className="font-bold mb-2" style={{ color: '#34C759' }}>🆘 상담 지원</p>
                            <div className="space-y-2">
                                <p>고객 지원: <strong>scorenix@gmail.com</strong></p>
                                <p>담당자 연락처: <strong>010-8725-4591</strong></p>
                            </div>
                        </div>
                    </section>

                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-4">
                            <Link href="/terms" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>이용약관</Link>
                            <Link href="/privacy" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>개인정보처리방침</Link>
                        </div>
                        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>최종 업데이트: 2026년 3월 8일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
