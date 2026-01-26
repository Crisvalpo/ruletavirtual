'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';

export default function WaitingPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();

    const supabase = createClient();
    const { queueId } = useGameStore();

    // 1. Poll Queue Status (Are we Playing yet?)
    useEffect(() => {
        if (!queueId) return;

        const checkStatus = async () => {
            const { data } = await supabase
                .from('player_queue')
                .select('status')
                .eq('id', queueId)
                .single();

            if (data?.status === 'playing') {
                router.push(`/individual/screen/${id}/spin`);
            }
        };

        const interval = setInterval(checkStatus, 1000);
        return () => clearInterval(interval);
    }, [queueId, id, router]);

    // 2. Poll Screen & Try to Promote (If we are waiting)
    useEffect(() => {
        const tryPromote = async () => {
            // Only try if screen is idle (this avoids unnecessary RPC calls)
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('status')
                .eq('screen_number', parseInt(id))
                .single();

            if (screenData?.status === 'idle') {
                console.log("Screen Idle - Attempting Promotion...");
                await supabase.rpc('promote_next_player', {
                    p_screen_number: parseInt(id)
                });
            }
        };

        const interval = setInterval(tryPromote, 3000); // Check every 3s
        return () => clearInterval(interval);
    }, [id]);

    return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8 text-white text-center">
            <div className="animate-pulse mb-8 text-6xl">
                ⏳
            </div>

            <h1 className="text-3xl font-bold mb-4">¡Estás en la cola!</h1>
            <p className="text-xl opacity-90 mb-8">
                Espera tu turno en la pantalla #{id}
            </p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 w-full max-w-sm">
                <p className="text-sm uppercase tracking-wider mb-2">Tu posición</p>
                <p className="text-5xl font-mono font-bold">03</p>
                <p className="text-xs mt-2 opacity-75">Aprox. 2 minutos de espera</p>
            </div>
        </div>
    );
}
