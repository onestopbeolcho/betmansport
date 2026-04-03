"use client";
import React from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
                <h1 className="text-3xl font-extrabold mb-8" style={{ color: 'var(--text-primary)' }}>
                    Privacy Policy
                </h1>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    <section>
                        <p>
                            Scorenix (hereinafter "Company") establishes and discloses the following Privacy Policy in accordance with the Personal Information Protection Act
                            to protect users' personal information and handle related grievances promptly and smoothly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>1. Personal Information Collected</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                        <th className="p-3 rounded-tl-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Category</th>
                                        <th className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>Items</th>
                                        <th className="p-3 rounded-tr-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Purpose</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3">Required</td>
                                        <td className="p-3">Email, password (encrypted), nickname</td>
                                        <td className="p-3">User identification and service provision</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3">Auto-collected</td>
                                        <td className="p-3">IP address, browser info, access time</td>
                                        <td className="p-3">Service stability and fraud prevention</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Payment</td>
                                        <td className="p-3">Payment method info (stored by PG provider)</td>
                                        <td className="p-3">Processing paid service payments</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>2. Retention and Processing Period</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Account info:</strong> Until account deletion (destroyed immediately upon withdrawal)</li>
                            <li><strong>Payment records:</strong> Retained for 5 years per E-Commerce Act</li>
                            <li><strong>Access logs:</strong> Retained for 3 months per Communications Privacy Act</li>
                            <li><strong>Service usage records:</strong> Retained for 1 year for service improvement (de-identified)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>3. Third-Party Disclosure</h2>
                        <p>
                            The Company does not, as a rule, provide users' personal information to third parties.
                            However, exceptions are made in the following cases:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>When the user has given prior consent</li>
                            <li>When required by law</li>
                            <li>When minimum necessary information is transmitted to PG provider (TossPayments) for payment processing</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>4. Security Measures</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Password encryption (bcrypt hashing)</li>
                            <li>Data transmission encryption (HTTPS/TLS)</li>
                            <li>Access control and restrictions</li>
                            <li>Access logs for personal information processing systems</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>5. User Rights</h2>
                        <p>Users may exercise the following rights at any time:</p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>Request to access personal information</li>
                            <li>Request correction of errors</li>
                            <li>Request deletion</li>
                            <li>Request suspension of processing</li>
                        </ul>
                        <p className="mt-2">
                            These requests can be made through My Page or via email (support@smartproto.kr).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>6. Use of Cookies</h2>
                        <p>
                            The Company uses cookies to analyze visit frequency and access patterns.
                            Users may refuse cookie collection through browser settings, though some services may be limited in this case.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>7. Privacy Officer</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p><strong>Privacy Officer</strong></p>
                            <p className="mt-1">Email: privacy@smartproto.kr</p>
                            <p>For inquiries, access, correction, or deletion requests regarding personal information, please contact the email above.</p>
                        </div>
                    </section>

                    {/* GDPR 조항 (글로벌 대비) */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>8. International Users</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
                            <p className="font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>🌍 GDPR / International Privacy</p>
                            <p>
                                For users within the EEA (European Economic Area), your personal data is processed in accordance with the
                                General Data Protection Regulation (GDPR). You have the right to:
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                                <li>Access your personal data</li>
                                <li>Rectify inaccurate data</li>
                                <li>Erase your data (&quot;right to be forgotten&quot;)</li>
                                <li>Port your data to another service</li>
                                <li>Object to processing</li>
                            </ul>
                            <p className="mt-2">
                                To exercise these rights, contact: privacy@smartproto.kr
                            </p>
                        </div>
                    </section>

                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p><strong>Supplementary Provisions</strong></p>
                        <p className="mt-2">This Privacy Policy shall be effective from February 18, 2026.</p>
                        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Last updated: February 18, 2026</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
