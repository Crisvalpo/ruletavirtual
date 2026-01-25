import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';

export function useRealtimeGame(screenId: string) {
    const supabase = createClient();
    const setGameMode = useGameStore((state) => state.setGameMode);

    useEffect(() => {
        // 1. Subscribe to screen_state changes for this screen
        const channel = supabase
            .channel(`screen_${screenId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'screen_state',
                    filter: `screen_id=eq.${screenId}`
                },
                (payload) => {
                    const newState = payload.new;
                    console.log('🔄 Realtime Screen Update:', newState);

                    // Sync Active Wheel (Mode)
                    if (newState.current_wheel_id) {
                        setGameMode('individual', newState.current_wheel_id);
                    } else {
                        setGameMode('group', undefined);
                    }

                    // Future: Sync Status (Spinning, Result, etc.)
                    // if (newState.status === 'spinning') { ... }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenId, supabase, setGameMode]);
}
