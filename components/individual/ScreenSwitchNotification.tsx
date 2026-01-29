'use client';

import { useEffect, useState } from 'react';

interface ScreenSwitchNotificationProps {
    currentScreen: number;
    availableScreen: number;
    offerId: string;
    expiresAt: string;
    onSwitch: () => void;
    onDismiss: () => void;
}

export default function ScreenSwitchNotification({
    currentScreen,
    availableScreen,
    offerId,
    expiresAt,
    onSwitch,
    onDismiss
}: ScreenSwitchNotificationProps) {
    const [timeLeft, setTimeLeft] = useState(10);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animate in
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const expires = new Date(expiresAt).getTime();
            const remaining = Math.max(0, Math.floor((expires - now) / 1000));

            setTimeLeft(remaining);

            if (remaining === 0) {
                setIsVisible(false);
                setTimeout(onDismiss, 300); // Wait for fade out animation
            }
        }, 100);

        return () => clearInterval(interval);
    }, [expiresAt, onDismiss]);

    const handleSwitch = () => {
        setIsVisible(false);
        setTimeout(onSwitch, 300);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
    };

    return (
        <div
            className={`fixed top-4 left-4 right-4 z-50 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
                }`}
        >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 rounded-2xl shadow-2xl border-2 border-white/20">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-3xl">🎯</span>
                            <p className="text-white font-bold text-xl">
                                ¡Pantalla {availableScreen} Disponible!
                            </p>
                        </div>
                        <p className="text-white/90 text-sm">
                            Cámbiate ahora y juega más rápido
                        </p>

                        {/* Countdown timer */}
                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-white h-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${(timeLeft / 10) * 100}%` }}
                                />
                            </div>
                            <span className="text-white font-bold text-lg min-w-[3ch]">
                                {timeLeft}s
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleSwitch}
                            className="bg-white text-green-600 px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform"
                        >
                            Cambiar
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="bg-white/20 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/30 transition-colors"
                        >
                            ✕ Quedarme
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
