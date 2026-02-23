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
                        투자 위험 고지 및 면책 조항
                    </h1>
                    <p className="mt-3 text-lg" style={{ color: 'var(--text-muted)' }}>
                        Responsible Gaming & Risk Disclaimer
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
                                    1. 본 서비스는 <span style={{ color: '#FF3B30' }}>투자 조언을 제공하지 않습니다.</span>
                                </p>
                                <p>
                                    Scorenix는 공개된 스포츠 데이터에 기반한 <strong>통계 분석 도구</strong>입니다.
                                    서비스에서 제공하는 모든 분석, 예측, 추천은 참고용 정보이며, 이용 결정은
                                    전적으로 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
                                </p>
                                <p className="font-bold">
                                    2. <span style={{ color: '#FF3B30' }}>금전적 손실 위험</span>이 있습니다.
                                </p>
                                <p>
                                    스포츠 데이터 분석은 원금 손실의 위험이 동반될 수 있으며, 과거의 분석 결과가 미래의 수익을 보장하지 않습니다.
                                    예측 정확도는 통계적 확률에 기반하며, 개별 경기의 결과는 예측할 수 없습니다.
                                </p>
                                <p className="font-bold">
                                    3. 회사는 이용자의 이용 결과에 대해 <span style={{ color: '#FF3B30' }}>어떠한 책임도 지지 않습니다.</span>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 합법적 이용 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>합법적 이용 안내</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="space-y-3">
                                <p>
                                    ✅ 본 서비스에서 분석하는 데이터의 출처는 <strong>체육진흥투표권(베트맨, betman.co.kr)</strong>으로,
                                    「국민체육진흥법」에 의해 합법적으로 운영되는 스포츠 토토입니다.
                                </p>
                                <p>
                                    ❌ 불법 온라인 도박 사이트에서의 이용을 위해 본 서비스를 사용하는 것은 엄격히 금지됩니다.
                                </p>
                                <p>
                                    ⚠️ 이용자는 자신의 거주 국가 및 지역의 관련 법률을 준수할 책임이 있습니다.
                                    일부 국가/지역에서는 스포츠 데이터 분석 서비스 이용이 제한될 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 연령 제한 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>연령 제한</h2>
                        <div className="flex items-center gap-4 p-4 rounded-xl" style={{
                            background: 'rgba(255,149,0,0.1)',
                            border: '1px solid rgba(255,149,0,0.3)',
                        }}>
                            <span className="text-4xl">🔞</span>
                            <div>
                                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>만 19세 미만 이용 불가</p>
                                <p className="mt-1">
                                    대한민국 법률에 따라 만 19세 미만의 미성년자는 본 서비스를 이용할 수 없습니다.
                                    서비스 가입 시 연령 확인에 동의하는 것으로 간주합니다.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 건전한 이용 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>건전한 이용 가이드</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <p className="font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>✅ 권장 사항</p>
                                <ul className="space-y-2">
                                    <li>• 잃어도 괜찮은 금액만 투자</li>
                                    <li>• 데이터 기반 합리적 의사결정</li>
                                    <li>• 월별 투자 한도 설정</li>
                                    <li>• 감정적 이용 자제</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.2)' }}>
                                <p className="font-bold mb-2" style={{ color: '#FF3B30' }}>❌ 주의 사항</p>
                                <ul className="space-y-2">
                                    <li>• 빚을 내서 이용하지 마세요</li>
                                    <li>• 손실 만회를 위한 추가 이용 금지</li>
                                    <li>• 생활비를 투자에 사용하지 마세요</li>
                                    <li>• 도박 중독 의심 시 즉시 도움 요청</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 도움 연락처 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>도움이 필요하신가요?</h2>
                        <div className="p-4 rounded-xl" style={{
                            background: 'rgba(52,199,89,0.1)',
                            border: '1px solid rgba(52,199,89,0.3)',
                        }}>
                            <p className="font-bold mb-2" style={{ color: '#34C759' }}>🆘 도박 중독 상담</p>
                            <div className="space-y-2">
                                <p>한국도박문제관리센터: <strong>1336</strong> (24시간 무료)</p>
                                <p>정신건강위기상담전화: <strong>1577-0199</strong></p>
                                <p>웹사이트: <a href="https://www.kcgp.or.kr" target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-primary)' }} className="underline">www.kcgp.or.kr</a></p>
                            </div>
                        </div>
                    </section>

                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-4">
                            <Link href="/terms" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>이용약관</Link>
                            <Link href="/privacy" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>개인정보처리방침</Link>
                        </div>
                        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>최종 수정일: 2026년 2월 18일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
