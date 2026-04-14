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
            title: '서비스 소개',
            content: (
                <div className="space-y-6">
                    <div className="p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(0,212,255,0.15)' }}>
                        <h3 className="text-lg font-extrabold mb-3" style={{ color: 'var(--accent-primary)' }}>스코어닉스란?</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            스코어닉스(Scorenix)는 글로벌 스포츠 배당 데이터를 비교/분석하여
                            통계적으로 유리한 구간(밸류 기회)을 찾아내는 <strong className="text-white">AI 기반 스포츠 데이터 분석 플랫폼</strong>입니다.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FeatureCard
                            icon="📊"
                            title="배당 효율성 분석"
                            desc="해외 배당과 국내 배당을 비교하여 데이터 기반 기대수익(EV)이 5% 이상인 구간을 자동으로 계산 및 필터링합니다."
                        />
                        <FeatureCard
                            icon="🧮"
                            title="안전한 비중 시스템"
                            desc="안정성을 최우선으로 리스크를 최소화하면서 장기적으로 수치를 관리할 수 있는 수학적 최적의 분석 비중을 제안합니다."
                        />
                        <FeatureCard
                            icon="🤖"
                            title="AI 머신러닝 리포트"
                            desc="단순 데이터 시각화를 넘어 28개 이상의 특성을 평가하는 AI 분석 엔진이 합리적인 의사결정을 지원합니다."
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'value-bet',
            icon: '💡',
            title: '밸류 분석이란?',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        밸류 기회(Value Opportunity)란 <strong className="text-white">실제 예상 확률에 비해 플랫폼에서 제공되는 배당률이 더 높게 책정된 구간</strong>을 뜻합니다.
                        이러한 수학적 우위 기회에 장기적으로 접근할 경우 통계적으로 긍정적인 기대 마진을 발생시킬 수 있습니다.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 기대 가치(EV) 산출 공식</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            EV(%) = (P<sub>true</sub> × O<sub>domestic</sub>) - 1
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P<sub>true</sub></strong> = 해외 글로벌 오즈메이커의 마진을 제거해 산출한 실제 적중 확률</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O<sub>domestic</sub></strong> = 국내 제공 기준 배당률</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span>결과값이 0.05 (5%) 이상일 경우 해당 경기를 <strong style={{ color: 'var(--status-success)' }}>고가치 분석 구간 (Value Opportunity)</strong>으로 간주합니다.</span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📖 예시 시나리오</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)' }}>
                                        <th className="text-left py-2 px-3">항목</th>
                                        <th className="text-right py-2 px-3">수치</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>해외 기준 홈 승 무마진 배당</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>1.85</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>내부 산출 실제 당첨 확률</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>55.2%</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>국내 배당 (홈 승리 시)</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--odds-home)' }}>2.05</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>기대 가치(EV) 밸류 지수</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--status-success)' }}>+13.2% ✅</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                            → 결과 해석: 위 경우 데이터를 기준으로 약 100회 산출할 때, 1회당 장기적으로 13.2%의 통계적 우위(Edge) 구조를 가집니다.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'kelly',
            icon: '📈',
            title: '안전 보장 (켈리 자산관리)',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        켈리 공식은 금융계에서 증권 등에 접근할 때 쓰이는 <strong className="text-white">수학적 최적 자산 비중 분배 전략</strong>입니다.
                        스코어닉스는 변동성을 관리하기 위해 방어적이고 보수적인 <strong style={{ color: 'var(--accent-primary)' }}>1/8 켈리 시스템</strong>을 핵심 원칙으로 제안합니다.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 1/8 분할 켈리 비중 산출 공식</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            투입 비중 = 총 자본금 × (1/8) × (P × O - 1) / (O - 1)
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">자본금</strong> = 현재 포트폴리오의 뱅크롤 총액</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P</strong> = 밸류 분석에서 기반 산정한 이길 체급(확률)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O</strong> = 현재 검증하려는 기준 배당률</span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <h4 className="text-sm font-bold mb-2" style={{ color: '#f87171' }}>⚠️ 전액 할당이 아닌 1/8 분할인 이유</h4>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            수학적으로 최대 분배가 목표 도달에는 빠를 수 있지만, 단기 변동성에 의해 데이터 지표가 크게 흔들립니다. 
                            1/8 분할 기준을 사용하면 <strong className="text-white">분석 효율의 87%는 유지하면서, 지표 이탈 위험(Drawdown)을 0.01% 이하로 극소화할 수 있습니다.</strong> 전문 데이터 분석가들이 지향하는 기본적인 데이터 접근 마인드셋입니다.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'data-sources',
            icon: '🌐',
            title: '검증된 데이터 소스',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        스코어닉스는 편향된 오즈메이커가 아닌 세계에서 가장 효율적인 기관들의 데이터를 조합 활용합니다.
                    </p>
                    <div className="space-y-3">
                        <RuleItem
                            title="Pinnacle (마켓 기준 배당)"
                            desc="세계 최대 규모의 샤프(Sharp) 오즈 마켓으로, 마진이 2~3% 미만이라 전체 시장 참여자들의 실시간 동향이 가장 순수하게 반영되는 '공정 확률'의 기준점입니다."
                            badge="Benchmark"
                            badgeColor="#60a5fa"
                        />
                        <RuleItem
                            title="API-Football 연동"
                            desc="선수 결장(Injury), 헤드투헤드 폼, 동기부여 등 데이터 분석에 필요한 기초 재료를 엔터프라이즈 급 API를 통해 매일 30분 마다 고도화 수집합니다."
                            badge="Primary"
                            badgeColor="#4ade80"
                        />
                        <RuleItem
                            title="종목 커버리지"
                            desc="축구(EPL, 라리가, 세리에A, K-League 등), 야구(MLB, KBO), 농구(KBL, NBA) 등 전세계 메이저 스포츠 데이터 일체 커버"
                            badge="Sports"
                            badgeColor="#a78bfa"
                        />
                        <RuleItem
                            title="데이터 업데이트 시간"
                            desc="배당 정보는 매 30분마다 동기화 되며 배당 낙폭이 발생합니다. 실제 기록 및 판단 전 공식 사이트의 데이터를 반드시 직접 재차 대조하십시오."
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
            title: '서비스 이용 워크플로우',
            content: (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <StepItem
                            step={1}
                            title="[밸류 분석] 탭 모니터링"
                            desc="매일 업데이트 되는 경기 중, 시장 배당 효율성과 비교하여 마이너스 가치를 내는 경기를 버리고 5% 이상 밸류 경기들만 스캔하세요."
                        />
                        <StepItem
                            step={2}
                            title="[AI 예측] 데이터 교차검증"
                            desc="단순 밸류가 높아도 핵심 결장자가 있으면 AI 신뢰도가 낮습니다. AI 엔진이 해당 데이터에 부여한 '신뢰도'와 상세 그래프를 직접 검증하세요."
                        />
                        <StepItem
                            step={3}
                            title="바구니 및 시스템 비중 파악"
                            desc="데이터 검증이 끝난 대상을 클릭하여 하단 카트에 담고, 뱅크롤 대비 시스템이 계산해주는 켈리 비중의 수준을 파악합니다."
                        />
                        <StepItem
                            step={4}
                            title="[내 포트폴리오] 탭 저장"
                            desc="단기성에 그치지 않기 위해 분석한 포트폴리오를 내 정보에 직접 저장하여 기록/관리를 시작하세요."
                        />
                        <StepItem
                            step={5}
                            title="성과 및 멘탈 트래킹"
                            desc="장기적인 분석 성과를 지표화하기 위해 감이 아닌 데이터를 계속 추적하고 실제 결과 데이터를 반영하여 피드백 루프를 반복하세요."
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'faq',
            icon: '❓',
            title: '자주 묻는 질문 (FAQ)',
            content: (
                <div className="space-y-4">
                    <FaqItem
                        q="이 플랫폼의 정체성과 목적이 무엇인가요?"
                        a="스코어닉스는 스포츠 데이터 분석 및 시각화 정보를 제공하는 구독형/열람형 정보제공 인포 플랫폼입니다. 특정 경기나 도박 행위를 유도하지 않으며, 직접적인 사행성 연결 조장 행위는 절대 취급하지 않습니다."
                    />
                    <FaqItem
                        q="왜 해외 데이터를 가지고 와서 비교하나요?"
                        a="한국 기관 배당은 마진율이 높고 조정 속도가 보수적인 특징을 띄며 변동성이 적습니다. 전 세계 시장 흐름을 즉각 반영하는 해외 Sharp 마켓의 흐름을 지표 삼아 국내 시장에서의 유리한 간극(갭 차이)를 찾아내는 것이 핵심 로직입니다."
                    />
                    <FaqItem
                        q="밸류 5%라는 것이 데이터 우위를 뜻하나요?"
                        a="그렇습니다. 밸류 기회란 동전 던지기에서 확률 대비 수학적 기대치가 더 높게 형성된 프리미엄 확률 구간을 뜻합니다. 개별 분석 결과의 성공여부와 무관하게 수백 번 누적될 수록 확률적으로 견고해지는 수학적 연구 기조를 의미합니다."
                    />
                    <FaqItem
                        q="현재 이용 권한 정책은 어떻게 되나요?"
                        a="일부 베이직 스포트는 무료 열람이 가능하며, AI 딥 머신러닝 리포트와 고밸류 추출 알고리즘 엔진 풀액세스를 위해선 VIP 프라임 멤버십 구독이 요구됩니다."
                    />
                </div>
            ),
        },
        {
            id: 'disclaimer',
            icon: '📜',
            title: '면책조항 필독',
            content: (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            스코어닉스(Scorenix)에서 표출하는 지표 및 확률 알고리즘은 <strong className="text-white">오직 스포츠 통계 및 빅데이터 데이터 분석 시각화 연구 목적</strong>으로 구동됩니다.
                        </p>
                    </div>
                    <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            본 서비스의 예측 및 추천 마킹 표기는 참고용 정보일 뿐, 이용자의 최종 판단의 근거로 보장받거나 손실 구제를 약속하지 않습니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            관련 법령 내에서 건전하고 책임감 있는 방향으로 데이터를 참고해주시기를 당부드리며 모든 민/형사상 최종 판단/결과 책임은 이용자 당사자에게 귀속됩니다.
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
                        플랫폼 이용 안내서
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        데이터가 든든하게 뒷받침하는 명확한 데이터 분석 가이드를 만나보세요.
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
