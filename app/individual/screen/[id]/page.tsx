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
                        }
                    }
                });
        }

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname, queueId, supabase, router]);


    const handleStartFresh = () => {
        resetGame(); // Clear queueId and everything
    };

    const handleChangeIdentity = () => {
        resetGame(); // Clear identity and everything
        setHasIdentity(false);
    };

    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => setHasIdentity(true)} />;
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
