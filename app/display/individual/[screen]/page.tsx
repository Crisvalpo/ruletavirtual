'use client';

import { use, useEffect, useState } from 'react';
import WheelCanvas from '@/components/individual/WheelCanvas';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useGameStore } from '@/lib/store/gameStore';
import Confetti from 'react-confetti';
// Remove useWindowSize if not strictly needed or ensure package is present.
// The code used window.innerWidth directly inside the check, which is fine.

export default function DisplayScreenPage({
    params
}: {
    params: Promise<{ screen: string }>
}) {
    const { screen } = use(params);
    const screenIdNum = parseInt(screen);

    // 1. Hooks
    useRealtimeGame(screen);
    const { venueMode, centralScreenId } = useVenueSettings();

    // 2. Read from store (Individual Mode State)
    const mode = useGameStore((state) => state.gameMode);
    const activeWheelId = useGameStore((state) => state.activeWheelId);

    // 3. Logic: Determine effective mode
    const isGroupEvent = venueMode === 'group_event';
    const isCentralScreen = isGroupEvent && screenIdNum === centralScreenId;
    const isBillboardScreen = isGroupEvent && !isCentralScreen;

    // Effective Wheel ID for Individual Play (ignored if Group Event)
    const effectiveActiveWheelId = isGroupEvent ? null : activeWheelId;
    const effectiveMode = isGroupEvent ? 'group' : mode; // Force group visual in event mode (or specific event visual)

    // Celebration State
    const [status, setStatus] = useState<'idle' | 'spinning' | 'result'>('idle');
    const [result, setResult] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBigWin, setShowBigWin] = useState(false);

    // Local state for dynamic assets
    const [activeWheelAssets, setActiveWheelAssets] = useState<{
        background: string;
        segments: any[];
    } | null>(null);

    const supabase = createClient();

    // 3. Effect: When activeWheelId changes (via Realtime), fetch assets
    useEffect(() => {
        async function loadWheelAssets() {
            // FORCE DEBUG: Override with local Mario assets
            const FORCE_DEBUG = true;

            if (FORCE_DEBUG) {
                const segments = Array.from({ length: 12 }, (_, i) => ({
                    id: i + 1,
                    label: `Seg ${i + 1}`,
                    color: 'transparent',
                    imageWheel: `/wheels/mario/${i + 1}.png`
                }));

                setActiveWheelAssets({
                    background: '/wheels/mario/background.jpg',
                    segments: segments
                });
                return;
            }

            // Logic refactored: if no ID is passed, we assume static group mode.
            // If in Group Event, effectiveActiveWheelId is null -> loads static group wheel (correct for central screen)

            if (effectiveMode === 'group' && !effectiveActiveWheelId) {
                setActiveWheelAssets(null); // Default 36 animals
                return;
            }
            // ... [rest of load function] ...
        }
        loadWheelAssets();
    }, [effectiveMode, effectiveActiveWheelId]);

    // Handle Spin Complete
    const handleSpinComplete = (winnerIndex: number) => {
        setStatus('result');
        setResult(winnerIndex);
        setShowConfetti(true);
        setShowBigWin(true);

        // Hide celebration after 10 seconds
        setTimeout(async () => {
            setShowConfetti(false);
            setShowBigWin(false);
            setStatus('idle');
            setResult(null);

            // Cleanup Session (Mark queue completed & reset screen)
            const { error } = await supabase.rpc('cleanup_screen_session', {
                p_screen_number: parseInt(screen)
            });
            if (error) console.error('Error cleaning session:', error);
        }, 10000);
    };

    // Move hooks to top level
    const realNickname = useGameStore(state => state.nickname);
    const realEmoji = useGameStore(state => state.emoji);

    // FORCE DEBUG IDENTITY
    const identityNickname = 'granjero'; // Force debug
    const identityEmoji = '💎'; // Force debug

    // Debug Spin Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'q' || e.key === 'Q') {
                if (status === 'idle') {
                    console.log('🐞 Debug Spin triggered');
                    setStatus('spinning');
                    setResult(null);
                    // Simulate Result after 3s
                    setTimeout(() => {
                        const randomResult = Math.floor(Math.random() * 12) + 1;
                        setResult(randomResult);
                    }, 3000);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8 overflow-hidden relative">
            {/* ... other code ... */}

            <div className="absolute top-8 left-8 bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20 z-50 flex items-center gap-4 shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold text-white">Pantalla {screen}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-300">Conectado</span>
                    </div>
                </div>

                {/* Player Identity Badge */}
                {identityNickname !== 'Jugador' && (
                    <div className="border-l border-white/20 pl-4 animate-in fade-in slide-in-from-left-4 duration-500">
                        <p className="text-xs text-gray-400 uppercase tracking-widest">Jugando ahora</p>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl">{identityEmoji}</span>
                            <span className="text-2xl font-bold text-yellow-400">{identityNickname}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* --- VISUALIZACIÓN SEGÚN MODO --- */}

            {/* CASO 1: MODO EVENTO - PANTALLA LATERAL (CARTELERA) */}
            {isBillboardScreen && (
                <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-center p-12">
                    <h1 className="text-6xl font-bold text-yellow-400 mb-8 animate-pulse">¡GRAN SORTEO EN CURSO!</h1>
                    <div className="text-4xl text-white mb-12">Mira la Pantalla Central #{centralScreenId}</div>

                    <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-md border border-white/20 w-full max-w-2xl">
                        <h3 className="text-2xl text-blue-300 mb-4">Últimos Ganadores</h3>
                        <div className="space-y-4 text-xl text-white">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span>🎟️ Ticket #4592</span>
                                <span className="text-green-400">$50,000</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span>🎟️ Ticket #4588</span>
                                <span className="text-green-400">$10,000</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CASO 2: MODO EVENTO - PANTALLA CENTRAL (RULETA DEDICADA) */}
            {/* ... (Unchanged) ... */}

            {/* Background Image if Dynamic Wheel (Solo si NO es Billboard) */}
            {activeWheelAssets?.background && !isBillboardScreen && (
                <div className="absolute inset-0 z-0">
                    <Image
                        src={activeWheelAssets.background}
                        alt="Background"
                        fill
                        className="object-cover opacity-100"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>
            )}

            {/* Canvas Container (Oculto si es Billboard) */}
            {!isBillboardScreen && (
                // Remove padding/centering constraints for Fan Mode to hit top edge
                <div className="absolute inset-0 flex items-start justify-center z-10 pt-0">

                    {/* Ruleta Wrapper */}
                    {(() => {
                        const segmentCount = activeWheelAssets?.segments?.length || 12;
                        const isFanMode = segmentCount <= 20;

                        return (
                            // Fan Mode: Limit height to avoid scroll. 2:1 aspect ratio roughly crops the empty bottom half.
                            // We use aspect-[2/1] and overflow-hidden to show only the top half of the square canvas.
                            <div className={`relative w-full transition-all duration-500 flex items-start justify-center 
                                ${isFanMode ? 'aspect-[2/1] overflow-hidden' : 'aspect-square items-center'}
                            `}>
                                {/* Canvas: Always square intrinsic matching width. 
                                    In Fan Mode, it overflows the container (bottom cropped). */}
                                <div className={`relative w-full aspect-square`}>
                                    <WheelCanvas
                                        isSpinning={status === 'spinning'}
                                        targetIndex={result} // Pass result directly so it can spin down
                                        segments={activeWheelAssets?.segments}
                                        onSpinComplete={handleSpinComplete}
                                        className="w-full h-full"
                                    />
                                </div>

                                {/* Logo Central Overlay - Removed as requested */}


                                {/* Pointer Overlay: ONLY for Group Mode */}
                                {!isFanMode && (
                                    <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-0 h-0 border-t-[20px] border-t-transparent border-l-[40px] border-l-red-600 border-b-[20px] border-b-transparent filter drop-shadow-lg z-20"></div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* QR Sidebar (Solo en Modo Individual) */}
            {!isGroupEvent && (
                <div className={`absolute right-0 top-0 h-full w-96 bg-gray-800/80 backdrop-blur-lg border-l border-white/10 p-8 flex flex-col items-center justify-center text-center transition-all duration-700 ease-in-out z-50 ${status === 'spinning' ? 'opacity-0 translate-x-20 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                    <h3 className="text-3xl font-bold text-white mb-6">¡Juega Ahora!</h3>
                    <div className="bg-white p-4 rounded-3xl shadow-xl mb-6 transform hover:scale-105 transition-all">
                        {/* Placeholder de QR */}
                        <div className="w-64 h-64 bg-gray-100 flex items-center justify-center text-gray-400">
                            [QR LINK A PANTALLA {screen}]
                        </div>
                    </div>
                    <p className="text-xl text-primary font-bold mb-2">Escanea para unirte</p>
                    <p className="text-gray-400">Solo $1,000 por jugada</p>

                    {/* Visual Mode Indicator for Staff Debug */}
                    <div className="mt-8 bg-black/50 p-2 rounded text-xs text-white">
                        Mode: {venueMode} <br />
                        Central ID: {centralScreenId} <br />
                        IsGroupEvent: {isGroupEvent ? 'YES' : 'NO'} <br />
                        Status: {status}
                    </div>
                </div>
            )}

            {/* FORCE DEBUG OVERLAY - ALWAYS VISIBLE */}
            <div className="fixed bottom-0 left-0 bg-red-600 text-white p-2 z-[9999] text-xs font-mono">
                DEBUG: VenueMode={venueMode} | Screen={screen} | Central={centralScreenId}
            </div>

        </div>
    );
}
