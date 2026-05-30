'use client';

import { useState, useEffect, useRef } from 'react';
import WheelCanvas from '@/components/individual/WheelCanvas';
import BigWinOverlay from '@/components/individual/BigWinOverlay';
import Confetti from 'react-confetti';
import { useGameStore } from '@/lib/store/gameStore';
import Image from 'next/image';

interface DisplayGroupRaffleWheelProps {
    screenIdNum: number;
    activeRaffleId: string | null;
    baseUrl: string;
    supabase: any;
}

export default function DisplayGroupRaffleWheel({
    screenIdNum,
    activeRaffleId,
    baseUrl,
    supabase
}: DisplayGroupRaffleWheelProps) {
    const setGameMode = useGameStore((state) => state.setGameMode);
    
    // Status local sincronizado del giro
    const [status, setStatus] = useState<'idle' | 'spinning' | 'result'>('idle');
    const [result, setResult] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBigWin, setShowBigWin] = useState(false);
    const [isWin, setIsWin] = useState(false);
    const [currentRaffle, setCurrentRaffle] = useState<{ code: string; name: string } | null>(null);
    const [activeWheelAssets, setActiveWheelAssets] = useState<any>(null);
    const [assetsLoading, setAssetsLoading] = useState<boolean>(false);

    const storeNickname = useGameStore((state) => state.nickname);
    const storeEmoji = useGameStore((state) => state.emoji);

    // 1. Cargar datos del sorteo activo
    useEffect(() => {
        if (!activeRaffleId) {
            setCurrentRaffle(null);
            return;
        }

        async function fetchCurrentRaffle() {
            try {
                const { data, error } = await supabase
                    .from('raffles')
                    .select('code, name')
                    .eq('id', activeRaffleId)
                    .maybeSingle();

                if (!error && data) {
                    setCurrentRaffle(data);
                }
            } catch (err) {
                console.error("Error al obtener datos del sorteo en display:", err);
            }
        }

        fetchCurrentRaffle();

        const channel = supabase
            .channel(`raffle_display_info_${activeRaffleId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'raffles',
                    filter: `id=eq.${activeRaffleId}`
                },
                (payload: any) => {
                    if (payload.new) {
                        setCurrentRaffle({
                            code: payload.new.code,
                            name: payload.new.name
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeRaffleId, supabase]);

    // 2. Definir e inicializar los 36 segmentos del sorteo grupal
    useEffect(() => {
        setAssetsLoading(true);
        const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;
        const segments = Array.from({ length: 36 }, (_, i) => {
            const num = i + 1;
            return {
                id: num,
                label: `${num}`,
                color: 'transparent',
                imageWheel: `${STORAGE_BASE}/group_sorteo/segments/${num}.png`,
                imageResult: `${STORAGE_BASE}/group_sorteo/selector/${num}.jpg`
            };
        });

        setActiveWheelAssets({
            background: `${STORAGE_BASE}/group_sorteo/background.jpg`,
            segments: segments
        });
        setAssetsLoading(false);
    }, []);

    // 3. Escuchar el estado de screen_state en Supabase para sincronizar giros
    useEffect(() => {
        const fetchInitialState = async () => {
            const { data, error } = await supabase
                .from('screen_state')
                .select('*')
                .eq('screen_number', screenIdNum)
                .single();

            if (!error && data) {
                if (data.status === 'spinning') {
                    setStatus('spinning');
                    setResult(data.last_spin_result);
                } else if (data.status === 'result') {
                    setStatus('result');
                    setResult(data.last_spin_result);
                } else {
                    setStatus('idle');
                    setResult(null);
                }
            }
        };

        fetchInitialState();

        const channel = supabase
            .channel(`screen_sorteo_${screenIdNum}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'screen_state',
                    filter: `screen_number=eq.${screenIdNum}`
                },
                (payload: any) => {
                    const newState = payload.new;
                    if (newState.status === 'spinning') {
                        setStatus('spinning');
                        setResult(newState.last_spin_result);
                        setShowBigWin(false);
                        setShowConfetti(false);
                    } else if (newState.status === 'result' || newState.status === 'showing_result') {
                        setStatus('result');
                        setResult(newState.last_spin_result);
                    } else if (newState.status === 'idle') {
                        setStatus('idle');
                        setResult(null);
                        setShowBigWin(false);
                        setShowConfetti(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase]);

    // 4. Procesar el final del giro de la ruleta
    const handleSpinComplete = async (winnerIndex: number) => {
        console.log(`🎰 Sorteo Complete! Index=${winnerIndex}`);

        setResult(winnerIndex);
        setStatus('result');
        setShowBigWin(true);

        // Notificar por canal de transmisión el fin del giro (opcional para móviles)
        supabase.channel(`screen_${screenIdNum}`).send({
            type: 'broadcast',
            event: 'spin_finished',
            payload: { result: winnerIndex }
        });

        // Sonido del animal ganador
        const audio = new Audio(`/audio/win${winnerIndex}.mp3`);
        audio.play().catch(err => console.error("Error playing winner sound:", err));

        // Obtener el ganador real de la base de datos
        try {
            if (!activeRaffleId) return;

            const { data: raffleData, error: raffleError } = await supabase
                .from('raffles')
                .select('winning_number, winner_ticket_id')
                .eq('id', activeRaffleId)
                .maybeSingle();

            if (!raffleError && raffleData) {
                let winnerName = null;
                if (raffleData.winner_ticket_id) {
                    const { data: ticketData } = await supabase
                        .from('raffle_tickets')
                        .select('buyer_name')
                        .eq('id', raffleData.winner_ticket_id)
                        .maybeSingle();
                    if (ticketData) winnerName = ticketData.buyer_name;
                }

                if (winnerName) {
                    useGameStore.setState({
                        nickname: winnerName,
                        emoji: '🎉'
                    });
                    setIsWin(true);
                    setShowConfetti(true);
                } else {
                    useGameStore.setState({
                        nickname: 'Acumulado',
                        emoji: '🪙'
                    });
                    setIsWin(false);
                    setShowConfetti(false);
                }
            }

            // Resetear la TV central a estado idle tras 15 segundos
            setTimeout(async () => {
                await supabase
                    .from('screen_state')
                    .update({
                        status: 'idle',
                        last_spin_result: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('screen_number', screenIdNum);
            }, 15000);

        } catch (err) {
            console.error("Critical error in raffle spin complete logic:", err);
        }
    };

    return (
        <div className="w-screen h-screen min-h-screen bg-gray-900 overflow-hidden relative font-sans animate-in fade-in duration-350">
            {/* Background image de Sorteo */}
            <div className="absolute inset-0 z-0">
                {activeWheelAssets?.background && (
                    <Image
                        src={activeWheelAssets.background}
                        alt="Background Sorteo"
                        fill
                        className="object-cover opacity-100"
                        priority
                    />
                )}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Info y Estado del Sorteo en la parte superior izquierda */}
            <div className="absolute inset-0 flex items-start justify-center z-10 pt-0">
                <div className="absolute top-[3vh] left-[3vh] z-40 flex flex-col gap-[1.5vh] items-start max-w-[40%]">
                    <div className="bg-white/10 backdrop-blur-md px-[1.5vw] py-[1vh] rounded-[2vh] border border-white/20 flex items-center gap-[1.5vw] shadow-lg">
                        <div className="flex items-center justify-center bg-black/40 backdrop-blur-md w-[6.5vh] h-[6.5vh] rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] flex-none">
                            <span className="text-[4.5vh] font-black text-indigo-400 animate-pulse drop-shadow-[0_0_8px_rgba(129,140,248,0.6)] select-none leading-none">
                                {screenIdNum}
                            </span>
                        </div>

                        {currentRaffle && (
                            <div className="border-l border-white/20 pl-[1.5vw] animate-in fade-in slide-in-from-left-4 duration-500 text-left">
                                <p className="text-[1vh] text-indigo-400 font-black uppercase tracking-widest leading-none mb-[0.5vh]">
                                    Sorteo en curso #{currentRaffle.code}
                                </p>
                                <div className="flex items-center gap-[0.5vw]">
                                    <span className="text-[2.2vh] font-bold text-yellow-400 uppercase tracking-tight truncate max-w-[250px] leading-tight select-none">
                                        {currentRaffle.name}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ruleta Canvas en formato Sorteo (36 animales) */}
                <div className="relative w-full aspect-square flex items-center justify-center">
                    <div className="relative w-full aspect-square">
                        <WheelCanvas
                            isSpinning={status === 'spinning'}
                            isIdle={status === 'idle'}
                            idleSpeed={4.0}
                            targetIndex={result}
                            onSpinComplete={handleSpinComplete}
                            segments={activeWheelAssets?.segments}
                            drawMode="segmentImage"
                            className="w-full h-full"
                        />
                    </div>
                </div>
            </div>

            {/* Winner / Celebration Overlays */}
            <BigWinOverlay
                isVisible={showBigWin}
                resultIndex={result}
                assets={activeWheelAssets}
                playerName={storeNickname}
                playerEmoji={storeEmoji}
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
                            animation: `progress-fill 15s linear forwards`
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
