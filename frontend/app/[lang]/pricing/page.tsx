"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

export default function PricingPage() {
    const pathname = usePathname();
    const { user } = useAuth();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const isKo = currentLang === 'ko';

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
                {/* ── 무료화 선언 Hero Section ──────────────────── */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6"
                        style={{ 
                            background: 'rgba(6,182,212,0.1)', 
                            color: 'var(--accent-primary)', 
                            border: '1px solid rgba(6,182,212,0.2)' 
                        }}
                    >
                        ⚡ Premium Sports Tech · 100% 전면 무료화
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black leading-tight text-white">
                        {isKo ? (
                            <>Scorenix의 모든 AI 분석 리포트를 <span className="gradient-text">전면 무료</span>로 개방합니다</>
                        ) : (
                            <>All AI Sports Analytics is Now <span className="gradient-text">100% Free</span></>
                        )}
                    </h1>
                    <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {isKo ? (
                            <>
                                유료 멤버십 가입 장벽을 완전히 걷어냈습니다.<br />
                                회원 가입만으로 수학적 기대값(EV) 분석, AI 복수 경기 조합 최적화 시뮬레이터까지 모든 도구를 무제한으로 사용하십시오.
                            </>
                        ) : (
                            <>
                                We have dismantled all paywall barriers. Enjoy unrestricted access to our Expected Value (EV) engine, AI combination optimizers, and machine learning models.
                            </>
                        )}
                    </p>
                </div>

                {/* ── 비즈니스 파트너십 및 광고 제휴 카드 ───────────────────── */}
                <div className="glass-card p-8 rounded-2xl border border-[rgba(6,182,212,0.15)] shadow-[0_0_50px_rgba(6,182,212,0.05)] mb-12">
                    <div className="text-center max-w-xl mx-auto space-y-6">
                        <span className="text-5xl inline-block mb-2">🤝</span>
                        <h2 className="text-xl font-bold text-white">
                            {isKo ? "비즈니스 제휴 및 광고 문의" : "Business Partnerships & Advertising"}
                        </h2>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {isKo ? (
                                <>
                                    Scorenix는 매일 자동 업로드되는 유튜브 쇼츠 영상 및 활발한 사이트 트래픽을 보유하고 있습니다.<br />
                                    스포츠 미디어 제휴, 배너 및 영상 광고 게재, 머신러닝 데이터 API 활용 등 다양한 비즈니스 협업 제안을 환영합니다.
                                </>
                            ) : (
                                <>
                                    Scorenix leverages automated YouTube content distribution and high-retention platform traffic. We welcome data API licensing, banner ads, and strategic business collaborations.
                                </>
                            )}
                        </p>

                        <hr className="border-[var(--border-subtle)] my-6" />

                        <div className="p-6 rounded-xl text-left bg-white/5 border border-white/10 space-y-3">
                            <span className="text-[10px] uppercase font-bold text-[var(--accent-primary)]">Official Business Channel</span>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                    <div className="text-sm font-bold text-gray-300">공식 제휴 문의 이메일</div>
                                    <div className="text-base font-black text-white mt-1 select-all">support@scorenix.com</div>
                                </div>
                                <a href="mailto:support@scorenix.com" className="sm:self-center">
                                    <button className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-lg transition shadow-md shadow-cyan-500/10">
                                        ✉️ 제안서 보내기
                                    </button>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 제공 기능 리스트 (Features Showcase) ─────────────────── */}
                <div className="grid gap-6 sm:grid-cols-2 mb-12">
                    {[
                        { 
                            icon: '📊', 
                            title: isKo ? '실시간 Pinnacle 배당 효율 비교' : 'Pinnacle Odds Efficiency', 
                            desc: isKo ? '해외 최대 배당판 흐름과 국내 배당 효율을 교차 실시간 검증합니다.' : 'Cross-verify local odds with pinnacle true probabilities.' 
                        },
                        { 
                            icon: '🧠', 
                            title: isKo ? '7-Factor AI 머신러닝 리포트' : '7-Factor Machine Learning', 
                            desc: isKo ? '전력/최근폼/H2H/로스터/동기부여 등 7대 요소를 계량화하여 예측을 도출합니다.' : 'Structured analysis using LightGBM trained over 8,900+ matches.' 
                        },
                        { 
                            icon: '🔮', 
                            title: isKo ? 'AI 자동 조합 및 켈리 계산기' : 'AI Combination Optimizer', 
                            desc: isKo ? '세금을 절세하고 분산 비중(Kelly Criterion)을 반영한 최적 조합을 찾습니다.' : 'Minimize tax rates and maximize expected values (EV) dynamically.' 
                        },
                        { 
                            icon: '🤖', 
                            title: isKo ? 'AI 데이터 분석 전용 챗봇' : 'Unrestricted AI Chatbot', 
                            desc: isKo ? '질문 한 번으로 경기 순위, 부상 흐름, 상대 전적을 종합 브리핑합니다.' : 'Ask anything to get fully synthesized sports intelligence.' 
                        },
                    ].map((feat, idx) => (
                        <div key={idx} className="glass-card p-5 flex items-start gap-4">
                            <span className="text-2xl flex-shrink-0">{feat.icon}</span>
                            <div>
                                <h3 className="text-sm font-bold text-white">{feat.title}</h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">{feat.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── FAQ ──────────────────────────── */}
                <div className="border-t border-[var(--border-subtle)] pt-12">
                    <h3 className="text-lg font-bold text-center text-white mb-6">❓ {isKo ? "자주 묻는 질문" : "Frequently Asked Questions"}</h3>
                    <div className="space-y-4">
                        {[
                            { 
                                q: isKo ? '왜 모든 기능을 무료로 제공하나요?' : 'Why is the service completely free?', 
                                a: isKo ? '사용자 편의성을 극대화하여 스포츠 테크 플랫폼 시장에서의 트래픽 우위를 확보하고 구글 애드센스 광고 수익 및 제휴 비즈니스 모델로 운영비를 충당하기 위해 무료화를 전격 실행하였습니다.' : 'To capture platform traffic and build a global user base, we monetize via programmatic web advertising and enterprise partnership models instead of paywalls.' 
                            },
                            { 
                                q: isKo ? '비즈니스 제휴 제안 프로세스는 어떻게 되나요?' : 'What is the partnership proposal process?', 
                                a: isKo ? '공식 제안 이메일(support@scorenix.com)을 통해 회사(혹은 브랜드) 소개서 및 기획안을 송부해 주시면, 검토 후 담당자가 영업일 기준 3일 이내에 회신 및 미팅 협의를 도와드립니다.' : 'Please send your proposal and details to support@scorenix.com. Our partnerships director will review and reply within 3 business days.' 
                            }
                        ].map((faq, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                                <h4 className="text-xs font-bold text-white">Q. {faq.q}</h4>
                                <p className="text-xs leading-relaxed text-[var(--text-muted)]">A. {faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center text-[10px] text-[var(--text-muted)] mt-12">
                    <p>Scorenix AI Sports Data Lab | Email: support@scorenix.com</p>
                    <p className="mt-1">© 2026 Scorenix. All Rights Reserved.</p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
