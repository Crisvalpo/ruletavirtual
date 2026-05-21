'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState, useRef } from 'react';
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
    const [isSpinning, setIsSpinning] = useState(false);
    const resultRef = useRef<number | null>(null);

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

    // Listener for result from TV screen
    useEffect(() => {
        if (!isSpinning) return;

        console.log(`📡 Listening for spin_finished on screen_${id}...`);
        const channel = supabase.channel(`screen_${id}`);

        channel.on(
            'broadcast',
            { event: 'spin_finished' },
            (payload) => {
                console.log("✅ Received spin_finished event:", payload);
                const winnerIndex = payload.payload?.result || resultRef.current;
                router.push(`/individual/screen/${id}/result?res=${winnerIndex}`);
            }
        ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSpinning, id, router, supabase]);

    const handleSpin = async () => {
        if (!queueId || isSpinning) return;

        setIsSpinning(true);
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
            setIsSpinning(false);
            return;
        }

        if (data && !data.success) {
            console.error("❌ Spin Failed:", data.message);
            alert("No se pudo girar: " + data.message);
            setIsSpinning(false);
            return;
        }

        console.log("✅ Spin Authorized! Result stored:", data.result_index);
        resultRef.current = data.result_index;

        // 2. WATCHDOG TIMER
        // If we don't hear back from the screen in 12 seconds, we force the redirect
        setTimeout(() => {
            console.warn("⏱️ Watchdog: Fallback redirect after 12s");
            router.push(`/individual/screen/${id}/result?res=${data.result_index}`);
        }, 12000);
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
            <h1 className="text-white text-3xl font-black tracking-widest mb-12 animate-pulse uppercase">
                ¡ES TU TURNO!
            </h1>

            <button
                onClick={handleSpin}
                disabled={isSpinning}
                className={`
                    relative w-72 h-72 rounded-full flex items-center justify-center transform transition-all duration-300
                    ${isSpinning 
                        ? 'bg-red-800 scale-95 opacity-80 cursor-wait border-8 border-red-900 shadow-inner' 
                        : 'bg-red-600 hover:bg-red-500 active:scale-95 shadow-[0_0_50px_rgba(220,38,38,0.6)] hover:shadow-[0_0_80px_rgba(220,38,38,0.8)] border-8 border-red-700 cursor-pointer'
                    }
                `}
            >
                {/* Decoración interior */}
                <div className={`absolute inset-2 rounded-full border-4 border-dashed ${isSpinning ? 'border-red-900/50 animate-[spin_3s_linear_infinite]' : 'border-red-400/30'}`}></div>

                <div className="text-center relative z-10 flex flex-col items-center gap-4">
                    {!isSpinning && (
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm mb-2">
                            <span className="text-4xl">🎯</span>
                        </div>
                    )}
                    
                    <span className="block text-4xl font-black text-white tracking-[0.2em] uppercase">
                        {isSpinning ? 'GIRANDO...' : 'GIRAR'}
                    </span>
                </div>
            </button>

            <p className="text-white/50 mt-12 text-sm font-medium tracking-wide uppercase">
                Presiona el botón rojo para lanzar la ruleta
            </p>
        </div>
    );
}
