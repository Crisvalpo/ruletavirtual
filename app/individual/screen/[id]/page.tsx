'use client';

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
    const { nickname, emoji, resetGame, setScreenId, queueId } = useGameStore();
    const [hasIdentity, setHasIdentity] = useState(false);
    const [installStep, setInstallStep] = useState(true);
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Check for "continue in browser" preference
    useEffect(() => {
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

    // ... (rest of the effects constant) ...
    useEffect(() => {
        setScreenId(id);

        if (queueId) {
            supabase
                .from('player_queue')
                .select('status, created_at')
                .eq('id', queueId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        const created = new Date(data.created_at).getTime();
                        const now = new Date().getTime();
                        const withinWindow = now - created < 1000 * 60 * 60 * 2; // 2 hours

                        if (withinWindow) {
                            if (data.status === 'waiting' || data.status === 'playing' || data.status === 'spinning') {
                                router.push(`/individual/screen/${id}/select`);
                            }
                            else if (data.status === 'selecting') {
                                const currentWheelId = useGameStore.getState().activeWheelId;
                                if (currentWheelId) {
                                    router.push(`/individual/screen/${id}/select`);
                                }
                            }
                        }
                    }
                });
        }

        if (nickname && nickname !== 'Jugador') {
            setHasIdentity(true);
        }
    }, [id, setScreenId, nickname, queueId, supabase, router]);

    // Check for active package on device
    useEffect(() => {
        const checkActivePackage = async () => {
            const stored = localStorage.getItem('current_package');
            if (!stored || !hasIdentity) return;

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
                        const wheelId = searchParams.get('wheelId');
                        if (wheelId) {
                            router.push(`/individual/screen/${id}/payment?wheelId=${wheelId}`);
                        }
                    } else {
                        localStorage.removeItem('current_package');
                    }
                }
            } catch (e) {
                console.error('Error checking package:', e);
            }
        };

        checkActivePackage();
    }, [hasIdentity, id, router, searchParams, supabase]);


    const handleStartFresh = () => {
        resetGame();
    };


    const handleChangeIdentity = () => {
        resetGame();
        setHasIdentity(false);
    };

    // Handle redirect after identity setup
    useEffect(() => {
        if (hasIdentity && nickname !== 'Jugador') {
            const returnTo = searchParams.get('returnTo');
            const wheelId = searchParams.get('wheelId');

            if (returnTo === 'payment' && wheelId) {
                router.push(`/individual/screen/${id}/payment?wheelId=${wheelId}`);
            }
        }
    }, [hasIdentity, nickname, searchParams, id, router]);

    // --- FLOW STEPS ---

    // 1. Initial Loading
    if (isLoading) return null;

    // 2. Install Prompt (if not in standalone and not skipped)
    if (installStep) {
        return <PWAInstallPrompt onContinue={() => setInstallStep(false)} />;
    }

    // 3. Identity Setup
    if (!hasIdentity) {
        return <NickEntry screenId={id} onComplete={() => setHasIdentity(true)} />;
    }


    return (
        <div className="min-h-screen bg-[#050505] flex flex-col pwa-mode">
            {/* Identity Bar */}
            <div className="bg-[#111] border-b border-white/5 px-4 py-2 flex justify-between items-center shadow-2xl z-20 sticky top-0">
                <button
                    onClick={handleChangeIdentity}
                    className="flex items-center gap-3 hover:bg-white/5 p-1 rounded-xl transition-all group pr-4"
                    title="Cambiar Apodo o Emoji"
                >
                    <div className="relative w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-xl group-hover:border-primary/50 transition-colors">
                        {emoji}
                        <div className="absolute -top-1 -right-1 bg-primary text-[8px] p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            ✏️
                        </div>
                    </div>
                    <div className="text-left">
                        <p className="font-black text-white text-md tracking-tight flex items-center gap-2">
                            {nickname}
                            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-tighter">Editar Perfil</span>
                        </p>
                    </div>
                </button>

                <IdentityBadge />
            </div>

            {/* Content */}
            <div className="flex-1">
                <WheelSelector screenId={id} />
            </div>
        </div>
    );
}
