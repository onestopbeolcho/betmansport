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
                    환불 정책
                </h1>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    {/* 개요 */}
                    <section>
                        <p>
                            Scorenix (이하 &quot;회사&quot;)는 「전자상거래 등에서의 소비자보호에 관한 법률」 및 관련 법령에 따라
                            아래와 같이 환불 정책을 운영합니다.
                        </p>
                    </section>

                    {/* 제1조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제1조 (적용 범위)</h2>
                        <p>
                            본 환불 정책은 회사가 제공하는 유료 구독 서비스(Pro Investor, VIP 플랜)에 적용됩니다.
                            무료 서비스(Free 플랜)에는 결제가 발생하지 않으므로 환불 대상에 해당하지 않습니다.
                        </p>
                    </section>

                    {/* 제2조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제2조 (환불 규정)</h2>

                        {/* 환불 테이블 */}
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                        <th className="p-3 rounded-tl-lg font-semibold" style={{ color: 'var(--text-primary)' }}>구분</th>
                                        <th className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>환불 조건</th>
                                        <th className="p-3 rounded-tr-lg font-semibold" style={{ color: 'var(--text-primary)' }}>환불 금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>결제일 7일 이내</td>
                                        <td className="p-3">서비스를 실질적으로 이용하지 않은 경우</td>
                                        <td className="p-3 font-bold" style={{ color: '#34C759' }}>전액 환불</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--accent-primary)' }}>결제일 7일 이내</td>
                                        <td className="p-3">서비스를 이용한 경우</td>
                                        <td className="p-3">이용 일수를 일할 계산하여 환불</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>결제일 7일 초과</td>
                                        <td className="p-3">해지 요청 시</td>
                                        <td className="p-3">잔여 일수 기준 일할 계산 환불</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-bold" style={{ color: 'var(--text-muted)' }}>자동 갱신 결제</td>
                                        <td className="p-3">갱신일 이전 해지 시</td>
                                        <td className="p-3">다음 결제 주기부터 과금 중지</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
                            <p className="font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>💡 일할 계산 방법</p>
                            <p>환불 금액 = 결제 금액 - (결제 금액 ÷ 30일 × 이용 일수)</p>
                        </div>
                    </section>

                    {/* 제3조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제3조 (환불 불가 사유)</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>이용자의 귀책 사유로 서비스 이용이 제한된 경우</li>
                            <li>이벤트, 프로모션 등 할인 적용으로 결제한 경우 (별도 환불 규정 적용)</li>
                            <li>서비스를 정상적으로 이용한 후 단순 변심에 의한 환불 요청</li>
                        </ul>
                    </section>

                    {/* 제4조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제4조 (환불 절차)</h2>
                        <div className="space-y-3">
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>1</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>환불 신청</p>
                                    <p>이메일(support@smartproto.kr) 또는 서비스 내 마이페이지에서 환불을 신청합니다.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>2</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>환불 심사</p>
                                    <p>접수일로부터 영업일 기준 3일 이내에 환불 여부를 안내합니다.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>3</div>
                                <div>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>환불 처리</p>
                                    <p>승인 후 영업일 기준 5~7일 이내에 결제 수단으로 환불됩니다.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 제5조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제5조 (서비스 요금)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Pro Investor</p>
                                <p className="text-2xl font-extrabold gradient-text">55,000원<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/월</span></p>
                                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>무제한 AI 분석 리포트, 실시간 알림, 심층 분석</p>
                            </div>
                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>VIP</p>
                                <p className="text-2xl font-extrabold" style={{ color: 'var(--accent-secondary)' }}>105,000원<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/월</span></p>
                                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>전용 채널, 1:1 프리미엄 리포트, 우선 지원</p>
                            </div>
                        </div>
                    </section>

                    {/* 문의 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>환불 문의</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p>이메일: <strong>support@smartproto.kr</strong></p>
                            <p className="mt-1">영업 시간: 평일 10:00 ~ 18:00 (주말·공휴일 제외)</p>
                            <p className="mt-1">환불 처리 기간: 접수일로부터 영업일 기준 3~7일 이내</p>
                        </div>
                    </section>

                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-4">
                            <Link href="/terms" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>이용약관</Link>
                            <Link href="/privacy" className="text-sm underline" style={{ color: 'var(--accent-primary)' }}>개인정보처리방침</Link>
                        </div>
                        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>최종 수정일: 2026년 2월 20일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
