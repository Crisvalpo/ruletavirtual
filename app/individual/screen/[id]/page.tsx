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
    const setScreenId = useGameStore((state) => state.setScreenId);
    const [hasIdentity, setHasIdentity] = useState(false);

    // Check if store already has non-default identity
    const nickname = useGameStore((state) => state.nickname);

    useEffect(() => {
        // Reset previous session and set new screen
        // resetGame(); // Commented out to avoid resetting identity on refresh if we want persistence
        // Or we should only reset if it's a truly new session.
        setScreenId(id);

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname]);

    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => setHasIdentity(true)} />;
    }

    return <WheelSelector screenId={id} />;
}
