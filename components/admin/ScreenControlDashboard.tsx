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
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchData = async () => {
        // 1. Fetch Screens
        const { data: screenData } = await supabase
            .from('screen_state')
            .select('*')
            .order('screen_number');

        if (screenData) setScreens(screenData);

        // 2. Fetch Queues (Next waiting player for each screen)
        // We fetch all waiting items and pick the first one per screen in JS for simplicity with small data
        const { data: queueData } = await supabase
            .from('player_queue')
            .select('screen_number, player_name, player_emoji, created_at')
            .eq('status', 'waiting')
            .order('created_at', { ascending: true });

        const nextPlayers: Record<number, QueueHead | null> = {};

        // Initialize keys
        if (screenData) {
            screenData.forEach(s => nextPlayers[s.screen_number] = null);
        }

        if (queueData) {
            queueData.forEach(item => {
                // Since it's ordered by created_at, the first time we see a screen_number, it's the head of the queue
                if (!nextPlayers[item.screen_number]) {
                    nextPlayers[item.screen_number] = item;
                }
            });
        }

        setQueues(nextPlayers);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('admin_dashboard_monitor')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'screen_state' },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'player_queue' },
                () => fetchData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleForceAdvance = async (screenId: number) => {
        const confirmed = window.confirm(`¿Seguro que deseas liberar la Pantalla ${screenId}? Esto avanzará la fila.`);
        if (!confirmed) return;

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
        const confirmed = window.confirm(`¿Lanzar Giro de Publicidad en Pantalla ${screenId}?`);
        if (!confirmed) return;

        const { error } = await supabase
            .from('screen_state')
            .update({
                status: 'spinning',
                is_demo: true,
                player_name: 'Modo Show',
                player_emoji: '🎭'
            })
            .eq('screen_number', screenId);

        if (error) alert(error.message);
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
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                📺 Monitoreo de Pantallas (En Vivo)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {screens.map((screen) => {
                    const nextPlayer = queues[screen.screen_number];
                    const isActive = screen.status !== 'idle';

                    let statusColor = 'bg-slate-50 text-slate-400 border-slate-100';
                    let statusLabelColor = 'bg-slate-200 text-slate-600';

                    if (screen.status === 'spinning') {
                        statusColor = 'bg-indigo-50 border-indigo-100';
                        statusLabelColor = 'bg-indigo-600 text-white';
                    } else if (screen.status === 'showing_result') {
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
                                flex flex-col justify-between border-2 rounded-2xl p-5 transition-all
                                ${statusColor}
                            `}
                        >
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-black text-slate-900 tracking-tight">Pantalla {screen.screen_number}</h3>
                                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black tracking-widest ${statusLabelColor}`}>
                                        {screen.status}
                                    </span>
                                </div>

                                <div className="mb-6 min-h-[4rem] flex flex-col justify-center">
                                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1.5">En Pantalla:</p>
                                    {screen.player_name ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">
                                                {screen.player_emoji}
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

                                {/* Next Player Preview */}
                                <div className={`mt-4 pt-4 border-t ${isActive ? 'border-black/5' : 'border-slate-100'}`}>
                                    {nextPlayer ? (
                                        <div className="bg-white/60 rounded-xl p-3 border border-indigo-100 shadow-sm">
                                            <p className="text-[9px] text-indigo-500 uppercase font-black tracking-widest mb-2">Siguiente en Fila:</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{nextPlayer.player_emoji}</span>
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

                            {/* ACCIONES */}
                            <div className="mt-6 pt-4 border-t border-black/5 flex flex-col gap-2">
                                <div className="px-1 mb-3">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[9px] uppercase text-slate-400 font-black tracking-widest">
                                            Velocidad
                                        </label>
                                        <span className="text-[10px] font-black text-indigo-600">{screen.idle_speed?.toFixed(1) || '1.0'}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="8.0"
                                        step="0.1"
                                        defaultValue={screen.idle_speed || 1.0}
                                        onMouseUp={async (e) => {
                                            const val = parseFloat(e.currentTarget.value);
                                            await supabase
                                                .from('screen_state')
                                                .update({ idle_speed: val })
                                                .eq('screen_number', screen.screen_number);
                                        }}
                                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {screen.status === 'idle' && !nextPlayer && (
                                        <button
                                            onClick={() => handleDemoSpin(screen.screen_number)}
                                            className="w-full bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            🎭 Giro Show
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleForceAdvance(screen.screen_number)}
                                        className="w-full bg-white border border-rose-100 hover:border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                        title="Forzar limpieza de pantalla y avance de fila"
                                    >
                                        🧹 Limpiar
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
