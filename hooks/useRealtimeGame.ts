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

                    // Sync Player Identity (for TV Display)
                    if (newState.player_name) {
                        // We don't have setIdentity exposed in the hook, let's just use useGameStore.setState or similar if we want to bypass action
                        // But better to pull the action.
                        // However, useRealtimeGame logic handles the *Display* part mostly. 
                        // If we are the mobile updating it, we already have it in store.
                        // Ideally we want the TV to have it in its store (even though TV doesn't use the store for "my identity", 
                        // it uses it for "what to show").
                        // Actually, Display Page reads `activeWheelAssets` based on `effectiveActiveWheelId` from store.
                        // Display Page also needs to read `playerName` and `playerEmoji` from store.

                        useGameStore.getState().setIdentity(newState.player_name, newState.player_emoji || '😎');
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
