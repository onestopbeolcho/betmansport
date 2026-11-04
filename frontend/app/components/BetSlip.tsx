"use client";
import { useEffect } from 'react';
import { useCart } from '../../context/CartContext';

/**
 * PG 컴플라이언스 및 플랫폼 정책에 따라 조합 저장(BetSlip 장바구니) 기능 완전 비활성화.
 * 기존 브라우저 localStorage에 남아있던 장바구니 데이터도 마운트 시 자동 초기화합니다.
 */
export default function BetSlip() {
    const { cartItems, clearCart } = useCart();

    useEffect(() => {
        if (cartItems && cartItems.length > 0) {
            clearCart();
        }
        try {
            localStorage.removeItem('cart');
        } catch {
            // ignore
        }
    }, [cartItems, clearCart]);

    return null;
}
