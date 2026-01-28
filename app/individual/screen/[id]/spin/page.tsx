'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';

export default function SpinPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const { queueId } = useGameStore();

    const supabase = createClient();

    // Redirect if no queueId (no active session)
    useEffect(() => {
        if (!queueId) {
            const timer = setTimeout(() => {
                if (!queueId) {
                    console.warn("🚫 No active queue session. Redirecting...");
                    router.push(`/individual/screen/${id}`);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [queueId, id, router]);

    const handleSpin = async () => {
        // Enviar señal de giro al backend
        await supabase
            .from('screen_state')
            .update({
                status: 'spinning',
                updated_at: new Date().toISOString()
            })
            .eq('screen_number', parseInt(id));

        // Navegar a resultado (feedback visual para el usuario móvil)
        router.push(`/individual/screen/${id}/result`);
    };

    return (
        <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-4">
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

            <p className="text-white/80 mt-8 text-sm">
                Presiona el botón rojo para lanzar la ruleta en la pantalla {id}
            </p>
        </div>
    );
}
