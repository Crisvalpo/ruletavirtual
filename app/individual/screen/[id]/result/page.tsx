'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/gameStore';
import { useRouter } from 'next/navigation';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeCanvas } from 'qrcode.react';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';

export default function ResultPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const { selectedAnimals, nickname, queueId } = useGameStore();

    const [status, setStatus] = useState<'loading' | 'winning' | 'losing' | 'auto_rejoin'>('loading');
    const [dbSelections, setDbSelections] = useState<number[]>([]);
    const [email, setEmail] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [ticketCode, setTicketCode] = useState<string | null>(null);

    // Package tracking state
    const [packageInfo, setPackageInfo] = useState<{
        packageId: string;
        spinNumber: number;
        totalSpins: number;
        spinsRemaining: number;
        code: string;
    } | null>(null);
    const [autoRejoinCountdown, setAutoRejoinCountdown] = useState(5);

    const { baseUrl } = useVenueSettings();
    const { user, profile, signInWithGoogle } = useAuth();

    // Check if user is actually identified (has email) vs anonymous
    const isIdentified = !!user?.email;

    // Redirect if no queueId (no active session)
    useEffect(() => {
        if (!queueId) {
            // Give it a moment in case zustand is still hydrating
            const timer = setTimeout(() => {
                if (!queueId) {
                    router.push(`/individual/screen/${id}`);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [queueId, id, router]);

    useEffect(() => {
        // If user just identified themselves while on this page, link the prize
        if (isIdentified && queueId && !isSaved) {
            handleSavePrize(user.email!);
        }
    }, [isIdentified, queueId]);

    const handleSavePrize = async (userEmail: string) => {
        if (!queueId) return;
        setIsSaving(true);
        const { error } = await supabase
            .from('player_queue')
            .update({
                email: userEmail,
                player_id: user?.id
            })
            .eq('id', queueId);

        if (!error) setIsSaved(true);
        setIsSaving(false);
    };

    useEffect(() => {
        let isMounted = true;

        const checkResult = async () => {
            try {
                if (!queueId) return;

                // 1. Fetch own queue record first (Session specific result)
                const { data: queueData, error: queueError } = await supabase
                    .from('player_queue')
                    .select('selected_animals, spin_result, status, package_code')
                    .eq('id', queueId)
                    .maybeSingle();

                if (queueError) {
                    console.error("Error fetching session result:", queueError);
                    return;
                }

                if (queueData) {
                    const effectiveSelections = (queueData.selected_animals as number[]) || selectedAnimals;
                    if (effectiveSelections.length > 0 && isMounted) {
                        setDbSelections(effectiveSelections);
                    }
                    if (queueData.package_code && isMounted) {
                        setTicketCode(queueData.package_code);
                    }

                    // 2. If we already have a result saved in our own record, show it!
                    if (queueData.spin_result !== null) {
                        const isWin = effectiveSelections.includes(queueData.spin_result);
                        if (isMounted) setStatus(isWin ? 'winning' : 'losing');
                        return;
                    }
                }

                // 3. Fallback to check global screen state ONLY for transition
                const { data: screenData } = await supabase
                    .from('screen_state')
                    .select('last_spin_result, status')
                    .eq('screen_number', parseInt(id))
                    .maybeSingle();

                if (screenData) {
                    if (screenData.status === 'spinning') {
                        if (isMounted) setStatus('loading');
                    } else if (screenData.last_spin_result !== null) {
                        // Use local selectedAnimals if DB selections haven't loaded yet
                        const selections = dbSelections.length > 0 ? dbSelections : selectedAnimals;
                        if (selections.length > 0) {
                            const isWin = selections.includes(screenData.last_spin_result);
                            if (isMounted) setStatus(isWin ? 'winning' : 'losing');
                        }
                    }
                }
            } catch (err) {
                console.error("Unexpected error in checkResult:", err);
            }
        };

        checkResult();

        // 2. Realtime Subscription for OUR OWN record
        const channel = supabase
            .channel(`player_result_${queueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'player_queue',
                    filter: `id=eq.${queueId}`
                },
                (payload) => {
                    console.log("📨 Realtime Packet:", payload);
                    if (isMounted) {
                        const newResult = payload.new.spin_result;
                        const newStatus = payload.new.status;
                        console.log(`Checking update: Result=${newResult}, Status=${newStatus}`);

                        if (newResult !== null) {
                            console.log("🎯 Personal Result Received:", newResult);
                            const selections = (payload.new.selected_animals as number[]) || selectedAnimals;
                            const isWin = selections.includes(newResult);
                            setStatus(isWin ? 'winning' : 'losing');
                        }
                    }
                }
            )
            .subscribe((status) => console.log("📡 Subscription Status:", status));

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [id, selectedAnimals, queueId, supabase]);

    // Check for package tracking and auto-rejoin
    useEffect(() => {
        if (status !== 'winning' && status !== 'losing') return;

        const checkPackageStatus = async () => {
            // Load package info from localStorage
            const stored = localStorage.getItem('current_package');
            if (!stored) return;

            try {
                const data = JSON.parse(stored);

                // Query package_tracking to get current status
                const { data: packageData, error } = await supabase
                    .from('package_tracking')
                    .select('total_spins, spins_consumed')
                    .eq('id', data.packageId)
                    .single();

                if (error || !packageData) {
                    console.error('Error fetching package:', error);
                    return;
                }

                const spinsRemaining = packageData.total_spins - packageData.spins_consumed;

                if (spinsRemaining > 0) {
                    console.log(`📦 Package has ${spinsRemaining} spins remaining`);

                    setPackageInfo({
                        packageId: data.packageId,
                        spinNumber: packageData.spins_consumed + 1,
                        totalSpins: packageData.total_spins,
                        spinsRemaining,
                        code: data.code
                    });

                    // Show auto-rejoin screen
                    setStatus('auto_rejoin');
                } else {
                    // Package complete, clear localStorage
                    localStorage.removeItem('current_package');
                }
            } catch (e) {
                console.error('Error parsing package info:', e);
            }
        };

        // Wait 3 seconds before checking (let user see result)
        const timer = setTimeout(checkPackageStatus, 3000);
        return () => clearTimeout(timer);
    }, [status, supabase]);

    // Auto-rejoin countdown
    useEffect(() => {
        if (status !== 'auto_rejoin') return;

        if (autoRejoinCountdown === 0) {
            handleAutoRejoin();
            return;
        }

        const timer = setTimeout(() => {
            setAutoRejoinCountdown(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [status, autoRejoinCountdown]);

    const handleAutoRejoin = async () => {
        if (!packageInfo) return;

        console.log('🔄 Auto-rejoining queue...');

        try {
            const deviceFingerprint = getDeviceFingerprint();

            // Call RPC to continue package
            const { data, error } = await supabase.rpc('redeem_or_continue_package', {
                p_code: packageInfo.code,
                p_device_fingerprint: deviceFingerprint,
                p_screen_number: parseInt(id),
                p_player_name: nickname,
                p_player_emoji: useGameStore.getState().emoji,
                p_player_id: user?.id || null
            });

            if (error || !data?.success) {
                console.error('Error continuing package:', error);
                return;
            }

            // Update package info in localStorage
            localStorage.setItem('current_package', JSON.stringify({
                packageId: data.package_id,
                spinNumber: data.spin_number,
                totalSpins: data.total_spins,
                code: packageInfo.code
            }));

            // Create new queue entry
            const wheelId = useGameStore.getState().activeWheelId;
            const { data: queueData, error: queueError } = await supabase
                .from('player_queue')
                .insert({
                    screen_number: parseInt(id),
                    player_name: nickname,
                    player_emoji: useGameStore.getState().emoji,
                    player_id: user?.id || null,
                    status: 'selecting',
                    selected_wheel_id: wheelId || null,
                    package_code: packageInfo.code,
                    package_tracking_id: data.package_id,
                    spin_number: data.spin_number,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (queueData && !queueError) {
                console.log('✅ Auto-rejoin successful:', queueData.id);
                useGameStore.getState().setQueueId(queueData.id);
                useGameStore.getState().setSelectedAnimals([]);
                router.push(`/individual/screen/${id}/select`);
            } else {
                console.error('❌ Queue create error:', queueError);
            }
        } catch (err) {
            console.error('Auto-rejoin error:', err);
        }
    };

    const handlePlayAgain = () => {
        // Clear selected animals for a fresh start
        useGameStore.getState().setSelectedAnimals([]);
        // Clear queueId to start a new session
        useGameStore.getState().setQueueId(null);
        // Return to entry page
        router.push(`/individual/screen/${id}`);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white perspective-1000">

            {status === 'loading' && (
                <div className="text-center animate-pulse">
                    <div className="text-6xl mb-4 animate-spin">🎲</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Girando...</h1>
                    <p className="text-gray-400">¡Buena Suerte!</p>
                </div>
            )}

            {status === 'winning' && (
                <div className="text-center animate-in zoom-in duration-500 max-w-sm w-full">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h1 className="text-4xl font-bold text-yellow-400 mb-2">¡GANASTE!</h1>
                    <p className="text-xl mb-4">La ruleta cayó en tu elección</p>

                    {!isSaved ? (
                        <div className="bg-gray-800/80 backdrop-blur-md p-6 rounded-2xl border border-yellow-500/30 mb-6 shadow-xl">
                            <h3 className="text-lg font-bold text-yellow-500 mb-2">🎁 Asegura tu Premio</h3>
                            <p className="text-xs text-gray-400 mb-6">Inicia sesión para registrar este premio en tu historial y participar en sorteos especiales.</p>

                            <button
                                onClick={signInWithGoogle}
                                disabled={isSaving}
                                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                            >
                                <span className="text-xl">
                                    <svg width="24" height="24" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                </span>
                                INICIAR CON GOOGLE
                            </button>
                        </div>
                    ) : (
                        <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl mb-6 flex items-center gap-3 animate-in fade-in">
                            <span className="text-2xl">✅</span>
                            <div className="text-left">
                                <p className="font-bold text-green-400 text-sm">¡Premio Registrado!</p>
                                <p className="text-[10px] text-green-300">Vinculado a {user?.email || 'tu cuenta'}</p>
                            </div>
                        </div>
                    )}


                    <div className="bg-white text-gray-900 p-6 rounded-xl mb-6 transform rotate-2 shadow-2xl border-4 border-yellow-400 flex flex-col justify-center">
                        <p className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-1">CÓDIGO DE CANJE</p>
                        <p className="text-3xl font-black text-green-600 tracking-tighter leading-tight">PREMIO NIVEL 1</p>
                    </div>

                    <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl transform -rotate-1">
                        <QRCodeCanvas
                            value={`${(baseUrl || window.location.origin).trim()}/staff/validate/${ticketCode || queueId?.slice(0, 8)}`}
                            size={180}
                            level="H"
                            includeMargin={false}
                            className="rounded-lg"
                        />
                        <p className="mt-2 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">QR VÁLIDO EN MESÓN</p>
                    </div>

                    <div className="mt-8 flex flex-col gap-4">
                        <button
                            onClick={handlePlayAgain}
                            className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                        >
                            Jugar de Nuevo
                        </button>
                        <p className="text-xs text-gray-500">Muestra esta pantalla al staff para cobrar</p>
                    </div>
                </div>
            )}

            {status === 'losing' && (
                <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-500 max-w-sm w-full">
                    <div className="text-6xl mb-4 grayscale opacity-50">😢</div>
                    <h1 className="text-3xl font-bold text-gray-300 mb-2">¡Casi!</h1>
                    <p className="text-xl mb-8 text-gray-400">Hoy no fue tu día de suerte.</p>

                    <div className="bg-gray-800 p-8 rounded-2xl mb-8 border border-gray-700">
                        <p className="text-gray-400 italic">"El que la sigue la consigue"</p>
                    </div>

                    <button
                        onClick={handlePlayAgain}
                        className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                    >
                        Intentar de Nuevo
                    </button>
                </div>
            )}

            {status === 'auto_rejoin' && packageInfo && (
                <div className="text-center animate-in fade-in zoom-in duration-500 max-w-sm w-full">
                    <div className="text-6xl mb-4">🎯</div>
                    <h1 className="text-3xl font-bold text-purple-400 mb-2">¡Tienes más giros!</h1>
                    <p className="text-xl mb-4 text-gray-300">
                        Te quedan <span className="text-yellow-400 font-bold">{packageInfo.spinsRemaining}</span> giros
                    </p>

                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-2xl mb-6 shadow-2xl">
                        <p className="text-white/80 text-sm mb-2">Próximo giro</p>
                        <p className="text-white text-3xl font-bold">
                            {packageInfo.spinNumber} de {packageInfo.totalSpins}
                        </p>
                    </div>

                    <div className="bg-gray-800/80 backdrop-blur-md p-6 rounded-2xl border border-purple-500/30 mb-6">
                        <p className="text-gray-300 mb-4">
                            Preparando tu siguiente giro...
                        </p>
                        <div className="text-5xl font-bold text-purple-400">
                            {autoRejoinCountdown}
                        </div>
                    </div>

                    <button
                        onClick={handleAutoRejoin}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white py-4 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                    >
                        Continuar Ahora
                    </button>
                </div>
            )}

        </div>
    );
}
