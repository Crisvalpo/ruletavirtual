import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';

export function useRealtimeGame(screenId: string) {
    const supabase = createClient();
    const setGameMode = useGameStore((state) => state.setGameMode);

    useEffect(() => {
        const parsedId = parseInt(screenId);
        if (isNaN(parsedId)) {
            console.warn('⚠️ useRealtimeGame: Waiting for valid screenId:', screenId);
            return;
        }

        // 0. Initial Fetch (Sync current state on load)
        const fetchInitialState = async () => {
            const { data, error } = await supabase
                .from('screen_state')
                .select('*')
                .eq('screen_number', parsedId)
                .single();

            if (error) {
                console.error('❌ Error fetching initial screen state:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                console.error('Context:', { screenId, parsedId });
                return;
            }

            if (data) {
                console.log('📥 Initial Screen State:', data);

                // Sync Mode/Wheel
                if (data.current_wheel_id) {
                    setGameMode('individual', data.current_wheel_id);
                } else {
                    setGameMode('individual', undefined);
                }

                // Sync Identity
                useGameStore.getState().setIdentity(
                    data.player_name || 'Jugador',
                    data.player_emoji || '😎'
                );

                // Sync Status
                if (data.status === 'spinning') {
                    useGameStore.setState({
                        status: 'spinning',
                        isDemo: data.is_demo || false,
                        idleSpeed: data.idle_speed || 1.0,
                        currentQueueId: data.current_queue_id,
                        lastSpinResult: data.last_spin_result
                    });
                } else {
                    useGameStore.setState({
                        status: 'idle',
                        isDemo: data.is_demo || false,
                        idleSpeed: data.idle_speed || 1.0,
                        currentQueueId: data.current_queue_id
                    });
                }
            }
        };

        fetchInitialState();

        // 1. Subscribe to screen_state changes for this screen
        const channel = supabase
            .channel(`screen_${parsedId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'screen_state',
                    filter: `screen_number=eq.${parsedId}`
                },
                (payload) => {
                    const newState = payload.new;
                    console.log(`🔄 [Realtime] Screen ${parsedId} Update:`, {
                        status: newState.status,
                        is_demo: newState.is_demo,
                        speed: newState.idle_speed,
                        result: newState.last_spin_result
                    });

                    // Sync Active Wheel (Mode)
                    if (newState.current_wheel_id) {
                        setGameMode('individual', newState.current_wheel_id);
                    } else {
                        setGameMode('individual', undefined);
                    }

                    // Sync Player Identity
                    useGameStore.getState().setIdentity(
                        newState.player_name || 'Jugador',
                        newState.player_emoji || '😎'
                    );

                    // Sync Status (Trigger Spin) & Speed
                    if (newState.status === 'spinning') {
                        useGameStore.setState({
                            status: 'spinning',
                            isDemo: newState.is_demo || false,
                            idleSpeed: newState.idle_speed || 1.0,
                            currentQueueId: newState.current_queue_id,
                            lastSpinResult: newState.last_spin_result
                        });
                    } else if (newState.status === 'result' || newState.status === 'showing_result') {
                        useGameStore.setState({
                            status: 'result',
                            isDemo: newState.is_demo || false,
                            idleSpeed: newState.idle_speed || 1.0,
                            currentQueueId: newState.current_queue_id,
                            lastSpinResult: newState.last_spin_result
                        });
                    } else if (newState.status === 'idle' || newState.status === 'waiting_for_spin') {
                        useGameStore.setState({
                            status: 'idle',
                            isDemo: newState.is_demo || false,
                            idleSpeed: newState.idle_speed || 1.0,
                            currentQueueId: newState.current_queue_id,
                            lastSpinResult: null
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenId, supabase, setGameMode]);
}
