"use client";
import React from 'react';
import Link from 'next/link';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navbar (Duplicated for now, should refactor) */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/">
                                <span className="text-2xl font-black text-indigo-600 tracking-tighter cursor-pointer">SMART PROTO</span>
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link href="/login" className="text-gray-500 hover:text-gray-900 font-medium">
                                로그인
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
                    수익을 극대화하는 <span className="text-indigo-600">스마트한 투자</span>
                </h1>
                <p className="mt-4 text-xl text-gray-500">
                    데이터에 기반한 확실한 가치 투자 기회를 놓치지 마세요.
                </p>

                <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
                    {/* Free Plan */}
                    <div className="relative p-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">Free</h3>
                            <p className="absolute top-0 py-1.5 px-4 bg-gray-100 rounded-full text-xs font-semibold uppercase tracking-wide text-gray-500 transform -translate-y-1/2">체험판</p>
                            <p className="mt-4 flex items-baseline justify-center text-gray-900">
                                <span className="text-5xl font-extrabold tracking-tight">0원</span>
                                <span className="ml-1 text-xl font-semibold">/월</span>
                            </p>
                            <p className="mt-6 text-gray-500">기본적인 가치 확인 가능</p>
                            <ul role="list" className="mt-6 space-y-6">
                                <li className="flex"><span className="text-indigo-500 mr-3">✓</span>일일 3개 종목 확인</li>
                                <li className="flex"><span className="text-indigo-500 mr-3">✓</span>기본 수익률 계산기</li>
                            </ul>
                        </div>
                        <Link href="/register" className="mt-8 block w-full bg-indigo-50 border border-indigo-500 rounded-md py-3 text-sm font-semibold text-indigo-700 text-center hover:bg-indigo-100">
                            무료로 시작하기
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="relative p-8 bg-gray-900 border border-gray-900 rounded-2xl shadow-lg flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-white">Pro Investor</h3>
                            <p className="absolute top-0 py-1.5 px-4 bg-indigo-500 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2">인기</p>
                            <p className="mt-4 flex items-baseline justify-center text-white">
                                <span className="text-5xl font-extrabold tracking-tight">29,000원</span>
                                <span className="ml-1 text-xl font-semibold">/월</span>
                            </p>
                            <p className="mt-6 text-gray-300">본격적인 수익 창출을 위한 플랜</p>
                            <ul role="list" className="mt-6 space-y-6 text-gray-300">
                                <li className="flex"><span className="text-indigo-400 mr-3">✓</span>무제한 가치 투자 종목</li>
                                <li className="flex"><span className="text-indigo-400 mr-3">✓</span>실시간 알림 서비스</li>
                                <li className="flex"><span className="text-indigo-400 mr-3">✓</span>고급 포트폴리오 관리</li>
                                <li className="flex"><span className="text-indigo-400 mr-3">✓</span>단폴더 필터 제공</li>
                            </ul>
                        </div>
                        <Link href="/payment/request?plan=pro" className="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-indigo-700">
                            지금 구독하기
                        </Link>
                    </div>

                    {/* VIP Plan */}
                    <div className="relative p-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">VIP</h3>
                            <p className="mt-4 flex items-baseline justify-center text-gray-900">
                                <span className="text-5xl font-extrabold tracking-tight">99,000원</span>
                                <span className="ml-1 text-xl font-semibold">/월</span>
                            </p>
                            <p className="mt-6 text-gray-500">전문가를 위한 1:1 케어</p>
                            <ul role="list" className="mt-6 space-y-6">
                                <li className="flex"><span className="text-indigo-500 mr-3">✓</span>Pro 플랜의 모든 기능</li>
                                <li className="flex"><span className="text-indigo-500 mr-3">✓</span>전용 텔레그램 채널</li>
                                <li className="flex"><span className="text-indigo-500 mr-3">✓</span>우선적 고객 지원</li>
                            </ul>
                        </div>
                        <Link href="/payment/request?plan=vip" className="mt-8 block w-full bg-indigo-50 border border-indigo-500 rounded-md py-3 text-sm font-semibold text-indigo-700 text-center hover:bg-indigo-100">
                            문의하기
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
