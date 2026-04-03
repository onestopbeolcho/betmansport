"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import PremiumGate from '../../components/PremiumGate';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

interface AlertRule {
    id: string;
    rule_type: string;
    field: string;
    operator: string;
    value: string;
    label: string;
    enabled: boolean;
    triggered_count: number;
    last_triggered: string | null;
}

interface Preset {
    id: string;
    label: string;
    rule_type: string;
    field: string;
    operator: string;
    value: string;
    description: string;
}

export default function VipAlertsPage() {
    const { user, token } = useAuth();
    const pathname = usePathname();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const [rules, setRules] = useState<AlertRule[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    useEffect(() => {
        if (token) {
            loadData();
        }
    }, [token]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rulesRes, presetsRes] = await Promise.all([
                fetch(`${API}/api/vip/alerts/rules`, { headers }),
                fetch(`${API}/api/vip/alerts/presets`, { headers }),
            ]);
            const rulesData = await rulesRes.json();
            const presetsData = await presetsRes.json();
            setRules(rulesData.rules || []);
            setPresets(presetsData.presets || []);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    const addPreset = async (preset: Preset) => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/vip/alerts/rules`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    rules: [{
                        rule_type: preset.rule_type,
                        field: preset.field,
                        operator: preset.operator,
                        value: preset.value,
                        label: preset.label,
                        enabled: true,
                    }],
                }),
            });
            if (res.ok) await loadData();
        } catch { /* */ }
        finally { setSaving(false); }
    };

    const toggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            await fetch(`${API}/api/vip/alerts/rules/${ruleId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ enabled }),
            });
            setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled } : r));
        } catch { /* */ }
    };

    const deleteRule = async (ruleId: string) => {
        try {
            await fetch(`${API}/api/vip/alerts/rules/${ruleId}`, {
                method: 'DELETE',
                headers,
            });
            setRules((prev) => prev.filter((r) => r.id !== ruleId));
        } catch { /* */ }
    };

    const OPERATOR_LABELS: Record<string, string> = {
        '>': 'above', '<': 'below', '>=': 'at least', '<=': 'at most', '==': 'equals', contains: 'contains',
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <Navbar />
            <DeadlineBanner />

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <a href={`/${currentLang}/vip`} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        ← VIP
                    </a>
                    <h1 className="text-xl font-black text-white">⚙️ Custom Alerts</h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-secondary)' }}>
                        VIP
                    </span>
                </div>

                <PremiumGate featureName="Custom Alerts" requiredTier="vip">
                    {/* Active Rules */}
                    <div className="glass-card p-5 rounded-2xl space-y-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">📋 My Alert Rules</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>
                                {rules.length}/10
                            </span>
                        </div>

                        {loading ? (
                            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                Loading...
                            </div>
                        ) : rules.length === 0 ? (
                            <div className="text-center py-6">
                                <div className="text-2xl mb-2">🔔</div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    No alert rules set yet.
                                    <br />Add one quickly from the presets below!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rules.map((rule) => (
                                    <div key={rule.id} className="p-3 rounded-xl flex items-center gap-3"
                                        style={{
                                            background: rule.enabled ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${rule.enabled ? 'rgba(0,212,255,0.15)' : 'var(--border-subtle)'}`,
                                        }}>
                                        {/* Toggle */}
                                        <button
                                            onClick={() => toggleRule(rule.id, !rule.enabled)}
                                            className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                                            style={{
                                                background: rule.enabled
                                                    ? 'var(--accent-primary)'
                                                    : 'rgba(255,255,255,0.1)',
                                            }}
                                        >
                                            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                                                style={{ left: rule.enabled ? '22px' : '2px' }} />
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white">{rule.label || rule.field}</div>
                                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {rule.field} {OPERATOR_LABELS[rule.operator] || rule.operator} {rule.value}
                                                {rule.triggered_count > 0 && (
                                                    <span className="ml-2">· Triggered {rule.triggered_count} times</span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => deleteRule(rule.id)}
                                            className="text-xs px-2 py-1 rounded transition hover:bg-red-500/20"
                                            style={{ color: '#ef4444' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Presets */}
                    <div className="glass-card p-5 rounded-2xl space-y-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <h2 className="text-sm font-bold text-white">⚡ Quick Add (Presets)</h2>
                        <div className="grid gap-2">
                            {presets.map((preset) => {
                                const alreadyAdded = rules.some(
                                    (r) => r.field === preset.field && r.operator === preset.operator && r.value === preset.value
                                );
                                return (
                                    <div key={preset.id} className="p-3 rounded-xl flex items-center gap-3"
                                        style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--border-subtle)',
                                            opacity: alreadyAdded ? 0.5 : 1,
                                        }}>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-white">{preset.label}</div>
                                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {preset.description}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => !alreadyAdded && addPreset(preset)}
                                            disabled={alreadyAdded || saving}
                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                                            style={{
                                                background: alreadyAdded ? 'rgba(255,255,255,0.05)' : 'rgba(0,212,255,0.15)',
                                                color: alreadyAdded ? 'var(--text-muted)' : 'var(--accent-primary)',
                                                border: `1px solid ${alreadyAdded ? 'transparent' : 'rgba(0,212,255,0.2)'}`,
                                            }}
                                        >
                                            {alreadyAdded ? 'Added' : '+ Add'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PremiumGate>
            </main>
        </div>
    );
}
