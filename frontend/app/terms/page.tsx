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

                    {/* 제1조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제1조 (목적)</h2>
                        <p>
                            본 약관은 Scorenix (이하 "서비스")가 제공하는 스포츠 데이터 분석 서비스의 이용조건 및
                            절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
                        </p>
                    </section>

                    {/* 제2조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제2조 (정의)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>"서비스"란 Scorenix가 제공하는 스포츠 경기 데이터 분석, 통계 비교, AI 예측, 세금 계산 등의 정보 서비스를 말합니다.</li>
                            <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
                            <li>"유료 회원"이란 정기 결제를 통해 프리미엄 서비스를 이용하는 이용자를 말합니다.</li>
                            <li>"콘텐츠"란 서비스에서 제공하는 분석 결과, 예측 데이터, 통계 정보 등 일체의 정보를 말합니다.</li>
                        </ol>
                    </section>

                    {/* 제3조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제3조 (서비스의 성격 및 면책)</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)' }}>
                            <p className="font-bold mb-2" style={{ color: '#FF3B30' }}>⚠️ 중요 고지사항</p>
                            <ol className="list-decimal list-inside space-y-2">
                                <li><strong>본 서비스는 투자 조언이 아닙니다.</strong> 서비스에서 제공하는 분석, 예측, 추천 정보는 참고용 데이터에 불과하며, 투자 결정은 전적으로 이용자 본인의 책임입니다.</li>
                                <li>서비스는 합법적인 체육진흥투표권(베트맨) 데이터에 기반한 <strong>통계 분석 도구</strong>이며, 불법 도박을 조장하거나 권유하지 않습니다.</li>
                                <li>서비스의 예측 및 분석 결과는 정확성을 보장하지 않으며, 이로 인한 금전적 손실에 대해 회사는 <strong>어떠한 책임도 부담하지 않습니다.</strong></li>
                                <li>이용자는 국민체육진흥법 및 관련 법령을 준수하여야 하며, 불법 도박에 본 서비스를 이용할 수 없습니다.</li>
                            </ol>
                        </div>
                    </section>

                    {/* 제4조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제4조 (이용 자격)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>서비스는 <strong>만 19세 이상</strong>의 이용자만 이용할 수 있습니다.</li>
                            <li>이용자는 회원가입 시 정확한 정보를 제공하여야 하며, 타인의 정보를 도용하여서는 안 됩니다.</li>
                            <li>회사는 다음 각 호에 해당하는 경우 서비스 이용을 제한하거나 회원 자격을 박탈할 수 있습니다:
                                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                    <li>허위 정보 제공</li>
                                    <li>타인의 계정 도용</li>
                                    <li>서비스의 정상적 운영을 방해하는 행위</li>
                                    <li>상업적 목적의 무단 크롤링 또는 데이터 수집</li>
                                </ul>
                            </li>
                        </ol>
                    </section>

                    {/* 제5조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제5조 (유료 서비스 및 결제)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>유료 서비스의 요금 및 기능은 서비스 내 요금제 페이지에 게시합니다.</li>
                            <li>결제는 매월 자동 갱신되며, 이용자가 해지하지 않는 한 자동으로 결제됩니다.</li>
                            <li>유료 서비스의 해지는 서비스 내에서 즉시 가능하며, 현재 결제 기간이 종료될 때까지 서비스를 이용할 수 있습니다.</li>
                            <li>환불은 결제일로부터 7일 이내, 서비스를 실질적으로 이용하지 않은 경우에 한하여 전액 환불됩니다. 그 외의 경우 이용 일수를 일할 계산하여 환불합니다.</li>
                        </ol>
                    </section>

                    {/* 제6조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제6조 (지적재산권)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>서비스에서 제공하는 분석 알고리즘, UI 디자인, 콘텐츠 등 일체의 지적재산권은 회사에 귀속됩니다.</li>
                            <li>이용자는 서비스에서 제공하는 콘텐츠를 개인적 목적으로만 사용할 수 있으며, 상업적 재배포, 복제, 판매를 금지합니다.</li>
                        </ol>
                    </section>

                    {/* 제7조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제7조 (서비스 변경 및 중단)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>회사는 서비스 개선을 위해 서비스의 전부 또는 일부를 수정, 변경, 중단할 수 있습니다.</li>
                            <li>중대한 변경 시 최소 7일 전 서비스 내 공지합니다.</li>
                            <li>외부 데이터 제공업체(API)의 서비스 변경이나 중단으로 인한 서비스 품질 저하에 대해 회사는 책임을 부담하지 않습니다.</li>
                        </ol>
                    </section>

                    {/* 제8조 */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>제8조 (분쟁 해결)</h2>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>본 약관에 관한 분쟁은 대한민국 법률을 적용합니다.</li>
                            <li>서비스 이용과 관련된 분쟁은 회사 소재지 관할 법원을 전속적 합의 관할로 합니다.</li>
                        </ol>
                    </section>

                    {/* 부칙 */}
                    <section className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p><strong>부칙</strong></p>
                        <p className="mt-2">본 약관은 2026년 2월 18일부터 시행합니다.</p>
                        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>최종 수정일: 2026년 2월 18일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
