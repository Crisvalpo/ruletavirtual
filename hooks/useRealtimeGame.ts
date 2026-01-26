import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';

export function useRealtimeGame(screenId: string) {
    const supabase = createClient();
    const setGameMode = useGameStore((state) => state.setGameMode);

    useEffect(() => {
        // 0. Initial Fetch (Sync current state on load)
        const fetchInitialState = async () => {
            const { data, error } = await supabase
                .from('screen_state')
                .select('*')
                .eq('screen_number', parseInt(screenId))
                .single();

            if (!error && data) {
                console.log('📥 Initial Screen State:', data);

                // Sync Mode/Wheel
                if (data.current_wheel_id) {
                    setGameMode('individual', data.current_wheel_id);
                } else {
                    setGameMode('group', undefined);
                }

                // Sync Identity
                useGameStore.getState().setIdentity(
                    data.player_name || 'Jugador',
                    data.player_emoji || '😎'
                );

                // Sync Status
                if (data.status === 'spinning') {
                    useGameStore.setState({ status: 'spinning', isDemo: data.is_demo || false });
                } else {
                    useGameStore.setState({ status: 'idle', isDemo: data.is_demo || false });
                }
            }
        };

        fetchInitialState();

        // 1. Subscribe to screen_state changes for this screen
        const channel = supabase
            .channel(`screen_${screenId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'screen_state',
                    filter: `screen_number=eq.${screenId}` // Fixed filter column name if it was wrong? Table uses screen_number, filter used screen_id?
                    // Wait, previous code used screen_id=eq.${screenId}. Let's verify column name in table.
                    // 003_screen_state.sql says: screen_number INTEGER UNIQUE NOT NULL.
                    // So filter should be screen_number=eq.${screenId}.
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
                    // If name is null (idle), reset to default Jugador/😎
                    useGameStore.getState().setIdentity(
                        newState.player_name || 'Jugador',
                        newState.player_emoji || '😎'
                    );

                    // Sync Status (Trigger Spin)
                    if (newState.status === 'spinning') {
                        // Directly update store to trigger reaction in components
                        useGameStore.setState({ status: 'spinning', isDemo: newState.is_demo || false });
                    } else if (newState.status === 'idle') {
                        useGameStore.setState({ status: 'idle', isDemo: newState.is_demo || false });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenId, supabase, setGameMode]);
}
