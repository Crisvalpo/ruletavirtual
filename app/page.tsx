'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
    const { profile, isLoading, user } = useAuth();
    const router = useRouter();
    const [isStandalone, setIsStandalone] = React.useState<boolean | null>(null);
    const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

    const isAdmin = profile?.role === 'admin';
    const isStaff = profile?.role === 'staff' || isAdmin;

    // 0. Detect Standalone Mode & Capture Install Prompt
    React.useEffect(() => {
        const checkStandalone = () => {
            const isPWA = window.matchMedia('(display-mode: standalone)').matches
                || (window.navigator as any).standalone
                || document.referrer.includes('android-app://');
            setIsStandalone(!!isPWA);
        };
        checkStandalone();

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsStandalone(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // 1. Force Auth (Only if standalone or staff)
    const [activeScreens, setActiveScreens] = React.useState<number[]>([]);
    const supabase = React.useMemo(() => createClient(), []);

    React.useEffect(() => {
        const channel = supabase.channel('global_presence_monitor');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const active: number[] = [];

                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.type === 'display' && typeof p.screen === 'number') {
                            active.push(p.screen);
                        }
                    });
                });

                setActiveScreens([...new Set(active)]); // Deduplicate
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    React.useEffect(() => {
        if (isStandalone === true || isStaff) {
            if (!isLoading && !user) {
                router.push('/auth/login');
            }
        }
    }, [user, isLoading, router, isStandalone, isStaff]);

    // 2. Ticket Redemption Logic
    const [scannedCode, setScannedCode] = React.useState<string | null>(null);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('redeemCode');
        if (code) {
            setScannedCode(code);
            localStorage.setItem('pending_ticket_code', code);
            window.history.replaceState({}, '', '/');
        }
    }, []);

    // Loading state or Gateway for non-standalone
    if (isStandalone === false && !isStaff) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-center space-y-8">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-3xl flex items-center justify-center text-5xl shadow-2xl animate-bounce">
                    🎰
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-white tracking-tighter">RULETA ANIMALITOS</h1>
                    <p className="text-gray-400 font-medium">Instala la aplicación para jugar</p>
                </div>

                <div className="w-full max-w-sm space-y-4">
                    {/* iOS Instructions */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl text-left">
                        <p className="text-white font-bold mb-2 flex items-center gap-2">
                            <span>🍎</span> Usuarios iPhone (iOS)
                        </p>
                        <ol className="text-sm text-gray-400 space-y-2 list-decimal ml-4">
                            <li>Presiona el botón <span className="text-blue-400 font-bold">Compartir</span> (cuadrado con flecha)</li>
                            <li>Baja y elige <span className="text-white font-bold">"Agregar al inicio"</span></li>
                        </ol>
                    </div>

                    {/* Android Instructions / APK / Native Install */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl text-left">
                        <p className="text-white font-bold mb-2 flex items-center gap-2">
                            <span>🤖</span> Usuarios Android
                        </p>

                        {deferredPrompt ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-400">¡Tu dispositivo es compatible con la instalación directa!</p>
                                <button
                                    onClick={handleInstallClick}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-yellow-500/20 active:scale-95 text-sm"
                                >
                                    📥 Instalar AHORA
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-400 mb-4">Instala directamente desde el menú de Chrome o descarga el acceso directo.</p>
                                <button
                                    disabled
                                    className="w-full bg-white/10 text-white/30 py-3 rounded-xl font-bold cursor-not-allowed text-xs uppercase tracking-widest"
                                >
                                    APK Próximamente
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="pt-8 flex flex-col items-center gap-4">
                    <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.3em]">Acceso Exclusivo App</p>
                    {/* Subtle Staff Bypass */}
                    <Link
                        href="/auth/login"
                        className="text-[9px] text-gray-800 hover:text-gray-400 transition-colors uppercase tracking-[0.3em] font-medium"
                    >
                        Acceso Staff
                    </Link>
                </div>
            </main>
        );
    }

    // Default: Show black screen until we are CERTAIN we are standalone or staff
    if (isStandalone !== true && !isStaff) {
        return <div className="min-h-screen bg-[#050505]" />;
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4 relative pwa-mode">
            {/* ... remaining content ... */}
            {/* Header / Auth Status */}
            <div className="absolute top-4 right-4 z-50">
                <IdentityBadge />
            </div>

            {/* TICKET DETECTED BANNER */}
            {scannedCode && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black font-black p-4 text-center z-50 animate-in slide-in-from-top duration-500 shadow-xl flex items-center justify-center gap-2">
                    <span className="text-2xl">🎫</span>
                    <div>
                        <p className="text-sm uppercase tracking-widest">TICKET DETECTADO: {scannedCode}</p>
                        <p className="text-xs">Elige una pantalla abajo para canjear tus jugadas automáticamente</p>
                    </div>
                </div>
            )}

            <div className="text-center text-white mb-8 mt-12">
                <h1 className="text-5xl md:text-7xl font-black mb-2 drop-shadow-lg tracking-tighter">
                    🎰 Ruleta Animalitos
                </h1>
                <p className="text-xl md:text-2xl font-medium opacity-90">
                    Fiestas Patrias 2026 - Hub Central
                </p>
            </div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mobile / Player Links */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 font-mono uppercase tracking-widest text-sm opacity-50">
                        📱 Modo Jugador (Mi Ruleta)
                    </h2>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((id) => (
                            <Link
                                key={id}
                                href={`/individual/screen/${id}${scannedCode ? '?redeemCode=' + scannedCode : ''}`}
                                className="block w-full bg-white text-primary font-bold py-3 px-4 rounded-xl hover:bg-gray-100 hover:scale-[1.02] transition-all flex justify-between items-center group shadow-xl"
                            >
                                <span>Pantalla #{id}</span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">👉</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Display / TV Links - ONLY STAFF/ADMIN */}
                {isStaff && (
                    <div className="bg-black/40 backdrop-blur-md rounded-3xl p-6 border border-white/10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 font-mono uppercase tracking-widest text-sm opacity-50">
                            📺 Modo Pantalla (TV)
                        </h2>
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((id) => {
                                const isActive = activeScreens.includes(id);
                                return (
                                    <div key={id} className="relative group">
                                        <Link
                                            href={isActive ? '#' : `/display/individual/${id}`}
                                            target={isActive ? undefined : "_blank"}
                                            onClick={(e) => isActive && e.preventDefault()}
                                            className={`
                                                block w-full border font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center shadow-lg
                                                ${isActive
                                                    ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed grayscale'
                                                    : 'bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:border-primary active:scale-[0.98]'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>Display #{id}</span>
                                                {isActive && (
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                )}
                                            </div>
                                            <span className="text-sm">
                                                {isActive ? '🟢 EN LÍNEA' : '🖥️'}
                                            </span>
                                        </Link>

                                        {isActive && (
                                            <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 bg-rose-600 text-[8px] font-black px-2 py-0.5 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                YA ABIERTA EN OTRA PESTAÑA
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Placeholder if not staff */}
                {!isStaff && !isLoading && (
                    <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                        <div className="text-4xl mb-4 opacity-20">🔒</div>
                        <p className="text-white/30 font-bold uppercase tracking-widest text-xs">
                            Área Restringida
                        </p>
                        <p className="text-white/20 text-[10px] mt-2 px-6">
                            Identifícate como Staff para activar paneles de visualización
                        </p>
                    </div>
                )}
            </div>

            {/* Admin & Tools - ONLY ADMIN */}
            {isAdmin && (
                <div className="mt-8 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-indigo-900/40 backdrop-blur-md rounded-3xl p-6 border border-indigo-500/30 flex justify-center">
                        <Link
                            href="/admin"
                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-tighter italic text-2xl transition-all hover:scale-[1.05] active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                        >
                            <span>📊</span>
                            ADMIN DASHBOARD
                        </Link>
                    </div>
                </div>
            )}

            <div className="mt-12 text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">
                Crisvalpo Dev • Next.js 16 • Fiestas Patrias 2026
            </div>
        </main>
    );
}
