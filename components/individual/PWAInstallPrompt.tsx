'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PWAInstallPromptProps {
    onContinue: () => void;
}

export default function PWAInstallPrompt({ onContinue }: PWAInstallPromptProps) {
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // 1. Detect Standalone Mode
        const checkStandalone = () => {
            const isS = window.matchMedia('(display-mode: standalone)').matches ||
                (navigator as any).standalone ||
                document.referrer.includes('android-app://');
            setIsStandalone(!!isS);
        };

        // 2. Detect iOS
        const checkIOS = () => {
            const isI = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            setIsIOS(isI);
        };

        checkStandalone();
        checkIOS();

        // 3. Listen for BeforeInstallPrompt (Chrome/Android)
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        setDeferredPrompt(null);
    };

    // If already in standalone, just call onContinue automatically
    useEffect(() => {
        if (isStandalone) {
            onContinue();
        }
    }, [isStandalone, onContinue]);

    if (isStandalone) return null;

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
            <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Visual Header */}
                <div className="text-center space-y-4">
                    <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] shadow-2xl flex items-center justify-center text-5xl border border-white/20 animate-bounce">
                        🎡
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">
                        Ruleta <span className="text-indigo-500">Virtual</span>
                    </h1>
                    <p className="text-slate-400 font-medium">Instala la app para una experiencia premium sin distracciones.</p>
                </div>

                {/* Integration Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-3xl">
                    {/* Instructions for iOS */}
                    {isIOS ? (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">1</span>
                                Instalación en iPhone
                            </h3>
                            <div className="space-y-4 text-slate-300 text-sm">
                                <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl">
                                    <span className="text-2xl">📤</span>
                                    <p>Toca el botón <b>"Compartir"</b> en la barra inferior de Safari.</p>
                                </div>
                                <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl">
                                    <span className="text-2xl">➕</span>
                                    <p>Selecciona <b>"Añadir a pantalla de inicio"</b>.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <button
                                onClick={handleInstallClick}
                                disabled={!deferredPrompt}
                                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all flex items-center justify-center gap-3
                                    ${deferredPrompt
                                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.4)] active:scale-95'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                    }
                                `}
                            >
                                <span className="text-2xl">📲</span>
                                {deferredPrompt ? 'Instalar App Ahora' : 'Lista para Instalar'}
                            </button>

                            {!deferredPrompt && (
                                <p className="text-xs text-center text-slate-500 bg-white/5 py-3 px-4 rounded-xl">
                                    Si no ves el botón, usa el menú del navegador y selecciona <b>"Instalar Aplicación"</b>.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Secondary Action */}
                    <button
                        onClick={onContinue}
                        className="w-full py-4 text-slate-400 hover:text-white font-black uppercase tracking-widest text-xs transition-colors"
                    >
                        Continuar en Navegador
                    </button>
                </div>

                {/* Footer Badges */}
                <div className="flex justify-center gap-6 opacity-40 grayscale">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🍎</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest">iOS</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🤖</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest">Android</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
