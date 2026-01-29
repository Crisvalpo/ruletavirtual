'use client';

import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';

import VirtualKeyboard from '@/components/individual/VirtualKeyboard';

export default function PaymentPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();

    const setGameMode = useGameStore((state) => state.setGameMode);

    const supabase = createClient();

    useEffect(() => {
        const wheelId = searchParams.get('wheelId');
        const modeParam = searchParams.get('mode');
        const mode = (modeParam as 'group' | 'individual') || (wheelId ? 'individual' : 'group');

        setGameMode(mode, wheelId || undefined);
    }, [searchParams, setGameMode, id]);

    const { nickname, emoji, setQueueId } = useGameStore();
    const { user } = useAuth();

    // Redirect to entry if no identity configured
    useEffect(() => {
        if (nickname === 'Jugador') {
            const wheelId = searchParams.get('wheelId');
            const redirectUrl = wheelId
                ? `/individual/screen/${id}?returnTo=payment&wheelId=${wheelId}`
                : `/individual/screen/${id}`;
            router.push(redirectUrl);
        }
    }, [nickname, id, searchParams, router]);

    // Demo Mode State
    const [demoSpins, setDemoSpins] = React.useState(2);
    const [canDemo, setCanDemo] = React.useState(false);
    const [isSpinningDemo, setIsSpinningDemo] = React.useState(false);

    // Check Queue Availability for Demo
    useEffect(() => {
        const checkQueue = async () => {
            const { count, error } = await supabase
                .from('player_queue')
                .select('*', { count: 'exact', head: true })
                .eq('screen_number', parseInt(id))
                .in('status', ['waiting', 'playing', 'selecting', 'ready', 'spinning']);

            if (!error && count === 0) {
                setCanDemo(true);
            } else {
                setCanDemo(false);
            }
        };
        checkQueue();

        const interval = setInterval(checkQueue, 5000);
        return () => clearInterval(interval);
    }, [id, supabase]);

    const handleDemoSpin = async () => {
        if (demoSpins <= 0) return;

        const { count } = await supabase
            .from('player_queue')
            .select('*', { count: 'exact', head: true })
            .eq('screen_number', parseInt(id))
            .in('status', ['waiting', 'playing', 'selecting', 'ready', 'spinning']);

        if (count && count > 0) {
            setCanDemo(false);
            alert("⚠️ Alguien se unió a la fila. El Modo Práctica ya no está disponible.");
            return;
        }

        setIsSpinningDemo(true);
        setDemoSpins(prev => prev - 1);

        const { data, error } = await supabase.rpc('play_demo_spin', {
            p_screen_number: parseInt(id)
        });

        if (error || (data && !data.success)) {
            console.error("Demo Spin Error:", error || data?.message);
            setIsSpinningDemo(false);
            if (data?.message) alert(data.message);
        } else {
            // Success
            setTimeout(() => setIsSpinningDemo(false), 5000);
        }


    };

    const handlePayment = async (method: 'cash' | 'mercadopago', codeUsed?: string) => {
        const wheelId = searchParams.get('wheelId');
        // Clear previous package info to distinguish Cash play
        if (method === 'cash' || method === 'mercadopago') {
            localStorage.removeItem('current_package');
        }

        // Redirect to Pre-Select directly
        router.push(`/individual/screen/${id}/pre-select?wheelId=${wheelId || ''}`);
    };

    // Payment / Code Redemption State
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemError, setRedeemError] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    const handleCashClick = () => {
        setShowCodeInput(true);
        setRedeemError('');
        setRedeemCode('');
    };

    // Auto-Open Redemption if Code Pending/Passed
    useEffect(() => {
        const urlCode = searchParams.get('redeemCode');
        const pendingCode = localStorage.getItem('pending_ticket_code');
        const codeToUse = urlCode || pendingCode;

        if (codeToUse) {
            console.log("🎟️ Pending Ticket Found:", codeToUse);
            // FIX: Remove hyphens if present to avoid double-dash in VirtualKeyboard
            const cleanCode = codeToUse.replace(/-/g, '');
            setRedeemCode(cleanCode);
            setShowCodeInput(true);

            // Optional: Auto-submit if needed, or just prep population
            // Clean up storage to avoid loop
            if (pendingCode) localStorage.removeItem('pending_ticket_code');
        }
    }, [searchParams]);

    const confirmRedemption = async () => {
        const rawCode = redeemCode.trim().toUpperCase();
        if (rawCode.length < 5) return;

        // Auto-format for DB Search: XX-NNN
        const cleanCode = `${rawCode.slice(0, 2)}-${rawCode.slice(2)}`;

        setIsRedeeming(true);
        setRedeemError('');

        try {
            // Get device fingerprint
            const deviceFingerprint = getDeviceFingerprint();

            // Call new RPC for package redemption/continuation
            const { data, error } = await supabase.rpc('redeem_or_continue_package', {
                p_code: cleanCode,
                p_device_fingerprint: deviceFingerprint,
                p_screen_number: parseInt(id),
                p_player_name: nickname,
                p_player_emoji: emoji,
                p_player_id: user?.id || null
            });

            if (error) throw error;

            if (data && data.success) {
                console.log("✅ Package redeemed/continued:", data);

                // Store package info in localStorage for later use
                localStorage.setItem('current_package', JSON.stringify({
                    packageId: data.package_id,
                    spinNumber: data.spin_number,
                    totalSpins: data.total_spins,
                    code: cleanCode
                }));

                // REDIRECT TO PRE-SELECTION
                console.log("✅ Code Validated. Redirecting to Pre-Selection.");
                const wheelId = searchParams.get('wheelId');
                router.push(`/individual/screen/${id}/pre-select?wheelId=${wheelId || ''}`);

            } else {
                // Show specific error message from RPC
                setRedeemError(data?.message || 'Error al canjear código');
            }
        } catch (err: any) {
            console.error("Redemption Error:", err);
            setRedeemError(err.message || 'Error de conexión');
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <h1 className="text-2xl font-bold text-center mb-6">💰 Elige tu Pack</h1>

            <div className="grid gap-4 max-w-md mx-auto">
                {/* Opción 1: Jugada Individual */}
                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-transparent hover:border-primary cursor-pointer transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg">1 Jugada</h3>
                        <span className="text-primary font-bold text-xl">$1,000</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Ideal para probar suerte.</p>
                    <button
                        onClick={handleCashClick}
                        className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg"
                    >
                        Tengo un Cupón / Código
                    </button>
                </div>

                {/* Opción 2: Promo 3x (Ejemplo) */}
                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-accent relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-accent text-xs font-bold px-3 py-1 rounded-bl-lg">
                        POPULAR
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg">3 Jugadas</h3>
                        <span className="text-primary font-bold text-xl">$2,500</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Ahorras $500</p>
                    <button
                        onClick={() => handlePayment('mercadopago')}
                        className="w-full bg-primary text-white font-bold py-3 rounded-lg mb-2"
                    >
                        Mercado Pago
                    </button>
                    <button
                        onClick={handleCashClick}
                        className="w-full bg-gray-100 text-gray-700 font-semibold py-2 rounded-lg text-sm"
                    >
                        Tengo un Cupón / Código
                    </button>
                </div>
            </div>

            {/* Code Redemption Modal */}
            {showCodeInput && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Ingresa tu Código</h3>
                            <button onClick={() => setShowCodeInput(false)} className="text-gray-400 hover:text-gray-600">
                                ✕
                            </button>
                        </div>

                        <div
                            onClick={() => setShowCodeInput(true)}
                            className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-all active:scale-95 group mb-6"
                        >
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-2 group-hover:text-yellow-600">Código de Ticket</p>
                            <div className="text-3xl font-black text-gray-300 group-hover:text-yellow-500 font-mono">
                                {redeemCode ? (
                                    <>
                                        {redeemCode.slice(0, 2)}
                                        <span className="text-yellow-500">-</span>
                                        {redeemCode.slice(2)}
                                    </>
                                ) : (
                                    'XX-NNN'
                                )}
                            </div>
                        </div>

                        {redeemError && (
                            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 text-center border border-red-100 flex flex-col gap-1">
                                <span className="font-black uppercase text-[10px] tracking-widest">⚠️ Error</span>
                                <span>{redeemError}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VIRTUAL KEYBOARD OVERLAY */}
            {showCodeInput && (
                <VirtualKeyboard
                    value={redeemCode}
                    onKeyPress={(key) => {
                        setRedeemError(''); // Clear error on type
                        setRedeemCode(prev => prev + key);
                    }}
                    onDelete={() => {
                        setRedeemError('');
                        setRedeemCode(prev => prev.slice(0, -1));
                    }}
                    onClear={() => {
                        setRedeemError('');
                        setRedeemCode('');
                    }}
                    onClose={() => setShowCodeInput(false)}
                    onConfirm={confirmRedemption}
                    errorMessage={redeemError}
                />
            )}

            {/* DEMO MODE Section */}
            {canDemo && demoSpins > 0 && (
                <div className="max-w-md mx-auto mt-8 text-center animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-[1px] rounded-xl">
                        <div className="bg-white rounded-[11px] p-4">
                            <h3 className="font-bold text-gray-800 mb-2">🎓 Modo Práctica</h3>
                            <p className="text-xs text-gray-500 mb-3">
                                Prueba la ruleta gratis antes de jugar.<br />
                                <span className="font-bold text-purple-600">{demoSpins} intento(s) disponible(s)</span>
                            </p>
                            <button
                                onClick={handleDemoSpin}
                                disabled={isSpinningDemo}
                                className={`
                                    w-full py-2 rounded-lg font-bold text-sm transition-all
                                    ${isSpinningDemo
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}
                                `}
                            >
                                {isSpinningDemo ? 'Girando...' : '🎲 Probar Ruleta Gratis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Version Text */}
            <div className="text-center mt-12 text-xs text-gray-300">
                v1.3 - Kiosk Codes Enabled
            </div>
        </div>
    );
}
