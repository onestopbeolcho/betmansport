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
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

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
                        🎉 100% Free Analytics · 전면 무료화 선언
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black leading-tight text-white">
                        {isKo ? (
                            <>모든 AI 정밀 분석 서비스를 <span className="gradient-text">100% 무료</span>로 공개합니다</>
                        ) : (
                            <>All AI Analytics is now <span className="gradient-text">100% Free</span> for Everyone</>
                        )}
                    </h1>
                    <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {isKo ? (
                            <>
                                기존의 Pro 및 VIP 월간 구독 카드 결제 장벽을 완전히 걷어냈습니다.<br />
                                이제 가입만 하면 Scorenix의 모든 머신러닝 분석 카드와 최적 조합기를 자유롭게 이용하실 수 있습니다.
                            </>
                        ) : (
                            <>
                                We have fully dismantled the paywall for Pro & VIP subscriptions.<br />
                                Enjoy unlimited access to all machine learning cards, Expected Value analyses, and portfolio optimizers.
                            </>
                        )}
                    </p>
                </div>

                {/* ── 후원안내 메인 카드 (Donation Card) ───────────────────── */}
                <div className="glass-card p-8 rounded-2xl border border-[rgba(6,182,212,0.15)] shadow-[0_0_50px_rgba(6,182,212,0.05)] mb-12">
                    <div className="text-center max-w-xl mx-auto space-y-6">
                        <span className="text-5xl inline-block animate-bounce mb-2">☕</span>
                        <h2 className="text-xl font-bold text-white">
                            {isKo ? "AI 예측 서버 유지 및 지속적인 개발 후원" : "Support Our AI Infrastructure"}
                        </h2>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {isKo ? (
                                <>
                                    감정 없이 숫자로만 계산하는 AI 분석 엔진의 실시간 피드 정보 수집 및 고성능 연산 서버(GPU) 유지를 위해 유저분들의 자발적인 커피 한 잔 후원을 기다립니다.<br />
                                    모든 후원금은 24시간 실시간 배당 스캐너 동작 및 모델 재학습 서버 기여 비용으로 투명하게 활용됩니다.
                                </>
                            ) : (
                                <>
                                    We run high-compute GPU instances to refresh true probabilities and self-train our LightGBM models every night. If the analysis is valuable to your portfolio, consider buying us a cup of coffee to keep the servers running.
                                </>
                            )}
                        </p>

                        <hr className="border-[var(--border-subtle)] my-6" />

                        {isKo ? (
                            /* ── 한국어 전용 간편 송금 ── */
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <a 
                                        href="https://toss.me/scorenix" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        id="toss-donation-btn"
                                    >
                                        <button className="w-full py-4 bg-[#0057ff] hover:bg-[#0047d1] text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2">
                                            <span>⚡</span> 토스아이디로 간편 송금
                                        </button>
                                    </a>

                                    <a 
                                        href="https://qr.kakaopay.com/share" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        id="kakao-donation-btn"
                                    >
                                        <button className="w-full py-4 bg-[#fee500] hover:bg-[#ebd300] text-[#191919] font-extrabold text-xs rounded-xl transition shadow-lg shadow-yellow-400/10 flex items-center justify-center gap-2">
                                            <span>💬</span> 카카오페이 간편 송금
                                        </button>
                                    </a>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] text-center">
                                    ※ 위 버튼은 상업적 결제망(PG)을 거치지 않으며 개인 정보가 노출되지 않는 안전한 간편 송금 링크입니다.
                                </p>
                            </div>
                        ) : (
                            /* ── 글로벌 후원 안내 (PayPal / Crypto / Support) ── */
                            <div className="space-y-4">
                                <div className="p-5 rounded-xl text-left bg-white/5 border border-white/10 space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-[var(--accent-primary)]">Global Sponsorship</span>
                                    <div className="text-xs text-gray-300 leading-relaxed">
                                        For international sponsors who want to support Scorenix global sports intelligence, you can leverage direct transfers or contact our support team.
                                    </div>
                                </div>
                                <a 
                                    href="mailto:support@scorenix.com" 
                                    className="block w-full"
                                    id="email-support-btn"
                                >
                                    <button className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition">
                                        ✉️ Contact Support for Global Sponsorship
                                    </button>
                                </a>
                            </div>
                        )}
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
                                q: isKo ? '왜 모든 기능을 무료로 전환했나요?' : 'Why is the service completely free?', 
                                a: isKo ? '보다 신뢰도 높은 인공지능 기반 분석 정보를 유저분들께 널리 전수하고 스포츠 가치 투자의 패러다임을 확립하기 위함입니다. 고성능 유지 비용은 채널 광고 및 자발적인 소액 후원을 기반으로 메꾸어 나가고 있습니다.' : 'We want to establish a truly data-driven paradigm for sports analysis. We monetize via YouTube automation and community sponsorships instead of hard paywalls.' 
                            },
                            { 
                                q: isKo ? '결제했던 정기 구독권은 어떻게 되나요?' : 'What happens to existing active subscriptions?', 
                                a: isKo ? '기존 결제 유저분들의 잔여 이용 기간은 전액 환불 및 전원 완전 무료 상태로 자동 전환되었습니다. 환불 문의는 공식 support 메일 혹은 마이페이지 고객지원 채널을 활용해 주십시오.' : 'All active paying subscribers have been migrated to the free plan. Please contact support@scorenix.com for refund settlements for any remaining active terms.' 
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
