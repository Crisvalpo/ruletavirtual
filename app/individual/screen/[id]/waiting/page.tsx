'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';
import ScreenSwitchNotification from '@/components/individual/ScreenSwitchNotification';

export default function WaitingPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();

    const supabase = createClient();
    const { queueId } = useGameStore();

    // Screen switch offer state
    const [currentOffer, setCurrentOffer] = useState<{
        id: string;
        targetScreen: number;
        expiresAt: string;
    } | null>(null);
    const [showSwitchNotification, setShowSwitchNotification] = useState(false);

    // 1. Poll Queue Status (Are we Playing yet?) AND Realtime Subscription (Primary)
    useEffect(() => {
        if (!queueId) return;

        // Fallback: Check every 3s (reduced from 1s)
        const checkStatus = async () => {
            const { data } = await supabase
                .from('player_queue')
                .select('status')
                .eq('id', queueId)
                .single();

            if (data?.status === 'playing') {
                router.push(`/individual/screen/${id}/spin`);
            }
        };

        const interval = setInterval(checkStatus, 3000);

        // Primary: Realtime Subscription
        const channel = supabase
            .channel(`player_queue_${queueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'player_queue',
                    filter: `id=eq.${queueId}` // Listen specifically to MY queue item
                },
                (payload) => {
                    const newStatus = payload.new.status;
                    if (newStatus === 'playing') {
                        console.log("🚀 Realtime Promotion! Moving to spin...");
                        router.push(`/individual/screen/${id}/spin`);
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [queueId, id, router, supabase]);

    // 1.5. Subscribe to Screen Switch Offers
    useEffect(() => {
        if (!queueId) return;

        const channel = supabase
            .channel('screen-switch-offers')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'screen_switch_offers',
                    filter: `offered_to_queue_id=eq.${queueId}`
                },
                (payload) => {
                    const offer = payload.new as any;
                    if (offer.status === 'pending') {
                        console.log('🎯 Screen switch offer received:', offer);
                        setCurrentOffer({
                            id: offer.id,
                            targetScreen: offer.target_screen_number,
                            expiresAt: offer.offer_expires_at
                        });
                        setShowSwitchNotification(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queueId, supabase]);

    // Handle screen switch acceptance
    const handleSwitchScreen = async () => {
        if (!currentOffer || !queueId) return;

        console.log('✅ Accepting screen switch to:', currentOffer.targetScreen);

        // Mark offer as accepted
        const { error: offerError } = await supabase
            .from('screen_switch_offers')
            .update({ status: 'accepted' })
            .eq('id', currentOffer.id);

        if (offerError) {
            console.error('Error accepting offer:', offerError);
            return;
        }

        // Call RPC for atomic switch
        const { data, error } = await supabase.rpc('switch_player_screen', {
            p_queue_id: queueId,
            p_new_screen_number: currentOffer.targetScreen
        });

        if (!error && data) {
            // Redirect to new screen's waiting page
            router.push(`/individual/screen/${currentOffer.targetScreen}/waiting`);
        } else {
            console.error('Error switching screen:', error);
        }
    };

    // Handle screen switch dismissal
    const handleDismissOffer = async () => {
        if (!currentOffer) return;

        console.log('❌ Declining screen switch offer');

        // Mark offer as declined
        await supabase
            .from('screen_switch_offers')
            .update({ status: 'declined' })
            .eq('id', currentOffer.id);

        setShowSwitchNotification(false);
        setCurrentOffer(null);

        // Trigger processing of next offer
        await supabase.rpc('process_expired_offers');
    };

    // 2. Poll Screen & Try to Promote (If we are waiting)
    useEffect(() => {
        const tryPromote = async () => {
            // Only try if screen is idle (this avoids unnecessary RPC calls)
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('status, updated_at')
                .eq('screen_number', parseInt(id))
                .single();

            if (screenData?.status === 'idle') {
                // If screen is idle, WE try to promote ourselves (or whoever is next)
                // This decentralizes the logic so we don't depend solely on the TV
                console.log("Screen Idle - Attempting Promotion...");
                const { data: promoteResult, error } = await supabase.rpc('promote_next_player', {
                    p_screen_number: parseInt(id)
                });

                if (promoteResult) {
                    console.log("✅ Promotion Successful!");
                }
            }
            // FAILSAFE: If screen is stuck on result for > 12 seconds (reduced from 20), force cleanup
            // Normal result time is 10s. giving 2s buffer.
            else if (screenData?.status === 'result') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const now = new Date().getTime();
                const diffSeconds = (now - lastUpdate) / 1000;

                if (diffSeconds > 12) {
                    console.warn("⚠️ Screen stuck on result > 12s! Forcing ADVANCE (Nuclear Option)...");
                    // Use the robust function that cleans everything & promotes
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: parseInt(id)
                    });
                }
            }
        };

        const interval = setInterval(tryPromote, 2000); // Check every 2s (Faster)
        return () => clearInterval(interval);
    }, [id, supabase]);

    const [position, setPosition] = useState<number | null>(null);

    useEffect(() => {
        if (!queueId) return;

        const fetchPosition = async () => {
            // Count how many WAITING players are ahead (ordered by created_at or queue_order)
            // Assuming queue_order is serial. 
            // We need our item first to comparing.

            // 1. Get our creation time
            const { data: myItem } = await supabase
                .from('player_queue')
                .select('created_at')
                .eq('id', queueId)
                .single();

            if (myItem) {
                // 2. Count items with created_at < myItem.created_at AND status='waiting'
                const { count } = await supabase
                    .from('player_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('screen_number', parseInt(id))
                    .eq('status', 'waiting')
                    .lt('created_at', myItem.created_at);

                // Position is count + 1 (if 0 people ahead, I am 1st)
                // But if someone is playing, they are position 0 (active).
                // Usually "Position in Queue" excludes the active player.
                if (count !== null) {
                    setPosition(count + 1);
                }
            }
        };

        fetchPosition();
        const interval = setInterval(fetchPosition, 5000);
        return () => clearInterval(interval);
    }, [queueId, id, supabase]);

    return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8 text-white text-center">
            <div className="animate-pulse mb-8 text-6xl">
                ⏳
            </div>

            <h1 className="text-3xl font-bold mb-4">¡Estás en la fila!</h1>
            <p className="text-xl opacity-90 mb-8">
                Espera tu turno en la pantalla #{id}
            </p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 w-full max-w-sm">
                <p className="text-sm uppercase tracking-wider mb-2">Tu lugar en la fila</p>
                <p className="text-5xl font-mono font-bold">
                    {position !== null ? String(position).padStart(2, '0') : '--'}
                </p>
                <p className="text-xs mt-2 opacity-75">
                    {position ? `Aprox. ${position * 2} minutos de espera` : 'Calculando...'}
                </p>
            </div>

            {/* Screen Switch Notification */}
            {showSwitchNotification && currentOffer && (
                <ScreenSwitchNotification
                    currentScreen={parseInt(id)}
                    availableScreen={currentOffer.targetScreen}
                    offerId={currentOffer.id}
                    expiresAt={currentOffer.expiresAt}
                    onSwitch={handleSwitchScreen}
                    onDismiss={handleDismissOffer}
                />
            )}
        </div>
    );
}
