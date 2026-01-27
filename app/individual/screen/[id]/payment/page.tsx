'use client';

import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import React from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PaymentPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();

    const setPaymentStatus = useGameStore((state) => state.setPaymentStatus);
    const setGameMode = useGameStore((state) => state.setGameMode);

    const supabase = createClient(); // Instantiate here if not present, but better to use import

    useEffect(() => {
        const wheelId = searchParams.get('wheelId');
        const modeParam = searchParams.get('mode');
        const mode = (modeParam as 'group' | 'individual') || (wheelId ? 'individual' : 'group');

        setGameMode(mode, wheelId || undefined);

        // REMOVED: Immediate screen_state sync. 
        // We now wait for the player turn to promote and switch theme.
    }, [searchParams, setGameMode, id]);

    const { nickname, emoji, setQueueId } = useGameStore();

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

            // Allow demo only if NO ONE is waiting, playing or in selection process
            if (!error && count === 0) {
                setCanDemo(true);
            } else {
                setCanDemo(false);
            }
        };
        checkQueue();

        // Optional: Poll every 5s to update availability
        const interval = setInterval(checkQueue, 5000);
        return () => clearInterval(interval);
    }, [id, supabase]);

    const handleDemoSpin = async () => {
        if (demoSpins <= 0) return;

        // Double check queue before firing (Race condition protection)
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

        // Trigger Demo Spin on TV
        const { error } = await supabase
            .from('screen_state')
            .update({
                status: 'spinning', // Direct Spin
                is_demo: true,
                player_name: 'Modo Práctica',
                player_emoji: '🎓'
            })
            .eq('screen_number', parseInt(id));

        if (error) {
            console.error("Demo Spin Error:", error);
            setIsSpinningDemo(false);
        } else {
            // Re-enable button after 5s (approx spin time)
            setTimeout(() => setIsSpinningDemo(false), 5000);
        }
    };

    const handlePayment = async (method: 'cash' | 'mercadopago', codeUsed?: string) => {
        // En producción aquí iría la integración real
        // Por ahora simulamos pago exitoso

        // 1. Resolve Wheel ID
        const wheelId = searchParams.get('wheelId');

        // 2. INSERT INTO QUEUE
        try {
            const { data, error } = await supabase
                .from('player_queue')
                .insert({
                    screen_number: parseInt(id),
                    player_name: nickname,
                    player_emoji: emoji,
                    status: 'selecting',
                    selected_wheel_id: wheelId || null,
                    package_code: codeUsed || null, // SAVE THE CODE FOR RECOVERY
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (data && !error) {
                console.log("✅ Queue Item Created:", data.id);
                setQueueId(data.id);
                router.push(`/individual/screen/${id}/select`);
            } else {
                console.error("❌ Queue Create Error:", error);
                setRedeemError('Error al crear sesión en la fila');
            }
        } catch (err) {
            console.error("Queue Error:", err);
            setRedeemError('Error de red al unirse a la fila');
        }
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

    const confirmRedemption = async () => {
        const cleanCode = redeemCode.trim().toUpperCase();
        if (!cleanCode) return;

        setIsRedeeming(true);
        setRedeemError('');

        try {
            // STEP 1: SESSION RESCUE CHECK
            // Check if this code already has an active session on this screen
            const { data: existingSession } = await supabase
                .from('player_queue')
                .select('id, status')
                .eq('screen_number', parseInt(id))
                .eq('package_code', cleanCode)
                .neq('status', 'completed') // Assuming completed sessions are done
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingSession) {
                console.log("♻️ Session rescued for code:", cleanCode);
                setQueueId(existingSession.id);

                // Redirect based on rescued status
                if (existingSession.status === 'selecting') {
                    router.push(`/individual/screen/${id}/select`);
                } else if (existingSession.status === 'completed') {
                    // Logic for completed session - if it happened recently, maybe show result?
                    router.push(`/individual/screen/${id}/result`);
                } else {
                    router.push(`/individual/screen/${id}/select`);
                }
                return;
            }

            // STEP 2: NORMAL REDEMPTION
            const { data, error } = await supabase.rpc('redeem_game_package', {
                p_code: cleanCode,
                p_screen_id: parseInt(id)
            });

            if (error) throw error;

            if (data && data.success) {
                // Success! Create a new session with this code
                handlePayment('cash', cleanCode);
            } else {
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

                        <p className="text-sm text-gray-500 mb-4">
                            Ingresa el código impreso en tu ticket del Kiosco.
                        </p>

                        <input
                            type="text"
                            className="w-full border-2 border-gray-200 rounded-lg p-3 text-center text-xl font-mono uppercase mb-4 focus:border-primary focus:outline-none"
                            placeholder="EJ: KIOSK-1234"
                            value={redeemCode}
                            onChange={(e) => setRedeemCode(e.target.value)}
                        />

                        {redeemError && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center border border-red-100">
                                {redeemError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCodeInput(false)}
                                className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmRedemption}
                                disabled={isRedeeming || !redeemCode.trim()}
                                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
                            >
                                {isRedeeming ? 'Validando...' : 'Canjear'}
                            </button>
                        </div>
                    </div>
                </div>
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
