'use client';

import React, { useState, useEffect } from 'react';

export default function DisplayLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            // portrait: width < height
            setIsPortrait(window.innerWidth < window.innerHeight);
        };

        checkOrientation();

        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    return (
        <>
            {children}
            {isPortrait && (
                <div className="fixed inset-0 z-[99999] bg-[#050505]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300 font-sans">
                    <style>{`
                        @keyframes rotate-phone {
                            0% { transform: rotate(0deg); }
                            35% { transform: rotate(-90deg); }
                            70% { transform: rotate(-90deg); }
                            100% { transform: rotate(0deg); }
                        }
                        @keyframes spin-slow {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                        .animate-phone-rotation {
                            animation: rotate-phone 2.5s infinite ease-in-out;
                        }
                        .animate-spin-slow {
                            animation: spin-slow 15s linear infinite;
                        }
                    `}</style>
                    
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full pointer-events-none" />
                    
                    {/* Floating Phone Icon Card */}
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl flex flex-col items-center gap-8 relative overflow-hidden">
                        {/* Glow borders decoration */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                        
                        {/* Device Rotate Animation (SVG) */}
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 relative">
                            {/* Rotation Arrow */}
                            <svg className="absolute w-16 h-16 text-orange-500/25 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            
                            {/* Phone SVG */}
                            <div className="animate-phone-rotation">
                                <svg className="w-10 h-16 text-white" viewBox="0 0 24 40" fill="currentColor">
                                    {/* Phone frame */}
                                    <rect x="2" y="2" width="20" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                                    {/* Screen notch/camera */}
                                    <circle cx="12" cy="5" r="1" />
                                    {/* Home button/indicator */}
                                    <line x1="9" y1="34" x2="15" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>

                        {/* Message Texts */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">
                                Gira tu <span className="text-orange-500">pantalla</span>
                            </h2>
                            <p className="text-gray-400 text-sm font-medium leading-relaxed">
                                Esta pantalla de visualización requiere modo horizontal (Landscape) para funcionar correctamente.
                            </p>
                        </div>

                        {/* Helper tip */}
                        <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                            <span>💡</span> Asegúrate de activar la rotación automática
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
