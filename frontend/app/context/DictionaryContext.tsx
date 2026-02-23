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

export function useDictionary() {
    const context = useContext(DictionaryContext);
    if (!context || Object.keys(context).length === 0) {
        throw new Error('useDictionary must be used within a DictionaryProvider');
    }
    return context;
}
