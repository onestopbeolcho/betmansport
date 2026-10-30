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
        <footer className="w-full mt-auto bg-white border-t border-slate-200 text-slate-600">
            {/* 상단 건전 레저문화 캠페인 & 공식 유관기관 백링크 배너 바 */}
            <div className="bg-slate-50 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#003996] text-white text-[10px] font-extrabold">
                                건전 스포츠·레저문화 캠페인
                            </span>
                            <span className="text-xs font-extrabold text-slate-800">
                                대한민국 공식 체육진흥·복권 유관기관 바로가기
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                            ※ 불법 사설 스포츠도박 근절 및 건전한 스포츠 관전 문화 정착을 함께합니다.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <a
                            href="https://www.betman.co.kr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0046b8] hover:shadow-xs transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-[#0046b8] text-white flex items-center justify-center text-xs font-black shrink-0">
                                    BM
                                </span>
                                <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                        베트맨 (Betman) ↗
                                    </div>
                                    <div className="text-[10px] text-slate-500">체육진흥투표권 공식 발매사이트</div>
                                </div>
                            </div>
                        </a>

                        <a
                            href="https://www.kspo.or.kr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0046b8] hover:shadow-xs transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                    KSPO
                                </span>
                                <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                        국민체육진흥공단 ↗
                                    </div>
                                    <div className="text-[10px] text-slate-500">국민체육진흥기금 공익사업 안내</div>
                                </div>
                            </div>
                        </a>

                        <a
                            href="https://www.dhlottery.co.kr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0046b8] hover:shadow-xs transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs font-black shrink-0">
                                    복권
                                </span>
                                <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                        기획재정부 복권위원회 ↗
                                    </div>
                                    <div className="text-[10px] text-slate-500">동행복권 · 건전 복권문화 안내</div>
                                </div>
                            </div>
                        </a>

                        <a
                            href="https://www.kcgp.or.kr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0046b8] hover:shadow-xs transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                                    1336
                                </span>
                                <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                        한국도박문제예방치유원 ↗
                                    </div>
                                    <div className="text-[10px] text-slate-500">건전이용 상담센터 (국번없이 1336)</div>
                                </div>
                            </div>
                        </a>

                        <a
                            href="https://www.ngcc.go.kr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0046b8] hover:shadow-xs transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-rose-700 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                    신고
                                </span>
                                <div>
                                    <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                        사행산업통합감독위원회 ↗
                                    </div>
                                    <div className="text-[10px] text-slate-500">불법사설 신고센터 (1899-1119)</div>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Links Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">

                    {/* 서비스 / Services */}
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-slate-900">{t.services || '핵심 서비스'}</h4>
                        <ul className="space-y-2 text-xs font-medium">
                            <li><a href={`/${currentLang}`} className="text-slate-600 transition hover:text-[#0046b8]">⚽ 베트맨 발매 게임별 AI 리포트</a></li>
                            <li><a href={`/${currentLang}/analysis`} className="text-slate-600 transition hover:text-[#0046b8]">🤖 3-Pillar AI 매치 리포트</a></li>
                            <li><a href={`/${currentLang}/archive/history`} className="text-slate-600 transition hover:text-[#0046b8]">📊 회차별 AI 예측 검증 아카이브</a></li>
                            <li><a href={`/${currentLang}/store/print-report/current`} className="text-slate-600 transition hover:text-[#0046b8]">🖨️ 판매점 A4 원클릭 출력 뷰</a></li>
                            <li><a href={`/${currentLang}/pricing`} className="text-slate-600 transition hover:text-[#0046b8]">{t.plans || '💎 구독 플랜 안내'}</a></li>
                        </ul>
                    </div>

                    {/* 안내 & 공식 채널 / Info & Channels */}
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-slate-900">{t.info || '이용안내 & 공식 채널'}</h4>
                        <ul className="space-y-2 text-xs font-medium">
                            <li><a href={`/${currentLang}/manual`} className="text-slate-600 transition hover:text-[#0046b8]">{t.userGuide || '📖 분석 모델 가이드'}</a></li>
                            <li><a href="https://www.youtube.com/@스코어닉스" target="_blank" rel="noopener noreferrer" className="text-slate-600 transition hover:text-[#0046b8]">🎬 공식 유튜브 (@스코어닉스)</a></li>
                            <li><a href="https://www.instagram.com/scorenix_official/" target="_blank" rel="noopener noreferrer" className="text-slate-600 transition hover:text-[#0046b8]">📸 공식 인스타그램 (@scorenix_official)</a></li>
                            <li><a href="https://www.threads.com/@scorenix_official" target="_blank" rel="noopener noreferrer" className="text-slate-600 transition hover:text-[#0046b8]">🧵 공식 쓰레드 (Threads)</a></li>
                            <li><a href="https://official-scorenix.blogspot.com" target="_blank" rel="noopener noreferrer" className="text-slate-600 transition hover:text-[#0046b8]">✍️ 공식 AI 분석 블로그</a></li>
                        </ul>
                    </div>

                    {/* 법적 고지 / Legal */}
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-slate-900">{t.legal || '약관 및 정책'}</h4>
                        <ul className="space-y-2 text-xs font-medium">
                            <li><a href={`/${currentLang}/terms`} className="text-slate-600 transition hover:text-[#0046b8]">{t.terms || '이용약관'}</a></li>
                            <li><a href={`/${currentLang}/privacy`} className="text-slate-600 transition hover:text-[#0046b8]">{t.privacy || '개인정보처리방침'}</a></li>
                            <li><a href={`/${currentLang}/refund`} className="text-slate-600 transition hover:text-[#0046b8]">{t.refund || '환불 및 해지 정책'}</a></li>
                            <li><a href={`/${currentLang}/disclaimer`} className="text-slate-600 transition hover:text-[#0046b8]">{t.disclaimer || '면책 공고'}</a></li>
                        </ul>
                    </div>

                    {/* 고객 지원 / Support */}
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-slate-900">{t.support || '고객 지원'}</h4>
                        <ul className="space-y-2 text-xs font-medium">
                            <li><a href="mailto:scorenix@gmail.com" className="text-slate-600 transition hover:text-[#0046b8]">scorenix@gmail.com</a></li>
                            <li><span className="text-slate-500">{t.counseling || '건전 이용 상담: 1336'}</span></li>
                        </ul>
                    </div>
                </div>

                {/* 사업자 정보 */}
                <div className="py-5 mb-5 border-t border-b border-slate-200">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-slate-900">{t.bizInfo || '사업자 정보'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-500">
                        <p>{t.bizCompany || '상호'}: <span className="text-slate-700 font-semibold">DesignBiz (Scorenix)</span></p>
                        <p>{t.bizRep || '대표자'}: <span className="text-slate-700 font-semibold">노천택</span></p>
                        <p>{t.bizRegNo || '사업자등록번호'}: <span className="text-slate-700 font-semibold">534-40-01041</span></p>
                        <p>{t.bizEcommerceNo || '통신판매업 신고번호'}: <span className="text-slate-700 font-semibold">2024-전남나주-0053</span></p>
                        <p>{t.bizCategory || '업태/종목'}: <span className="text-slate-700 font-semibold">{t.bizCategoryValue || '정보통신업 / 스포츠 통계 데이터베이스 및 알고리즘 시뮬레이션 SaaS'}</span></p>
                        <p>{t.bizAddress || '주소'}: <span className="text-slate-700 font-semibold">{t.bizAddressValue || '전라남도 나주시 교육길 13 C동 4층 401호'}</span></p>
                        <p>{t.bizEmail || '이메일'}: <a href="mailto:scorenix@gmail.com" className="text-slate-700 font-semibold transition hover:text-[#0046b8]">scorenix@gmail.com</a></p>
                        <p>{t.bizPhone || '담당자 연락처'}: <a href="tel:010-8725-4591" className="text-slate-700 font-semibold transition hover:text-[#0046b8]">010-8725-4591</a></p>
                    </div>
                </div>

                {/* 필수 법적 면책 조항 */}
                <div className="mb-5 p-3.5 rounded-lg text-[11px] leading-relaxed bg-slate-50 border border-slate-200 text-slate-600">
                    ⚖️ <strong className="text-slate-800">면책 고지:</strong> 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 투표권 구매를 권유하거나 결과를 보장하지 않습니다. 모든 스포츠 관전 및 분석의 최종 판단과 책임은 이용자 본인에게 있습니다.
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-[#003996]">SCORENIX</span>
                        <span className="text-xs font-medium text-slate-500">스포츠데이터연구소 · Digital Sports Data Analytics SaaS</span>
                    </div>

                    <p className="text-xs text-center text-slate-500">
                        © 2026 Scorenix (DesignBiz). All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
