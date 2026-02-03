"use client";
import React, { useState } from 'react';
import Link from 'next/link';

// Mock Data for UI Dev
const MOCK_PORTFOLIO = [
    { id: 1, match: "Man City vs Liverpool", selection: "Home", odds: 2.1, stake: 50000, result: "Win", profit: 55000, date: "2024-02-01" },
    { id: 2, match: "Lakers vs Warriors", selection: "Over 220.5", odds: 1.9, stake: 30000, result: "Loss", profit: -30000, date: "2024-02-02" },
];

export default function MyPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/">
                                <span className="text-2xl font-black text-indigo-600 tracking-tighter cursor-pointer">SMART PROTO</span>
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">홍길동님 (VIP)</span>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* User Profile Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-1">
                        <div className="px-4 py-5 sm:p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">내 멤버십</dt>
                                        <dd className="flex items-baseline">
                                            <div className="text-2xl font-semibold text-gray-900">VIP Plan</div>
                                            <span className="ml-2 flex items-baseline text-sm font-semibold text-green-600">Active</span>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-4 sm:px-6">
                            <div className="text-sm">
                                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">구독 관리 <span aria-hidden="true">&rarr;</span></a>
                            </div>
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-1">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">총 수익금</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">+25,000원</dd>
                            <div className="opacity-50 text-xs mt-1">누적 적중률 50%</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-1 flex items-center justify-center p-6">
                        <Link href="/" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                            새로운 배팅 찾기
                        </Link>
                    </div>
                </div>

                {/* Portfolio Table */}
                <div className="mt-8">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">나의 배팅 포트폴리오 (Betting Portfolio)</h3>
                    <div className="mt-4 flex flex-col">
                        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">경기명</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">선택</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">배당률</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결과</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {MOCK_PORTFOLIO.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.match}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.selection}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.odds}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.stake.toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.result === 'Win' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {item.result} (+{item.profit.toLocaleString()})
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
