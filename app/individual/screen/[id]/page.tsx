'use client';

import WheelSelector from '@/components/individual/WheelSelector';
import NickEntry from '@/components/individual/NickEntry'; // Auto-import if possible but explicit is better
import { useGameStore } from '@/lib/store/gameStore';
import { useEffect, use, useState } from 'react';

export default function JoinScreenPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const { nickname, emoji, resetGame, setScreenId } = useGameStore();
    const [hasIdentity, setHasIdentity] = useState(false);

    useEffect(() => {
        // Reset previous session and set new screen
        setScreenId(id);

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname]);

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
            <div className="bg-[#111] border-b border-white/5 px-4 py-3 flex justify-between items-center shadow-2xl z-20 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-2xl">
                        {emoji}
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Sesión Activa</p>
                        <p className="font-black text-white text-lg tracking-tight">{nickname}</p>
                    </div>
                </div>
                <button
                    onClick={handleChangeIdentity}
                    className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-all active:scale-95"
                >
                    Cambiar
                </button>
            </div>

            {/* Content */}
            <div className="flex-1">
                <WheelSelector screenId={id} />
            </div>
        </div>
    );
}
