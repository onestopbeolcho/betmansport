"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
    id: string; // unique combo of match_id + selection
    match_name: string;
    selection: 'Home' | 'Draw' | 'Away';
    odds: number;
    team_home: string;
    team_away: string;
    time: string;
}

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    isOpen: boolean;
    toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    // Load from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('smart_cart');
        if (saved) {
            try {
                setCartItems(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load cart", e);
            }
        }
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        localStorage.setItem('smart_cart', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (item: CartItem) => {
        setCartItems(prev => {
            // Prevent duplicate of EXACT same bet
            if (prev.some(i => i.id === item.id)) return prev;

            // Optional: Logic to prevent conflicting bets (e.g. Home AND Away for same match)?
            // For now, allow it (maybe for checking arbitrage), but we can warn later.
            const existingMatchBet = prev.find(i => i.match_name === item.match_name);
            if (existingMatchBet) {
                // If user picks new outcome for same match, replace it? Or add distinct?
                // Let's replace for a "Bet Slip" behavior (usually you pick one outcome per match for a parlay).
                // But for "Analysis", maybe they want to compare.
                // Let's allow multiple for now, or just warn. 
                // Strategy: Allow multiple, let user delete.
            }

            setIsOpen(true); // Auto open cart when adding
            return [...prev, item];
        });
    };

    const removeFromCart = (id: string) => {
        setCartItems(prev => prev.filter(item => item.id !== id));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const toggleCart = () => setIsOpen(prev => !prev);

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, isOpen, toggleCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
