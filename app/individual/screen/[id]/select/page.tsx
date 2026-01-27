'use client';

import { useGameStore } from '@/lib/store/gameStore';
import DynamicAnimalSelector from '@/components/individual/DynamicAnimalSelector';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import React from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SelectionPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();

    const mode = useGameStore((state) => state.gameMode);
    const { queueId, selectedAnimals, activeWheelId } = useGameStore();
    const wheelId = activeWheelId;
    const supabase = createClient();

    // REALTIME: Sync Selection to DB
    React.useEffect(() => {
        if (!queueId) return;

        const syncSelection = async () => {
            const { error } = await supabase
                .from('player_queue')
                .update({ selected_animals: selectedAnimals })
                .eq('id', queueId)
                .eq('status', 'selecting'); // Only update if still selecting

            if (error) console.error("Error syncing selection:", error);
        };

        syncSelection();
    }, [selectedAnimals, queueId, supabase]);

    const [uiStatus, setUiStatus] = React.useState<'selecting' | 'waiting' | 'ready'>('selecting');
    const [queuePosition, setQueuePosition] = React.useState<number | null>(null);

    // Initial check on mount
    React.useEffect(() => {
        const checkExistingStatus = async () => {
            if (queueId) {
                const { data } = await supabase.from('player_queue').select('status').eq('id', queueId).single();
                if (data?.status === 'waiting') setUiStatus('waiting');
                if (data?.status === 'playing') setUiStatus('ready');
            }
        };

        const syncScreenState = async () => {
            const { data } = await supabase
                .from('screen_state')
                .select('current_wheel_id')
                .eq('screen_number', parseInt(id))
                .single();

            if (data && data.current_wheel_id) {
                useGameStore.getState().setGameMode('individual', data.current_wheel_id);
            }
        };

        checkExistingStatus();
        syncScreenState();
    }, [queueId, supabase, id]);

    // REALTIME: Listen for Queue Updates (Am I playing?)
    React.useEffect(() => {
        if (!queueId) return;

        const channel = supabase
            .channel(`select_queue_${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'player_queue', filter: `id=eq.${queueId}` },
                (payload) => {
                    const status = payload.new.status;
                    if (status === 'playing') {
                        setUiStatus('ready');
                    } else if (status === 'waiting') {
                        setUiStatus('waiting');
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queueId, supabase, id]);

    // REALTIME Poll: Status of screen (To switch from waiting -> ready if next)
    // Actually, queue logic (promote_next_player) sets us to 'playing', so the subscription above handles the trigger.
    // BUT we also need to update position.

    // Position Polling
    React.useEffect(() => {
        if (uiStatus !== 'waiting') return;

        const fetchPos = async () => {
            const { count } = await supabase
                .from('player_queue')
                .select('*', { count: 'exact', head: true })
                .eq('screen_number', parseInt(id))
                .eq('status', 'waiting')
                .lt('created_at', new Date().toISOString()); // Logic approximation

            // Better: Get my creation time and count how many older 'waiting' exist
            // Simplification: just count.
            // Given short queues, simple count is okay-ish but we prefer index.
        };
        // Simplified: Just show "En Fila"
    }, [uiStatus]);


    const handleConfirm = async () => {
        if (selectedAnimals.length === 3 && queueId) {

            // 1. Submit Selection & Set to WAITING
            const { error } = await supabase
                .from('player_queue')
                .update({
                    status: 'waiting',
                    selected_animals: selectedAnimals,
                })
                .eq('id', queueId);

            if (!error) {
                setUiStatus('waiting');

                // 2. Try to promote immediately (SQL will validate if screen is actually idle)
                console.log("🚀 Selection Confirmed. Attempting promotion...");

                await supabase.rpc('promote_next_player', {
                    p_screen_number: parseInt(id)
                });

                // The Realtime subscription will handle the UI switch if successful.
            }
        }
    };

    const handleSpin = async () => {
        // Enviar señal de giro al backend
        await supabase
            .from('screen_state')
            .update({
                status: 'spinning',
                updated_at: new Date().toISOString()
            })
            .eq('screen_number', parseInt(id));

        // Navegar a resultado (feedback visual para el usuario móvil)
        router.push(`/individual/screen/${id}/result`);
    };

    if (uiStatus === 'ready') {
        return (
            <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-300 fixed inset-0 z-50">
                <h1 className="text-white text-2xl font-bold mb-8 animate-bounce">
                    ¡ES TU TURNO!
                </h1>

                <button
                    onClick={handleSpin}
                    className="w-64 h-64 rounded-full bg-white shadow-[0_0_50px_rgba(255,255,255,0.5)] flex items-center justify-center transform transition-all active:scale-95 border-8 border-yellow-400 group"
                >
                    <div className="text-center">
                        <span className="block text-5xl mb-2 group-hover:rotate-12 transition-transform">🎲</span>
                        <span className="block text-2xl font-black text-red-600 tracking-wider">GIRAR</span>
                    </div>
                </button>

                <p className="text-white/80 mt-8 text-sm text-center">
                    Presiona el botón rojo para lanzar la ruleta en la pantalla {id}
                </p>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden">
            <header className="px-4 py-3 bg-gray-900/90 backdrop-blur-sm z-10 flex-none border-b border-gray-800">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            Elige 3 {mode === 'group' ? 'Animales' : 'Opciones'}
                        </h1>
                        <p className="text-xs text-green-400 font-medium tracking-wide">
                            {selectedAnimals.length}/3 SELECCIONADOS
                        </p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full shadow-inner">
                        <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">PANTALLA</span>
                        <span className="text-sm font-bold text-white">{id}</span>
                    </div>
                </div>
            </header>

            {/* Grid Interactivo Real (Disabled if not selecting) */}
            <div className={`flex-1 overflow-hidden relative ${uiStatus !== 'selecting' ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                <DynamicAnimalSelector wheelId={wheelId} mode={mode} />
            </div>

            <div className="flex-none p-4 bg-gray-900/95 backdrop-blur-md border-t border-gray-800">
                {uiStatus === 'selecting' && (
                    <button
                        onClick={handleConfirm}
                        disabled={selectedAnimals.length !== 3}
                        className={`
                            w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all shadow-lg
                            ${selectedAnimals.length === 3
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white transform active:scale-[0.98] shadow-green-500/20'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}
                        `}
                    >
                        {selectedAnimals.length === 3 ? 'CONFIRMAR JUGADA' : `Selecciona ${3 - selectedAnimals.length} más`}
                    </button>
                )}

                {uiStatus === 'waiting' && (
                    <button disabled className="w-full py-4 rounded-xl font-bold text-lg tracking-wide bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 flex items-center justify-center gap-3 animate-pulse">
                        <span className="text-2xl animate-spin">🎲</span>
                        ESTÁS EN LA FILA...
                    </button>
                )}
            </div>
        </div>
    );
}

