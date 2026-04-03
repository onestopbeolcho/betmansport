"use client";
import React, { createContext, useContext } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dictionary = Record<string, any>;

const DictionaryContext = createContext<Dictionary>({});

export function DictionaryProvider({
    dictionary,
    children,
}: {
    dictionary: Dictionary;
    children: React.ReactNode;
}) {
    return (
        <DictionaryContext.Provider value={dictionary}>
            {children}
        </DictionaryContext.Provider>
    );
}

/**
 * Dictionary 값을 가져오는 훅
 * DictionaryProvider 내부에서만 사용 가능 (strict 모드)
 */
export function useDictionary() {
    const context = useContext(DictionaryContext);
    if (!context || Object.keys(context).length === 0) {
        throw new Error('useDictionary must be used within a DictionaryProvider');
    }
    return context;
}

/**
 * DictionaryProvider 밖에서도 안전하게 사용할 수 있는 훅
 * Provider 바깥이면 null 반환 → 기본 한국어 하드코딩으로 fallback
 */
export function useDictionarySafe() {
    const context = useContext(DictionaryContext);
    if (!context || Object.keys(context).length === 0) {
        return null;
    }
    return context;
}
