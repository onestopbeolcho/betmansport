"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { signInWithPopup, ConfirmationResult } from 'firebase/auth';
import { auth, googleProvider, RecaptchaVerifier, signInWithPhoneNumber } from '../../lib/firebase';

interface User {
    id: string;
    email: string;
    nickname: string;
    role: string;
    tier?: string;
    full_name?: string;
    phone?: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, nickname: string, full_name?: string, phone?: string) => Promise<void>;
    googleLogin: () => Promise<void>;
    sendPhoneCode: (phone: string, recaptchaContainerId: string) => Promise<void>;
    verifyPhoneCode: (code: string) => Promise<void>;
    logout: () => void;
    token: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // Load user from token on mount
    const fetchMe = useCallback(async (t: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${t}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
            }
        } catch {
            console.error('Failed to fetch user');
        }
    }, [apiUrl]);

    useEffect(() => {
        const stored = localStorage.getItem('token');
        if (stored) {
            setToken(stored);
            fetchMe(stored).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [fetchMe]);

    const login = async (email: string, password: string) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch(`${apiUrl}/api/auth/login/access-token`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || '이메일 또는 비밀번호가 일치하지 않습니다.');
        }

        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        await fetchMe(data.access_token);
    };

    const register = async (email: string, password: string, nickname: string, full_name?: string, phone?: string) => {
        const res = await fetch(`${apiUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, nickname, full_name: full_name || '', phone: phone || '' }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || '회원가입에 실패했습니다.');
        }

        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        await fetchMe(data.access_token);
    };

    const googleLogin = async () => {
        // 1. Firebase Google popup sign-in
        const result = await signInWithPopup(auth, googleProvider);
        const idToken = await result.user.getIdToken();

        // 2. Send Firebase ID token to backend → get JWT
        const res = await fetch(`${apiUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Google 로그인에 실패했습니다.');
        }

        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        await fetchMe(data.access_token);
    };

    const sendPhoneCode = async (phone: string, recaptchaContainerId: string) => {
        // Clean up previous verifier
        if (recaptchaVerifier) {
            try { recaptchaVerifier.clear(); } catch { /* ignore */ }
        }
        const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
        setRecaptchaVerifier(verifier);
        const result = await signInWithPhoneNumber(auth, phone, verifier);
        setConfirmationResult(result);
    };

    const verifyPhoneCode = async (code: string) => {
        if (!confirmationResult) throw new Error('인증번호를 먼저 요청해주세요.');
        const credential = await confirmationResult.confirm(code);
        const idToken = await credential.user.getIdToken();

        // Send Firebase ID token to backend (reuse google endpoint)
        const res = await fetch(`${apiUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || '전화번호 로그인에 실패했습니다.');
        }

        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        await fetchMe(data.access_token);
        setConfirmationResult(null);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, googleLogin, sendPhoneCode, verifyPhoneCode, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
}
