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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Identity Bar */}
            <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Jugando como</p>
                        <p className="font-bold text-gray-900 leading-tight">{nickname}</p>
                    </div>
                </div>
                <button
                    onClick={handleChangeIdentity}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-semibold transition-colors"
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
