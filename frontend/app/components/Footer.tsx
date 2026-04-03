"use client";
import React from 'react';

import { useDictionary } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';
import { usePathname } from 'next/navigation';

export default function Footer({ lang }: { lang?: string }) {
    const pathname = usePathname();
    const currentLang = lang || i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch {
        dict = null;
    }
    const t = dict?.footer || {};

    return (
        <footer className="w-full mt-auto" style={{
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
        }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Links Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">

                    {/* 서비스 / Services */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.services || 'Services'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a href={`/${currentLang}/bets`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.valueBet || 'Value Analysis'}</a></li>
                            <li><a href={`/${currentLang}/market`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.aiPredict || 'AI Prediction'}</a></li>
                            <li><a href={`/${currentLang}/pricing`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.plans || 'Plans'}</a></li>
                        </ul>
                    </div>

                    {/* 안내 / Info */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.info || 'Info'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a href={`/${currentLang}/manual`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.userGuide || 'User Guide'}</a></li>
                            <li><a href={`/${currentLang}/pricing`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.membership || 'Membership'}</a></li>
                        </ul>
                    </div>

                    {/* 법적 고지 / Legal */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.legal || 'Legal'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a href={`/${currentLang}/terms`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.terms || 'Terms of Service'}</a></li>
                            <li><a href={`/${currentLang}/privacy`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.privacy || 'Privacy Policy'}</a></li>
                            <li><a href={`/${currentLang}/refund`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.refund || 'Refund Policy'}</a></li>
                            <li><a href={`/${currentLang}/disclaimer`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.disclaimer || 'Risk Disclaimer'}</a></li>
                        </ul>
                    </div>

                    {/* 고객 지원 / Support */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.support || 'Support'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a href="mailto:scorenix@gmail.com" className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>scorenix@gmail.com</a></li>
                            <li><span style={{ color: 'var(--text-muted)' }}>{t.counseling || 'Responsible Use Helpline: 1336'}</span></li>
                        </ul>
                    </div>
                </div>

                {/* 사업자 정보 */}
                <div className="py-5 mb-5" style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.bizInfo || '사업자 정보'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <p>{t.bizCompany || '상호'}: <span style={{ color: 'var(--text-secondary)' }}>DesignBiz (Scorenix)</span></p>
                        <p>{t.bizRep || '대표자'}: <span style={{ color: 'var(--text-secondary)' }}>노천택</span></p>
                        <p>{t.bizRegNo || '사업자등록번호'}: <span style={{ color: 'var(--text-secondary)' }}>534-40-01041</span></p>
                        <p>{t.bizEcommerceNo || '통신판매업 신고번호'}: <span style={{ color: 'var(--text-secondary)' }}>2024-전남나주-0053</span></p>
                        <p>{t.bizCategory || '업태/종목'}: <span style={{ color: 'var(--text-secondary)' }}>{t.bizCategoryValue || '정보통신업 / 데이터베이스 및 온라인 정보 제공업'}</span></p>
                        <p>{t.bizAddress || '주소'}: <span style={{ color: 'var(--text-secondary)' }}>{t.bizAddressValue || '전라남도 나주시 교육길 13 C동 4층 401호'}</span></p>
                        <p>{t.bizEmail || '이메일'}: <a href="mailto:scorenix@gmail.com" className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>scorenix@gmail.com</a></p>
                        <p>{t.bizPhone || '담당자 연락처'}: <a href="tel:010-8725-4591" className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>010-8725-4591</a></p>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold gradient-text">Scorenix</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Sports Data Analytics</span>
                    </div>

                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                        © 2026 Scorenix. All rights reserved.
                    </p>

                    <p className="text-[10px] text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
                        {t.footerNotice || '본 서비스는 통계 분석 도구이며, 분석 결과에 대한 책임은 이용자에게 있습니다.'}
                    </p>
                </div>
            </div>
        </footer>
    );
}
