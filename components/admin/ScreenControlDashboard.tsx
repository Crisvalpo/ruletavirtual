'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface ScreenState {
    screen_number: number;
    status: string;
    player_name: string | null;
    player_emoji: string | null;
    current_wheel_id: string | null;
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

    if (loading) return <div className="p-4">Cargando monitores...</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                📺 Monitoreo de Pantallas (En Vivo)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {screens.map((screen) => {
                    const nextPlayer = queues[screen.screen_number];

                    return (
                        <div
                            key={screen.screen_number}
                            className={`
                                border rounded-lg p-4 flex flex-col justify-between
                                ${screen.status === 'idle' ? 'bg-gray-50 border-gray-200' : ''}
                                ${screen.status === 'spinning' ? 'bg-purple-50 border-purple-200' : ''}
                                ${screen.status === 'showing_result' ? 'bg-green-50 border-green-200' : ''}
                                ${screen.status === 'waiting_for_spin' ? 'bg-blue-50 border-blue-200' : ''}
                            `}
                        >
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-lg">Pantalla {screen.screen_number}</h3>
                                    <span className={`text-xs uppercase px-2 py-0.5 rounded font-bold
                                        ${screen.status === 'idle' ? 'bg-gray-200 text-gray-600' : 'bg-primary text-white'}
                                    `}>
                                        {screen.status}
                                    </span>
                                </div>

                                <div className="mb-4 min-h-[3rem]">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Actual:</p>
                                    {screen.player_name ? (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{screen.player_emoji}</span>
                                            <span className="font-semibold text-lg leading-tight">{screen.player_name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-sm block mb-2">-- Libre --</span>
                                    )}

                                    {/* Next Player Preview */}
                                    {nextPlayer && (
                                        <div className="bg-blue-50 rounded p-2 mt-2 border border-blue-100">
                                            <p className="text-[10px] text-blue-500 uppercase font-bold mb-1">En Fila (Siguiente):</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{nextPlayer.player_emoji}</span>
                                                <span className="text-sm font-medium text-blue-900 leading-tight">
                                                    {nextPlayer.player_name}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-blue-400 italic mt-0.5">
                                                "¡{nextPlayer.player_name}, estás listo para jugar!"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ACCIONES */}
                            <div className="pt-3 border-t border-black/5 flex flex-col gap-2">
                                {screen.status === 'idle' && (
                                    <button
                                        onClick={() => handleDemoSpin(screen.screen_number)}
                                        className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                    >
                                        🎲 Giro Publicidad
                                    </button>
                                )}

                                <button
                                    onClick={() => handleForceAdvance(screen.screen_number)}
                                    className="w-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                    title="Forzar limpieza de pantalla y avance de fila"
                                >
                                    ⚠️ Forzar Avance
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
