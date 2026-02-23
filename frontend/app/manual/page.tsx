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
                        <h3 className="text-lg font-extrabold mb-3" style={{ color: 'var(--accent-primary)' }}>Scorenix란?</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Scorenix는 해외 배당(Pinnacle 기준)과 국내 배당(배트맨/프로토)의 <strong className="text-white">가격 차이</strong>를 분석하여,
                            통계적으로 유리한 구간(Value Bet)을 찾아주는 <strong className="text-white">데이터 기반 스포츠 투자 분석 플랫폼</strong>입니다.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FeatureCard
                            icon="📊"
                            title="배당 효율 분석"
                            desc="해외 진짜 확률과 국내 배당을 비교하여 기대값(EV) 5% 이상인 구간을 자동으로 발굴합니다."
                        />
                        <FeatureCard
                            icon="🧮"
                            title="세금 최적화"
                            desc="배트맨 과세 기준(200만원/100배)을 실시간으로 계산하고, 비과세 조합을 추천합니다."
                        />
                        <FeatureCard
                            icon="🤖"
                            title="AI 분석 리포트"
                            desc="경기별 AI 분석 리포트를 제공하여, 데이터 기반의 합리적인 투자 결정을 돕습니다."
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'value-bet',
            icon: '💡',
            title: '밸류벳이란?',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        밸류벳(Value Bet)이란 <strong className="text-white">실제 확률보다 높은 배당이 책정된 베팅</strong>을 의미합니다.
                        장기적으로 반복하면 수학적으로 수익이 기대되는 구간입니다.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 기대값(EV) 계산 공식</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            EV = (P<sub>true</sub> × O<sub>domestic</sub>) - 1
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P<sub>true</sub></strong> = Pinnacle 배당에서 역산한 진짜 확률 (마진 제거 후)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O<sub>domestic</sub></strong> = 배트맨/프로토에서 제공하는 국내 배당률</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span>EV &gt; 0.05 (5%) 이상일 때 <strong style={{ color: 'var(--status-success)' }}>밸류벳</strong>으로 판정</span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📖 예시</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)' }}>
                                        <th className="text-left py-2 px-3">항목</th>
                                        <th className="text-right py-2 px-3">값</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Pinnacle 홈 배당</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>1.85</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>마진 제거 후 진짜 확률</td>
                                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>55.2%</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>배트맨 홈 배당</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--odds-home)' }}>2.05</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-bold" style={{ color: 'var(--text-primary)' }}>기대값 (EV)</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: 'var(--status-success)' }}>+13.2% ✅</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                            → 이 경우 배트맨에서 홈 승에 베팅하면, 장기적으로 13.2%의 초과 수익이 기대됩니다.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'kelly',
            icon: '📈',
            title: '켈리 기준법',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        켈리 기준법(Kelly Criterion)은 <strong className="text-white">최적의 베팅 금액을 수학적으로 계산</strong>하는 자금 관리 전략입니다.
                        Scorenix는 안전한 <strong style={{ color: 'var(--accent-primary)' }}>1/8 부분 켈리(Fractional Kelly)</strong>를 사용합니다.
                    </p>
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <h4 className="font-bold mb-3 text-sm" style={{ color: 'var(--accent-primary)' }}>📐 1/8 켈리 공식</h4>
                        <div className="p-4 rounded-lg font-mono text-center text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            Bet = Bankroll × (1/8) × (P × O - 1) / (O - 1)
                        </div>
                        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">Bankroll</strong> = 총 투자 자산</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">P</strong> = Pinnacle 기반 진짜 승률</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>▸</span>
                                <span><strong className="text-white">O</strong> = 국내 배당률</span>
                            </li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <h4 className="text-sm font-bold mb-2" style={{ color: '#f87171' }}>⚠️ 왜 1/8 켈리인가?</h4>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            풀 켈리는 이론적 최적이지만 변동성(Variance)이 매우 큽니다.
                            1/8을 적용하면 <strong className="text-white">수익의 약 87%를 유지하면서 파산 확률을 0.01% 이하</strong>로 낮출 수 있습니다.
                            프로 베터들도 1/4~1/8 켈리를 표준으로 사용합니다.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'tax',
            icon: '🏛️',
            title: '세금 안내',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        배트맨(체육진흥투표권)의 적중금에 대한 과세 기준은 <strong className="text-white">소득세법 제21조</strong>에 의해 결정됩니다.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <div className="text-xs font-bold mb-2 px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>과세 조건 1</div>
                            <h4 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>적중금 200만원 초과</h4>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                적중금(투표금 × 배당률)이 <strong className="text-white">200만원을 초과</strong>하면
                                기타소득세 <strong style={{ color: '#f87171' }}>22%</strong> (소득세 20% + 지방소득세 2%)가 원천징수됩니다.
                            </p>
                        </div>
                        <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <div className="text-xs font-bold mb-2 px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>과세 조건 2</div>
                            <h4 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>배당 100배 + 적중금 10만원 초과</h4>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                배당률이 <strong className="text-white">100배를 초과</strong>하고, 적중금이 <strong className="text-white">10만원을 초과</strong>하면
                                동일하게 <strong style={{ color: '#f87171' }}>22%</strong>가 원천징수됩니다.
                            </p>
                        </div>
                    </div>
                    <div className="p-5 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                        <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--accent-primary)' }}>💡 절세 전략 (세금계산기 활용)</h4>
                        <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>1.</span>
                                <span>적중금이 200만원을 살짝 초과하면 → <strong className="text-white">경기 1개 제거</strong>로 비과세 구간 조정</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>2.</span>
                                <span>고배당 조합 시 → <strong className="text-white">베팅 금액을 비과세 한도까지 줄이기</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>3.</span>
                                <span>큰 금액 투자 시 → <strong className="text-white">여러 건으로 분할 구매</strong> (회차당 10만원 한도)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            ),
        },
        {
            id: 'betman-rules',
            icon: '⚽',
            title: '배트맨 규정',
            content: (
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        배트맨(betman.co.kr)은 대한민국 유일의 합법 스포츠 토토 판매 사이트입니다. 주요 규정을 숙지해주세요.
                    </p>
                    <div className="space-y-3">
                        <RuleItem
                            title="축구 적용 시간"
                            desc="배트맨 축구는 전반 + 후반 정규 시간(90분) 결과만 적용됩니다. 연장전, 승부차기 결과는 반영되지 않습니다."
                            badge="중요"
                            badgeColor="#f87171"
                        />
                        <RuleItem
                            title="구매 한도"
                            desc="1회차당 최대 100,000원까지 구매 가능합니다. 프로토 승부식은 최소 2경기부터 조합 가능합니다."
                            badge="한도"
                            badgeColor="#fbbf24"
                        />
                        <RuleItem
                            title="배당률 범위"
                            desc="배트맨 배당률은 1.01~999.99배 사이에서 설정됩니다. 프로토 승부식과 기록식의 배당 구조가 다릅니다."
                            badge="배당"
                            badgeColor="#60a5fa"
                        />
                        <RuleItem
                            title="결과 확정"
                            desc="경기 종료 후 공식 결과가 확정되면 배트맨에서 자동 정산됩니다. 이의신청은 결과 확정 후 7일 이내에 가능합니다."
                            badge="정산"
                            badgeColor="#4ade80"
                        />
                        <RuleItem
                            title="환급률"
                            desc="스포츠토토의 환급률은 약 50~60%로 설정되어 있습니다. 이는 복권 환급률(약 50%)과 유사한 수준입니다."
                            badge="환급"
                            badgeColor="#a78bfa"
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'howto',
            icon: '📖',
            title: '이용 방법',
            content: (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <StepItem
                            step={1}
                            title="배당 분석 확인"
                            desc="'밸류벳' 페이지에서 해외 배당과 국내 배당의 차이를 확인합니다. EV(기대값) 5% 이상인 밸류벳을 찾으세요."
                        />
                        <StepItem
                            step={2}
                            title="경기 선택"
                            desc="'AI예측' 페이지에서 원하는 경기의 배당을 클릭하여 장바구니에 담습니다. AI 분석 리포트와 배당 이력 차트도 확인할 수 있습니다."
                        />
                        <StepItem
                            step={3}
                            title="세금 시뮬레이션"
                            desc="'세금계산' 페이지에서 장바구니의 조합에 대한 예상 세금을 확인합니다. 비과세 조합으로 최적화할 수 있습니다."
                        />
                        <StepItem
                            step={4}
                            title="조합 저장 & 베팅"
                            desc="최종 결정한 조합을 '내 포트폴리오'에 저장합니다. 배트맨 사이트에서 동일하게 구매하세요."
                        />
                        <StepItem
                            step={5}
                            title="결과 추적"
                            desc="경기 종료 후 '내 포트폴리오'에서 결과와 수익률을 확인합니다. 포트폴리오 전체 성과를 관리하세요."
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
                        q="이 서비스는 도박 사이트인가요?"
                        a="아닙니다. Scorenix는 데이터 분석 플랫폼입니다. 실제 베팅은 대한민국 합법 사이트인 배트맨(betman.co.kr)에서만 진행됩니다. 저희는 분석 정보만 제공합니다."
                    />
                    <FaqItem
                        q="Pinnacle 배당은 왜 기준으로 사용하나요?"
                        a="Pinnacle은 세계 최대 규모의 북메이커로, 가장 낮은 마진(약 2~3%)과 가장 효율적인 시장을 운영하고 있어 '진짜 확률'의 기준으로 업계에서 널리 인정됩니다."
                    />
                    <FaqItem
                        q="밸류벳이면 무조건 이기나요?"
                        a="아닙니다. 밸류벳은 '장기적'으로 기대값이 양수인 베팅을 의미합니다. 단일 경기에서는 당연히 질 수 있으며, 최소 수백 건 이상의 샘플에서 효과가 나타납니다. 그래서 켈리 기준법으로 자금 관리가 필수적입니다."
                    />
                    <FaqItem
                        q="프로토 vs 토토 차이가 뭔가요?"
                        a="프로토 승부식은 2경기 이상을 조합하여 배당을 곱한 결합 베팅이고, 토토는 고정배당으로 진행됩니다. Scorenix는 프로토 승부식 분석에 최적화되어 있습니다."
                    />
                    <FaqItem
                        q="배당 데이터는 실시간인가요?"
                        a="해외 배당(Pinnacle)은 The Odds API를 통해 주기적으로 갱신됩니다. 배트맨 배당은 배트맨 공식 데이터를 기반으로 수집됩니다. 배당은 경기 시작 전까지 수시로 변동될 수 있으니, 최종 구매 전 배트맨에서 직접 확인해주세요."
                    />
                </div>
            ),
        },
        {
            id: 'disclaimer',
            icon: '📜',
            title: '면책 조항',
            content: (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Scorenix는 <strong className="text-white">스포츠 데이터 분석 정보</strong>를 제공하는 서비스입니다.
                            본 서비스는 도박을 조장하거나 권유하지 않으며, 사용자의 베팅 결과에 대해 어떠한 법적 책임도 지지 않습니다.
                        </p>
                    </div>
                    <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            본 서비스의 분석 결과는 참고 자료이며, 투자의 최종 결정과 책임은 사용자 본인에게 있습니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            스포츠 토토는 만 19세 이상만 구매 가능하며, 체육진흥투표권 발행 등에 관한 법률에 의해 규제됩니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            도박 중독이 의심되면 한국도박문제관리센터(☎ 1336)에 상담하시기 바랍니다.
                        </li>
                        <li className="flex items-start gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            배당 데이터의 정확성은 보장되지 않으며, 최종 배당은 배트맨 공식 사이트에서 확인해야 합니다.
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
                        이용 가이드
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        서비스의 핵심 개념과 이용 방법을 안내합니다.
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
