"use client";
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

type Section = {
    id: string;
    icon: string;
    title: string;
    content: React.ReactNode;
};

export default function ManualPage() {
    const [activeSection, setActiveSection] = useState('intro');

    const sections: Section[] = [
        {
            id: 'intro',
            icon: '🎯',
            title: 'Service Introduction',
            content: (
                <div className="space-y-6">
                    <div className="p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(0,212,255,0.15)' }}>
                        <h3 className="text-lg font-extrabold mb-3" style={{ color: 'var(--accent-primary)' }}>What is Scorenix?</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Scorenix compares and analyzes global sports odds data to identify
                            statistically favorable zones (Value Opportunities) — an <strong className="text-white">AI-powered sports data analytics platform</strong>.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FeatureCard
                            icon="📊"
                            title="Odds Efficiency Analysis"
                            desc="Compares true probabilities from global odds with domestic odds to automatically identify zones with 5%+ expected value (EV)."
                        />
                        <FeatureCard
                            icon="🧮"
                            title="Kelly Criterion Money Management"
                            desc="Calculates mathematically optimal allocation ratios to minimize risk while maximizing long-term returns."
                        />
                        <FeatureCard
                            icon="🤖"
                            title="AI Analysis Reports"
                            desc="Provides per-match AI analysis reports to support data-driven, rational decision making."
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'value-bet',
            icon: '💡',
            title: 'What is Value Analysis?',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        A Value Opportunity is <strong className="text-white">a scenario where the odds offered are higher than the actual probability</strong>.
                        Over time, these opportunities are mathematically expected to yield positive returns.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 Expected Value (EV) Formula</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            EV = (P<sub>true</sub> × O<sub>domestic</sub>) - 1
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P<sub>true</sub></strong> = True probability derived from Pinnacle odds (margin removed)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O<sub>domestic</sub></strong> = Domestic odds offered by Betman/Proto</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span>When EV &gt; 0.05 (5%), it qualifies as a <strong style={{ color: 'var(--status-success)' }}>Value Opportunity</strong></span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📖 Example</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)' }}>
                                        <th className="text-left py-2 px-3">Item</th>
                                        <th className="text-right py-2 px-3">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Pinnacle Home Odds</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>1.85</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>True Probability (margin removed)</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>55.2%</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Betman Home Odds</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--odds-home)' }}>2.05</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>Expected Value (EV)</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--status-success)' }}>+13.2% ✅</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                            → In this case, selecting Home Win at Betman yields an expected excess return of 13.2% over the long run.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'kelly',
            icon: '📈',
            title: 'Kelly Criterion',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        The Kelly Criterion is a money management strategy that <strong className="text-white">mathematically calculates the optimal bet size</strong>.
                        Scorenix uses a safe <strong style={{ color: 'var(--accent-primary)' }}>1/8 Fractional Kelly</strong> approach.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 1/8 Kelly Formula</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            Bet = Bankroll × (1/8) × (P × O - 1) / (O - 1)
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">Bankroll</strong> = Total funds</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P</strong> = True win probability (Pinnacle-based)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O</strong> = Domestic odds</span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <h4 className="text-sm font-bold mb-2" style={{ color: '#f87171' }}>⚠️ Why 1/8 Kelly?</h4>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Full Kelly is theoretically optimal but has very high variance.
                            Using 1/8 Kelly <strong className="text-white">retains ~87% of returns while reducing bankruptcy risk to below 0.01%</strong>.
                            Professional bettors typically use 1/4 to 1/8 Kelly as the standard.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'data-sources',
            icon: '🌐',
            title: 'Data Sources',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Scorenix collects and analyzes global odds data to provide the most accurate probabilities.
                    </p>
                    <div className="space-y-3">
                        <RuleItem
                            title="Pinnacle (Sharp Line)"
                            desc="The world's largest bookmaker, offering the most efficient market prices through low margins (~2-3%). Widely recognized as the industry benchmark for 'true odds'."
                            badge="Benchmark"
                            badgeColor="#60a5fa"
                        />
                        <RuleItem
                            title="API-Football"
                            desc="Comprehensive sports data API providing odds, standings, player stats, injuries, live scores, and AI predictions from a single source."
                            badge="Primary"
                            badgeColor="#4ade80"
                        />
                        <RuleItem
                            title="Supported Sports"
                            desc="Covers major leagues including Soccer (EPL, La Liga, Serie A, Bundesliga, K-League), Baseball (MLB, KBO, NPB), Basketball (NBA, KBL), Volleyball, and more."
                            badge="Sports"
                            badgeColor="#a78bfa"
                        />
                        <RuleItem
                            title="Data Refresh Cycle"
                            desc="Odds data is refreshed periodically and may change until match start. Always verify on the official site before making final decisions."
                            badge="Refresh"
                            badgeColor="#fbbf24"
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'howto',
            icon: '📖',
            title: 'How to Use',
            content: (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <StepItem
                            step={1}
                            title="Browse Value Opportunities"
                            desc="Compare odds efficiency on the 'Value Analysis' page. Matches with EV of 5%+ are automatically filtered."
                        />
                        <StepItem
                            step={2}
                            title="Check AI Analysis"
                            desc="View detailed match analysis, odds history charts, and AI reports on the 'AI Predictions' page."
                        />
                        <StepItem
                            step={3}
                            title="Select & Combine Matches"
                            desc="Add analyzed matches to your cart and check optimal Kelly-based allocation."
                        />
                        <StepItem
                            step={4}
                            title="Save Portfolio"
                            desc="Save your final combinations to 'My Portfolio' for systematic management."
                        />
                        <StepItem
                            step={5}
                            title="Track Performance"
                            desc="After matches end, check results and ROI. Analyze cumulative performance to refine your strategy."
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'faq',
            icon: '❓',
            title: 'FAQ',
            content: (
                <div className="space-y-4">
                    <FaqItem
                        q="이 서비스는 어떤 서비스인가요?"
                        a="Scorenix는 스포츠 데이터 분석 플랫폼입니다. 데이터를 통계적으로 비교·분석하여 정보를 제공하며, 직접적인 거래를 중개하지 않습니다."
                    />
                    <FaqItem
                        q="해외 데이터를 기준으로 사용하는 이유는?"
                        a="해외 글로벌 데이터는 세계에서 가장 효율적이고 마진이 낮아(~2-3%), 업계에서 공정 데이터의 기준점으로 널리 인정받고 있습니다."
                    />
                    <FaqItem
                        q="밸류 기회가 결과를 보장하나요?"
                        a="아닙니다. 밸류 기회는 장기적으로 기대값이 높다는 의미입니다. 개별 경기는 빗나갈 수 있으며, 수백 개 샘플에 걸쳐 효과가 나타납니다."
                    />
                    <FaqItem
                        q="어떤 스포츠/리그를 지원하나요?"
                        a="축구(EPL, 라리가, 세리에A, 분데스리가, K리그), 야구(MLB, KBO, NPB), 농구(NBA, KBL), 배구 등 주요 글로벌 리그를 지원합니다. 지원 리그는 계속 확대되고 있습니다."
                    />
                    <FaqItem
                        q="데이터는 실시간인가요?"
                        a="30개 이상의 글로벌 데이터 소스에서 주기적으로 갱신됩니다. 데이터는 경기 시작 전까지 변동될 수 있으니 최종 확인을 권장합니다."
                    />
                </div>
            ),
        },
        {
            id: 'disclaimer',
            icon: '📜',
            title: '면책조항',
            content: (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Scorenix는 <strong className="text-white">스포츠 데이터 분석 정보</strong>를 제공하는 서비스입니다.
                            본 서비스는 불법 행위를 조장하지 않으며, 이용자의 예측 결과에 대한 법적 책임을 지지 않습니다.
                        </p>
                    </div>
                    <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            본 서비스의 분석 결과는 참고용입니다. 최종 판단과 책임은 이용자에게 있습니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            서비스 이용 시 해당 국가의 법률과 규정을 준수해 주세요.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            과도한 사용은 문제를 일으킬 수 있습니다. 책임감 있는 이용을 권장합니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            데이터의 정확성은 보장되지 않습니다. 최종 확인은 공식 사이트에서 해주세요.
                        </li>
                    </ul>
                </div>
            ),
        },
    ];

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <div className="mb-8">
                    <h1 className="text-2xl font-extrabold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-3xl">📖</span>
                        이용 안내
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        핵심 개념과 서비스 이용 방법을 알아보세요.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar Navigation */}
                    <nav className="lg:w-56 shrink-0">
                        <div className="lg:sticky lg:top-24 space-y-1">
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2.5 ${activeSection === s.id ? 'text-white' : ''}`}
                                    style={activeSection === s.id
                                        ? { background: 'var(--accent-primary)' }
                                        : { color: 'var(--text-secondary)' }
                                    }
                                    onMouseEnter={e => { if (activeSection !== s.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (activeSection !== s.id) (e.currentTarget as HTMLElement).style.background = ''; }}
                                >
                                    <span className="text-base">{s.icon}</span>
                                    {s.title}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                        {sections.map(s => (
                            activeSection === s.id && (
                                <div key={s.id} className="glass-card p-6 animate-fade-up">
                                    <h2 className="text-xl font-extrabold mb-6 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                                        <span className="text-2xl">{s.icon}</span>
                                        {s.title}
                                    </h2>
                                    {s.content}
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

// Sub-components
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
    return (
        <div className="p-4 rounded-xl transition-transform hover:scale-[1.02]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-2xl mb-2">{icon}</div>
            <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        </div>
    );
}

function RuleItem({ title, desc, badge, badgeColor }: { title: string; desc: string; badge: string; badgeColor: string }) {
    return (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${badgeColor}20`, color: badgeColor }}>{badge}</span>
                <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
        </div>
    );
}

function StepItem({ step, title, desc }: { step: number; title: string; desc: string }) {
    return (
        <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-extrabold shrink-0" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                {step}
            </div>
            <div className="flex-1 p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
        </div>
    );
}

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full text-left px-5 py-4 flex items-center justify-between transition"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{q}</span>
                <span className="text-lg transition-transform" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm leading-relaxed animate-fade-up" style={{ color: 'var(--text-secondary)' }}>
                    {a}
                </div>
            )}
        </div>
    );
}
