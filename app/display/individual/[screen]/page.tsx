'use client';

import { use, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useAuth } from '@/hooks/useAuth';
import DisplayIndividualPlay from '@/components/display/DisplayIndividualPlay';
import DisplayGroupRaffleWheel from '@/components/display/DisplayGroupRaffleWheel';
import DisplayRaffleBillboard from '@/components/display/DisplayRaffleBillboard';
import DisplayRaffleStats from '@/components/display/DisplayRaffleStats';

export default function DisplayScreenPage({
    params
}: {
    params: Promise<{ screen: string }>
}) {
    const { screen } = use(params);
    const screenIdNum = parseInt(screen);
    const supabase = createClient();

    // 0. Auth & Password Protection Check
    const { user, profile, isLoading } = useAuth();
    const isAdmin = profile?.role === 'admin' || user?.email === 'cristianluke@gmail.com' || user?.email === 'tortolasluke@gmail.com';

    const [isUnlocked, setIsUnlocked] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        // Auto-unlock if user is already logged in as an admin
        if (!isLoading && user && isAdmin) {
            setIsUnlocked(true);
            setCheckingAuth(false);
            return;
        }

        // Otherwise check localStorage
        if (typeof window !== 'undefined') {
            const auth = localStorage.getItem(`display_screen_auth_${screen}`);
            if (auth === 'true') {
                setIsUnlocked(true);
            }
            if (!isLoading) {
                setCheckingAuth(false);
            }
        }
    }, [user, isAdmin, isLoading, screen]);

    // 1. Venue configurations (Mode & settings)
    const { venueMode, centralScreenId, baseUrl, activeRaffleId, raffleBillboardId } = useVenueSettings();

    // Sincronización de URLs del cliente
    const [clientUrl, setClientUrl] = useState<string>('');
    useEffect(() => {
        setClientUrl(window.location.origin);
    }, []);

    // 2. Duplicate Screens Control (Supabase Presence and Local BroadcastChannel)
    const [isDuplicateScreen, setIsDuplicateScreen] = useState(false);
    const [isLocalDuplicate, setIsLocalDuplicate] = useState(false);
    const instanceId = useRef(Math.random().toString(36).substring(7));
    const joinedAt = useRef(Date.now());

    // 2.1 Presence Detection
    useEffect(() => {
        if (!screenIdNum || checkingAuth || !isUnlocked) return;

        const channel = supabase.channel('global_presence_monitor');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const otherInstances: any[] = [];
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.type === 'display' && p.screen === screenIdNum) {
                            otherInstances.push(p);
                        }
                    });
                });

                if (otherInstances.length <= 1) {
                    setIsDuplicateScreen(false);
                    return;
                }

                otherInstances.sort((a, b) => a.joined_at - b.joined_at);
                const firstInstance = otherInstances[0];
                if (firstInstance.id !== instanceId.current) {
                    console.warn(`🚫 OTRA PESTAÑA DETECTADA (ID: ${instanceId.current}): Bloqueando esta instancia secundaria.`);
                    setIsDuplicateScreen(true);
                } else {
                    setIsDuplicateScreen(false);
                }
            })
            .subscribe(async (subStatus) => {
                if (subStatus === 'SUBSCRIBED') {
                    await channel.track({
                        id: instanceId.current,
                        screen: screenIdNum,
                        type: 'display',
                        joined_at: joinedAt.current
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase, checkingAuth, isUnlocked]);

    // 2.2 Local BroadcastChannel
    useEffect(() => {
        if (!screenIdNum || typeof window === 'undefined') return;

        const channelName = `ruleta_screen_session_${screenIdNum}`;
        const bc = new BroadcastChannel(channelName);

        bc.postMessage({ type: 'ping', id: instanceId.current });

        const handleMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'ping' && data.id !== instanceId.current) {
                bc.postMessage({ type: 'pong', id: instanceId.current });
            } else if (data.type === 'pong' && data.id !== instanceId.current) {
                console.warn(`🚫 Local BroadcastChannel: duplicate tab detected for screen ${screenIdNum}`);
                setIsLocalDuplicate(true);
            }
        };

        bc.addEventListener('message', handleMessage);

        return () => {
            bc.removeEventListener('message', handleMessage);
            bc.close();
        };
    }, [screenIdNum]);

    // 2.3 Remote Reload command
    useEffect(() => {
        if (!screenIdNum) return;

        const channel = supabase.channel(`screen_commands_${screenIdNum}`);
        channel
            .on('broadcast', { event: 'force_reload' }, () => {
                console.log('🔄 RECARGA REMOTA RECIBIDA: Reiniciando pantalla...');
                window.location.reload();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase]);

    // UI Loaders
    if (checkingAuth || venueMode === null) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-8 text-center font-sans">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <p className="text-slate-400 text-sm uppercase tracking-widest font-black">Cargando Pantalla...</p>
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <PasswordPrompt screenId={screen} onUnlock={() => setIsUnlocked(true)} />
        );
    }

    if (isDuplicateScreen || isLocalDuplicate) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 font-sans">
                <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center text-5xl mb-6 border border-rose-500/30 animate-pulse text-rose-500">
                    ⚠️
                </div>
                <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Pantalla Duplicada</h2>
                <p className="text-slate-400 max-w-md font-medium text-lg leading-relaxed">
                    Esta pantalla (<span className="text-rose-400">#{screenIdNum}</span>) ya se encuentra abierta en otra pestaña o dispositivo.
                </p>
                <div className="mt-8 flex flex-col gap-4 w-full max-w-xs transition-all">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white hover:bg-slate-100 text-slate-900 font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 shadow-xl transition-all"
                    >
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // 3. Router de Visualización según Modo y ID de pantalla
    const isGroupEvent = venueMode === 'group_event';

    if (isGroupEvent) {
        if (screenIdNum === centralScreenId) {
            return (
                <DisplayGroupRaffleWheel
                    screenIdNum={screenIdNum}
                    activeRaffleId={activeRaffleId}
                    baseUrl={baseUrl || clientUrl}
                    supabase={supabase}
                />
            );
        } else if (screenIdNum === raffleBillboardId) {
            return (
                <DisplayRaffleBillboard
                    activeRaffleId={activeRaffleId}
                    baseUrl={baseUrl || clientUrl}
                    supabase={supabase}
                />
            );
        } else if (screenIdNum === 3) {
            return (
                <DisplayRaffleStats
                    baseUrl={baseUrl || clientUrl}
                    supabase={supabase}
                />
            );
        } else {
            // Pantalla Publicitaria o de espera por defecto del Sorteo (para otras pantallas)
            return (
                <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-start text-center p-0 overflow-hidden font-sans">
                    <div className="w-full bg-indigo-600 py-8 shadow-2xl z-20">
                        <h1 className="text-6xl font-black text-white uppercase tracking-tighter animate-pulse">
                            🔥 ¡Gran Sorteo en Vivo! 🔥
                        </h1>
                        <p className="text-indigo-200 text-xl font-bold mt-2 uppercase tracking-widest">
                            Atentos a la Pantalla Principal
                        </p>
                    </div>

                    <div className="flex-1 w-full grid grid-cols-2 gap-8 p-12 bg-gradient-to-br from-slate-900 to-indigo-950">
                        <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 p-10 flex flex-col shadow-inner items-center justify-center">
                            <span className="text-8xl mb-6">🎟️</span>
                            <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">¡Próximo Sorteo!</h3>
                            <p className="text-slate-400 text-lg">Revisa tu boleto en la app o consulta al animador.</p>
                        </div>

                        <div className="flex flex-col gap-8">
                            <div className="flex-1 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-[3rem] p-10 flex flex-col items-center justify-center text-white shadow-2xl">
                                <span className="text-8xl mb-6">🍿</span>
                                <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none mb-4">¡Combo Ruleta!</h2>
                                <p className="text-2xl font-bold opacity-90 max-w-xs uppercase leading-tight text-center">
                                    Pide tu combo y recibe <span className="text-yellow-300 font-black">2 TIROS GRATIS</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-white/5 border-t border-white/10 py-6 px-12 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <span className="text-slate-400 font-bold uppercase tracking-widest">Sigue participando:</span>
                            <span className="text-2xl font-black text-white tracking-widest">RULETA.LUKEAPP.ME</span>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // Por defecto renderizar el modo individual
    return (
        <DisplayIndividualPlay
            screen={screen}
            screenIdNum={screenIdNum}
            baseUrl={baseUrl || clientUrl}
            supabase={supabase}
        />
    );
}

// Subcomponente de Contraseña
function PasswordPrompt({ screenId, onUnlock }: { screenId: string, onUnlock: () => void }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expected = process.env.NEXT_PUBLIC_SCREEN_PASSWORD || 'luke123';
        if (password === expected) {
            localStorage.setItem(`display_screen_auth_${screenId}`, 'true');
            onUnlock();
        } else {
            setError(true);
            setPassword('');
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4 font-sans select-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                        📺
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Pantalla Protegida</h2>
                    <p className="text-slate-400 text-sm mt-2">
                        Ingresa la contraseña para visualizar la Pantalla <span className="text-indigo-400 font-bold">#{screenId}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative flex flex-col items-center">
                        <div className="w-full relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Contraseña nativa"
                                className={`w-full bg-slate-950/80 border ${error ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'} rounded-2xl py-4 px-12 text-white placeholder-slate-600 text-center font-bold tracking-widest focus:outline-none transition-all`}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {error && (
                            <p className="text-rose-500 text-xs font-bold text-center mt-2 animate-bounce">
                                Contraseña incorrecta, intenta de nuevo
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
                    >
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}
