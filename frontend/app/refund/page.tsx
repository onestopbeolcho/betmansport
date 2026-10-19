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
                <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>
                    환불 및 정기구독 해지 정책 (Refund & Cancellation Policy)
                </h1>
                <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
                    전자상거래 등에서의 소비자보호에 관한 법률 및 디지털 콘텐츠 이용자 보호 지침 준수
                </p>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    {/* 제1조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제1조 (적용 범위 및 상품 정의)</h2>
                        <p>
                            본 환불 및 해지 정책은 DesignBiz(이하 &quot;회사&quot;)가 운영하는 스포츠 통계 데이터베이스 및 알고리즘 시뮬레이션 SaaS 플랫폼 <strong>Scorenix(스코어닉스)</strong>의 유료 디지털 데이터 리포트 구독권(<strong>Basic Pass 월 3,900원</strong>, <strong>Pro Quant 월 9,900원</strong>)에 적용됩니다. 무료 체험 등급(Free)은 결제가 발생하지 않으므로 환불 대상에 해당하지 않습니다.
                        </p>
                    </section>

                    {/* 제2조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제2조 (원클릭 셀프 구독 해지 안내)</h2>
                        <div className="p-4 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <p className="font-bold mb-1" style={{ color: '#34d399' }}>⚡ 고객센터 문의 없는 24시간 원클릭 셀프 해지 지원</p>
                            <p className="text-xs">
                                모든 유료 구독 회원은 <strong>[마이페이지(My Page) → 구독 관리 → 구독 즉시 해지]</strong> 버튼을 통해 상담원 연결 없이 언제든 원클릭으로 다음 결제 주기의 자동 결제를 해지할 수 있습니다. 해지 신청 즉시 다음 달 결제가 중단되며, 이미 결제된 당월 잔여 이용 기간 만료일까지는 데이터 리포트 열람 권한이 정상 유지됩니다.
                            </p>
                        </div>
                    </section>

                    {/* 제3조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제3조 (청약철회 및 일할 자동 차감 환불 기준)</h2>

                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                        <th className="p-3 rounded-tl-lg font-semibold" style={{ color: 'var(--text-primary)' }}>구분</th>
                                        <th className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>디지털 리포트 열람 여부</th>
                                        <th className="p-3 rounded-tr-lg font-semibold" style={{ color: 'var(--text-primary)' }}>환불 금액 산정 기준</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>결제 후 7일 이내</td>
                                        <td className="p-3">유료 전용 데이터 리포트 미열람 (미사용)</td>
                                        <td className="p-3 font-bold" style={{ color: '#34C759' }}>100% 전액 환불</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>결제 후 7일 이내</td>
                                        <td className="p-3">유료 전용 리포트 또는 시뮬레이터 열람 이력 존재</td>
                                        <td className="p-3">사용 일수 일할 차감 후 잔액 환불</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>결제 후 7일 경과</td>
                                        <td className="p-3">중도 해지 및 환불 요청 시</td>
                                        <td className="p-3">잔여 일수 기준 일할 계산 환불 (위약금 10% 공제)</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>다음 주기 자동결제 해지</td>
                                        <td className="p-3">만료일 이전 마이페이지 셀프 해지</td>
                                        <td className="p-3">익월 과금 100% 차단 (잔여 기간 이용 보장)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
                            <p className="font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>💡 일할 계산 자동 산식 (Prorated Auto-Calculation)</p>
                            <p>환불 금액 = 결제 금액 - (결제 금액 ÷ 30일 × 이용 일수)</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                ※ 당일 경기의 유료 시뮬레이션 리포트를 이미 열람한 경우 해당 일자는 이용 일수(1일)로 산입됩니다.
                            </p>
                        </div>
                    </section>

                    {/* 제4조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제4조 (면책 및 환불 제한 사유)</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>본 서비스는 통계적 시뮬레이션 지표를 제공하는 소프트웨어(SaaS)이며, 실제 스포츠 경기의 승패 결과는 환불 사유에 해당하지 않습니다.</li>
                            <li>회원의 약관 위반(계정 공유, 크롤링 봇을 통한 데이터 무단 수집 등)으로 인해 이용이 제한된 경우 환불이 제한될 수 있습니다.</li>
                        </ul>
                    </section>

                    {/* 제5조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제5조 (환불 처리 절차 및 고객 지원)</h2>
                        <p className="mb-2">
                            구독 해지는 <Link href="/ko/mypage" className="underline font-bold" style={{ color: 'var(--accent-primary)' }}>마이페이지</Link>에서 즉시 처리 가능하며, 결제 취소 및 일할 환불 접수 시 KG이니시스(PortOne) 카드 취소 규정에 따라 영업일 기준 3~5일 이내에 원결제 수단으로 자동 환급됩니다.
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            결제/환불 전용 문의: <a href="mailto:scorenix@gmail.com" className="underline">scorenix@gmail.com</a> | 대표번호: 010-8725-4591
                        </p>
                    </section>

                </div>
            </main>
        </div>
    );
}
