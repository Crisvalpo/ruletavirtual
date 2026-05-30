'use client';

import Link from 'next/link';
import WheelSelector from '@/components/individual/WheelSelector';
import NickEntry from '@/components/individual/NickEntry';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { useAuth } from '@/hooks/useAuth';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, use, useState, useCallback } from 'react';
import { useAvailableSpins } from '@/hooks/useAvailableSpins';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { safeRedirect } from '@/lib/navigation';

export default function JoinScreenPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const { nickname, emoji, resetGame, setScreenId, queueId, setQueueId } = useGameStore();
    const [hasHydrated, setHasHydrated] = useState(false);
    const router = useRouter();
    const { user, profile, isLoading } = useAuth();
    const { venueMode } = useVenueSettings();

    // Derivar de forma síncrona y reactiva si el usuario ya cuenta con un apodo/identidad establecido.
    // Esto evita estados asíncronos duplicados y parpadeos molestos de la vista de personalización.
    const hasIdentity = !!nickname || !!profile?.display_name;
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [resolvedWheelId, setResolvedWheelId] = useState<string | null>(null);
    const [resolvingWheel, setResolvingWheel] = useState(true);
    const [checkingQueue, setCheckingQueue] = useState(!!queueId);

    const { totalSpinsAvailable, availablePackages, loading: spinsLoading } = useAvailableSpins();
    const [isBypassing, setIsBypassing] = useState(false);

    // Set hydrated state on mount
    useEffect(() => {
        setHasHydrated(true);
    }, []);

    // 0. Force Auth
    useEffect(() => {
        if (!isLoading && !user) {
            const currentUrl = window.location.href;
            localStorage.setItem('auth_return_url', currentUrl);
            safeRedirect(router, '/auth/login');
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
                                safeRedirect(router, `/individual/screen/${id}/select`);
                            }
                            else if (data.status === 'selecting') {
                                isActiveQueue = true;
                                safeRedirect(router, `/individual/screen/${id}/select`);
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

    }, [id, setScreenId, queueId, supabase, router, user, setQueueId]);
    // Handle bypass of payment if user has available spins
    useEffect(() => {
        const handleSpinsBypass = async () => {
            // Wait for everything to be loaded
            if (!hasIdentity || resolvingWheel || !resolvedWheelId || checkingQueue || spinsLoading || isLoading) {
                return;
            }

            if (totalSpinsAvailable > 0 && availablePackages.length > 0 && !isBypassing) {
                setIsBypassing(true);
                try {
                    const firstPkg = availablePackages[0];
                    console.log("⚡ Auto-redeeming/continuing package:", firstPkg.code);

                    const deviceFingerprint = getDeviceFingerprint();

                    const { data, error } = await supabase.rpc('redeem_or_continue_package', {
                        p_code: firstPkg.code,
                        p_device_fingerprint: deviceFingerprint,
                        p_screen_number: parseInt(id),
                        p_player_name: nickname || profile?.display_name || 'Jugador',
                        p_player_emoji: emoji || '😎',
                        p_player_id: user?.id || null
                    });

                    if (error) throw error;

                    if (data && data.success) {
                        console.log("✅ Auto-redeemed/continued successfully:", data);
                        
                        localStorage.setItem('current_package', JSON.stringify({
                            packageId: data.package_id,
                            spinNumber: data.spin_number,
                            totalSpins: data.total_spins,
                            code: firstPkg.code
                        }));
                        sessionStorage.setItem('payment_authorized', 'true');

                        safeRedirect(router, `/individual/screen/${id}/pre-select?wheelId=${resolvedWheelId}`);
                    } else {
                        console.error("Auto-redeem RPC failed:", data?.message);
                        // Fallback to normal flow if auto-redeem fails
                        safeRedirect(router, `/individual/screen/${id}/payment?wheelId=${resolvedWheelId}`);
                    }
                } catch (err) {
                    console.error("Error in spins bypass:", err);
                    // Fallback to normal flow on error
                    safeRedirect(router, `/individual/screen/${id}/payment?wheelId=${resolvedWheelId}`);
                }
            } else if (totalSpinsAvailable === 0 && !isBypassing) {
                // Normal flow: no available spins, redirect to payment
                safeRedirect(router, `/individual/screen/${id}/payment?wheelId=${resolvedWheelId}`);
            }
        };

        handleSpinsBypass();
    }, [
        hasIdentity,
        nickname,
        id,
        router,
        resolvingWheel,
        resolvedWheelId,
        checkingQueue,
        spinsLoading,
        isLoading,
        totalSpinsAvailable,
        availablePackages,
        isBypassing,
        supabase,
        emoji,
        user,
        profile
    ]);

    // --- FLOW STEPS ---

    // 1. Initial Loading or Hydrating
    if (isLoading || resolvingWheel || checkingQueue || !hasHydrated || spinsLoading || isBypassing || venueMode === null) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-yellow-400 rounded-full animate-spin" />
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold tracking-widest text-white/50 uppercase">
                        {isBypassing ? 'Cargando tus Giros' : 'Conectando'}
                    </p>
                    <p className="text-xs text-white/30">
                        {isBypassing ? 'Preparando tu juego directo...' : 'Cargando la configuración de la pantalla...'}
                    </p>
                </div>
            </div>
        );
    }

    // 2. Block if venue is in Group Event (Raffle) mode
    if (venueMode === 'group_event') {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6 font-sans text-center relative overflow-hidden">
                {/* Premium Background Blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse delay-1000" />
                </div>

                <div className="w-20 h-20 bg-indigo-600/20 border border-indigo-500/30 rounded-3xl flex items-center justify-center text-4xl mb-2 animate-bounce z-10 shadow-lg shadow-indigo-500/10">
                    🎟️
                </div>
                <div className="space-y-2 max-w-sm z-10">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-indigo-400">Modo Sorteo Activo</h2>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        Esta pantalla (<span className="text-white font-bold">#{id}</span>) no está disponible para juego individual en este momento porque el local se encuentra en modo Sorteo Grupal.
                    </p>
                </div>
                <Link
                    href="/"
                    className="bg-white hover:bg-gray-100 text-black font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 z-10"
                >
                    Volver al Inicio 🏠
                </Link>
            </div>
        );
    }

    // 3. Identity Setup
    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => {}} />;
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
