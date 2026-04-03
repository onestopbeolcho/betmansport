"use client";
import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useRouter } from 'next/navigation';

export default function BetSlip() {
    const { cartItems, removeFromCart, clearCart, isOpen, toggleCart } = useCart();
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const totalOdds = cartItems.reduce((acc, item) => acc * item.odds, 1);

    const handleSave = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (confirm("로그인이 필요합니다. 로그인 하시겠습니까?")) {
                router.push('/login');
            }
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API}/api/portfolio/slip/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ items: cartItems, total_odds: totalOdds })
            });
            if (res.ok) { alert("조합이 저장되었습니다! 💾"); clearCart(); toggleCart(); }
            else { const err = await res.json(); alert("저장 실패: " + (err.detail || "알 수 없는 오류")); }
        } catch (e) { console.error(e); alert("네트워크 오류"); }
        finally { setSaving(false); }
    };

    if (!isOpen && cartItems.length === 0) return null;

    return (
        <>
            {/* Floating Cart Button */}
            {!isOpen && cartItems.length > 0 && (
                <button
                    onClick={toggleCart}
                    className="fixed bottom-6 right-6 z-50 rounded-2xl p-4 shadow-2xl hover:scale-105 transition-all animate-pulse-glow"
                    style={{
                        background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                        boxShadow: '0 0 30px rgba(0,212,255,0.3), 0 8px 32px rgba(0,0,0,0.4)',
                    }}
                >
                    <span className="text-white text-lg">📊</span>
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-[var(--bg-primary)]">
                        {cartItems.length}
                    </span>
                </button>
            )}

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                    onClick={toggleCart}
                />
            )}

            {/* Panel */}
            <div className={`fixed bottom-0 right-0 h-full w-[340px] shadow-2xl transform transition-transform duration-300 ease-out z-50 flex flex-col glass-heavy border-l border-[var(--border-default)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-[var(--border-subtle)]" style={{ background: 'var(--bg-elevated)' }}>
                    <h2 className="font-bold text-white flex items-center text-sm gap-2">
                        📊 조합 분석
                        <span className="badge badge-value">{cartItems.length}</span>
                    </h2>
                    <button onClick={toggleCart} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all text-lg">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 space-y-2">
                    {cartItems.length === 0 ? (
                        <div className="text-center mt-16">
                            <div className="text-4xl mb-3 opacity-30">📊</div>
                            <p className="text-[var(--text-muted)]">선택된 경기가 없습니다.</p>
                            <p className="text-xs mt-1 text-[var(--text-muted)] opacity-60">분석할 경기를 추가하세요</p>
                        </div>
                    ) : (
                        <div className="stagger-children">
                            {cartItems.map((item) => (
                                <div key={item.id} className="surface-card p-3 relative group">
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all text-sm opacity-0 group-hover:opacity-100"
                                    >
                                        &times;
                                    </button>
                                    <div className="text-xs text-[var(--accent-primary)] font-bold mb-1">
                                        {item.selection === 'Home' ? '홈 승' : item.selection === 'Away' ? '원정 승' : '무승부'}
                                    </div>
                                    <div className="font-medium text-white/90 text-sm">{item.team_home} vs {item.team_away}</div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs text-[var(--text-muted)]">{item.time}</span>
                                        <span className="badge badge-value font-mono text-sm font-bold">{item.odds.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cartItems.length > 0 && (
                    <div className="p-4 border-t border-[var(--border-subtle)] space-y-3" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex justify-between items-center p-3 rounded-xl border border-[var(--border-accent)] bg-[rgba(0,212,255,0.05)]">
                            <span className="text-xs text-[var(--accent-primary)] font-bold">조합 지표</span>
                            <span className="text-xl font-black gradient-text font-mono">{totalOdds.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={clearCart} className="btn-ghost text-sm !py-2">전체 삭제</button>
                            <button onClick={handleSave} disabled={saving} className={`btn-primary text-sm !py-2 ${saving ? 'opacity-50' : ''}`}>
                                {saving ? '저장 중...' : '💾 조합 저장'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
