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
                    개인정보처리방침
                </h1>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                    <section>
                        <p>
                            Scorenix (이하 "회사")는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고
                            이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>1. 수집하는 개인정보 항목</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                        <th className="p-3 rounded-tl-lg font-semibold" style={{ color: 'var(--text-primary)' }}>구분</th>
                                        <th className="p-3 font-semibold" style={{ color: 'var(--text-primary)' }}>항목</th>
                                        <th className="p-3 rounded-tr-lg font-semibold" style={{ color: 'var(--text-primary)' }}>수집 목적</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3">필수</td>
                                        <td className="p-3">이메일, 비밀번호(암호화), 닉네임</td>
                                        <td className="p-3">회원 식별 및 서비스 제공</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="p-3">자동 수집</td>
                                        <td className="p-3">IP 주소, 브라우저 정보, 접속 일시</td>
                                        <td className="p-3">서비스 안정성 확보, 부정 이용 방지</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">결제 시</td>
                                        <td className="p-3">결제 수단 정보 (PG사 보관)</td>
                                        <td className="p-3">유료 서비스 결제 처리</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>2. 개인정보의 처리 및 보유 기간</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>회원 정보:</strong> 회원 탈퇴 시까지 (탈퇴 후 즉시 파기)</li>
                            <li><strong>결제 기록:</strong> 전자상거래법에 따라 5년간 보존</li>
                            <li><strong>접속 로그:</strong> 통신비밀보호법에 따라 3개월간 보존</li>
                            <li><strong>서비스 이용 기록:</strong> 서비스 개선 목적으로 1년간 보존 (비식별화 처리)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>3. 개인정보의 제3자 제공</h2>
                        <p>
                            회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
                            다만, 다음의 경우에는 예외로 합니다:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>이용자가 사전에 동의한 경우</li>
                            <li>법령에 의하여 요구되는 경우</li>
                            <li>결제 처리를 위해 PG사(토스페이먼츠)에 필요 최소 정보 전달</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>4. 개인정보의 안전성 확보 조치</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>비밀번호 암호화 (bcrypt 해싱)</li>
                            <li>전송 데이터 암호화 (HTTPS/TLS)</li>
                            <li>접근 권한 관리 및 제한</li>
                            <li>개인정보 처리 시스템 접근 기록 보관</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>5. 이용자의 권리·의무</h2>
                        <p>이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다:</p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>개인정보 열람 요구</li>
                            <li>오류 등에 대한 정정 요구</li>
                            <li>삭제 요구</li>
                            <li>처리 정지 요구</li>
                        </ul>
                        <p className="mt-2">
                            위 요청은 서비스 내 마이페이지 또는 이메일(support@smartproto.kr)을 통해 가능합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>6. 쿠키의 사용</h2>
                        <p>
                            회사는 이용자의 접속 빈도나 방문 시간 등을 분석하기 위해 쿠키(Cookie)를 사용합니다.
                            이용자는 브라우저 설정을 통해 쿠키 수집을 거부할 수 있으며, 이 경우 일부 서비스 이용이 제한될 수 있습니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>7. 개인정보 보호책임자</h2>
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p><strong>개인정보 보호책임자</strong></p>
                            <p className="mt-1">이메일: privacy@smartproto.kr</p>
                            <p>개인정보 관련 문의, 열람·정정·삭제 요청 등은 위 이메일로 연락주시기 바랍니다.</p>
                        </div>
                    </section>

                    {/* GDPR 조항 (글로벌 대비) */}
                    <section>
                        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>8. 해외 이용자 (For International Users)</h2>
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
                        <p><strong>부칙</strong></p>
                        <p className="mt-2">본 개인정보처리방침은 2026년 2월 18일부터 시행합니다.</p>
                        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>최종 수정일: 2026년 2월 18일</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
