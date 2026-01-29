'use client';

import { useEffect, useState } from 'react';

interface SpinCounterProps {
    currentSpin: number;
    totalSpins: number;
}

export default function SpinCounter({ currentSpin, totalSpins }: SpinCounterProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animate in
        setIsVisible(true);
    }, []);

    const percentage = (currentSpin / totalSpins) * 100;

    return (
        <div
            className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                }`}
        >
            <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 p-6 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-2xl">🎯</span>
                        </div>
                        <div>
                            <p className="text-white/80 text-sm font-medium">Tu Progreso</p>
                            <p className="text-white text-2xl font-bold">
                                Giro {currentSpin} de {totalSpins}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                <p className="text-white/70 text-xs mt-2 text-center">
                    {totalSpins - currentSpin} giros restantes
                </p>
            </div>
        </div>
    );
}
