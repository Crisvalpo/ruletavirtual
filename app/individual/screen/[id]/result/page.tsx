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

    useEffect(() => {
        const checkResult = async () => {
            // 1. Get Screen State (Did we win?)
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('last_spin_result, status')
                .eq('screen_number', parseInt(id))
                .single();

            if (screenData?.status === 'showing_result' && screenData.last_spin_result) {
                const resultIndex = screenData.last_spin_result;
                const isWin = selectedAnimals.includes(resultIndex);
                setStatus(isWin ? 'winning' : 'losing');
            } else if (screenData?.status === 'spinning') {
                setStatus('loading');
            }
        };

        // Poll every 1s
        const interval = setInterval(checkResult, 1000);
        return () => clearInterval(interval);
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
