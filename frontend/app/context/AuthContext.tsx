"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';

interface User {
    id: string;
    email: string;
    nickname: string;
    role: string;
    tier?: string;  // 'free' | 'basic' | 'pro' | 'premium'
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, nickname: string) => Promise<void>;
    googleLogin: () => Promise<void>;
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

    const register = async (email: string, password: string, nickname: string) => {
        const res = await fetch(`${apiUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, nickname }),
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

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
}
