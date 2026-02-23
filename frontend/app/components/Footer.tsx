"use client";
import React from 'react';
import Link from 'next/link';
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
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.services || '서비스'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><Link href={`/${currentLang}/bets`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.valueBet || '밸류벳 분석'}</Link></li>
                            <li><Link href={`/${currentLang}/market`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.aiPredict || 'AI 예측'}</Link></li>
                            <li><Link href={`/${currentLang}/pricing`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.plans || '요금제'}</Link></li>
                        </ul>
                    </div>

                    {/* 안내 / Info */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.info || '안내'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><Link href={`/${currentLang}/manual`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.userGuide || '이용 가이드'}</Link></li>
                            <li><Link href={`/${currentLang}/pricing`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.membership || '멤버십 안내'}</Link></li>
                        </ul>
                    </div>

                    {/* 법적 고지 / Legal */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.legal || '법적 고지'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><Link href={`/${currentLang}/terms`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.terms || '이용약관'}</Link></li>
                            <li><Link href={`/${currentLang}/privacy`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.privacy || '개인정보처리방침'}</Link></li>
                            <li><Link href={`/${currentLang}/refund`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.refund || '환불정책'}</Link></li>
                            <li><Link href={`/${currentLang}/disclaimer`} className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>{t.disclaimer || '분석 위험 고지'}</Link></li>
                        </ul>
                    </div>

                    {/* 고객 지원 / Support */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.support || '고객 지원'}</h4>
                        <ul className="space-y-2 text-xs">
                            <li><a href="mailto:scorenix@gmail.com" className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>scorenix@gmail.com</a></li>
                            <li><span style={{ color: 'var(--text-muted)' }}>{t.counseling || '도박 중독 상담: 1336'}</span></li>
                        </ul>
                    </div>
                </div>

                {/* 사업자 정보 */}
                <div className="py-5 mb-5" style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t.bizInfo || '사업자 정보'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <p>{t.bizCompany || '상호명'}: <span style={{ color: 'var(--text-secondary)' }}>디자인비즈 (Scorenix)</span></p>
                        <p>{t.bizRep || '대표자'}: <span style={{ color: 'var(--text-secondary)' }}>노천택</span></p>
                        <p>{t.bizRegNo || '사업자등록번호'}: <span style={{ color: 'var(--text-secondary)' }}>534-40-01041</span></p>
                        <p>{t.bizCategory || '업종'}: <span style={{ color: 'var(--text-secondary)' }}>데이터베이스 및 온라인 정보 제공업</span></p>
                        <p>{t.bizAddress || '사업장 소재지'}: <span style={{ color: 'var(--text-secondary)' }}>전라남도 나주시 교육길 13, c동 4층 401호</span></p>
                        <p>{t.bizEmail || '이메일'}: <a href="mailto:scorenix@gmail.com" className="transition hover:text-[var(--accent-primary)]" style={{ color: 'var(--text-secondary)' }}>scorenix@gmail.com</a></p>
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
                        {t.footerNotice || '본 서비스는 통계 분석 도구이며 투자 조언을 제공하지 않습니다. 분석 결과에 따른 손실은 전적으로 이용자 본인의 책임입니다.'}
                    </p>
                </div>
            </div>
        </footer>
    );
}
