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
        if (!queueId) return;

        console.log("🚀 Requesting Server Authority Spin...");

        // 1. CALL SERVER AUTHORITY RPC
        // The server decides the result, deducts the credit, and updates game state atomically.
        const { data, error } = await supabase.rpc('play_spin', {
            p_queue_id: queueId,
            p_screen_number: parseInt(id)
        });

        if (error) {
            console.error("❌ Spin Error:", error);
            alert("Error al girar: " + error.message);
            return;
        }

        if (data && !data.success) {
            console.error("❌ Spin Failed:", data.message);
            alert("No se pudo girar: " + data.message);
            return;
        }

        console.log("✅ Spin Authorized! Result:", data.result_index);

        // 2. Navigate to Result (passing result via query param for speed, or let it fetch)
        // For now, let's just go to result page. It should read from DB or we can pass state.
        // To be safe and "dumb", we just navigate.
        router.push(`/individual/screen/${id}/result?res=${data.result_index}`);
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
