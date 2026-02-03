"use client";
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentRequestPage() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan') || 'pro';

    const prices = { 'pro': 29000, 'vip': 99000 };
    const price = prices[plan as keyof typeof prices] || 29000;

    const [name, setName] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // In real app, call API here. 
        // For demo/POC, just mock success.
        // const res = await fetch('/api/payments/request' ...)

        // Assume success
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">무통장 입금 신청</h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        <span className="font-bold text-indigo-600 uppercase">{plan} Plan</span> 구독을 신청합니다.
                    </p>
                </div>

                {!submitted ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div className="p-4 bg-gray-100 rounded-t-md border-b border-gray-200">
                                <p className="text-sm text-gray-500">입금하실 금액</p>
                                <p className="text-2xl font-bold text-gray-900">{price.toLocaleString()}원</p>
                            </div>
                            <div className="p-4 bg-blue-50 border-b border-blue-100">
                                <p className="text-sm text-blue-600 font-semibold">입금 계좌 안내</p>
                                <p className="text-lg font-bold text-blue-900">카카오뱅크 3333-00-0000000</p>
                                <p className="text-sm text-blue-800">예금주: 스마트프로토</p>
                            </div>
                            <div className="pt-4">
                                <label htmlFor="depositor" className="sr-only">입금자명</label>
                                <input
                                    id="depositor"
                                    name="depositor"
                                    type="text"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder="입금자명 (실명 입력)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                입금 완료 신청하기
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="mt-2 text-xl font-medium text-gray-900">신청이 완료되었습니다!</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            관리자가 입금 확인 후<br />1시간 이내에 승인 문자를 보내드립니다.
                        </p>
                        <div className="mt-6">
                            <a href="/" className="text-indigo-600 hover:text-indigo-500 font-medium">
                                홈으로 돌아가기
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
