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

    const isAdmin = profile?.role === 'admin' || user?.email === 'cristianluke@gmail.com' || user?.email === 'tortolasluke@gmail.com';
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

    // Configuration of active screens (background image, category, name)
    const [screensConfig, setScreensConfig] = React.useState<Record<number, {
        screen_number: number;
        current_wheel_id: string | null;
        image_preview: string | null;
        background_image: string | null;
        wheel_name: string | null;
    }>>({});

    const fetchScreensConfig = React.useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('screen_state')
                .select(`
                    screen_number,
                    current_wheel_id,
                    individual_wheels (
                        name,
                        image_preview,
                        background_image
                    )
                `);

            if (error) {
                console.error("Error al obtener la configuración de pantallas:", error);
                return;
            }

            if (data) {
                const config: any = {};
                data.forEach((row: any) => {
                    const wheel = row.individual_wheels as any;
                    config[row.screen_number] = {
                        screen_number: row.screen_number,
                        current_wheel_id: row.current_wheel_id,
                        image_preview: wheel?.image_preview || null,
                        background_image: wheel?.background_image || null,
                        wheel_name: wheel?.name || null,
                    };
                });
                setScreensConfig(config);
            }
        } catch (err) {
            console.error("Excepción al obtener configuración de pantallas:", err);
        }
    }, [supabase]);

    const getFullUrl = (path: string | null) => {
        if (!path) return null;
        const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;
        return path.startsWith('http') ? path : `${STORAGE_BASE}/${path}`;
    };

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
        fetchScreensConfig();

        const channel = supabase
            .channel('screen_state_changes_home')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'screen_state'
                },
                () => {
                    console.log('🔄 Cambios detectados en screen_state, recargando config de pantallas...');
                    fetchScreensConfig();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchScreensConfig]);

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

    // 1. Loading / Initialization State (Always Black)
    if (isLoading || isStandalone === null) {
        return <div className="min-h-screen bg-[#050505]" />;
    }

    // 2. Landing Page (Not PWA and Not Staff)
    if (isStandalone === false && !isStaff) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-center space-y-8">
                <div className="w-24 h-24 bg-white/5 backdrop-blur-xl rounded-3xl flex items-center justify-center shadow-2xl animate-bounce border border-white/10 overflow-hidden p-4">
                    <img
                        src="/icons/icon-512x512.png"
                        alt="Ruleta Icon"
                        className="w-full h-full object-contain"
                    />
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

    // 3. Security Layer (PWA or Staff) - Must be logged in to see the orange content
    if (!user) {
        // Show black screen while redirecting to login
        return <div className="min-h-screen bg-[#050505]" />;
    }

    // 4. Main Content (Authenticated PWA or Staff)

    return (
        <main className="min-h-screen flex flex-col items-center justify-start bg-[#050505] relative pwa-mode overflow-hidden selection:bg-primary/30">
            {/* Premium Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse delay-1000" />
            </div>

            {/* Header / Auth Status */}
            <div className="w-full px-6 py-6 flex justify-between items-center z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/10 shadow-2xl p-2">
                        <img src="/icons/icon-512x512.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                </div>
                <IdentityBadge />
            </div>

            {/* TICKET DETECTED BANNER */}
            {scannedCode && (
                <div className="fixed top-20 left-4 right-4 bg-yellow-400 text-black font-black p-4 rounded-2xl z-50 animate-in slide-in-from-top-full duration-500 shadow-2xl flex items-center justify-center gap-3 border-2 border-white/20">
                    <span className="text-2xl">🎫</span>
                    <div className="text-left">
                        <p className="text-xs uppercase tracking-[0.2em] leading-none mb-1">Ticket Activo</p>
                        <p className="text-sm font-black uppercase tracking-tight">{scannedCode}</p>
                    </div>
                </div>
            )}

            <div className="flex-1 w-full max-w-lg flex flex-col justify-center px-6 z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                        Escoge tu <span className="text-primary">pantalla</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.4em] mt-4 opacity-50">
                        Fiestas Patrias 2026
                    </p>
                </div>

                {/* 2x2 Premium Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((id) => {
                        const isActive = activeScreens.includes(id);
                        const screenConf = screensConfig[id];
                        const previewPath = screenConf?.image_preview || 'mario/selector/1.jpg';
                        const imageUrl = getFullUrl(previewPath);

                        return (
                            <Link
                                key={id}
                                href={`/individual/screen/${id}${scannedCode ? '?redeemCode=' + scannedCode : ''}`}
                                className={`
                                    relative aspect-square rounded-[2.5rem] flex flex-col items-center justify-center transition-all duration-500 group overflow-hidden border-2
                                    ${isActive
                                        ? 'border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:scale-[1.05] active:scale-95 hover:border-white/20'
                                        : 'bg-white/5 border-white/5 hover:scale-[1.02] active:scale-95 hover:border-white/10 opacity-70 hover:opacity-90'
                                    }
                                `}
                            >
                                {/* Background Image with Blur */}
                                {imageUrl && (
                                    <>
                                        <img
                                            src={imageUrl}
                                            alt={`Pantalla ${id}`}
                                            className={`absolute inset-0 w-full h-full object-cover filter blur-[1.5px] scale-110 group-hover:scale-125 transition-transform duration-700
                                                ${isActive ? 'opacity-80' : 'opacity-45 grayscale-[20%]'}`}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                                    </>
                                )}

                                {/* Active Glow Effect */}
                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                )}

                                {/* Wheel Name Badge */}
                                {screenConf?.wheel_name && (
                                    <div className={`
                                        absolute top-6 px-3.5 py-1.5 rounded-xl backdrop-blur-md border text-[9px] font-black uppercase tracking-widest z-10 transition-all duration-500
                                        ${isActive 
                                            ? 'bg-primary/25 text-primary border-primary/30 shadow-[0_4px_12px_rgba(249,115,22,0.15)] group-hover:scale-105' 
                                            : 'bg-black/45 text-white/50 border-white/10 group-hover:text-white/70'
                                        }
                                    `}>
                                        {screenConf.wheel_name}
                                    </div>
                                )}

                                {/* Number Icon/Text */}
                                <span className={`
                                    text-[10rem] font-black leading-none tracking-tighter transition-all duration-500 select-none z-10
                                    ${isActive 
                                        ? 'text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-105' 
                                        : 'text-white/20 drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)] group-hover:text-white/40 group-hover:scale-105'
                                    }
                                `}>
                                    {id}
                                </span>

                                {/* Status Label */}
                                <div className={`
                                    absolute bottom-6 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md transition-all z-10 border
                                    ${isActive 
                                        ? 'bg-black/40 text-emerald-400 border-emerald-500/20 shadow-[0_4px_12px_rgba(0,0,0,0.25)]' 
                                        : 'bg-black/40 text-white/30 border-white/5'
                                    }
                                `}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {isActive ? 'En Línea' : 'Offline'}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Mis Premios Section - Integrated below the grid */}
                {!isAdmin && user?.email && (
                    <div className="mt-12 w-full">
                        <PlayerPrizes userEmail={user.email} />
                    </div>
                )}

                {/* Admin/Staff Controls - Minimized & Floating or at bottom */}
                {isStaff && (
                    <div className="mt-8 flex flex-col gap-2">
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] text-center mb-2">Display Controls</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {[1, 2, 3, 4].map((id) => (
                                <Link
                                    key={id}
                                    href={`/display/individual/${id}`}
                                    target="_blank"
                                    className="bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all"
                                >
                                    TV #{id}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isAdmin && (
                <div className="mt-auto w-full max-w-lg p-6 z-50">
                    <Link
                        href="/admin"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-sm transition-all shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 border border-indigo-400/30"
                    >
                        <span>📊</span>
                        Admin Dashboard
                    </Link>
                </div>
            )}

            <div className="py-8 text-[8px] text-white/20 uppercase font-black tracking-[0.5em] z-0">
                Premium Gaming Experience
            </div>
        </main>
    );
}

function PlayerPrizes({ userEmail }: { userEmail: string }) {
    const [wins, setWins] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const supabase = React.useMemo(() => createClient(), []);

    React.useEffect(() => {
        const fetchWins = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('player_queue')
                .select('*')
                .eq('status', 'completed')
                .or(`email.eq.${userEmail},player_id.eq.${userEmail}`) // Try email or ID
                .order('updated_at', { ascending: false })
                .limit(5);

            if (!error && data) {
                // Filter only actual wins (where spin_result is in selected_animals)
                const actualWins = data.filter(row => {
                    const selections = row.selected_animals as number[];
                    return selections && row.spin_result !== null && selections.includes(row.spin_result);
                });
                setWins(actualWins);
            }
            setLoading(false);
        };

        fetchWins();
    }, [userEmail, supabase]);

    if (loading) return null;
    if (wins.length === 0) return null;

    return (
        <div className="bg-amber-500/10 backdrop-blur-md rounded-3xl p-6 border border-amber-500/30 animate-in fade-in slide-in-from-left-4 duration-700 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2 font-mono uppercase tracking-widest text-[10px] opacity-80">
                🏆 Mis Premios Recientes
            </h2>
            <div className="space-y-3">
                {wins.map((win) => (
                    <Link
                        key={win.id}
                        href={`/individual/screen/${win.screen_number}/result?q=${win.id}`}
                        className="block w-full bg-white/5 border border-white/10 hover:bg-white/10 p-4 rounded-2xl transition-all group"
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl group-hover:scale-125 transition-transform duration-500 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                                    🎁
                                </span>
                                <div>
                                    <p className="text-white font-bold text-sm">Premio Ganado!</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
                                        {new Date(win.updated_at).toLocaleDateString()} • Pantalla #{win.screen_number}
                                    </p>
                                </div>
                            </div>
                            <span className="bg-amber-500 text-black text-[10px] font-black px-3 py-1.5 rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/20">
                                VER QR
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
            <p className="mt-4 text-[9px] text-amber-500/50 text-center uppercase tracking-widest font-bold">
                Muestra el código QR al encargado para cobrar
            </p>
        </div>
    );
}
