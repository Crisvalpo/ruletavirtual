'use client';

import React, { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeCanvas } from 'qrcode.react';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import Link from 'next/link';

export default function ResultPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const { selectedAnimals, nickname, emoji, queueId, status: globalStatus, activeWheelId } = useGameStore();

    // Sync with global screen state to know when it's safe to play again
    useRealtimeGame(id);

    const searchParams = useSearchParams();
    const urlQueueId = searchParams.get('q');
    const resParam = searchParams.get('res');
    const effectiveQueueId = queueId || urlQueueId;

    // Obtener el estado inicial determinado por el query parameter 'res' para evitar flasheos celestes
    const initialStatus = React.useMemo(() => {
        if (resParam !== null && selectedAnimals.length > 0) {
            const resNum = parseInt(resParam);
            if (!isNaN(resNum)) {
                return selectedAnimals.includes(resNum) ? 'winning' : 'losing';
            }
        }
        return 'loading';
    }, [resParam, selectedAnimals]);

    const [status, setStatus] = useState<'loading' | 'winning' | 'losing' | 'auto_rejoin'>(initialStatus);
    const [dbSelections, setDbSelections] = useState<number[]>([]);
    const [isRevenge, setIsRevenge] = useState<boolean>(false);

    // Piedra, Papel o Tijera (RPS) States
    const [rpsPlaying, setRpsPlaying] = useState(false);
    const [rpsUserChoice, setRpsUserChoice] = useState<'rock' | 'paper' | 'scissors' | null>(null);
    const [rpsCompChoice, setRpsCompChoice] = useState<'rock' | 'paper' | 'scissors' | null>(null);
    const [rpsResult, setRpsResult] = useState<'win' | 'lose' | 'draw' | null>(null);
    const [rpsAnimating, setRpsAnimating] = useState(false);
    const [hasPlayedRps, setHasPlayedRps] = useState(false);

    useEffect(() => {
        if (effectiveQueueId) {
            const played = sessionStorage.getItem(`rps_played_${effectiveQueueId}`) === 'true';
            setHasPlayedRps(played);
        }
    }, [effectiveQueueId]);

    const playRPS = (userChoice: 'rock' | 'paper' | 'scissors') => {
        if (rpsAnimating) return;
        setRpsUserChoice(userChoice);
        setRpsAnimating(true);
        setRpsCompChoice(null);
        setRpsResult(null);

        setTimeout(() => {
            const choices: ('rock' | 'paper' | 'scissors')[] = ['rock', 'paper', 'scissors'];
            const compChoice = choices[Math.floor(Math.random() * 3)];
            setRpsCompChoice(compChoice);

            let result: 'win' | 'lose' | 'draw';
            if (userChoice === compChoice) {
                result = 'draw';
            } else if (
                (userChoice === 'rock' && compChoice === 'scissors') ||
                (userChoice === 'paper' && compChoice === 'rock') ||
                (userChoice === 'scissors' && compChoice === 'paper')
            ) {
                result = 'win';
            } else {
                result = 'lose';
            }

            setRpsResult(result);
            setRpsAnimating(false);

            if (result !== 'draw') {
                setHasPlayedRps(true);
                if (effectiveQueueId) {
                    sessionStorage.setItem(`rps_played_${effectiveQueueId}`, 'true');
                }
            }
        }, 1500);
    };

    const renderRpsGame = () => {
        const choiceLabels = {
            rock: { emoji: '✊', label: 'Piedra', color: 'from-pink-500 to-rose-600' },
            paper: { emoji: '✋', label: 'Papel', color: 'from-yellow-400 to-amber-500' },
            scissors: { emoji: '✌️', label: 'Tijera', color: 'from-cyan-400 to-blue-500' }
        };

        return (
            <div className="text-center animate-in zoom-in duration-500 max-w-sm w-full bg-gray-800/80 backdrop-blur-md p-6 rounded-3xl border border-gray-700 shadow-2xl">
                <h2 className="text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent mb-1 uppercase tracking-tight">
                    ✊ ¡Revancha de Honor! ✌️
                </h2>
                <p className="text-xs text-gray-400 mb-6 font-medium">
                    Gana la partida para obtener un Giro de Consuelo
                </p>

                {/* Battle Arena */}
                <div className="flex justify-between items-center bg-gray-900/60 rounded-2xl p-4 mb-6 border border-white/5 relative overflow-hidden">
                    {/* User choice */}
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">Tú</span>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-gray-900 border-2 ${rpsAnimating ? 'animate-bounce border-blue-500' : rpsResult === 'win' ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-gray-700'}`}>
                            {rpsUserChoice ? choiceLabels[rpsUserChoice].emoji : '❓'}
                        </div>
                        <span className="text-xs font-bold text-gray-400 mt-2">
                            {rpsUserChoice ? choiceLabels[rpsUserChoice].label : 'Elige...'}
                        </span>
                    </div>

                    {/* VS divider */}
                    <div className="flex-none px-4 text-sm font-black text-gray-600 animate-pulse">
                        VS
                    </div>

                    {/* Computer choice */}
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">Oponente</span>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-gray-900 border-2 ${rpsAnimating ? 'animate-bounce border-pink-500' : rpsResult === 'lose' ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-gray-700'}`}>
                            {rpsAnimating ? '⏳' : rpsCompChoice ? choiceLabels[rpsCompChoice].emoji : '🤖'}
                        </div>
                        <span className="text-xs font-bold text-gray-400 mt-2">
                            {rpsAnimating ? 'Pensando...' : rpsCompChoice ? choiceLabels[rpsCompChoice].label : 'Esperando...'}
                        </span>
                    </div>
                </div>

                {/* Game outcome message */}
                <div className="h-12 flex items-center justify-center mb-6">
                    {rpsAnimating && (
                        <p className="text-sm font-black text-blue-400 animate-pulse uppercase tracking-wider">
                            👊 ¡Preparando jugada...! 🖐️
                        </p>
                    )}
                    {!rpsAnimating && rpsResult === 'draw' && (
                        <p className="text-sm font-black text-yellow-500 animate-bounce uppercase tracking-wider">
                            🤝 ¡Empate! Inténtalo de nuevo
                        </p>
                    )}
                    {!rpsAnimating && rpsResult === 'win' && (
                        <div className="text-center">
                            <p className="text-base font-black text-green-400 uppercase tracking-widest animate-pulse">
                                🎉 ¡GANASTE LA REVANCHA! 🎉
                            </p>
                        </div>
                    )}
                    {!rpsAnimating && rpsResult === 'lose' && (
                        <p className="text-sm font-black text-red-500 uppercase tracking-widest">
                            😢 Perdiste la oportunidad
                        </p>
                    )}
                    {!rpsAnimating && !rpsResult && (
                        <p className="text-xs font-bold text-gray-500 tracking-wider">
                            Piedra vence a Tijera • Tijera vence a Papel • Papel vence a Piedra
                        </p>
                    )}
                </div>

                {/* RPS Choice Buttons */}
                {!rpsResult || rpsResult === 'draw' ? (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {(['rock', 'paper', 'scissors'] as const).map((choice) => {
                            const info = choiceLabels[choice];
                            return (
                                <button
                                    key={choice}
                                    onClick={() => playRPS(choice)}
                                    disabled={rpsAnimating}
                                    className={`
                                        flex flex-col items-center justify-center py-4 rounded-2xl bg-gradient-to-b ${info.color} 
                                        text-white font-black transition-all transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-md hover:shadow-lg
                                    `}
                                >
                                    <span className="text-3xl mb-1">{info.emoji}</span>
                                    <span className="text-xs uppercase tracking-tight font-black">{info.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 mt-2">
                        {rpsResult === 'win' && (
                            <button
                                onClick={() => {
                                    useGameStore.getState().setQueueId(null);
                                    router.push(`/individual/screen/${id}/pre-select?wheelId=${activeWheelId || ''}&isRevenge=true`);
                                }}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-base uppercase tracking-wider shadow-lg shadow-green-500/20 transition-all transform active:scale-95"
                            >
                                Reclamar Giro de Revancha 🚀
                            </button>
                        )}
                        {rpsResult === 'lose' && (
                            <button
                                onClick={() => {
                                    setRpsPlaying(false);
                                }}
                                className="w-full py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-black text-sm uppercase tracking-wide transition-all active:scale-95"
                            >
                                Continuar
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const selectedAnimalsRef = React.useRef(selectedAnimals);
    const dbSelectionsRef = React.useRef(dbSelections);

    useEffect(() => {
        selectedAnimalsRef.current = selectedAnimals;
    }, [selectedAnimals]);

    useEffect(() => {
        dbSelectionsRef.current = dbSelections;
    }, [dbSelections]);
    const [email, setEmail] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [ticketCode, setTicketCode] = useState<string | null>(null);

    // Package tracking state
    const [packageInfo, setPackageInfo] = useState<{
        packageId: string;
        spinNumber: number;
        totalSpins: number;
        spinsRemaining: number;
        code: string;
    } | null>(null);
    const [autoRejoinCountdown, setAutoRejoinCountdown] = useState(5);

    const { baseUrl } = useVenueSettings();
    const { user, profile, signInWithGoogle } = useAuth();

    // Is the Big Screen ready for a new player?
    // We disable buttons if the screen is still showing a result or spinning (not idle)
    // NOTE: globalStatus might take a second to sync, so we default to false (enabled) if undefined, 
    // but 'waiting' is safer. However, since we are ON the result page, the screen is likely 'result'.
    const isScreenBusy = globalStatus !== 'idle';

    // Check if user is actually identified (has email) vs anonymous
    const isIdentified = !!user?.email;

    // Redirect if no queueId (no active session)
    useEffect(() => {
        if (!effectiveQueueId) {
            // Give it a moment in case zustand is still hydrating
            const timer = setTimeout(() => {
                if (!effectiveQueueId) {
                    router.push(`/individual/screen/${id}`);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [effectiveQueueId, id, router]);

    useEffect(() => {
        // If user just identified themselves while on this page, link the prize
        // Only trigger this if we have a definitive win status and we haven't saved yet
        if (isIdentified && effectiveQueueId && !isSaved && status === 'winning') {
            handleSavePrize(user.email!);
        }
    }, [isIdentified, effectiveQueueId, status, isSaved]);

    const handleSavePrize = async (userEmail: string) => {
        if (!effectiveQueueId) return;
        setIsSaving(true);
        const { error } = await supabase
            .from('player_queue')
            .update({
                email: userEmail,
                player_id: user?.id,
                prize_won: isRevenge ? 'PREMIO NIVEL 2' : 'PREMIO NIVEL 1' // Save prize so it appears in history
            })
            .eq('id', effectiveQueueId);

        if (!error) setIsSaved(true);
        setIsSaving(false);
    };

    // Maintain a ref to the current status to prevent stale asynchronous DB queries 
    // from overwriting a definitive 'winning' or 'losing' status back to 'loading'.
    const statusRef = React.useRef(status);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // 1. Core Result Logic
    const checkResult = React.useCallback(async (isMounted: boolean) => {
        try {
            // Guard: If we already have a definitive terminal status, do not re-run checks
            if (statusRef.current === 'winning' || statusRef.current === 'losing') {
                return;
            }

            // 0. RECUPERAR DESDE LOCALSTORAGE si no hay queueId
            if (!queueId) {
                try {
                    const savedSpin = localStorage.getItem(`spin_${id}_active`);
                    if (savedSpin) {
                        const { queueId: savedQueueId, timestamp, screenNumber } = JSON.parse(savedSpin);

                        // Validar que sea reciente (< 10 minutos)
                        const ageMinutes = (Date.now() - timestamp) / 1000 / 60;
                        if (ageMinutes < 10 && screenNumber === parseInt(id)) {
                            console.log("💾 Recovered queueId from localStorage:", savedQueueId);
                            useGameStore.getState().setQueueId(savedQueueId);
                            // Re-run check with recovered queueId
                            setTimeout(() => checkResult(isMounted), 100);
                            return;
                        } else {
                            // Expirado, limpiar
                            localStorage.removeItem(`spin_${id}_active`);
                        }
                    }
                } catch (e) {
                    console.warn("Could not recover from localStorage:", e);
                }
            }

            if (!effectiveQueueId) return;

            // 1. Fetch own queue record first (Session specific result)
            const { data: queueData, error: queueError } = await supabase
                .from('player_queue')
                .select('selected_animals, spin_result, status, package_code, player_name, player_emoji, is_revenge')
                .eq('id', effectiveQueueId)
                .maybeSingle();

            if (queueError) {
                console.error("Error fetching session result:", queueError);
                return;
            }

            if (queueData) {
                // RESTORE IDENTITY: Critical for anonymous users after reload
                if (queueData.player_name) {
                    useGameStore.getState().setIdentity(queueData.player_name, queueData.player_emoji || '😎');
                }

                setIsRevenge(!!queueData.is_revenge);

                const effectiveSelections = (queueData.selected_animals as number[]) || selectedAnimals;
                if (effectiveSelections.length > 0 && isMounted) {
                    setDbSelections(effectiveSelections);
                }
                if (queueData.package_code && isMounted) {
                    setTicketCode(queueData.package_code);
                }
            }

            // 2. Fetch global screen state (REQUIRED for sync)
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('last_spin_result, status')
                .eq('screen_number', parseInt(id))
                .maybeSingle();

            // 3. PRIORITY CHECK: If screen is spinning OR player status is playing, WAIT.
            // LOOSENED: If store already says 'result' (globalStatus), we allow transition.
            const isSpinning = screenData?.status === 'spinning' || queueData?.status === 'playing';
            const isCompleted = queueData?.status === 'completed' || screenData?.status === 'showing_result' || globalStatus === 'result';

            if (isSpinning && !isCompleted) {
                if (isMounted) setStatus('loading');
                return;
            }

            if (queueData) {
                const effectiveSelections = (queueData.selected_animals as number[]) || selectedAnimals;

                // Determinamos el resultado efectivo. Si la BD no lo tiene aún, pero lo tenemos en el query param, lo usamos.
                let effectiveSpinResult = queueData.spin_result;
                if (effectiveSpinResult === null && resParam !== null) {
                    const resNum = parseInt(resParam);
                    if (!isNaN(resNum)) {
                        effectiveSpinResult = resNum;
                        console.log("🎯 Using spin result from query parameter as fallback:", resNum);
                    }
                }

                // Caso A: El resultado del giro aún no ha sido calculado por el servidor (esperando en cola)
                if (effectiveSpinResult === null) {
                    if (isMounted) setStatus('loading');

                    if (isSpinning) {
                        console.log("⏳ Spinning in progress, result not ready yet. Will retry...");
                        let retryCount = 0;
                        const maxRetries = 5;

                        const retryFetch = async () => {
                            while (retryCount < maxRetries && isMounted) {
                                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
                                retryCount++;

                                const { data: retryData } = await supabase
                                    .from('player_queue')
                                    .select('spin_result, status')
                                    .eq('id', effectiveQueueId)
                                    .maybeSingle();

                                if (retryData && retryData.spin_result !== null) {
                                    console.log(`✅ Result found on retry ${retryCount}:`, retryData.spin_result);
                                    const isWin = effectiveSelections.includes(retryData.spin_result!);
                                    if (isMounted) setStatus(isWin ? 'winning' : 'losing');

                                    // Limpiar localStorage
                                    try {
                                        localStorage.removeItem(`spin_${id}_active`);
                                    } catch (e) { }
                                    return;
                                }

                                console.log(`🔄 Retry ${retryCount}/${maxRetries}: Still no result...`);
                            }

                            if (isMounted && retryCount >= maxRetries) {
                                console.error("❌ Max retries reached. Result not found.");
                                // Stay in loading state - user can refresh
                            }
                        };

                        retryFetch();
                    }
                    return;
                }

                // Caso B: El resultado ya está calculado, pero la ruleta en la TV aún está girando visualmente
                // Nota: Si usamos resParam, asumimos que el giro ya terminó porque el broadcast nos redirigió
                if (!isCompleted && queueData.spin_result === null) {
                    if (isMounted) setStatus('loading');
                    return;
                }

                // Caso C: El resultado está calculado y la ruleta ya terminó de girar en la TV (giro completado)
                const isWin = effectiveSelections.includes(effectiveSpinResult);
                if (isMounted) setStatus(isWin ? 'winning' : 'losing');

                // Limpiar localStorage ya que tenemos el resultado
                try {
                    localStorage.removeItem(`spin_${id}_active`);
                    console.log("🧹 Cleaned localStorage after successful result");
                } catch (e) {
                    console.warn("Could not clean localStorage:", e);
                }

                return;
            }

            // 5. Fallback for idle/result transition (Only reached if queueData is null)
            if (screenData) {
                if (screenData.last_spin_result !== null && (screenData.status === 'showing_result' || screenData.status === 'result')) {
                    const selections = dbSelections.length > 0 ? dbSelections : selectedAnimals;
                    if (selections.length > 0) {
                        const isWin = selections.includes(screenData.last_spin_result);
                        if (isMounted) setStatus(isWin ? 'winning' : 'losing');
                    }
                }
            }
        } catch (err) {
            console.error("Unexpected error in checkResult:", err);
        }
    }, [id, queueId, effectiveQueueId, supabase, selectedAnimals, dbSelections, globalStatus, resParam]);

    const checkResultRef = React.useRef(checkResult);
    useEffect(() => {
        checkResultRef.current = checkResult;
    }, [checkResult]);

    // 2. Realtime Subscriptions
    useEffect(() => {
        let isMounted = true;
        
        // Execute initial check safely via ref
        if (checkResultRef.current) {
            checkResultRef.current(isMounted);
        }

        if (!effectiveQueueId) return;

        console.log("🔌 Subscribing to player_result channel for queueId:", effectiveQueueId);

        // 2. Realtime Subscription for OUR OWN record
        const channel = supabase
            .channel(`player_result_${effectiveQueueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'player_queue',
                    filter: `id=eq.${effectiveQueueId}`
                },
                (payload) => {
                    console.log("📨 Queue Update Packet:", payload);
                    if (isMounted) {
                        const newResult = payload.new.spin_result;
                        if (newResult !== null) {
                            const selections = (payload.new.selected_animals as number[]) || dbSelectionsRef.current || selectedAnimalsRef.current;
                            const isWin = selections.includes(newResult);
                            setIsRevenge(!!payload.new.is_revenge);
                            setStatus(isWin ? 'winning' : 'losing');
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`🔌 Channel status for player_result_${effectiveQueueId}:`, status);
            });

        console.log("🔌 Subscribing to display broadcast channel screen_", id);
        // 3. SECONARY SYNC: Listen for Broadcast from Display (Instant)
        const displayChannel = supabase.channel(`screen_${id}`);
        displayChannel
            .on('broadcast', { event: 'spin_finished' }, ({ payload }) => {
                console.log("⚡ Instant Broadcast received:", payload);
                if (isMounted && payload.result !== null) {
                    const selections = dbSelectionsRef.current.length > 0 ? dbSelectionsRef.current : selectedAnimalsRef.current;
                    if (selections.length > 0) {
                        const isWin = selections.includes(payload.result);
                        setStatus(isWin ? 'winning' : 'losing');
                    } else {
                        console.warn("⚠️ Broadcast received but selections are empty!");
                    }
                }
            })
            .subscribe((status) => {
                console.log(`🔌 Channel status for screen_${id}:`, status);
            });

        return () => {
            console.log("🔌 Cleaning up channel subscriptions for queueId:", effectiveQueueId);
            isMounted = false;
            supabase.removeChannel(channel);
            supabase.removeChannel(displayChannel);
        };
    }, [id, effectiveQueueId, supabase]);

    // Check for package tracking and auto-rejoin
    useEffect(() => {
        // Fix: Do NOT auto-rejoin if winning. Winning = Stops flow to claim prize.
        if (status !== 'winning' && status !== 'losing') return;

        const checkPackageStatus = async () => {
            // Load package info from localStorage
            const stored = localStorage.getItem('current_package');
            if (!stored) return;

            try {
                const data = JSON.parse(stored);

                // Query package_tracking to get current status
                const { data: packageData, error } = await supabase
                    .from('package_tracking')
                    .select('total_spins, spins_consumed')
                    .eq('id', data.packageId)
                    .single();

                if (error || !packageData) {
                    console.error('Error fetching package:', error);
                    return;
                }

                const spinsRemaining = packageData.total_spins - packageData.spins_consumed;

                if (spinsRemaining > 0) {
                    console.log(`📦 Package has ${spinsRemaining} spins remaining`);

                    setPackageInfo({
                        packageId: data.packageId,
                        spinNumber: packageData.spins_consumed + 1,
                        totalSpins: packageData.total_spins,
                        spinsRemaining,
                        code: data.code
                    });

                    // Only auto-rejoin on LOSS. On WIN, we stay to claim prize.
                    // ALSO: Don't auto-rejoin if they can play RPS (not revenge yet, and not played RPS yet)
                    if (status === 'losing') {
                        if (!isRevenge && !hasPlayedRps) {
                            console.log("✋ Delaying auto-rejoin because RPS option is available.");
                        } else {
                            setStatus('auto_rejoin');
                        }
                    }
                } else {
                    // Package complete, clear localStorage
                    localStorage.removeItem('current_package');
                }
            } catch (e) {
                console.error('Error parsing package info:', e);
            }
        };

        // Wait 3 seconds before checking (let user see result)
        const timer = setTimeout(checkPackageStatus, 3000);
        return () => clearTimeout(timer);
    }, [status, supabase, isRevenge, hasPlayedRps]);

    // Auto-rejoin countdown
    useEffect(() => {
        if (status !== 'auto_rejoin') return;

        // PAUSE COUNTDOWN if screen is busy
        if (isScreenBusy) return;

        if (autoRejoinCountdown === 0) {
            handleAutoRejoin();
            return;
        }

        const timer = setTimeout(() => {
            setAutoRejoinCountdown(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [status, autoRejoinCountdown, isScreenBusy]);

    const handleAutoRejoin = async () => {
        if (!packageInfo || isScreenBusy) return;

        console.log('🔄 Auto-rejoining queue...');

        try {
            const deviceFingerprint = getDeviceFingerprint();

            // Call RPC to continue package
            const { data, error } = await supabase.rpc('redeem_or_continue_package', {
                p_code: packageInfo.code,
                p_device_fingerprint: deviceFingerprint,
                p_screen_number: parseInt(id),
                p_player_name: useGameStore.getState().nickname,
                p_player_emoji: useGameStore.getState().emoji,
                p_player_id: user?.id || null
            });

            if (error || !data?.success) {
                console.error('Error continuing package:', error);
                return;
            }

            // Update package info in localStorage
            localStorage.setItem('current_package', JSON.stringify({
                packageId: data.package_id,
                spinNumber: data.spin_number,
                totalSpins: data.total_spins,
                code: packageInfo.code
            }));

            // CORRECTED LOGIC: Prioritize Auth Identity over potentially empty Store
            const authName = user?.user_metadata?.full_name || profile?.display_name;
            const authEmoji = user?.user_metadata?.emoji || '😎'; // Fallback if no specific emoji field

            const nameToUse = authName || useGameStore.getState().nickname;
            const emojiToUse = authEmoji || useGameStore.getState().emoji;

            // Enforce identity update in store
            useGameStore.getState().setIdentity(nameToUse, emojiToUse);

            // NUEVO: Limpiar queueId anterior para permitir nueva entrada
            console.log("🔄 Limpiando queueId anterior antes de auto-rejoin");
            useGameStore.getState().setQueueId(null);

            // Create new queue entry
            const activeWheelId = useGameStore.getState().activeWheelId;
            const { data: queueData, error: queueError } = await supabase
                .from('player_queue')
                .insert({
                    screen_number: parseInt(id),
                    player_name: nameToUse,
                    player_emoji: emojiToUse,
                    player_id: user?.id || null,
                    status: 'selecting',
                    selected_wheel_id: activeWheelId || null,
                    package_code: packageInfo.code,
                    package_tracking_id: data.package_id,
                    spin_number: data.spin_number,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (queueData && !queueError) {
                console.log('✅ Auto-rejoin successful:', queueData.id);
                useGameStore.getState().setQueueId(queueData.id);
                useGameStore.getState().setSelectedAnimals([]);
                router.push(`/individual/screen/${id}/select`);
            } else {
                console.error('❌ Queue create error:', queueError);
            }
        } catch (err) {
            console.error('Auto-rejoin error:', err);
        }
    };

    const handlePlayAgain = () => {
        if (isScreenBusy) return;

        // Clear selected animals for a fresh start
        useGameStore.getState().setSelectedAnimals([]);
        // Clear queueId to start a new session
        useGameStore.getState().setQueueId(null);
        // Return to entry page
        router.push(`/individual/screen/${id}`);
    };

    const displayName = profile?.display_name || nickname || 'Jugador';
    const displayEmoji = profile?.avatar_url || emoji || '😎';

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col pwa-mode">
            {/* Navigation Header */}
            <div className="bg-black/20 backdrop-blur-md border-b border-white/5 px-4 py-2 flex justify-between items-center z-50 sticky top-0">
                <div className="flex items-center gap-2">
                    {displayEmoji.startsWith('http') ? (
                        <img src={displayEmoji} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white/20" />
                    ) : (
                        <span className="text-xl">{displayEmoji}</span>
                    )}
                    <span className="font-black text-xs uppercase tracking-tight">{displayName}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4">
                {status === 'loading' && (
                    <div className="text-center animate-pulse flex flex-col items-center">
                        <div className="text-6xl mb-4 animate-spin">🎲</div>
                        <h1 className="text-2xl font-bold text-white mb-2">Girando...</h1>
                        <p className="text-gray-400 mb-8">¡Buena Suerte!</p>

                        {/* RESET BUTTON (Visible after 10s of loading) */}
                        <div className="mt-8 opacity-0 animate-in fade-in duration-1000 delay-[10000ms]">
                            <p className="text-xs text-gray-500 mb-4">Si la ruleta se detuvo y no ves el resultado:</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="text-xs font-bold text-yellow-500 underline uppercase tracking-widest"
                            >
                                Refrescar Pantalla
                            </button>
                        </div>
                    </div>
                )}

                {status === 'winning' && (
                    <div className="text-center animate-in zoom-in duration-500 max-w-sm w-full">
                        <div className="text-6xl mb-4 animate-bounce">🎉</div>
                        <h1 className="text-4xl font-bold text-yellow-400 mb-2">¡GANASTE!</h1>
                        <p className="text-xl mb-4">La ruleta cayó en tu elección</p>

                        {!isSaved ? (
                            <div className="bg-gray-800/80 backdrop-blur-md p-6 rounded-2xl border border-yellow-500/30 mb-6 shadow-xl">
                                <h3 className="text-lg font-bold text-yellow-500 mb-2">🎁 Asegura tu Premio</h3>
                                <p className="text-xs text-gray-400 mb-6">Inicia sesión para registrar este premio en tu historial y participar en sorteos especiales.</p>

                                <button
                                    onClick={signInWithGoogle}
                                    disabled={isSaving}
                                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                                >
                                    <span className="text-xl">
                                        <svg width="24" height="24" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                    </span>
                                    INICIAR CON GOOGLE
                                </button>
                            </div>
                        ) : (
                            <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl mb-6 flex items-center gap-3 animate-in fade-in">
                                <span className="text-2xl">✅</span>
                                <div className="text-left">
                                    <p className="font-bold text-green-400 text-sm">¡Premio Registrado!</p>
                                    <p className="text-[10px] text-green-300">Vinculado a {user?.email || 'tu cuenta'}</p>
                                </div>
                            </div>
                        )}


                        <div className="bg-white text-gray-900 p-6 rounded-xl mb-6 transform rotate-2 shadow-2xl border-4 border-yellow-400 flex flex-col justify-center">
                            <p className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-1">CÓDIGO DE CANJE</p>
                            <p className="text-3xl font-black text-green-600 tracking-tighter leading-tight">
                                {isRevenge ? 'PREMIO NIVEL 2' : 'PREMIO NIVEL 1'}
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl transform -rotate-1">
                            <QRCodeCanvas
                                value={`${(baseUrl || window.location.origin).trim()}/staff/validate/${ticketCode || queueId?.slice(0, 8)}`}
                                size={180}
                                level="H"
                                includeMargin={false}
                                className="rounded-lg"
                            />
                            <p className="mt-2 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">QR VÁLIDO EN MESÓN</p>
                        </div>

                        <div className="mt-8 flex flex-col gap-4">
                            {packageInfo && packageInfo.spinsRemaining > 0 ? (
                                <button
                                    onClick={handleAutoRejoin}
                                    disabled={isScreenBusy}
                                    className={`bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95 animate-pulse disabled:opacity-50 disabled:grayscale disabled:animate-none`}
                                >
                                    {isScreenBusy ? 'Esperando ruleta...' : `Sig. Giro (${packageInfo.spinsRemaining})`}
                                </button>
                            ) : (
                                <button
                                    onClick={handlePlayAgain}
                                    disabled={isScreenBusy}
                                    className={`bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:grayscale`}
                                >
                                    {isScreenBusy ? 'Esperando ruleta...' : 'Jugar de Nuevo'}
                                </button>
                            )}

                            {isSaved && (
                                <Link href="/individual/prizes" className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full font-bold shadow-lg text-center transition-all">
                                    Ver Mi Historial de Premios
                                </Link>
                            )}
                            <p className="text-xs text-gray-500">Muestra esta pantalla al staff para cobrar</p>
                        </div>
                    </div>
                )}

                {status === 'losing' && rpsPlaying && renderRpsGame()}

                {status === 'losing' && !rpsPlaying && (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-500 max-w-sm w-full">
                        <div className="text-6xl mb-4 grayscale opacity-50">😢</div>
                        <h1 className="text-3xl font-bold text-gray-300 mb-2">¡Casi!</h1>
                        <p className="text-xl mb-8 text-gray-400">Hoy no fue tu día de suerte.</p>

                        {!isRevenge && !hasPlayedRps && (
                            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 p-6 rounded-2xl mb-6 shadow-lg animate-in zoom-in duration-300">
                                <h3 className="text-lg font-black text-orange-400 mb-1 flex items-center justify-center gap-2">🔥 ¿Quieres una Revancha?</h3>
                                <p className="text-xs text-gray-300 mb-4 font-medium leading-relaxed">
                                    ¡Juega a Piedra, Papel o Tijera contra la ruleta! Si ganas, obtienes un giro gratis para jugar por un Premio Nivel 2 (Consuelo).
                                </p>
                                <button
                                    onClick={() => setRpsPlaying(true)}
                                    className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all transform active:scale-95 shadow-md shadow-orange-500/20"
                                >
                                    ¡Jugar Revancha! ✊✋✌️
                                </button>
                            </div>
                        )}

                        <div className="bg-gray-800 p-8 rounded-2xl mb-8 border border-gray-700">
                            <p className="text-gray-400 italic">"El que la sigue la consigue"</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={handlePlayAgain}
                                disabled={isScreenBusy}
                                className={`w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:grayscale`}
                            >
                                {isScreenBusy ? 'Esperando ruleta...' : 'Intentar de Nuevo'}
                            </button>

                            {isIdentified && (
                                <Link href="/individual/prizes" className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-full font-bold shadow-lg text-center transition-all">
                                    Ver Mi Historial
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {status === 'auto_rejoin' && packageInfo && (
                    <div className="text-center animate-in fade-in zoom-in duration-500 max-w-sm w-full">
                        <div className="text-6xl mb-4">🎯</div>
                        <h1 className="text-3xl font-bold text-purple-400 mb-2">¡Tienes más giros!</h1>
                        <p className="text-xl mb-4 text-gray-300">
                            Te quedan <span className="text-yellow-400 font-bold">{packageInfo.spinsRemaining}</span> giros
                        </p>

                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-2xl mb-6 shadow-2xl">
                            <p className="text-white/80 text-sm mb-2">Próximo giro</p>
                            <p className="text-white text-3xl font-bold">
                                {packageInfo.spinNumber} de {packageInfo.totalSpins}
                            </p>
                        </div>

                        <div className="bg-gray-800/80 backdrop-blur-md p-6 rounded-2xl border border-purple-500/30 mb-6">
                            <p className="text-gray-300 mb-4">
                                {isScreenBusy ? 'Esperando a que la ruleta se libere...' : 'Preparando tu siguiente giro...'}
                            </p>
                            {!isScreenBusy && (
                                <div className="text-5xl font-bold text-purple-400">
                                    {autoRejoinCountdown}
                                </div>
                            )}
                            {isScreenBusy && (
                                <div className="text-xl font-bold text-yellow-400 animate-pulse">
                                    ⏳
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleAutoRejoin}
                            disabled={isScreenBusy}
                            className={`w-full bg-purple-500 hover:bg-purple-600 text-white py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:grayscale`}
                        >
                            {isScreenBusy ? 'Esperando...' : 'Continuar Ahora'}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
