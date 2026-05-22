'use client';

import Link from 'next/link';
import WheelSelector from '@/components/individual/WheelSelector';
import NickEntry from '@/components/individual/NickEntry';
import PWAInstallPrompt from '@/components/individual/PWAInstallPrompt';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, use, useState, useCallback } from 'react';

export default function JoinScreenPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const { nickname, emoji, resetGame, setScreenId, queueId, setQueueId } = useGameStore();
    const [hasIdentity, setHasIdentity] = useState(false);
    const [installStep, setInstallStep] = useState(true);
    const [hasHydrated, setHasHydrated] = useState(false);
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [resolvedWheelId, setResolvedWheelId] = useState<string | null>(null);
    const [resolvingWheel, setResolvingWheel] = useState(true);
    const [checkingQueue, setCheckingQueue] = useState(!!queueId);

    // Check for "continue in browser" preference and mounting
    useEffect(() => {
        setHasHydrated(true);
        const skipped = localStorage.getItem('pwa_prompt_skipped') === 'true';
        if (skipped) {
            setInstallStep(false);
        }
    }, []);

    const handleSkipInstall = () => {
        setInstallStep(false);
        localStorage.setItem('pwa_prompt_skipped', 'true');
    };

    // 0. Force Auth
    useEffect(() => {
        if (!isLoading && !user) {
            const currentUrl = window.location.href;
            localStorage.setItem('auth_return_url', currentUrl);
            router.push('/auth/login');
        }
    }, [user, isLoading, router]);

    // Fetch Screen Theme (current_wheel_id) from Supabase
    useEffect(() => {
        const fetchScreenTheme = async () => {
            setResolvingWheel(true);
            try {
                const { data: screenData, error } = await supabase
                    .from('screen_state')
                    .select('current_wheel_id')
                    .eq('screen_number', parseInt(id))
                    .single();

                if (error) {
                    console.error("Error fetching screen theme:", error);
                }

                let wheelId = screenData?.current_wheel_id;
                if (!wheelId) {
                    // Fallback: Fetch first active wheel
                    const { data: fallbackWheel } = await supabase
                        .from('individual_wheels')
                        .select('id')
                        .eq('is_active', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    wheelId = fallbackWheel?.id || null;
                }

                if (wheelId) {
                    setResolvedWheelId(wheelId);
                    // Update activeWheelId in the store as well
                    useGameStore.getState().setGameMode('individual', wheelId);
                }
            } catch (err) {
                console.error("Error in fetchScreenTheme:", err);
            } finally {
                setResolvingWheel(false);
            }
        };

        fetchScreenTheme();
    }, [id, supabase]);

    // Verify Active Queue & Setup Identity
    useEffect(() => {
        setScreenId(id);

        if (queueId && user) {
            setCheckingQueue(true);
            supabase
                .from('player_queue')
                .select('status, created_at, player_id')
                .eq('id', queueId)
                .single()
                .then(({ data }) => {
                    let isActiveQueue = false;
                    
                    if (data && data.player_id !== user.id) {
                        console.warn("🚫 Queue ID belongs to another user. Clearing local queue state.");
                        setQueueId(null);
                        setCheckingQueue(false);
                        return;
                    }

                    if (data) {
                        const created = new Date(data.created_at).getTime();
                        const now = new Date().getTime();
                        const withinWindow = now - created < 1000 * 60 * 60 * 2; // 2 hours

                        if (withinWindow) {
                            if (data.status === 'waiting' || data.status === 'playing' || data.status === 'spinning') {
                                isActiveQueue = true;
                                router.push(`/individual/screen/${id}/select`);
                            }
                            else if (data.status === 'selecting') {
                                isActiveQueue = true;
                                router.push(`/individual/screen/${id}/select`);
                            }
                        }
                    }
                    if (!isActiveQueue) {
                        setCheckingQueue(false);
                    }
                },
                () => {
                    setCheckingQueue(false);
                });
        } else {
            setCheckingQueue(false);
        }

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname, queueId, supabase, router, user, setQueueId]);

    // Check for active package on device
    useEffect(() => {
        const checkActivePackage = async () => {
            const stored = localStorage.getItem('current_package');
            if (!stored || !hasIdentity || resolvingWheel || !resolvedWheelId) return;

            try {
                const packageData = JSON.parse(stored);

                const { data, error } = await supabase
                    .from('package_tracking')
                    .select('total_spins, spins_consumed')
                    .eq('id', packageData.packageId)
                    .single();

                if (!error && data) {
                    const spinsRemaining = data.total_spins - data.spins_consumed;

                    if (spinsRemaining > 0) {
                        router.push(`/individual/screen/${id}/payment?wheelId=${resolvedWheelId}`);
                    } else {
                        localStorage.removeItem('current_package');
                    }
                }
            } catch (e) {
                console.error('Error checking package:', e);
            }
        };

        checkActivePackage();
    }, [hasIdentity, id, router, resolvedWheelId, resolvingWheel, supabase]);

    // Handle redirect to payment directly
    useEffect(() => {
        if (hasIdentity && nickname !== 'Jugador' && !resolvingWheel && resolvedWheelId && !checkingQueue) {
            router.push(`/individual/screen/${id}/payment?wheelId=${resolvedWheelId}`);
        }
    }, [hasIdentity, nickname, id, router, resolvingWheel, resolvedWheelId, checkingQueue]);

    // --- FLOW STEPS ---

    // 1. Initial Loading or Hydrating
    if (isLoading || resolvingWheel || checkingQueue || !hasHydrated) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-yellow-400 rounded-full animate-spin" />
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold tracking-widest text-white/50 uppercase">Conectando</p>
                    <p className="text-xs text-white/30">Cargando la configuración de la pantalla...</p>
                </div>
            </div>
        );
    }

    // 2. Install Prompt (only if not in standalone, not skipped, AND user has NO active identity)
    const isPlayerDefault = nickname === 'Jugador';
    if (installStep && isPlayerDefault) {
        return <PWAInstallPrompt onContinue={() => setInstallStep(false)} />;
    }

    // 3. Identity Setup
    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => setHasIdentity(true)} />;
    }

    // Fallback UI (usually redirected before this point)
    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6">
            <div className="w-16 h-16 border-4 border-white/10 border-t-yellow-400 rounded-full animate-spin" />
            <div className="text-center animate-pulse">
                <p className="text-lg font-bold tracking-widest text-white/50 uppercase">Redireccionando</p>
                <p className="text-xs text-white/30">Entrando a la zona de juego...</p>
            </div>
        </div>
    );
}
