"use client";
import React from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';
import { useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation';
import { i18n } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';

export default function PricingPage() {
    const { user } = useAuth();
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const tp = dict?.pricing || {} as any;
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const userTier = user?.tier || 'free';

    const Check = ({ color = 'var(--accent-primary)' }: { color?: string }) => (
        <span className="mr-3 flex-shrink-0" style={{ color }}>✓</span>
    );
    const Lock = () => (
        <span className="mr-3 flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>✗</span>
    );

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex-grow">
                <h1 className="text-4xl font-extrabold sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
                    {tp.headlinePre || 'Maximize data with'} <span className="gradient-text">{tp.headlineHighlight || 'Smart Analytics'}</span>
                </h1>
                <p className="mt-4 text-xl" style={{ color: 'var(--text-muted)' }}>
                    {tp.subheadline || "Don't miss data-driven sports analysis opportunities."}
                </p>

                <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8 text-left">

                    {/* ── Free Plan ── */}
                    <div className="glass-card relative p-8 flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Free</h3>
                            <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wide transform -translate-y-1/2"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                                {tp.freeBadge || 'Trial'}
                            </p>
                            <p className="mt-4 flex items-baseline" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight">{tp.freePrice || '$0'}</span>
                                <span className="ml-1 text-xl font-semibold">/{tp.month || 'mo'}</span>
                            </p>
                            <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                {tp.freeDesc || 'Try the service first'}
                            </p>

                            {/* Feature Category: 데이터 분석 */}
                            <div className="mt-6">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                    📊 {tp.catData || 'Data Analytics'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check />{tp.freeData1 || '3 daily value analyses'}</li>
                                    <li className="flex"><Check />{tp.freeData2 || 'Basic odds comparison'}</li>
                                    <li className="flex"><Check />{tp.freeData3 || 'Basic efficiency calculator'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: AI / 고급분석 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                    🧠 {tp.catAI || 'AI · Advanced'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                    <li className="flex"><Lock />{tp.freeAI1 || 'AI match prediction'}</li>
                                    <li className="flex"><Lock />{tp.freeAI2 || 'Portfolio analysis'}</li>
                                    <li className="flex"><Lock />{tp.freeAI3 || 'Combo optimization'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: 알림 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                    🔔 {tp.catAlert || 'Alerts · Support'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                    <li className="flex"><Lock />{tp.freeAlert1 || 'Real-time alerts'}</li>
                                    <li className="flex"><Lock />{tp.freeAlert2 || 'Custom alert rules'}</li>
                                </ul>
                            </div>
                        </div>
                        {user ? (
                            <span className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl"
                                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                ✓ {tp.currentPlan || 'Current Plan'}
                            </span>
                        ) : (
                            <a href={`/${currentLang}/register`} className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl transition-all"
                                style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.3)' }}>
                                {tp.startFree || 'Start Free'}
                            </a>
                        )}
                    </div>

                    {/* ── Pro Plan ── */}
                    <div className="glass-card relative p-8 flex flex-col ring-2" style={{ borderColor: 'var(--accent-primary)', boxShadow: '0 0 30px rgba(0,212,255,0.15)' }}>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Pro Analyst</h3>
                            <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2"
                                style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                                {tp.popular || 'Popular'}
                            </p>
                            <p className="mt-4 flex items-baseline" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight gradient-text">{tp.proPrice || '$49'}</span>
                                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>/{tp.month || 'mo'}</span>
                            </p>
                            <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                {tp.proDesc || 'Analytics plan for serious analysis'}
                            </p>

                            {/* Feature Category: 데이터 분석 */}
                            <div className="mt-6">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>
                                    📊 {tp.catData || 'Data Analytics'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check />{tp.proData1 || 'Unlimited value analyses'}</li>
                                    <li className="flex"><Check />{tp.proData2 || 'Live odds comparison'}</li>
                                    <li className="flex"><Check />{tp.proData3 || 'Auto efficiency gap calc'}</li>
                                    <li className="flex"><Check />{tp.proData4 || 'Tax optimizer'}</li>
                                    <li className="flex"><Check />{tp.proData5 || 'Kelly Criterion budget calc'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: AI / 고급분석 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>
                                    🧠 {tp.catAI || 'AI · Advanced'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check />{tp.proAI1 || 'AI match prediction report'}</li>
                                    <li className="flex"><Check />{tp.proAI2 || 'Deep single-match analysis'}</li>
                                    <li className="flex"><Check />{tp.proAI3 || 'Portfolio performance stats'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: 알림 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>
                                    🔔 {tp.catAlert || 'Alerts · Support'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check />{tp.proAlert1 || 'Real-time value alerts'}</li>
                                    <li className="flex items-center">
                                        <Lock />
                                        <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{tp.proAlert2 || 'Custom alert rules (VIP)'}</span>
                                    </li>
                                </ul>
                            </div>

                            {/* VIP 전용 잠금 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                                    👑 {tp.vipOnly || 'VIP Exclusive'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                                    <li className="flex"><Lock />{tp.proVIP1 || 'Multi-match AI combo'}</li>
                                    <li className="flex"><Lock />{tp.proVIP2 || 'Kelly auto allocation'}</li>
                                    <li className="flex"><Lock />{tp.proVIP3 || 'Custom alert conditions'}</li>
                                </ul>
                            </div>
                        </div>
                        {userTier === 'pro' ? (
                            <span className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl"
                                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                ✓ {tp.currentPlan || 'Current Plan'}
                            </span>
                        ) : (
                            <a href={`/${currentLang}/payment/request?plan=pro`} className="btn-primary mt-8 block w-full py-3 text-sm font-semibold text-center">
                                {tp.subscribePro || 'Subscribe Now'}
                            </a>
                        )}
                    </div>

                    {/* ── VIP Plan ── */}
                    <div className="glass-card relative p-8 flex flex-col" style={{ border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 25px rgba(139,92,246,0.1)' }}>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                👑 VIP
                            </h3>
                            <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                                {tp.premium || 'Premium'}
                            </p>
                            <p className="mt-4 flex items-baseline" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#a78bfa' }}>{tp.vipPrice || '$99'}</span>
                                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>/{tp.month || 'mo'}</span>
                            </p>
                            <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                {tp.vipDesc || 'All-in-one analytics for pro investors'}
                            </p>

                            {/* Feature Category: 데이터 분석 (Pro 전체 포함) */}
                            <div className="mt-6">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>
                                    📊 {tp.catDataPro || 'Data Analytics — All Pro included'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipData1 || 'Unlimited value analyses + live data'}</li>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipData2 || 'Efficiency gap + tax optimizer'}</li>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipData3 || 'Kelly Criterion budget calc'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: AI / 고급분석 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>
                                    🧠 {tp.catAIPro || 'AI · Advanced — All Pro included'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipAI1 || 'AI prediction + deep analysis'}</li>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipAI2 || 'Portfolio performance stats'}</li>
                                </ul>
                            </div>

                            {/* Feature Category: VIP 전용 */}
                            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#c084fc' }}>
                                    👑 {tp.vipExclusive || 'VIP Exclusive Features'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex">
                                        <Check color="#c084fc" />
                                        <div>
                                            <span className="font-semibold text-white">{tp.vipFeat1 || 'Multi-match AI combo optimization'}</span>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {tp.vipFeat1Desc || 'Auto value combos + tax strategy'}
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex">
                                        <Check color="#c084fc" />
                                        <div>
                                            <span className="font-semibold text-white">{tp.vipFeat2 || 'Kelly-based auto allocation'}</span>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {tp.vipFeat2Desc || 'Optimal budget distribution by risk level'}
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex">
                                        <Check color="#c084fc" />
                                        <div>
                                            <span className="font-semibold text-white">{tp.vipFeat3 || 'Custom alert conditions'}</span>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {tp.vipFeat3Desc || 'Set your own rules like "Value gap 15%+"'}
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex">
                                        <Check color="#c084fc" />
                                        <div>
                                            <span className="font-semibold text-white">{tp.vipFeat4 || 'Portfolio performance stats'}</span>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {tp.vipFeat4Desc || 'Accuracy · Efficiency · Risk metrics'}
                                            </p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            {/* 지원 */}
                            <div className="mt-5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>
                                    💬 {tp.catPremium || 'Premium Support'}
                                </p>
                                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipSupport1 || 'Dedicated Telegram channel'}</li>
                                    <li className="flex"><Check color="#a78bfa" />{tp.vipSupport2 || 'Priority customer support'}</li>
                                </ul>
                            </div>
                        </div>
                        {(userTier === 'vip' || userTier === 'premium') ? (
                            <span className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl"
                                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                ✓ {tp.currentPlan || 'Current Plan'}
                            </span>
                        ) : (
                            <a href={`/${currentLang}/payment/request?plan=vip`} className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl transition-all"
                                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))', color: '#c084fc', border: '1px solid rgba(139,92,246,0.4)' }}>
                                {tp.subscribeVip || 'Subscribe VIP'}
                            </a>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
