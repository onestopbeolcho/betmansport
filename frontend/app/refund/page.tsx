"use client";
import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function RefundPage() {
    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
                <h1 className="text-3xl font-extrabold mb-8" style={{ color: 'var(--text-primary)' }}>
                    Refund Policy
                </h1>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    {/* Overview */}
                    <section>
                        <p>
                            Scorenix (hereinafter &quot;Company&quot;) operates the following refund policy in accordance with the
                            Act on Consumer Protection in Electronic Commerce.
                        </p>
                    </section>

                    {/* Article 1 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Article 1 (Scope)</h2>
                        <p>
                            This refund policy applies to the paid subscription services (Pro Investor, VIP plans) provided by the Company.
                            The free plan (Free) does not involve payment and is therefore not subject to refunds.
                        </p>
                    </section>

                    {/* Article 2 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Article 2 (Refund Terms)</h2>

                        {/* 환불 테이블 */}
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                        <th className="p-3 rounded-tl-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Category</th>
                                        <th className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>Refund Condition</th>
                                        <th className="p-3 rounded-tr-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Refund Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>Within 7 days</td>
                                        <td className="p-3">Service not substantially used</td>
                                        <td className="p-3 font-bold" style={{ color: '#34C759' }}>Full refund</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>Within 7 days</td>
                                        <td className="p-3">Service has been used</td>
                                        <td className="p-3">Prorated refund based on days used</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>After 7 days</td>
                                        <td className="p-3">Cancellation request</td>
                                        <td className="p-3">Prorated refund based on remaining days</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>Auto-renewal</td>
                                        <td className="p-3">Cancelled before renewal date</td>
                                        <td className="p-3">Billing stops from next cycle</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
                            <p className="font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>💡 Prorated Calculation Method</p>
                            <p>Refund Amount = Payment Amount - (Payment Amount ÷ 30 days × Days Used)</p>
                        </div>
                    </section>

                    {/* Article 3 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Article 3 (Non-Refundable Cases)</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Service access was restricted due to user's own fault</li>
                            <li>Payment was made with event/promotion discounts (separate refund policy applies)</li>
                            <li>Simple change of mind after normal use of the service</li>
                        </ul>
                    </section>

                    {/* Article 4 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Article 4 (Refund Procedure)</h2>
                        <div className="space-y-3">
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>1</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Submit Request</p>
                                    <p>Request a refund via email (support@smartproto.kr) or through My Page in the service.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>2</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Review</p>
                                    <p>Refund eligibility will be communicated within 3 business days of receipt.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>3</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Processing</p>
                                    <p>After approval, the refund will be processed to your payment method within 5-7 business days.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Article 5 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Article 5 (Service Pricing)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Pro Investor</p>
                                <p className="text-2xl font-extrabold gradient-text">₩55,000<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></p>
                                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Unlimited AI reports, real-time alerts, deep analysis</p>
                            </div>
                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>VIP</p>
                                <p className="text-2xl font-extrabold" style={{ color: 'var(--accent-secondary)' }}>₩105,000<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></p>
                                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Exclusive channel, 1:1 premium reports, priority support</p>
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Refund Inquiries</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p>Email: <strong>support@smartproto.kr</strong></p>
                            <p className="mt-1">Business hours: Mon-Fri 10:00 ~ 18:00 (excl. weekends/holidays)</p>
                            <p className="mt-1">Refund processing: Within 3-7 business days from receipt</p>
                        </div>
                    </section>

                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-4">
                            <Link href="/terms" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>Terms of Service</Link>
                            <Link href="/privacy" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</Link>
                        </div>
                        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>Last updated: February 20, 2026</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
