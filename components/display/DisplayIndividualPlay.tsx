'use client';

import { useState, useEffect, useRef } from 'react';
import WheelCanvas from '@/components/individual/WheelCanvas';
import BigWinOverlay from '@/components/individual/BigWinOverlay';
import Confetti from 'react-confetti';
import QueueList from '@/components/individual/QueueList';
import { QRCodeCanvas } from 'qrcode.react';
import { useGameStore } from '@/lib/store/gameStore';
import Image from 'next/image';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';

interface DisplayIndividualPlayProps {
    screen: string;
    screenIdNum: number;
    baseUrl: string;
    supabase: any;
}

export default function DisplayIndividualPlay({
    screen,
    screenIdNum,
    baseUrl,
    supabase
}: DisplayIndividualPlayProps) {
    // 0. Sincronizar en tiempo real el juego individual
    useRealtimeGame(screen);

    // 1. Store state variables
    const mode = useGameStore((state) => state.gameMode);
    const activeWheelId = useGameStore((state) => state.activeWheelId);
    const realNickname = useGameStore(state => state.nickname);
    const realEmoji = useGameStore(state => state.emoji);
    const currentQueueId = useGameStore(state => state.currentQueueId);
    const isDemo = useGameStore(state => state.isDemo);
    const storeStatus = useGameStore(s => s.status);
    const idleSpeed = useGameStore(s => s.idleSpeed);

    const MARIO_WHEEL_ID = 'a4b68bf3-78e6-4a16-9957-5d357dbd1d8a';
    const effectiveActiveWheelId = activeWheelId || MARIO_WHEEL_ID;

    // Local visual states
    const [status, setStatus] = useState<'idle' | 'spinning' | 'result'>('idle');
    const [result, setResult] = useState<number | null>(null);
    const [lastSpins, setLastSpins] = useState<any[]>([]);
    const [activeWheelAssets, setActiveWheelAssets] = useState<any>(null);
    const [assetsLoading, setAssetsLoading] = useState<boolean>(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBigWin, setShowBigWin] = useState(false);
    const [currentSelections, setCurrentSelections] = useState<number[]>([]);
    const [isWin, setIsWin] = useState(false);
    const [clientUrl, setClientUrl] = useState<string>('');

    // Pre-selection preview from mobile
    const [previewPlayer, setPreviewPlayer] = useState<{
        nickname: string;
        emoji: string;
        selections: number[];
    } | null>(null);

    useEffect(() => {
        setClientUrl(window.location.origin);
    }, []);

    // 2. Fetch Assets for dynamic individual wheels
    useEffect(() => {
        async function loadWheelAssets() {
            setAssetsLoading(true);
            const loadStartTime = Date.now();

            const loadingFailsafe = setTimeout(() => {
                setAssetsLoading(prev => {
                    if (prev) {
                        console.warn(`⏳ [Assets] Failsafe triggered for Screen ${screenIdNum} after 10s`);
                        return false;
                    }
                    return prev;
                });
            }, 10000);

            try {
                if (!effectiveActiveWheelId) {
                    console.warn("🎨 [Assets] Individual Mode but no effectiveActiveWheelId.");
                    setActiveWheelAssets(null);
                    return;
                }

                console.log(`🎨 [Assets] Fetching for ID: ${effectiveActiveWheelId}`);
                
                try {
                    const { data: wheel, error: wheelError } = await supabase
                        .from('individual_wheels')
                        .select('storage_path, segment_count, background_image')
                        .eq('id', effectiveActiveWheelId)
                        .single();

                    if (wheelError) throw wheelError;

                    const { data: dbSegments, error: segmentError } = await supabase
                        .from('individual_wheel_segments')
                        .select('position, name, segment_image, selector_image, color')
                        .eq('wheel_id', effectiveActiveWheelId)
                        .order('position', { ascending: true });

                    if (segmentError) throw segmentError;

                    if (wheel) {
                        const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;

                        const getFullUrl = (path: string | null) => {
                            if (!path) return null;
                            return path.startsWith('http') ? path : `${STORAGE_BASE}/${path}`;
                        };

                        const segments = dbSegments.map((s: any) => ({
                            id: s.position,
                            label: s.name,
                            color: s.color || 'transparent',
                            imageWheel: getFullUrl(s.segment_image),
                            imageResult: getFullUrl(s.selector_image)
                        }));

                        setActiveWheelAssets({
                            background: getFullUrl(wheel.background_image) || '',
                            segments: segments
                        });
                    }
                } catch (err: any) {
                    console.error("❌ Failed to load wheel assets, falling back to Mario:", err);
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
                }
            } catch (err: any) {
                console.error("❌ Failed to load wheel assets top level:", err);
                setActiveWheelAssets(null);
            } finally {
                clearTimeout(loadingFailsafe);
                setAssetsLoading(false);
                console.log(`🎨 [Assets] Load finished for Screen ${screenIdNum} in ${Date.now() - loadStartTime}ms`);
            }
        }
        loadWheelAssets();
    }, [effectiveActiveWheelId, screenIdNum, supabase]);

    // 3. Sincronizar el estado del giro local cuando el Store cambia
    useEffect(() => {
        if ((storeStatus === 'spinning' || storeStatus === 'result') && status === 'idle') {
            console.log('📱 Mobile Spin triggered - Server Authority Mode');
            setStatus('spinning');
            setResult(null);

            const storeResult = useGameStore.getState().lastSpinResult;

            if (storeResult !== null) {
                console.log("📥 Instant Result from Store:", storeResult);
                setResult(storeResult);
            } else {
                const fetchResult = async () => {
                    const { data, error } = await supabase
                        .from('screen_state')
                        .select('last_spin_result')
                        .eq('screen_number', screenIdNum)
                        .single();

                    if (!error && data && data.last_spin_result !== null) {
                        setResult(data.last_spin_result);
                    } else {
                        // Watchdog de respaldo
                        const watchdog = setTimeout(() => {
                            const currentStatus = useGameStore.getState().status;
                            if (currentStatus === 'spinning') {
                                setStatus('idle');
                            }
                        }, 15000);

                        // Reintentar en 1s
                        setTimeout(async () => {
                            try {
                                const { data: retryData } = await supabase
                                    .from('screen_state')
                                    .select('last_spin_result')
                                    .eq('screen_number', screenIdNum)
                                    .single();

                                if (retryData && retryData.last_spin_result !== null) {
                                    setResult(retryData.last_spin_result);
                                }
                            } catch (e) {}
                        }, 1000);

                        return () => clearTimeout(watchdog);
                    }
                };
                fetchResult();
            }
        }
        else if (storeStatus === 'idle' && status !== 'idle') {
            setStatus('idle');
            setResult(null);
            setShowConfetti(false);
            setShowBigWin(false);
        }
    }, [storeStatus, status, screenIdNum, supabase]);

    // 4. Escuchar pre-selecciones en tiempo real (Preview de los animales elegidos por el móvil)
    useEffect(() => {
        const channel = supabase.channel(`screen_${screenIdNum}`);
        channel.on(
            'broadcast',
            { event: 'preview_update' },
            (payload: any) => {
                setPreviewPlayer(payload.payload);

                // Limpiar preselección tras 30s de inactividad
                const timer = setTimeout(() => {
                    setPreviewPlayer(null);
                }, 30000);
                return () => clearTimeout(timer);
            }
        ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase]);

    // 5. Cargar selecciones activas del jugador actual de la cola
    useEffect(() => {
        if (status === 'idle' && !realNickname && previewPlayer) {
            setCurrentSelections(previewPlayer.selections);
            return;
        }

        if (status === 'idle' && !realNickname) {
            setCurrentSelections([]);
            return;
        }

        async function fetchSelections() {
            if (status === 'idle') return;

            try {
                const { data, error } = await supabase
                    .from('player_queue')
                    .select('selected_animals')
                    .eq('screen_number', screenIdNum)
                    .eq('status', 'playing')
                    .maybeSingle();

                if (!error && data?.selected_animals) {
                    setCurrentSelections(data.selected_animals as number[]);
                } else {
                    setCurrentSelections([]);
                    // Reintento rápido por si hay retraso
                    if (realNickname) {
                        setTimeout(async () => {
                            const { data: retry } = await supabase
                                .from('player_queue')
                                .select('selected_animals')
                                .eq('screen_number', screenIdNum)
                                .eq('status', 'playing')
                                .maybeSingle();
                            if (retry?.selected_animals) {
                                setCurrentSelections(retry.selected_animals as number[]);
                            }
                        }, 2000);
                    }
                }
            } catch (err) {
                console.error("Exception in fetchSelections:", err);
            }
        }
        fetchSelections();
    }, [screenIdNum, status, realNickname, previewPlayer]);

    // 6. Cargar el historial de los últimos 9 giros
    useEffect(() => {
        async function fetchHistory() {
            let query = supabase
                .from('game_history')
                .select('*')
                .eq('screen_id', screenIdNum)
                .order('created_at', { ascending: false })
                .limit(9);

            if (effectiveActiveWheelId) {
                query = query.eq('wheel_id', effectiveActiveWheelId);
            }

            const { data } = await query;
            if (data) {
                setLastSpins(data);
            }
        }
        fetchHistory();
    }, [screenIdNum, effectiveActiveWheelId, supabase]);

    // 7. Watchdog automático para avanzar la cola si la pantalla se queda pegada
    useEffect(() => {
        const checkPromotion = async () => {
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('status, updated_at, current_queue_id')
                .eq('screen_number', screenIdNum)
                .single();

            if (screenData?.status === 'idle') {
                const { count } = await supabase
                    .from('player_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('screen_number', screenIdNum)
                    .eq('status', 'waiting');

                if (count && count > 0) {
                    await supabase.rpc('promote_next_player', {
                        p_screen_number: screenIdNum
                    });
                }
            }
            else if (screenData?.status === 'waiting_for_spin') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const diffSeconds = (new Date().getTime() - lastUpdate) / 1000;

                if (diffSeconds > 60) {
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: screenIdNum,
                        p_expected_queue_id: screenData.current_queue_id
                    });
                }
            }
            else if (screenData?.status === 'selecting') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const diffSeconds = (new Date().getTime() - lastUpdate) / 1000;

                if (diffSeconds > 120) {
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: screenIdNum,
                        p_expected_queue_id: screenData.current_queue_id
                    });
                }
            }
        };

        const interval = setInterval(checkPromotion, 5000);
        return () => clearInterval(interval);
    }, [screenIdNum, supabase]);

    // 8. Evento del Teclado debug 'q' para tests rápidos locales
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'q' || e.key === 'Q') {
                if (status === 'idle') {
                    setStatus('spinning');
                    setResult(null);
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

    // 9. Completar el giro local e individual
    const handleSpinComplete = async (winnerIndex: number) => {
        console.log(`🎰 Spin Complete! isDemo=${isDemo}, Index=${winnerIndex}`);

        setResult(winnerIndex);
        setStatus('result');
        setShowBigWin(true);

        supabase.channel(`screen_${screenIdNum}`).send({
            type: 'broadcast',
            event: 'spin_finished',
            payload: { result: winnerIndex }
        });

        try {
            let playerWon = false;

            const { data: activePlayer } = await supabase
                .from('player_queue')
                .select('selected_animals')
                .eq('screen_number', screenIdNum)
                .eq('status', 'playing')
                .maybeSingle();

            if (activePlayer && activePlayer.selected_animals) {
                const selection = activePlayer.selected_animals as number[];
                if (selection.includes(winnerIndex)) {
                    playerWon = true;
                }
            } else if (isDemo) {
                playerWon = true;
            }

            setIsWin(playerWon);

            if (playerWon) {
                setShowConfetti(true);
            }

            // Llamar al RPC del servidor para cerrar el giro individual
            const { error: finishError } = await supabase.rpc('complete_spin_and_check_package', {
                p_screen_number: screenIdNum,
                p_result_index: winnerIndex
            });

            if (finishError) console.error("Error finishing spin cycle:", finishError);

            if (!isDemo) {
                const historyEntry = {
                    screen_id: screenIdNum,
                    wheel_id: effectiveActiveWheelId || null,
                    result_index: winnerIndex,
                    player_name: realNickname || 'Anon',
                    created_at: new Date().toISOString()
                };
                await supabase.from('game_history').insert([historyEntry]);
                setLastSpins(prev => [historyEntry, ...prev].slice(0, 9));
            } else {
                setTimeout(async () => {
                    await supabase
                        .from('screen_state')
                        .update({
                            status: 'idle',
                            player_id: null,
                            player_name: null,
                            player_emoji: null,
                            current_queue_id: null,
                            is_demo: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('screen_number', screenIdNum);
                }, 5000);
            }

            if (!isDemo) {
                setTimeout(async () => {
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: screenIdNum,
                        p_expected_queue_id: currentQueueId
                    });
                }, 10000);
            }

        } catch (err) {
            console.error("Critical error in spin complete logic:", err);
        }
    };

    const displayNickname = (status === 'idle' && !realNickname && previewPlayer) ? previewPlayer.nickname : realNickname;
    const displayEmoji = (status === 'idle' && !realNickname && previewPlayer) ? previewPlayer.emoji : realEmoji;
    const isFanMode = assetsLoading || (activeWheelAssets?.segments?.length ? activeWheelAssets.segments.length <= 20 : true);

    return (
        <div className="w-screen h-screen min-h-screen bg-gray-900 overflow-hidden relative font-sans animate-in fade-in duration-300">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                {activeWheelAssets?.background && (
                    <Image
                        src={activeWheelAssets.background}
                        alt="Background"
                        fill
                        className="object-cover opacity-100"
                        priority
                    />
                )}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Zona de Juego y UI */}
            <div className="absolute inset-0 flex items-start justify-center z-10 pt-0">
                {/* Info del jugador y cola (Esquina superior izquierda) */}
                <div className="absolute top-[3vh] left-[3vh] z-40 flex flex-col gap-[1.5vh] items-start max-w-[40%]">
                    <div className="bg-white/10 backdrop-blur-md px-[1.5vw] py-[1vh] rounded-[2vh] border border-white/20 flex items-center gap-[1.5vw] shadow-lg">
                        <div className="flex items-center justify-center bg-black/40 backdrop-blur-md w-[6.5vh] h-[6.5vh] rounded-xl border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] flex-none">
                            <span className="text-[4.5vh] font-black text-green-400 animate-pulse drop-shadow-[0_0_8px_rgba(74,222,128,0.6)] select-none leading-none">
                                {screen}
                            </span>
                        </div>

                        {displayNickname && (status !== 'idle' || previewPlayer) && (
                            <div className="border-l border-white/20 pl-[1.5vw] animate-in fade-in slide-in-from-left-4 duration-500 text-left">
                                <p className="text-[1vh] text-gray-400 uppercase tracking-widest leading-none mb-[0.5vh]">
                                    {previewPlayer && status === 'idle' && !realNickname ? 'Preparando...' : 'Jugando ahora'}
                                </p>
                                <div className="flex items-center gap-[0.5vw]">
                                    {displayEmoji?.startsWith('http') ? (
                                        <img src={displayEmoji} alt="P" className="w-[4.5vh] h-[4.5vh] rounded-full border border-white/20 object-cover shadow-lg" />
                                    ) : (
                                        <span className="text-[2.5vh]">{displayEmoji}</span>
                                    )}
                                    <span className="text-[2.2vh] font-bold text-yellow-400">{displayNickname}</span>
                                </div>
                            </div>
                        )}

                        {currentSelections.length > 0 && (
                            <div className="flex items-center gap-[0.5vw] border-l border-white/20 pl-[1.5vw] animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
                                <div className="flex -space-x-[1.2vh]">
                                    {currentSelections.map((selId, idx) => {
                                        let imgSrc = null;
                                        if (activeWheelAssets?.segments) {
                                            const seg = activeWheelAssets.segments.find((s: any) => s.id === selId);
                                            if (seg) imgSrc = seg.imageResult || seg.imageWheel;
                                        }
                                        if (!imgSrc) {
                                            const animal = ANIMAL_LIST.find(a => a.id === selId);
                                            if (animal) imgSrc = animal.imageSelector || animal.imageWheel;
                                        }

                                        return (
                                            <div key={idx} className="w-[4.5vh] h-[4.5vh] rounded-full border-2 border-gray-800 bg-gray-700 relative overflow-hidden shadow-lg">
                                                {imgSrc ? (
                                                    <Image src={imgSrc} alt="Choice" fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[1.2vh] font-bold text-white">{selId}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <span className="text-[0.9vh] text-gray-400 font-mono tracking-tighter leading-tight">APUESTA<br />ACTIVA</span>
                            </div>
                        )}
                    </div>

                    <QueueList screenId={screenIdNum} assets={activeWheelAssets} />
                </div>

                {/* Ruleta */}
                <div className={`relative w-full transition-all duration-500 flex items-start justify-center
                    ${isFanMode ? 'aspect-[2/1] overflow-hidden' : 'aspect-square items-center'}
                    ${assetsLoading ? 'opacity-0' : 'opacity-100'}
                `}>
                    <div className="relative w-full aspect-square">
                        <WheelCanvas
                            isSpinning={status === 'spinning'}
                            isIdle={status === 'idle'}
                            idleSpeed={idleSpeed || 4.0}
                            targetIndex={result}
                            onSpinComplete={handleSpinComplete}
                            segments={activeWheelAssets?.segments}
                            className="w-full h-full"
                        />
                    </div>

                    {!isFanMode && (
                        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-0 h-0 border-t-[1.8vh] border-t-transparent border-l-[3.6vh] border-l-red-600 border-b-[1.8vh] border-b-transparent filter drop-shadow-lg z-20"></div>
                    )}
                </div>
            </div>

            {/* QR Lateral e Historial de Giros */}
            <div className={`absolute right-0 top-0 h-full bg-slate-950/90 backdrop-blur-lg border-l border-white/10 p-[3vh] px-[2vw] flex flex-col items-center justify-start text-center transition-all duration-700 ease-in-out z-50 overflow-hidden
                ${status === 'spinning' 
                    ? 'w-0 min-w-0 max-w-0 opacity-0 border-l-transparent pointer-events-none translate-x-full' 
                    : 'w-[22vw] min-w-[260px] max-w-[340px] opacity-100 translate-x-0'
                }`}
            >
                <div className="flex flex-col items-center flex-none">
                    <h3 className="text-[3vh] font-black text-white leading-tight mb-[0.5vh] tracking-tight">¡Juega Ahora!</h3>
                    <p className="text-[2.2vh] text-indigo-400 font-extrabold mb-[0.2vh] uppercase tracking-wide">Escanea para unirte</p>
                    <p className="text-[1.5vh] text-gray-400 mb-[2vh]">Solo $1,000 por jugada</p>
                </div>

                <div className="bg-white p-[1.5vh] rounded-[2vh] shadow-2xl transform hover:scale-105 transition-all w-[18vh] h-[18vh] max-w-[85%] max-h-[180px] flex items-center justify-center aspect-square flex-none">
                    {clientUrl && (
                        <QRCodeCanvas
                            value={`${clientUrl}/individual/screen/${screen}`}
                            size={150}
                            level="H"
                            includeMargin={false}
                            className="w-full h-full rounded-[1vh]"
                        />
                    )}
                </div>

                <div className="flex-grow min-h-[3vh]" />

                {/* Historial de últimos 9 giros */}
                <div className="w-full max-w-[220px] flex-none">
                    <h4 className="text-[1.3vh] uppercase tracking-wider text-gray-500 mb-[1.5vh] border-b border-white/10 pb-[0.5vh] leading-none">Últimos 9</h4>
                    <div className="grid grid-cols-3 gap-[0.8vh]">
                        {[...lastSpins, ...Array(9)].slice(0, 9).map((spin, i) => {
                            let imageSrc = null;
                            if (spin && activeWheelAssets?.segments) {
                                const segment = activeWheelAssets.segments.find((s: any) => s.id === spin.result_index);
                                if (segment) imageSrc = segment.imageResult || segment.imageWheel;
                            }

                            return (
                                <div key={i} className="aspect-square bg-white/5 rounded-[0.8vh] border border-white/10 overflow-hidden relative flex items-center justify-center">
                                    {spin ? (
                                        imageSrc ? (
                                            <div className="w-full h-full relative">
                                                <Image
                                                    src={imageSrc}
                                                    alt="Res"
                                                    fill
                                                    className="object-contain p-[0.3vh]"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-[1.8vh] text-yellow-500 font-bold">#{spin.result_index}</span>
                                        )
                                    ) : (
                                        <div className="w-[0.5vh] h-[0.5vh] bg-white/10 rounded-full" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-grow min-h-[2vh]" />

                <div className="opacity-30 hover:opacity-100 transition-opacity text-[1.1vh] text-gray-500 text-left w-full pt-[1.5vh] leading-normal flex-none border-t border-white/5">
                    Mode: {mode} | Screen: {screenIdNum} <br />
                    Evt: Individual | St: {status}
                </div>
            </div>

            {/* Overlays de Victoria / Derrota */}
            <BigWinOverlay
                isVisible={showBigWin}
                resultIndex={result}
                assets={activeWheelAssets}
                playerName={realNickname}
                playerEmoji={realEmoji}
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

            {status === 'result' && (
                <div className="fixed bottom-0 left-0 w-full h-2 bg-gray-800 z-[9999]">
                    <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-red-500 origin-left"
                        style={{
                            animation: `progress-fill ${isDemo ? '5s' : '15s'} linear forwards`
                        }}
                    />
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes progress-fill {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}} />
        </div>
    );
}
