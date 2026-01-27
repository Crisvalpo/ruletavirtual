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
    const { selectedAnimals, nickname } = useGameStore();

    const [status, setStatus] = useState<'loading' | 'winning' | 'losing'>('loading');
    const [dbSelections, setDbSelections] = useState<number[]>([]);

    useEffect(() => {
        let isMounted = true;

        const checkResult = async (currentStatus?: string, currentResult?: number | null) => {
            // 2. Resolve Selections (Store or Database)
            let effectiveSelections = selectedAnimals;
            if (effectiveSelections.length === 0) {
                const { data: queueData } = await supabase
                    .from('player_queue')
                    .select('selected_animals')
                    .eq('screen_number', parseInt(id))
                    .in('status', ['playing', 'completed'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (queueData?.selected_animals && isMounted) {
                    effectiveSelections = queueData.selected_animals as number[];
                    setDbSelections(effectiveSelections);
                }
            }

            // 3. Logic based on screen status/result
            if (currentResult) {
                const isWin = effectiveSelections.includes(currentResult);
                setStatus(isWin ? 'winning' : 'losing');
            }
            else if (currentStatus === 'idle') {
                // TV already finished and reset. Fallback to Game History.
                const { data: history } = await supabase
                    .from('game_history')
                    .select('result_index')
                    .eq('screen_id', parseInt(id))
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (history && isMounted) {
                    const isWin = effectiveSelections.includes(history.result_index);
                    setStatus(isWin ? 'winning' : 'losing');
                } else if (isMounted) {
                    setStatus('losing'); // Default fallback
                }
            }
            else {
                setStatus('loading');
            }
        };

        // 1. Initial Fetch
        const init = async () => {
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('last_spin_result, status')
                .eq('screen_number', parseInt(id))
                .single();

            if (isMounted && screenData) {
                checkResult(screenData.status, screenData.last_spin_result);
            }
        };
        init();

        // 2. Realtime Subscription for instant update
        const channel = supabase
            .channel(`result_sync_${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'screen_state',
                    filter: `screen_number=eq.${id}`
                },
                (payload) => {
                    if (isMounted) {
                        console.log("🎯 Result Received via Realtime:", payload.new);
                        checkResult(payload.new.status, payload.new.last_spin_result);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [id, selectedAnimals, supabase]);

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
                <div className="text-center animate-in zoom-in duration-500">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h1 className="text-4xl font-bold text-yellow-400 mb-2">¡GANASTE!</h1>
                    <p className="text-xl mb-8">La ruleta cayó en tu elección</p>

                    <div className="bg-white text-gray-900 p-6 rounded-xl mb-8 transform rotate-2 shadow-2xl border-4 border-yellow-400 h-100 flex flex-col justify-center">
                        <p className="font-bold text-lg text-gray-500 uppercase tracking-widest mb-2">PREMIO</p>
                        <p className="text-3xl font-black text-green-600 tracking-tighter leading-tight">ESCOGE TU PREMIO</p>
                        <p className="text-xs text-gray-400 mt-2">Todo lo que ves en el stand es premio</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg inline-block shadow-lg">
                        <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-mono border-2 border-dashed border-gray-300">
                            QR CODE PREMIO
                        </div>
                    </div>

                    <p className="mt-4 text-sm text-gray-400">
                        Muestra este código al staff
                    </p>

                    <button
                        onClick={handlePlayAgain}
                        className="mt-8 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                    >
                        Jugar de Nuevo
                    </button>
                </div>
            )}

            {status === 'losing' && (
                <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-500">
                    <div className="text-6xl mb-4 grayscale opacity-50">😢</div>
                    <h1 className="text-3xl font-bold text-gray-300 mb-2">¡Casi!</h1>
                    <p className="text-xl mb-8 text-gray-400">Hoy no fue tu día de suerte.</p>

                    <div className="bg-gray-800 p-8 rounded-2xl mb-8 border border-gray-700">
                        <p className="text-gray-400 italic">"El que la sigue la consigue"</p>
                    </div>

                    <button
                        onClick={handlePlayAgain}
                        className="mt-4 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                    >
                        Intentar de Nuevo
                    </button>
                </div>
            )}

        </div>
    );
}
