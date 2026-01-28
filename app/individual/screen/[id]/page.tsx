'use client';

import WheelSelector from '@/components/individual/WheelSelector';
import NickEntry from '@/components/individual/NickEntry';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, use, useState, useCallback } from 'react';

export default function JoinScreenPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const { nickname, emoji, resetGame, setScreenId, queueId } = useGameStore();
    const [hasIdentity, setHasIdentity] = useState(false);
    const [showSessionPrompt, setShowSessionPrompt] = useState(false);
    const [savedSession, setSavedSession] = useState<{ status: string; id: string } | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        setScreenId(id);

        if (queueId) {
            supabase
                .from('player_queue')
                .select('status, created_at')
                .eq('id', queueId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        const created = new Date(data.created_at).getTime();
                        const now = new Date().getTime();
                        const withinWindow = now - created < 1000 * 60 * 60 * 2; // 2 hours

                        if (withinWindow) {
                            // Auto-redirect only for ACTIVE sessions
                            if (data.status === 'waiting' || data.status === 'playing' || data.status === 'spinning' || data.status === 'selecting') {
                                router.push(`/individual/screen/${id}/select`);
                            }
                            // For completed sessions, ask user
                            else if (data.status === 'completed') {
                                setSavedSession({ status: data.status, id: queueId });
                                setShowSessionPrompt(true);
                            }
                        }
                    }
                });
        }

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname, queueId, supabase, router]);

    const handleContinuePrevious = () => {
        if (savedSession) {
            router.push(`/individual/screen/${id}/result`);
        }
    };

    const handleStartFresh = () => {
        resetGame(); // Clear queueId and everything
        setShowSessionPrompt(false);
        setSavedSession(null);
    };

    const handleChangeIdentity = () => {
        resetGame(); // Clear identity and everything
        setHasIdentity(false);
    };

    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => setHasIdentity(true)} />;
    }

    // Session Recovery Prompt
    if (showSessionPrompt && savedSession) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
                <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">🎡</div>
                        <h2 className="text-2xl font-black text-white mb-2">Sesión Anterior Encontrada</h2>
                        <p className="text-sm text-gray-400">
                            Tienes un juego completado recientemente. ¿Qué deseas hacer?
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleContinuePrevious}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-4 rounded-xl transition-all active:scale-95"
                        >
                            Ver Mi Resultado Anterior
                        </button>
                        <button
                            onClick={handleStartFresh}
                            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-4 rounded-xl transition-all active:scale-95"
                        >
                            Empezar Juego Nuevo
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col">
            {/* Identity Bar */}
            <div className="bg-[#111] border-b border-white/5 px-4 py-2 flex justify-between items-center shadow-2xl z-20 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-xl">
                        {emoji}
                    </div>
                    <div>
                        <p className="font-black text-white text-md tracking-tight">{nickname}</p>
                    </div>
                </div>

                <IdentityBadge />
            </div>

            {/* Content */}
            <div className="flex-1">
                <WheelSelector screenId={id} />
            </div>
        </div>
    );
}
