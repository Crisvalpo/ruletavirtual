'use client';

import { useGameStore } from '@/lib/store/gameStore';
import DynamicAnimalSelector from '@/components/individual/DynamicAnimalSelector';
import SpinCounter from '@/components/individual/SpinCounter';
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
    const [isInitializing, setIsInitializing] = React.useState(true);
    const [queuePosition, setQueuePosition] = React.useState<number | null>(null);
    const [currentLocalWheelId, setCurrentLocalWheelId] = React.useState<string | null>(activeWheelId);

    // Timeout states
    const [spinTimeout, setSpinTimeout] = React.useState(30); // Fase 1: 30s
    const [spinCountdown, setSpinCountdown] = React.useState<number | null>(null); // Fase 2: 10s
    const [selectingTimeout, setSelectingTimeout] = React.useState(120); // 120s para selecting

    // Package tracking state
    const [packageInfo, setPackageInfo] = React.useState<{
        spinNumber: number;
        totalSpins: number;
    } | null>(null);

    // Load package info from localStorage
    React.useEffect(() => {
        const stored = localStorage.getItem('current_package');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                setPackageInfo({
                    spinNumber: data.spinNumber,
                    totalSpins: data.totalSpins
                });
            } catch (e) {
                console.error('Error parsing package info:', e);
            }
        }
    }, []);

    // Initial check on mount
    React.useEffect(() => {
        const init = async () => {
            setIsInitializing(true);

            // 1. Resolve correct wheel ID
            // PRIORITIZE what the user selected in the previous screen (stored in activeWheelId)
            let resolvedWheelId = activeWheelId;

            // If we don't have it in the store (e.g. HARD REFRESH), try to recover from the queue
            if (!resolvedWheelId && queueId) {
                const { data: queueData } = await supabase
                    .from('player_queue')
                    .select('selected_wheel_id, status')
                    .eq('id', queueId)
                    .single();

                if (queueData?.selected_wheel_id) {
                    resolvedWheelId = queueData.selected_wheel_id;
                    useGameStore.getState().setGameMode('individual', resolvedWheelId ?? undefined);
                }

                // Also sync UI status from queue
                if (queueData?.status === 'waiting') setUiStatus('waiting');
                if (queueData?.status === 'playing') setUiStatus('ready');
            }

            // 2. Only if STILL no wheelId and NO queue, fallback to screen (emergency fallback)
            if (!resolvedWheelId) {
                const { data: screenData } = await supabase
                    .from('screen_state')
                    .select('current_wheel_id')
                    .eq('screen_number', parseInt(id))
                    .single();

                if (screenData?.current_wheel_id) {
                    resolvedWheelId = screenData.current_wheel_id;
                    useGameStore.getState().setGameMode('individual', resolvedWheelId ?? undefined);
                }
            }

            if (resolvedWheelId) {
                setCurrentLocalWheelId(resolvedWheelId);
                useGameStore.getState().setGameMode('individual', resolvedWheelId ?? undefined);
            }

            if (!queueId) {
                console.warn("🚫 No active queue session found. Redirecting to ID page...");
                router.push(`/individual/screen/${id}`);
                return;
            }

            setIsInitializing(false);
        };

        if (!isInitializing) setIsInitializing(true);
        init();
    }, [queueId, supabase, id, activeWheelId, router]);

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

    // 4. Position & Failsafe Background Polling
    React.useEffect(() => {
        const interval = setInterval(async () => {
            // A. Position Check (If waiting)
            if (uiStatus === 'waiting' && queueId) {
                const { data: myItem } = await supabase
                    .from('player_queue')
                    .select('created_at')
                    .eq('id', queueId)
                    .single();

                if (myItem) {
                    const { count } = await supabase
                        .from('player_queue')
                        .select('*', { count: 'exact', head: true })
                        .eq('screen_number', parseInt(id))
                        .eq('status', 'waiting')
                        .lt('created_at', myItem.created_at);

                    if (count !== null) setQueuePosition(count + 1);
                }
            }

            // B. Failsafe: Try to Promote if screen is IDLE
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('status, updated_at')
                .eq('screen_number', parseInt(id))
                .single();

            if (screenData?.status === 'idle') {
                console.log("🛠️ Failsafe: Screen Idle. Attempting Promotion...");
                await supabase.rpc('promote_next_player', {
                    p_screen_number: parseInt(id)
                });
            }
            // C. Failsafe: Stuck on Result or Showing Result (> 12s)
            else if (screenData?.status === 'result' || screenData?.status === 'showing_result') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const now = new Date().getTime();
                const diffSeconds = (now - lastUpdate) / 1000;

                if (diffSeconds > 12) {
                    console.warn(`⚠️ Failsafe: Screen stuck on ${screenData.status}! Forcing advance...`);
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: parseInt(id)
                    });
                }
            }
        }, 3000); // Robust check every 3s

        return () => clearInterval(interval);
    }, [uiStatus, queueId, id, supabase]);

    // Timer for waiting_for_spin: 30s bar + 10s countdown
    React.useEffect(() => {
        if (uiStatus !== 'ready') {
            // Reset timers cuando no estamos ready
            setSpinTimeout(30);
            setSpinCountdown(null);
            return;
        }

        // Fase 1: Barra de 30 segundos
        if (spinTimeout > 0 && spinCountdown === null) {
            const timer = setTimeout(() => {
                setSpinTimeout(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }

        // Fase 2: Iniciar countdown de 10s
        if (spinTimeout === 0 && spinCountdown === null) {
            setSpinCountdown(10);
        }

        // Countdown de 10 a 0
        if (spinCountdown !== null && spinCountdown > 0) {
            const timer = setTimeout(() => {
                setSpinCountdown(prev => prev! - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }

        // Giro automático
        if (spinCountdown === 0) {
            console.log("⏰ Timeout alcanzado - Girando automáticamente");
            handleSpin();
        }
    }, [uiStatus, spinTimeout, spinCountdown]);

    // Timer for selecting: 120s timeout
    React.useEffect(() => {
        if (uiStatus !== 'selecting') {
            // Reset timer cuando no estamos selecting
            setSelectingTimeout(120);
            return;
        }

        if (selectingTimeout > 0) {
            const timer = setTimeout(() => {
                setSelectingTimeout(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }

        // Expulsar al jugador
        if (selectingTimeout === 0 && queueId) {
            console.warn("⏰ Timeout de selección - Expulsando jugador");
            supabase
                .from('player_queue')
                .update({ status: 'abandoned' })
                .eq('id', queueId)
                .then(() => {
                    router.push(`/individual/screen/${id}`);
                });
        }
    }, [uiStatus, selectingTimeout, queueId, router, id, supabase]);

    const handleConfirm = async () => {
        if (selectedAnimals.length === 3 && queueId) {

            // 1. Submit Selection & Set to WAITING
            const { error } = await supabase
                .from('player_queue')
                .update({
                    status: 'waiting',
                    selected_animals: selectedAnimals,
                })
                .eq('id', queueId)
                .eq('status', 'selecting'); // Only if still selecting (prevents overwriting 'playing' if TV promoted us fast)

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
        if (!queueId) return;

        // 1. Call RPC to Process Spin (Randomness + Deduction + State Update)
        const { data, error } = await supabase.rpc('play_spin', {
            p_queue_id: queueId,
            p_screen_number: parseInt(id)
        });

        if (error) {
            console.error("Spin Error:", error);
            // Optional: Show error to user
            return;
        }

        // 2. Persistir en localStorage para recuperación si cierra ventana
        try {
            localStorage.setItem(`spin_${id}_active`, JSON.stringify({
                queueId: queueId,
                timestamp: Date.now(),
                screenNumber: parseInt(id)
            }));
            console.log("💾 Spin info saved to localStorage");
        } catch (e) {
            console.warn("Could not save to localStorage:", e);
        }

        // 3. Navegar a resultado (feedback visual para el usuario móvil)
        router.push(`/individual/screen/${id}/result`);
    };

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-white space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-green-500 rounded-full animate-spin" />
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold tracking-widest text-white/50 uppercase">Sincronizando</p>
                    <p className="text-xs text-white/30">Cargando la configuración del mundo...</p>
                </div>
            </div>
        );
    }

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

                {/* Countdown de 10 segundos */}
                {spinCountdown !== null && (
                    <div className="mt-8 bg-yellow-400 text-black px-6 py-3 rounded-full animate-pulse">
                        <p className="text-sm font-bold">Giro automático en</p>
                        <p className="text-4xl font-black">{spinCountdown}</p>
                    </div>
                )}

                {/* Barra de progreso de 30s */}
                {spinCountdown === null && (
                    <div className="fixed bottom-0 left-0 right-0 h-2 bg-white/20">
                        <div
                            className="h-full bg-yellow-400 transition-all duration-1000"
                            style={{ width: `${(spinTimeout / 30) * 100}%` }}
                        />
                    </div>
                )}

                <p className="text-white/80 mt-8 text-sm text-center">
                    Presiona el botón rojo para lanzar la ruleta en la pantalla {id}
                </p>
            </div>
        );
    }

    const handleChangeWheel = () => {
        useGameStore.getState().setGameMode('individual', undefined); // Clear wheel selection to prevent auto-redirect
        router.push(`/individual/screen/${id}`);
    };

    return (
        <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden">
            <header className="px-4 py-3 bg-gray-900/90 backdrop-blur-sm z-10 flex-none border-b border-gray-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleChangeWheel}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-colors"
                            aria-label="Cambiar Ruleta"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                Elige 3 {mode === 'group' ? 'Animales' : 'Opciones'}
                            </h1>
                            <p className="text-xs text-green-400 font-medium tracking-wide">
                                {selectedAnimals.length}/3 SELECCIONADOS
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Package Progress - Inline */}
                        {packageInfo && (
                            <div className="bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 rounded-full shadow-inner flex items-center gap-2">
                                <span className="text-[10px] text-purple-300 uppercase font-bold">GIRO</span>
                                <span className="text-sm font-bold text-purple-200">{packageInfo.spinNumber}/{packageInfo.totalSpins}</span>
                            </div>
                        )}

                        <div className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full shadow-inner">
                            <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">PANTALLA</span>
                            <span className="text-sm font-bold text-white">{id}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Grid Interactivo Real (Disabled if not selecting) */}
            <div className={`flex-1 overflow-hidden relative ${uiStatus !== 'selecting' ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                <DynamicAnimalSelector
                    wheelId={currentLocalWheelId}
                    mode={mode}
                    disabled={uiStatus !== 'selecting'} // Enforce logic disable
                />
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

                {uiStatus === 'waiting' && queuePosition !== null && (
                    <div className="flex flex-col gap-2">
                        <button disabled className="w-full py-4 rounded-xl font-bold text-lg tracking-wide bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 flex items-center justify-center gap-3">
                            <span className="text-2xl animate-spin">🎲</span>
                            ESTÁS EN LA FILA...
                        </button>
                        <p className="text-center text-xs text-yellow-500/70 font-bold uppercase tracking-widest">
                            Posición: {queuePosition}
                        </p>
                    </div>
                )}

                {uiStatus === 'waiting' && queuePosition === null && (
                    <button disabled className="w-full py-4 rounded-xl font-bold text-lg tracking-wide bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 flex items-center justify-center gap-3 animate-pulse">
                        <span className="text-2xl animate-spin">🎲</span>
                        ESTÁS EN LA FILA...
                    </button>
                )}
            </div>

            {/* Barra de timeout para selecting */}
            {uiStatus === 'selecting' && (
                <div className="fixed bottom-0 left-0 right-0 h-2 bg-gray-800 z-50">
                    <div
                        className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-1000"
                        style={{ width: `${(selectingTimeout / 120) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
}
