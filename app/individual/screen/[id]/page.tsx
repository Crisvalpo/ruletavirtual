'use client';

import WheelSelector from '@/components/individual/WheelSelector';
import { useGameStore } from '@/lib/store/gameStore';
import { useEffect, use } from 'react';

export default function JoinScreenPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const setScreenId = useGameStore((state) => state.setScreenId);
    const resetGame = useGameStore((state) => state.resetGame);

    useEffect(() => {
        // Reset previous session and set new screen
        resetGame();
        setScreenId(id);
    }, [id, setScreenId, resetGame]);

    return <WheelSelector screenId={id} />;
}
