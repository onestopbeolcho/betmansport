"use client";
import React from 'react';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function TermsPage() {
    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
                <h1 className="text-3xl font-extrabold mb-8" style={{ color: 'var(--text-primary)' }}>
                    이용약관
                </h1>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    {/* Article 1 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제1조 (목적)</h2>
                        <p>
                            본 이용약관은 Scorenix(이하 "서비스")가 제공하는 스포츠 데이터 분석 서비스 이용에 관한
                            조건, 절차, 권리, 의무 및 책임사항을 정합니다.
                        </p>
                    </section>

                    {/* Article 2 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제2조 (정의)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>"서비스"란 Scorenix가 제공하는 스포츠 경기 데이터 분석, 통계 비교, AI 예측 등의 정보 서비스를 말합니다.</li>
                            <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
                            <li>"유료회원"이란 정기결제를 통해 프리미엄 서비스를 이용하는 이용자를 말합니다.</li>
                            <li>"콘텐츠"란 분석 결과, 예측 데이터, 통계 정보 등 서비스가 제공하는 모든 정보를 말합니다.</li>
                        </ol>
                    </section>

                    {/* Article 3 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제3조 (서비스 성격 및 면책)</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)' }}>
                            <p className="font-bold mb-2" style={{ color: '#FF3B30' }}>⚠️ 중요 고지</p>
                            <ol className="list-decimal list-inside space-y-2">
                                <li>본 서비스는 <strong>통계 분석 도구</strong>입니다. 분석, 예측 결과는 참고용이며, 이용 판단은 전적으로 이용자의 책임입니다.</li>
                                <li>본 서비스는 합법적 스포츠 데이터를 기반으로 한 <strong>통계 분석 도구</strong>이며, 불법 행위를 조장하지 않습니다.</li>
                                <li>예측 및 분석 결과의 정확성은 보장되지 않습니다. 회사는 분석 데이터로 인한 <strong>어떠한 결과에도 책임을 지지 않습니다</strong>.</li>
                                <li>이용자는 국민체육진흥법 및 관련 법률을 준수해야 합니다.</li>
                            </ol>
                        </div>
                    </section>

                    {/* Article 4 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제4조 (이용 자격)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>본 서비스는 <strong>만 19세 이상</strong>만 이용 가능합니다.</li>
                            <li>이용자는 가입 시 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.</li>
                            <li>회사는 다음의 경우 서비스 이용을 제한하거나 회원자격을 취소할 수 있습니다:
                                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                    <li>허위 정보 제공</li>
                                    <li>타인 계정 무단 사용</li>
                                    <li>정상적인 서비스 운영을 방해하는 행위</li>
                                    <li>무단 상업적 크롤링 또는 데이터 수집</li>
                                </ul>
                            </li>
                        </ol>
                    </section>

                    {/* Article 5 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제5조 (유료 서비스 및 결제)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>유료 서비스의 요금 및 기능은 서비스 내 가격 페이지에 게시됩니다.</li>
                            <li>결제는 이용자가 취소하지 않는 한 매월 자동 갱신됩니다.</li>
                            <li>유료 서비스 해지는 서비스 내에서 즉시 가능하며, 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.</li>
                            <li>결제 후 7일 이내 서비스를 실질적으로 이용하지 않은 경우 전액 환불이 가능합니다. 그 외에는 이용 일수에 따라 비례 환불됩니다.</li>
                        </ol>
                    </section>

                    {/* Article 6 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제6조 (지적 재산권)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>서비스가 제공하는 분석 알고리즘, UI 디자인, 콘텐츠의 모든 지적 재산권은 회사에 귀속됩니다.</li>
                            <li>이용자는 콘텐츠를 개인 목적으로만 사용할 수 있습니다. 상업적 재배포, 복제, 재판매는 금지됩니다.</li>
                        </ol>
                    </section>

                    {/* Article 7 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제7조 (서비스 변경 및 중단)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>회사는 서비스 개선을 위해 서비스의 전부 또는 일부를 수정, 변경, 중단할 수 있습니다.</li>
                            <li>중요한 변경 사항은 최소 7일 전에 서비스 내에서 공지합니다.</li>
                            <li>외부 데이터 제공자(API)의 변경이나 장애로 인한 서비스 품질 저하에 대해 회사는 책임을 지지 않습니다.</li>
                        </ol>
                    </section>

                    {/* Article 8 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제8조 (분쟁 해결)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>본 약관에 대한 분쟁은 대한민국 법률에 따릅니다.</li>
                            <li>서비스 이용 관련 분쟁에 대해서는 회사 소재지를 관할하는 법원을 합의 관할법원으로 합니다.</li>
                        </ol>
                    </section>

                    {/* Supplementary */}
                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p><strong>부칙</strong></p>
                        <p className="mt-2">본 약관은 2026년 2월 18일부터 시행합니다.</p>
                        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>최종 업데이트: 2026년 3월 8일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
