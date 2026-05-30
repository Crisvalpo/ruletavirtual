'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface ScreenState {
    screen_number: number;
    status: string;
    player_name: string | null;
    player_emoji: string | null;
    current_wheel_id: string | null;
    idle_speed?: number;
}

interface QueueHead {
    screen_number: number;
    player_name: string;
    player_emoji: string;
}

export default function ScreenControlDashboard() {
    const [screens, setScreens] = useState<ScreenState[]>([]);
    const [queues, setQueues] = useState<Record<number, QueueHead | null>>({});
    const [activeWheels, setActiveWheels] = useState<{ id: string; name: string }[]>([]);
    const [venueMode, setVenueMode] = useState<'individual' | 'group_event' | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchData = async (isMounted: boolean) => {
        try {
            // Fetch venue settings mode
            const { data: settingsData } = await supabase.from('venue_settings').select('current_mode').single();
            if (settingsData && isMounted) {
                setVenueMode(settingsData.current_mode);
            }

            // 1. Fetch Screens
            const { data: screenData, error: screenError } = await supabase
                .from('screen_state')
                .select('*')
                .order('screen_number');

            if (screenError) throw screenError;
            if (screenData && isMounted) setScreens(screenData);

            // 2. Fetch Queues (Next waiting player for each screen)
            const { data: queueData, error: queueError } = await supabase
                .from('player_queue')
                .select('screen_number, player_name, player_emoji, created_at')
                .eq('status', 'waiting')
                .order('created_at', { ascending: true });

            if (queueError) throw queueError;

            const nextPlayers: Record<number, QueueHead | null> = {};

            // Initialize keys
            if (screenData && isMounted) {
                screenData.forEach(s => nextPlayers[s.screen_number] = null);
            }

            if (queueData && isMounted) {
                queueData.forEach(item => {
                    if (!nextPlayers[item.screen_number]) {
                        nextPlayers[item.screen_number] = item;
                    }
                });
            }

            if (isMounted) {
                setQueues(nextPlayers);
            }

            // 3. Fetch active wheels
            const { data: wheelsData, error: wheelsError } = await supabase
                .from('individual_wheels')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            if (wheelsError) throw wheelsError;
            if (wheelsData && isMounted) {
                setActiveWheels(wheelsData);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Error fetching admin data:", {
                    message: err.message,
                    details: err.details,
                    hint: err.hint,
                    code: err.code,
                    full: err
                });
            }
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchData(isMounted);

        const channel = supabase
            .channel('admin_dashboard_monitor')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'screen_state' },
                () => { if (isMounted) fetchData(isMounted); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'player_queue' },
                () => { if (isMounted) fetchData(isMounted); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'venue_settings' },
                (payload: any) => {
                    if (isMounted && payload.new) {
                        setVenueMode(payload.new.current_mode);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleForceAdvance = async (screenId: number) => {

        console.log(`Force advancing screen ${screenId}...`);

        // Call the NEW Robust RPC directly
        const { data, error } = await supabase.rpc('force_advance_queue', {
            p_screen_number: screenId
        });

        if (error) {
            alert(`Error: ${error.message}`);
        } else {
            // Optimistic update or wait for realtime
            const res = data as any;
            alert(res?.message || 'Pantalla liberada.');
        }    // fetchData() will be triggered by realtime
    };

    const handleDemoSpin = async (screenId: number) => {

        const { data, error } = await supabase.rpc('admin_demo_spin', {
            p_screen_number: screenId,
            p_player_name: 'Modo Show',
            p_player_emoji: '🎭'
        });

        if (error) {
            console.error("Error in demo spin:", error);
            alert("Error: " + error.message);
            return;
        }

        const res = data as any;
        if (res && !res.success) {
            alert(res.message || 'No se pudo iniciar el giro de demostración.');
        }
    };

    const getScreenRaffleRole = (screenId: number) => {
        if (screenId === 1) return 'Ruleta Sorteo (Central)';
        if (screenId === 4) return 'Cartelera Boletos';
        if (screenId === 3) return 'Estadísticas e Historial';
        return 'Espera / Publicidad';
    };

    if (loading) return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-pulse">
            <div className="h-6 w-48 bg-slate-100 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-slate-50 rounded-xl"></div>)}
            </div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {screens.map((screen) => {
                    const nextPlayer = queues[screen.screen_number];
                    const isActive = screen.status !== 'idle';
                    const isRaffleMode = venueMode === 'group_event';

                    let statusColor = 'bg-slate-50 text-slate-400 border-slate-100';
                    let statusLabelColor = 'bg-slate-200 text-slate-600';
                    let statusLabelText = screen.status;

                    if (isRaffleMode) {
                        statusColor = 'bg-indigo-50/30 border-indigo-100/50 text-indigo-650';
                        statusLabelColor = 'bg-indigo-600 text-white';
                        statusLabelText = 'Sorteo';
                    } else if (screen.status === 'spinning') {
                        statusColor = 'bg-indigo-50 border-indigo-100';
                        statusLabelColor = 'bg-indigo-600 text-white';
                    } else if (screen.status === 'result') {
                        statusColor = 'bg-emerald-50 border-emerald-100';
                        statusLabelColor = 'bg-emerald-600 text-white';
                    } else if (screen.status === 'waiting_for_spin') {
                        statusColor = 'bg-amber-50 border-amber-100';
                        statusLabelColor = 'bg-amber-600 text-white';
                    }

                    return (
                        <div
                            key={screen.screen_number}
                            className={`
                                flex flex-col justify-between border-2 rounded-2xl p-3 transition-all
                                ${statusColor}
                            `}
                        >
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-black text-slate-900 tracking-tight text-xs uppercase">S{screen.screen_number}</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const channel = supabase.channel(`screen_commands_${screen.screen_number}`);
                                                await channel.subscribe(async (status) => {
                                                    if (status === 'SUBSCRIBED') {
                                                        await channel.send({
                                                            type: 'broadcast',
                                                            event: 'force_reload',
                                                            payload: {}
                                                        });
                                                        supabase.removeChannel(channel);
                                                    }
                                                });
                                            }}
                                            className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-indigo-600"
                                            title="Refrescar Pantalla"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                                        </button>
                                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black tracking-widest ${statusLabelColor}`}>
                                            {statusLabelText}
                                        </span>
                                    </div>
                                </div>

                                <div className={`mb-3 ${isRaffleMode ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <label className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1 block">Tema Asignado:</label>
                                    <select
                                        value={screen.current_wheel_id || ''}
                                        disabled={isRaffleMode}
                                        onChange={async (e) => {
                                            const wheelId = e.target.value || null;
                                            // Update local state optimistically
                                            setScreens(prev => prev.map(s =>
                                                s.screen_number === screen.screen_number ? { ...s, current_wheel_id: wheelId } : s
                                            ));
                                            // Update Supabase
                                            const { error } = await supabase
                                                .from('screen_state')
                                                .update({ current_wheel_id: wheelId })
                                                .eq('screen_number', screen.screen_number);
                                            if (error) {
                                                console.error("Error updating screen theme:", error);
                                                alert("Error al guardar tema: " + error.message);
                                            }
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg p-1.5 focus:border-indigo-600 focus:bg-white outline-none transition-all text-slate-900"
                                    >
                                        <option value="">Seleccionar Tema...</option>
                                        {activeWheels.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-3 min-h-[3rem] flex flex-col justify-center">
                                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Activo:</p>
                                    {isRaffleMode ? (
                                        <div className="py-2.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                                            <span className="text-sm">📺</span>
                                            {getScreenRaffleRole(screen.screen_number)}
                                        </div>
                                    ) : screen.player_name ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg overflow-hidden">
                                                {screen.player_emoji?.startsWith('http') ? (
                                                    <img src={screen.player_emoji} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    screen.player_emoji
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 leading-none">{screen.player_name}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Jugando ahora</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-2 px-3 rounded-lg bg-slate-100/50 border border-slate-100 text-slate-400 italic text-xs flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                            Sin actividad
                                        </div>
                                    )}
                                </div>

                                {/* Next Player Preview - Compacted */}
                                <div className={`mt-2 pt-2 border-t ${isActive && !isRaffleMode ? 'border-black/5' : 'border-slate-100'} ${isRaffleMode ? 'opacity-40 pointer-events-none' : ''}`}>
                                    {nextPlayer && !isRaffleMode ? (
                                        <div className="bg-white/60 rounded-xl p-3 border border-indigo-100 shadow-sm">
                                            <p className="text-[9px] text-indigo-500 uppercase font-black tracking-widest mb-2">Siguiente en Fila:</p>
                                            <div className="flex items-center gap-2">
                                                {nextPlayer.player_emoji?.startsWith('http') ? (
                                                    <img src={nextPlayer.player_emoji} alt="Avatar" className="w-5 h-5 rounded-full object-cover border border-slate-100 flex-none" />
                                                ) : (
                                                    <span className="text-sm flex-none">{nextPlayer.player_emoji}</span>
                                                )}
                                                <span className="text-xs font-black text-slate-900 uppercase">
                                                    {nextPlayer.player_name}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest text-center py-2">Fila Vacía</p>
                                    )}
                                </div>
                            </div>

                            {/* ACCIONES - Compacted */}
                            <div className={`mt-3 pt-2 border-t border-black/5 flex flex-col gap-1.5 ${isRaffleMode ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="px-1 mb-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[9px] uppercase text-slate-400 font-black tracking-widest">
                                            Velocidad
                                        </label>
                                        <span className="text-[10px] font-black text-indigo-600">{screen.idle_speed?.toFixed(1) || '4.0'}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="8.0"
                                        step="0.1"
                                        value={screen.idle_speed || 4.0}
                                        disabled={isRaffleMode}
                                        onChange={async (e) => {
                                            const val = parseFloat(e.target.value);
                                            // Optimistic update locally
                                            setScreens(prev => prev.map(s =>
                                                s.screen_number === screen.screen_number ? { ...s, idle_speed: val } : s
                                            ));

                                            // Update DB
                                            await supabase
                                                .from('screen_state')
                                                .update({ idle_speed: val })
                                                .eq('screen_number', screen.screen_number);
                                        }}
                                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => handleDemoSpin(screen.screen_number)}
                                        disabled={isRaffleMode || screen.status === 'spinning' || screen.status === 'waiting_for_spin'}
                                        className={`w-full text-[9px] font-black uppercase tracking-widest py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2
                                            ${(isRaffleMode || screen.status === 'spinning' || screen.status === 'waiting_for_spin')
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                                : 'bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white shadow-md'
                                            }
                                        `}
                                        title={isRaffleMode ? "Modo Sorteo Activo" : screen.status === 'spinning' ? "Hay un giro en curso" : "Lanzar Giro de Show para el Público"}
                                    >
                                        🎭 Giro Show
                                    </button>

                                    <button
                                        onClick={() => handleForceAdvance(screen.screen_number)}
                                        disabled={isRaffleMode}
                                        className={`w-full text-[9px] font-black uppercase tracking-widest py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 border
                                            ${isRaffleMode
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                                                : isActive
                                                ? 'bg-rose-600 border-rose-600 text-white shadow-rose-500/20'
                                                : 'bg-white border-rose-100 text-rose-600 hover:bg-rose-50'
                                            }
                                        `}
                                        title={isRaffleMode ? "Modo Sorteo Activo" : "Forzar limpieza de pantalla y avance de fila"}
                                    >
                                        🧹 Destrabar / Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
