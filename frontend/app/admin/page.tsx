"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    const [activeTab, setActiveTab] = useState<'config' | 'sns' | 'video' | 'users' | 'payments' | 'accuracy'>('config');
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
    const [remoteTriggering, setRemoteTriggering] = useState(false);
    const [remoteResult, setRemoteResult] = useState('');

    // --- Tab 3: Users ---
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // --- Tab 4: Payments ---
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    // --- Tab 5: Accuracy ---
    const [accuracyData, setAccuracyData] = useState<any>(null);
    const [accuracyLoading, setAccuracyLoading] = useState(false);

    // --- Tab 6: Video Config (신규) ---
    interface VideoConfig {
        tts_voice_ko: string;
        tts_voice_en: string;
        tts_voice_ja: string;
        tts_speed_ko: string;
        tts_speed_en: string;
        tts_speed_ja: string;
        tts_pitch_ko: string;
        subtitle_base_size_intro: number;
        subtitle_base_size_match: number;
        subtitle_font_ko: string;
        winning_intros: string[];
        winning_ctas: string[];
        educational_intros: string[];
        educational_ctas: string[];
    }
    
    const [videoConfig, setVideoConfig] = useState<VideoConfig>({
        tts_voice_ko: 'ko-KR-SunHiNeural',
        tts_voice_en: 'en-US-EmmaNeural',
        tts_voice_ja: 'ja-JP-NanamiNeural',
        tts_speed_ko: '+15%',
        tts_speed_en: '+12%',
        tts_speed_ja: '+10%',
        tts_pitch_ko: '+5Hz',
        subtitle_base_size_intro: 68,
        subtitle_base_size_match: 54,
        subtitle_font_ko: 'malgun.ttf',
        winning_intros: [],
        winning_ctas: [],
        educational_intros: [],
        educational_ctas: [],
    });
    const [videoLoading, setVideoLoading] = useState(false);
    const [videoMessage, setVideoMessage] = useState('');

    // Load Video Config
    useEffect(() => {
        if (activeTab === 'video') {
            setVideoLoading(true);
            fetch(`${API}/api/admin/video-config`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            })
            .then(res => res.json())
            .then(data => {
                setVideoConfig({
                    ...data,
                    winning_intros: Array.isArray(data.winning_intros) ? data.winning_intros : [],
                    winning_ctas: Array.isArray(data.winning_ctas) ? data.winning_ctas : [],
                    educational_intros: Array.isArray(data.educational_intros) ? data.educational_intros : [],
                    educational_ctas: Array.isArray(data.educational_ctas) ? data.educational_ctas : [],
                });
            })
            .catch(err => console.error(err))
            .finally(() => setVideoLoading(false));
        }
    }, [activeTab, API]);

    const handleVideoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setVideoLoading(true);
        setVideoMessage('');
        try {
            const res = await fetch(`${API}/api/admin/video-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify(videoConfig)
            });
            if (!res.ok) throw new Error('Failed to save video config');
            setVideoMessage('비디오 설정이 성공적으로 저장되었습니다!');
        } catch (err) {
            setVideoMessage('비디오 설정 저장에 실패했습니다.');
            console.error(err);
        } finally {
            setVideoLoading(false);
        }
    };

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

    // Load Accuracy
    useEffect(() => {
        if (activeTab === 'accuracy' && !accuracyData) {
            setAccuracyLoading(true);
            fetch(`${API}/api/ai/accuracy?days=30`)
            .then(res => res.json())
            .then(data => setAccuracyData(data))
            .catch(err => console.error(err))
            .finally(() => setAccuracyLoading(false));
        }
    }, [activeTab, API, accuracyData]);

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

    const handleRemoteTrigger = async () => {
        setRemoteTriggering(true);
        setRemoteResult('');
        try {
            const triggerRef = doc(db, "system_control", "remote_trigger");
            await setDoc(triggerRef, {
                trigger_auto_all: true,
                last_requested: serverTimestamp(),
                status: 'pending'
            }, { merge: true });
            setRemoteResult('✅ 성공: 로컬 PC로 원격 실행 신호를 전송했습니다! (Auto-Manager 확인)');
        } catch (error) {
            console.error("Firebase remote trigger error:", error);
            setRemoteResult('❌ 실패: Firebase 연결 권한 또는 설정을 확인하세요.');
        }
        setRemoteTriggering(false);
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
                    <div onClick={() => setActiveTab('video')} className={tabClasses('video')}>비디오/마케팅 설정</div>
                    <div onClick={() => setActiveTab('users')} className={tabClasses('users')}>회원 관리</div>
                    <div onClick={() => setActiveTab('payments')} className={tabClasses('payments')}>결제 내역</div>
                    <div onClick={() => setActiveTab('accuracy')} className={tabClasses('accuracy')}>AI 검증</div>
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
                        
                        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
                            <h3 className="text-md font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                💻 로컬 PC 원격 자동화 제어 (Auto-Manager)
                            </h3>
                            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                집에 켜져있는 PC의 Scorenix Manager 프로그램에 원격으로 전체 자동화(크롤링~렌더링~업로드) 명령을 내립니다.
                            </p>
                            {remoteResult && (
                                <div className="p-3 mb-4 rounded-lg text-sm font-medium" style={remoteResult.includes('✅') ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' } : { background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                    {remoteResult}
                                </div>
                            )}
                            <button onClick={handleRemoteTrigger} disabled={remoteTriggering} className="w-full py-4 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 shadow-lg" style={{ background: 'linear-gradient(135deg, #0f172a, #3b82f6)' }}>
                                {remoteTriggering ? '신호 전송 중...' : '📡 원격 영상 생성 및 자동화 시작 (Remote Trigger)'}
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

                {/* Tab 5: Accuracy */}
                {activeTab === 'accuracy' && (
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-bold mb-4 flex justify-between items-center" style={{ color: 'var(--text-primary)' }}>
                            AI 예측 검증 (최근 30일)
                            <button onClick={async () => {
                                setAccuracyLoading(true);
                                try {
                                    const res = await fetch(`${API}/api/ai/grade-predictions`, { method: 'POST' });
                                    const data = await res.json();
                                    alert(`수동 검증 완료: ${data.graded || 0}건 처리됨`);
                                    const accRes = await fetch(`${API}/api/ai/accuracy?days=30`);
                                    const accData = await accRes.json();
                                    setAccuracyData(accData);
                                } catch (e) {
                                    alert('오류 발생');
                                }
                                setAccuracyLoading(false);
                            }} className="text-xs px-3 py-1 rounded font-bold transition bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">수동 검증(채점) 실행</button>
                        </h2>
                        {accuracyLoading ? (
                             <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>로딩중...</div>
                        ) : !accuracyData ? (
                            <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>데이터가 없습니다.</div>
                        ) : (
                            <div className="space-y-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">총 예측(종료)</div>
                                        <div className="text-xl font-bold">{accuracyData.total_graded}건</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">적중(Hit)</div>
                                        <div className="text-xl font-bold text-green-500">{accuracyData.hit}건</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">미적중(Miss)</div>
                                        <div className="text-xl font-bold text-red-500">{accuracyData.miss}건</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">적중률</div>
                                        <div className="text-xl font-bold text-blue-500">{accuracyData.accuracy_percent}%</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 6: Video Config */}
                {activeTab === 'video' && (
                    <div className="space-y-6">
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold mb-4 flex justify-between items-center" style={{ color: 'var(--text-primary)' }}>
                                🎬 비디오 콘텐츠 & 디자인 설정
                            </h2>
                            {videoMessage && (
                                <div className="p-4 mb-4 rounded-xl text-sm font-medium"
                                    style={videoMessage.includes('성공')
                                        ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                        : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                                    }>
                                    {videoMessage}
                                </div>
                            )}

                            {videoLoading ? (
                                <div className="py-10 text-center" style={{ color: 'var(--text-secondary)' }}>설정을 불러오는 중...</div>
                            ) : (
                                <form onSubmit={handleVideoSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* TTS Voice 설정 */}
                                        <div className="space-y-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                            <h3 className="text-sm font-bold text-[var(--accent-primary)]">🗣️ Edge-TTS 성우 ID 설정</h3>
                                            <div>
                                                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>한국어 성우 (ko)</label>
                                                <input type="text" value={videoConfig.tts_voice_ko} onChange={(e) => setVideoConfig(prev => ({...prev, tts_voice_ko: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>영어 성우 (en)</label>
                                                <input type="text" value={videoConfig.tts_voice_en} onChange={(e) => setVideoConfig(prev => ({...prev, tts_voice_en: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>일본어 성우 (ja)</label>
                                                <input type="text" value={videoConfig.tts_voice_ja} onChange={(e) => setVideoConfig(prev => ({...prev, tts_voice_ja: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                            </div>
                                        </div>

                                        {/* TTS 속도 & 자막 스타일 */}
                                        <div className="space-y-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                            <h3 className="text-sm font-bold text-[var(--accent-primary)]">🎨 자막 디자인 & TTS 속도</h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>속도 (ko)</label>
                                                    <input type="text" value={videoConfig.tts_speed_ko} onChange={(e) => setVideoConfig(prev => ({...prev, tts_speed_ko: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>속도 (en)</label>
                                                    <input type="text" value={videoConfig.tts_speed_en} onChange={(e) => setVideoConfig(prev => ({...prev, tts_speed_en: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>속도 (ja)</label>
                                                    <input type="text" value={videoConfig.tts_speed_ja} onChange={(e) => setVideoConfig(prev => ({...prev, tts_speed_ja: e.target.value}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <div>
                                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>소개글 자막 크기</label>
                                                    <input type="number" value={videoConfig.subtitle_base_size_intro} onChange={(e) => setVideoConfig(prev => ({...prev, subtitle_base_size_intro: parseInt(e.target.value) || 0}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>본문 자막 크기</label>
                                                    <input type="number" value={videoConfig.subtitle_base_size_match} onChange={(e) => setVideoConfig(prev => ({...prev, subtitle_base_size_match: parseInt(e.target.value) || 0}))} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 대본 템플릿 설정 */}
                                    <div className="space-y-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                        <h3 className="text-sm font-bold text-[var(--accent-primary)]">📝 적중 인증(Winning) 대본 템플릿</h3>
                                        <div>
                                            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>인트로 멘트 (한 줄씩 작성, 랜덤 선택)</label>
                                            <textarea 
                                                value={videoConfig.winning_intros.join('\n')} 
                                                onChange={(e) => setVideoConfig(prev => ({...prev, winning_intros: e.target.value.split('\n')}))} 
                                                className="w-full px-3 py-2 rounded-lg text-xs resize-none" 
                                                style={{ ...inputStyle, minHeight: '80px' }} 
                                                placeholder="템플릿을 줄바꿈으로 구분해 작성하세요."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>마무리 CTA 멘트 (한 줄씩 작성)</label>
                                            <textarea 
                                                value={videoConfig.winning_ctas.join('\n')} 
                                                onChange={(e) => setVideoConfig(prev => ({...prev, winning_ctas: e.target.value.split('\n')}))} 
                                                className="w-full px-3 py-2 rounded-lg text-xs resize-none" 
                                                style={{ ...inputStyle, minHeight: '80px' }} 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                        <h3 className="text-sm font-bold text-[var(--accent-primary)]">📝 가치 투자 교육(Educational) 대본 템플릿</h3>
                                        <div>
                                            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>인트로 멘트 (한 줄씩 작성)</label>
                                            <textarea 
                                                value={videoConfig.educational_intros.join('\n')} 
                                                onChange={(e) => setVideoConfig(prev => ({...prev, educational_intros: e.target.value.split('\n')}))} 
                                                className="w-full px-3 py-2 rounded-lg text-xs resize-none" 
                                                style={{ ...inputStyle, minHeight: '80px' }} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>마무리 CTA 멘트 (한 줄씩 작성)</label>
                                            <textarea 
                                                value={videoConfig.educational_ctas.join('\n')} 
                                                onChange={(e) => setVideoConfig(prev => ({...prev, educational_ctas: e.target.value.split('\n')}))} 
                                                className="w-full px-3 py-2 rounded-lg text-xs resize-none" 
                                                style={{ ...inputStyle, minHeight: '80px' }} 
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={videoLoading} className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50">
                                        {videoLoading ? '저장 중...' : '💾 비디오 설정 저장 및 적용'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
