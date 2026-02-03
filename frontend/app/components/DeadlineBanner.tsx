import React, { useEffect, useState } from 'react';

export default function DeadlineBanner() {
    const [status, setStatus] = useState<'OPEN' | 'CLOSING_SOON' | 'CLOSED'>('OPEN');
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // Betman Blackout: 23:00 ~ 08:00
            // Closing Soon: 22:00 ~ 23:00

            if (hours >= 23 || hours < 8) {
                setStatus('CLOSED');
            } else if (hours === 22) {
                setStatus('CLOSING_SOON');
                const minLeft = 60 - minutes;
                setTimeLeft(`${minLeft}분`);
            } else {
                setStatus('OPEN');
            }
        };

        checkTime();
        const interval = setInterval(checkTime, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    if (status === 'OPEN') return null;

    return (
        <div className={`w-full p-3 text-center text-white font-bold shadow-md animate-pulse ${status === 'CLOSED' ? 'bg-gray-800' : 'bg-red-600'}`}>
            {status === 'CLOSED' ? (
                <span>💤 발매 차단 시간 (23:00 ~ 08:00) - 내일 아침 8시에 만나요!</span>
            ) : (
                <span>⏰ 마감 임박! {timeLeft} 뒤에 발매가 중단됩니다. (서두르세요!)</span>
            )}
        </div>
    );
}
