'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter } from 'next/navigation';

export default function ResultPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const { selectedAnimals, nickname, queueId } = useGameStore();

    const [status, setStatus] = useState<'loading' | 'winning' | 'losing'>('loading');
    const [dbSelections, setDbSelections] = useState<number[]>([]);
    const [email, setEmail] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSavePrize = async () => {
        if (!email || !queueId) return;
        setIsSaving(true);
        const { error } = await supabase
            .from('player_queue')
            .update({ email: email })
            .eq('id', queueId);

        if (!error) setIsSaved(true);
        setIsSaving(false);
    };

    useEffect(() => {
        let isMounted = true;

        const checkResult = async () => {
            if (!queueId) return;

            // 1. Fetch own queue record first (Session specific result)
            const { data: queueData, error: queueError } = await supabase
                .from('player_queue')
                .select('selected_animals, spin_result, status')
                .eq('id', queueId)
                .single();

            if (queueError || !queueData) {
                console.error("Error fetching session result:", queueError);
                return;
            }

            const effectiveSelections = (queueData.selected_animals as number[]) || selectedAnimals;
            if (effectiveSelections.length > 0 && isMounted) {
                setDbSelections(effectiveSelections);
            }

            // 2. If we already have a result saved in our own record, show it!
            if (queueData.spin_result !== null) {
                const isWin = effectiveSelections.includes(queueData.spin_result);
                if (isMounted) setStatus(isWin ? 'winning' : 'losing');
                return;
            }

            // 3. If no result yet, maybe we are still spinning?
            // Fallback to check global screen state ONLY for transition
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('last_spin_result, status')
                .eq('screen_number', parseInt(id))
                .single();

            if (screenData?.status === 'spinning') {
                if (isMounted) setStatus('loading');
            } else if (screenData?.last_spin_result && queueData.status === 'playing') {
                // If it just stopped and hasn't saved to queue yet (race condition)
                const isWin = effectiveSelections.includes(screenData.last_spin_result);
                if (isMounted) setStatus(isWin ? 'winning' : 'losing');
            }
        };

        checkResult();

        // 2. Realtime Subscription for OUR OWN record
        const channel = supabase
            .channel(`player_result_${queueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'player_queue',
                    filter: `id=eq.${queueId}`
                },
                (payload) => {
                    if (isMounted && payload.new.spin_result !== null) {
                        console.log("🎯 Personal Result Received:", payload.new.spin_result);
                        const selections = (payload.new.selected_animals as number[]) || selectedAnimals;
                        const isWin = selections.includes(payload.new.spin_result);
                        setStatus(isWin ? 'winning' : 'losing');
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [id, selectedAnimals, queueId, supabase]);

    const handlePlayAgain = () => {
        // Reset local state if needed
        // Assuming queue logic handles cleanup via "cleanup_screen_session" on TV side
        // But for user flow, we just go back to start or queue.
        // Or Payment page if credits needed? Assuming back to start/select for flow.
        router.push(`/individual/screen/${id}`);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white perspective-1000">

            {status === 'loading' && (
                <div className="text-center animate-pulse">
                    <div className="text-6xl mb-4 animate-spin">🎲</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Girando...</h1>
                    <p className="text-gray-400">¡Buena Suerte!</p>
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
                            <p className="text-xs text-gray-400 mb-4">Ingresa tu email para registrar este premio y participar en el ranking semanal.</p>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-center mb-4 focus:border-yellow-500 outline-none"
                            />
                            <button
                                onClick={handleSavePrize}
                                disabled={!email || isSaving}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'REGISTRANDO...' : 'REGISTRAR PREMIO'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl mb-6 flex items-center gap-3 animate-in fade-in">
                            <span className="text-2xl">✅</span>
                            <div className="text-left">
                                <p className="font-bold text-green-400 text-sm">¡Premio Registrado!</p>
                                <p className="text-[10px] text-green-300">Te enviaremos los detalles a {email}</p>
                            </div>
                        </div>
                    )}


                    <div className="bg-white text-gray-900 p-6 rounded-xl mb-6 transform rotate-2 shadow-2xl border-4 border-yellow-400 flex flex-col justify-center">
                        <p className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-1">CÓDIGO DE CANJE</p>
                        <p className="text-3xl font-black text-green-600 tracking-tighter leading-tight">PREMIO NIVEL 1</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg inline-block shadow-lg">
                        <div className="w-40 h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] font-mono border-2 border-dashed border-gray-300 text-center px-4">
                            [TICKET: {queueId?.slice(0, 8)}] <br /> QR VÁLIDO EN MESÓN
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-4">
                        <button
                            onClick={handlePlayAgain}
                            className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                        >
                            Jugar de Nuevo
                        </button>
                        <p className="text-xs text-gray-500">Muestra esta pantalla al staff para cobrar</p>
                    </div>
                </div>
            )}

            {status === 'losing' && (
                <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-500 max-w-sm w-full">
                    <div className="text-6xl mb-4 grayscale opacity-50">😢</div>
                    <h1 className="text-3xl font-bold text-gray-300 mb-2">¡Casi!</h1>
                    <p className="text-xl mb-8 text-gray-400">Hoy no fue tu día de suerte.</p>

                    <div className="bg-gray-800 p-8 rounded-2xl mb-8 border border-gray-700">
                        <p className="text-gray-400 italic">"El que la sigue la consigue"</p>
                    </div>

                    <button
                        onClick={handlePlayAgain}
                        className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                    >
                        Intentar de Nuevo
                    </button>
                </div>
            )}

        </div>
    );
}
