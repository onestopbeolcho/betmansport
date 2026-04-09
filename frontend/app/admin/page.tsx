"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemConfig {
    api_football_key: string;
    betman_user_agent: string;
    scrape_interval_minutes: number;
}

interface User {
    id: string;
    email?: string;
    role: string;
    created_at: string;
}

interface Payment {
    id: string;
    user_id: string;
    amount?: number;
    currency?: string;
    status: string;
    created_at: string;
    portone_payment_id?: string;
    name?: string;
}

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'config' | 'sns' | 'users' | 'payments'>('config');
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    // --- Tab 1: System Config ---
    const [config, setConfig] = useState<SystemConfig>({
        api_football_key: '',
        betman_user_agent: '',
        scrape_interval_minutes: 10,
    });
    const [configLoading, setConfigLoading] = useState(false);
    const [configMessage, setConfigMessage] = useState('');

    // --- Tab 1: Push Notifications ---
    const [notifType, setNotifType] = useState('marketing');
    const [notifBody, setNotifBody] = useState('');
    const [notifSending, setNotifSending] = useState(false);
    const [notifResult, setNotifResult] = useState('');

    // --- Tab 2: SNS Marketing ---
    const [publishSending, setPublishSending] = useState(false);
    const [publishResult, setPublishResult] = useState('');

    // --- Tab 3: Users ---
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // --- Tab 4: Payments ---
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    // Initial Config Load
    useEffect(() => {
        fetch(`${API}/api/admin/config`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load config');
                return res.json();
            })
            .then(data => setConfig(data))
            .catch(err => console.error("Error loading config:", err));
    }, [API]);

    // Load Users
    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            setUsersLoading(true);
            fetch(`${API}/api/admin/users?limit=100`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            })
            .then(res => res.json())
            .then(data => setUsers(data.users || []))
            .catch(err => console.error(err))
            .finally(() => setUsersLoading(false));
        }
    }, [activeTab, API, users.length]);

    // Load Payments
    useEffect(() => {
        if (activeTab === 'payments' && payments.length === 0) {
            setPaymentsLoading(true);
            fetch(`${API}/api/admin/payments?limit=100`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            })
            .then(res => res.json())
            .then(data => setPayments(data.payments || []))
            .catch(err => console.error(err))
            .finally(() => setPaymentsLoading(false));
        }
    }, [activeTab, API, payments.length]);

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: name === 'scrape_interval_minutes' ? parseInt(value) || 0 : value
        }));
    };

    const handleConfigSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfigLoading(true);
        setConfigMessage('');
        try {
            const res = await fetch(`${API}/api/admin/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error('Failed to save config');
            setConfigMessage('Settings saved successfully!');
        } catch (err) {
            setConfigMessage('Failed to save settings.');
            console.error(err);
        } finally {
            setConfigLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (!notifBody.trim()) return;
        setNotifSending(true);
        setNotifResult('');
        try {
            const res = await fetch(`${API}/api/notifications/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                    notification_type: notifType,
                    body: notifBody,
                    url: '/',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNotifResult(`✅ Sent! (Delivered: ${data.sent || 0}, Skipped: ${data.skipped || 0})`);
                setNotifBody('');
            } else {
                setNotifResult('❌ Failed to send');
            }
        } catch (err) {
            setNotifResult('❌ Error occurred while sending');
        }
        setNotifSending(false);
    };

    const handleInstantPublish = async () => {
        setPublishSending(true);
        setPublishResult('');
        try {
            const res = await fetch(`${API}/api/marketing/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setPublishResult(`✅ 발행 성공! (Total: ${data.total_published || 0})`);
            } else {
                setPublishResult(`❌ 발행 실패: ${data.message || 'Unknown error'}`);
            }
        } catch (err) {
            setPublishResult('❌ 에러 발생: 백엔드 연결을 확인하세요');
        }
        setPublishSending(false);
    };

    const inputStyle = {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
    };

    const notifTypes = [
        { value: 'value_bet', label: '🎯 Value Opportunity Found' },
        { value: 'daily_pick', label: '⭐ Daily Pick' },
        { value: 'odds_change', label: '📈 Odds Change' },
        { value: 'result', label: '🏆 Match Result' },
        { value: 'marketing', label: '📢 News/Event' },
    ];

    const tabClasses = (tab: string) => `px-6 py-3 text-sm font-bold rounded-t-xl transition-all cursor-pointer ${activeTab === tab ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-t-2 border-t-[var(--accent-primary)] border-l border-l-[var(--border-subtle)] border-r border-r-[var(--border-subtle)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border-b border-b-[var(--border-subtle)]'}`;

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--bg-primary)' }}>
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                        <span className="gradient-text">⚙️ Admin Dashboard</span>
                    </h1>
                    <Link href="/" className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
                        ← Home
                    </Link>
                </div>

                {/* Tabs Header */}
                <div className="flex flex-wrap mb-6 border-b border-[var(--border-subtle)]">
                    <div onClick={() => setActiveTab('config')} className={tabClasses('config')}>시스템 설정</div>
                    <div onClick={() => setActiveTab('sns')} className={tabClasses('sns')}>SNS 발행</div>
                    <div onClick={() => setActiveTab('users')} className={tabClasses('users')}>회원 관리</div>
                    <div onClick={() => setActiveTab('payments')} className={tabClasses('payments')}>결제 내역</div>
                </div>

                {/* Tab 1: System Config */}
                {activeTab === 'config' && (
                    <div className="space-y-6">
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>크롤러 & 환경설정</h2>
                            {configMessage && (
                                <div className="p-4 mb-4 rounded-xl text-sm font-medium"
                                    style={configMessage.includes('success')
                                        ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                        : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                                    }>
                                    {configMessage}
                                </div>
                            )}

                            <form onSubmit={handleConfigSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>API-Football Key</label>
                                    <input type="password" name="api_football_key" value={config.api_football_key} onChange={handleConfigChange} className="w-full px-4 py-3 rounded-xl text-sm transition" style={inputStyle} placeholder="Enter API Key" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Betman User-Agent</label>
                                    <input type="text" name="betman_user_agent" value={config.betman_user_agent} onChange={handleConfigChange} className="w-full px-4 py-3 rounded-xl text-sm transition" style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Scrape Interval (min)</label>
                                    <input type="number" name="scrape_interval_minutes" value={config.scrape_interval_minutes} onChange={handleConfigChange} min="1" max="60" className="w-full px-4 py-3 rounded-xl text-sm transition" style={inputStyle} />
                                </div>
                                <button type="submit" disabled={configLoading} className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50">
                                    {configLoading ? 'Saving...' : 'Save Settings'}
                                </button>
                            </form>
                        </div>

                        <div className="glass-card p-6 border-l-4 border-l-[#8b5cf6]">
                            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>🔔 Push Notifications</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Type</label>
                                    <select value={notifType} onChange={(e) => setNotifType(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle}>
                                        {notifTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Message</label>
                                    <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={{ ...inputStyle, minHeight: '80px' }} placeholder="Enter notification message" />
                                </div>
                                {notifResult && (
                                    <div className="p-3 rounded-lg text-sm font-medium" style={notifResult.includes('✅') ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' } : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                        {notifResult}
                                    </div>
                                )}
                                <button onClick={handleSendNotification} disabled={notifSending || !notifBody.trim()} className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 flex justify-center items-center gap-2" style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}>
                                    {notifSending ? 'Sending...' : '📤 Send to All Users'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: SNS */}
                {activeTab === 'sns' && (
                    <div className="glass-card p-6 border-l-4 border-l-[#f59e0b]">
                        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📣 SNS 마케팅 즉시 발행</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            최신 예측 데이터를 바탕으로 Gemini 프롬프트를 실행하고 Buffer에 연결된 페이스북, 인스타그램 등에 즉시 게시합니다.
                        </p>
                        <div className="space-y-4">
                            {publishResult && (
                                <div className="p-4 border border-[var(--border-subtle)] rounded-xl text-sm font-medium mb-4" style={publishResult.includes('✅') ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' } : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{publishResult}</div>
                            )}
                            <button onClick={handleInstantPublish} disabled={publishSending} className="w-full py-5 rounded-xl text-base font-black text-white transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                                {publishSending ? (
                                    <><div className="animate-spin inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full" /> 컨텐츠 생성 및 즉시 발행 중...</>
                                ) : '🚀 다중 채널 즉시 발행 (Publish Now)'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab 3: Users */}
                {activeTab === 'users' && (
                    <div className="glass-card p-6 overflow-x-auto">
                        <h2 className="text-lg font-bold mb-4 flex justify-between items-center" style={{ color: 'var(--text-primary)' }}>
                            회원 목록 (최근 100명)
                            <button onClick={() => { 
                                setUsersLoading(true); 
                                fetch(`${API}/api/admin/users?limit=100`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } })
                                .then(res => res.json())
                                .then(data => setUsers(data.users || []))
                                .finally(() => setUsersLoading(false)); 
                            }} className="text-xs px-3 py-1 rounded font-bold transition" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>새로고침</button>
                        </h2>
                        {usersLoading ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : users.length === 0 ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>회원 데이터가 없습니다.</div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
                                        <th className="py-3 px-4 font-bold">Email</th>
                                        <th className="py-3 px-4 font-bold">Role</th>
                                        <th className="py-3 px-4 font-bold">Created At</th>
                                        <th className="py-3 px-4 font-bold text-right">User ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u, i) => (
                                        <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition opacity-90 hover:opacity-100">
                                            <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{u.email || '-'}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'premium' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                                                    {u.role ? u.role.toUpperCase() : 'FREE'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{formatDate(u.created_at)}</td>
                                            <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--text-subtle)' }}>{u.id}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Tab 4: Payments */}
                {activeTab === 'payments' && (
                    <div className="glass-card p-6 overflow-x-auto">
                        <h2 className="text-lg font-bold mb-4 flex justify-between items-center" style={{ color: 'var(--text-primary)' }}>
                            결제 내역 (최근 100건)
                            <button onClick={() => { 
                                setPaymentsLoading(true); 
                                fetch(`${API}/api/admin/payments?limit=100`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } })
                                .then(res => res.json())
                                .then(data => setPayments(data.payments || []))
                                .finally(() => setPaymentsLoading(false)); 
                            }} className="text-xs px-3 py-1 rounded font-bold transition" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>새로고침</button>
                        </h2>
                        {paymentsLoading ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : payments.length === 0 ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>결제 내역이 없습니다.</div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[var(--border-subtle)]" style={{ color: 'var(--text-secondary)' }}>
                                        <th className="py-3 px-4 font-bold">Item Name</th>
                                        <th className="py-3 px-4 font-bold">Amount</th>
                                        <th className="py-3 px-4 font-bold">Status</th>
                                        <th className="py-3 px-4 font-bold">Date</th>
                                        <th className="py-3 px-4 font-bold text-right">User ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p, i) => (
                                        <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition opacity-90 hover:opacity-100">
                                            <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name || 'Premium Subs'}</td>
                                            <td className="py-3 px-4 font-bold" style={{ color: 'var(--accent-primary)' }}>{p.amount?.toLocaleString()} {p.currency || 'KRW'}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'paid' ? 'bg-[#4ade80]/20 text-[#4ade80]' : p.status === 'failed' ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                                                    {p.status ? p.status.toUpperCase() : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{formatDate(p.created_at)}</td>
                                            <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--text-subtle)' }}>{p.user_id}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
