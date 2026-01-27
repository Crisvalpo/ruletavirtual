'use client';

import { use, useEffect, useState } from 'react';
import WheelCanvas from '@/components/individual/WheelCanvas';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import Image from 'next/image';
import BigWinOverlay from '@/components/individual/BigWinOverlay';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useGameStore } from '@/lib/store/gameStore';
import Confetti from 'react-confetti';
import QueueList from '@/components/individual/QueueList';
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
    const realNickname = useGameStore(state => state.nickname); // Moved up for access
    const realEmoji = useGameStore(state => state.emoji); // Moved up

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
    // History State
    const [lastSpins, setLastSpins] = useState<any[]>([]);

    // Missing State Definitions
    const [activeWheelAssets, setActiveWheelAssets] = useState<{ background: string; segments: any[] } | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBigWin, setShowBigWin] = useState(false);
    const [currentSelections, setCurrentSelections] = useState<number[]>([]);

    const supabase = createClient();

    // 3. Effect: When activeWheelId changes (via Realtime), fetch assets
    useEffect(() => {
        async function loadWheelAssets() {
            // FORCE DEBUG: Override with local Mario assets
            const FORCE_DEBUG = false; // Set to false to enable Real Database Fetching

            if (FORCE_DEBUG) {
                // Base URL for Supabase Storage (Public Bucket: individual-wheels)
                // Corrected path based on Storage structure: mario/mario/segments/X.png
                // Project ID: umimqlybmqivowsshtkt
                const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;

                const segments = Array.from({ length: 12 }, (_, i) => ({
                    id: i + 1,
                    label: `Seg ${i + 1}`,
                    color: 'transparent',
                    imageWheel: `${STORAGE_BASE}/mario/segments/${i + 1}.png`,
                    imageResult: `${STORAGE_BASE}/mario/selector/${i + 1}.jpg`
                }));

                setActiveWheelAssets({
                    background: `${STORAGE_BASE}/mario/background.jpg`,
                    segments: segments
                });
                return;
            } else if (effectiveMode === 'group' && !effectiveActiveWheelId) {
                setActiveWheelAssets(null); // Default 36 animals
            } else if (effectiveActiveWheelId) {
                // REAL LOGIC: Fetch Dynamic Wheel Data
                try {
                    const { data, error } = await supabase
                        .from('individual_wheels')
                        .select('storage_path, segment_count') // We need storage_path to build URLs
                        .eq('id', effectiveActiveWheelId)
                        .single();

                    if (error) throw error;

                    if (data) {
                        const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;
                        const path = data.storage_path; // e.g., 'mario' or 'sonic'

                        const segments = Array.from({ length: data.segment_count || 12 }, (_, i) => ({
                            id: i + 1,
                            label: `Seg ${i + 1}`,
                            color: 'transparent',
                            // Convention verified in upload-mario.js:
                            imageWheel: `${STORAGE_BASE}/${path}/segments/${i + 1}.png`,
                            imageResult: `${STORAGE_BASE}/${path}/selector/${i + 1}.jpg`
                        }));

                        setActiveWheelAssets({
                            background: `${STORAGE_BASE}/${path}/background.jpg`,
                            segments: segments
                        });
                    }
                } catch (err) {
                    console.error("Failed to load wheel assets:", err);
                    // Fallback? Currently keeps previous or null.
                }
            }
        }
        loadWheelAssets();
    }, [effectiveMode, effectiveActiveWheelId]);

    // 4. Listen to Store Status (Triggered by Realtime from Mobile)
    const storeStatus = useGameStore(s => s.status);
    const idleSpeed = useGameStore(s => s.idleSpeed);

    useEffect(() => {
        // Start Spin
        if (storeStatus === 'spinning' && status === 'idle') {
            console.log('📱 Mobile Spin triggered');
            setStatus('spinning');
            setResult(null);

            // Generate Random Result locally (since mobile didn't send one)
            setTimeout(() => {
                const randomResult = Math.floor(Math.random() * 12) + 1;
                setResult(randomResult);
            }, 500);
        }
        // Reset / Cleanup (Driven by Realtime)
        else if (storeStatus === 'idle' && status !== 'idle') {
            console.log('🧹 Remote Reset triggered');
            setStatus('idle');
            setResult(null);
            setShowConfetti(false);
            setShowBigWin(false);
        }
    }, [storeStatus, status]);

    // Fetch Active Player Selections
    useEffect(() => {
        if (status === 'idle' && !realNickname) {
            setCurrentSelections([]);
            return;
        }

        async function fetchSelections() {
            // Only fetch if we have a player name but no selections yet, or if status changed
            const { data } = await supabase
                .from('player_queue')
                .select('selected_animals')
                .eq('screen_number', screenIdNum)
                .eq('status', 'playing')
                .maybeSingle();

            if (data?.selected_animals) {
                setCurrentSelections(data.selected_animals as number[]);
            } else {
                setCurrentSelections([]);
            }
        }

        fetchSelections();
    }, [screenIdNum, status, realNickname]);

    // Fetch History Effect
    useEffect(() => {
        async function fetchHistory() {
            let query = supabase
                .from('game_history')
                .select('*')
                .eq('screen_id', screenIdNum)
                .order('created_at', { ascending: false })
                .limit(9);

            // Filter by Game/Wheel ID if active (prevents mixing Mario vs Sonic history)
            if (effectiveActiveWheelId) {
                query = query.eq('wheel_id', effectiveActiveWheelId);
            }

            const { data, error } = await query;

            if (data) {
                setLastSpins(data);
            }
        }
        fetchHistory();
    }, [screenIdNum, effectiveActiveWheelId]);

    const isDemo = useGameStore(state => state.isDemo);

    // State for Win/Loss
    const [isWin, setIsWin] = useState(false);

    // Handle Spin Complete
    const handleSpinComplete = async (winnerIndex: number) => {
        console.log(`🎰 Spin Complete! isDemo=${isDemo}, Index=${winnerIndex}`);

        // 1. Determine Win/Loss (Fetch active player selection)
        let playerWon = false;

        // Fetch current active player from queue to check their selection
        const { data: activePlayer } = await supabase
            .from('player_queue')
            .select('selected_animals')
            .eq('screen_number', screenIdNum)
            .eq('status', 'playing')
            .single();

        if (activePlayer && activePlayer.selected_animals) {
            // Check if winnerIndex is in their selection
            // Ensure types match (array of numbers)
            const selection = activePlayer.selected_animals as number[];
            if (selection.includes(winnerIndex)) {
                playerWon = true;
            }
        } else if (isDemo) {
            // Demo always wins for satisfaction? Or random? 
            // Let's make demo random too or just win for testing visuals?
            // Usually demo is just strictly visual, but let's assume 'win' context for confetti testing if needed.
            // For now, let's say Demo always wins to show off particles.
            playerWon = true;
        }

        setIsWin(playerWon);
        setStatus('result');
        setResult(winnerIndex);

        // Only show confetti / BigWin if Won
        if (playerWon) {
            setShowConfetti(true);
        }
        setShowBigWin(true); // Show overlay for both (Win or Loss message)

        // 2. Update Screen State (For Mobile Sync)
        await supabase
            .from('screen_state')
            .update({
                status: 'showing_result',
                last_spin_result: winnerIndex,
                updated_at: new Date().toISOString()
            })
            .eq('screen_number', parseInt(screen));


        // Logic Branch: Demo vs Real
        if (isDemo) {
            console.log("🎓 Demo Spin Complete. Skipping History.");

            // Fast Cleanup (2s)
            setTimeout(async () => {
                // Use Robust RPC to auto-promote next player if waiting
                console.log("🎓 Demo Finished. Calling Force Advance.");
                await supabase.rpc('force_advance_queue', {
                    p_screen_number: parseInt(screen)
                });
            }, 5000); // Give them time to see result

            return; // EXIT EARLY
        }

        // --- REAL GAME LOGIC ---

        // Record History
        try {
            const historyEntry = {
                screen_id: screenIdNum,
                wheel_id: effectiveActiveWheelId || null,
                result_index: winnerIndex,
                player_name: realNickname || 'Anon',
                created_at: new Date().toISOString()
            };

            await supabase.from('game_history').insert([historyEntry]);

            // Optimistic Update
            setLastSpins(prev => [historyEntry, ...prev].slice(0, 9));

        } catch (err) {
            console.error("Failed to save history:", err);
        }

        // Hide celebration after 10 seconds (Trigger DB Reset)
        setTimeout(async () => {
            // Cleanup Session (Mark queue completed & reset screen & PROMOTE NEXT)
            const { error } = await supabase.rpc('force_advance_queue', {
                p_screen_number: parseInt(screen)
            });
            if (error) console.error('Error cleaning session:', error);
        }, 10000);
    };

    // Move hooks to top level (Done)

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

            {/* Top Left Container: Info & Queue */}
            <div className="absolute top-8 left-8 z-50 flex flex-col gap-4 items-start">

                {/* 1. Main Info Card */}
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20 flex items-center gap-4 shadow-lg">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Pantalla {screen}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-300">Conectado</span>
                        </div>
                    </div>

                    {/* Player Identity Badge */}
                    {realNickname && (realNickname !== 'Jugador' || status !== 'idle') && (
                        <div className="border-l border-white/20 pl-4 animate-in fade-in slide-in-from-left-4 duration-500">
                            <p className="text-xs text-gray-400 uppercase tracking-widest">Jugando ahora</p>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl">{realEmoji}</span>
                                <span className="text-2xl font-bold text-yellow-400">{realNickname}</span>
                            </div>
                        </div>
                    )}

                    {/* Active Selections Visualization */}
                    {currentSelections.length > 0 && (
                        <div className="flex items-center gap-2 border-l border-white/20 pl-4 animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
                            <div className="flex -space-x-3 hover:space-x-1 transition-all">
                                {currentSelections.map((selId, idx) => {
                                    // Resolve Image
                                    let imgSrc = null;
                                    if (activeWheelAssets?.segments) {
                                        const seg = activeWheelAssets.segments.find(s => s.id === selId);
                                        // Use imageResult (selector icon) instead of wedge
                                        if (seg) imgSrc = seg.imageResult || seg.imageWheel;
                                    }
                                    if (!imgSrc) {
                                        const animal = ANIMAL_LIST.find(a => a.id === selId);
                                        // Use imageSelector (animal portrait)
                                        if (animal) imgSrc = animal.imageSelector || animal.imageWheel;
                                    }

                                    return (
                                        <div key={idx} className="w-10 h-10 rounded-full border-2 border-gray-800 bg-gray-700 relative overflow-hidden shadow-lg">
                                            {imgSrc ? (
                                                <Image src={imgSrc} alt="Choice" fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{selId}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono tracking-tighter">APUESTA<br />ACTIVA</span>
                        </div>
                    )}
                </div>

                {/* 2. Queue List (Stacked Below) */}
                <QueueList screenId={screenIdNum} assets={activeWheelAssets} />
            </div >

            {/* --- VISUALIZACIÓN SEGÚN MODO --- */}

            {/* CASO 1: MODO EVENTO - PANTALLA LATERAL (CARTELERA) */}
            {
                isBillboardScreen && (
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
                )
            }

            {/* CASO 2: MODO EVENTO - PANTALLA CENTRAL (RULETA DEDICADA) */}
            {/* ... (Unchanged) ... */}



            {/* Background Image if Dynamic Wheel (Solo si NO es Billboard) */}
            {
                activeWheelAssets?.background && !isBillboardScreen && (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={activeWheelAssets.background}
                            alt="Background"
                            fill
                            className="object-cover opacity-100"
                        />
                        <div className="absolute inset-0 bg-black/40" />
                    </div>
                )
            }

            {/* Canvas Container (Oculto si es Billboard) */}
            {
                !isBillboardScreen && (
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
                                            isSpinning={storeStatus === 'spinning'}
                                            isIdle={storeStatus === 'idle'}
                                            idleSpeed={idleSpeed || 1.0} // Use subscribed value
                                            targetIndex={result}
                                            onSpinComplete={handleSpinComplete}
                                            segments={activeWheelAssets?.segments}
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
                )
            }

            {/* QR Sidebar (Solo en Modo Individual) */}
            {
                !isGroupEvent && (
                    <div className={`absolute right-0 top-0 h-full w-80 bg-gray-800/90 backdrop-blur-lg border-l border-white/10 p-6 flex flex-col items-center justify-start pt-12 text-center transition-all duration-700 ease-in-out z-50 ${status === 'spinning' ? 'opacity-0 translate-x-20 pointer-events-none' : 'opacity-100 translate-x-0'}`}>

                        {/* Header Text */}
                        <h3 className="text-3xl font-bold text-white mb-2">¡Juega Ahora!</h3>
                        <p className="text-xl text-primary font-bold mb-1">Escanea para unirte</p>
                        <p className="text-gray-400 mb-6">Solo $1,000 por jugada</p>

                        {/* QR Code */}
                        <div className="bg-white p-3 rounded-2xl shadow-xl mb-8 transform hover:scale-105 transition-all w-full max-w-[240px]">
                            {/* Placeholder de QR */}
                            <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 rounded-xl overflow-hidden relative">
                                {/* You can use a real QR image here if available, or keep placeholder text */}
                                <span className="text-xs text-gray-400">[QR LINK PANTALLA {screen}]</span>
                            </div>
                        </div>

                        {/* History Grid */}
                        <div className="w-full max-w-[240px]">
                            <h4 className="text-sm uppercase tracking-widest text-gray-500 mb-3 border-b border-white/10 pb-1">Últimos 9</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {/* Render actual history, padded to 9 items */}
                                {[...lastSpins, ...Array(9)].slice(0, 9).map((spin, i) => {
                                    // Find image for this result
                                    let imageSrc = null;
                                    if (spin && activeWheelAssets?.segments) {
                                        // Assuming result_index matches ID (1-based)
                                        // If segments are 0-indexed in array but have IDs:
                                        const segment = activeWheelAssets.segments.find(s => s.id === spin.result_index);
                                        if (segment) imageSrc = segment.imageResult || segment.imageWheel;
                                    }

                                    return (
                                        <div key={i} className="aspect-square bg-white/5 rounded-lg border border-white/10 overflow-hidden relative flex items-center justify-center">
                                            {spin ? (
                                                imageSrc ? (
                                                    <div className="w-full h-full relative">
                                                        <Image
                                                            src={imageSrc}
                                                            alt="Res"
                                                            fill
                                                            className="object-contain p-1"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-yellow-500 font-bold">#{spin.result_index}</span>
                                                )
                                            ) : (
                                                // Empty Slot
                                                <div className="w-1 h-1 bg-white/5 rounded-full" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Visual Mode Indicator for Staff Debug (Minimized) */}
                        <div className="mt-auto opacity-30 hover:opacity-100 transition-opacity text-[10px] text-gray-500 text-left w-full">
                            Mode: {venueMode} | Central: {centralScreenId} <br />
                            Evt: {isGroupEvent ? 'Yes' : 'No'} | St: {status}
                        </div>
                    </div>
                )
            }

            {/* --- WINNER REACTIONS --- */}
            <BigWinOverlay
                isVisible={showBigWin}
                resultIndex={result}
                assets={activeWheelAssets}
                playerName={realNickname}
                type={isWin ? 'win' : 'loss'}
            />

            {showConfetti && (
                <div className="absolute inset-0 z-[100] pointer-events-none">
                    <Confetti
                        width={typeof window !== 'undefined' ? window.innerWidth : 1000}
                        height={typeof window !== 'undefined' ? window.innerHeight : 1000}
                        recycle={true}
                        numberOfPieces={500}
                        gravity={0.2}
                    />
                </div>
            )}

            <div className="fixed bottom-0 left-0 bg-red-600 text-white p-2 z-[9999] text-xs font-mono hidden">
                DEBUG: VenueMode={venueMode} | Screen={screen} | Central={centralScreenId}
            </div>

        </div >
    );
}
