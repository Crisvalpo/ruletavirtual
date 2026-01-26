'use client';

import { useGameStore } from '@/lib/store/gameStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect } from 'react';
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
        // Default to individual if wheelId is present, otherwise group
        const modeParam = searchParams.get('mode');
        const mode = (modeParam as 'group' | 'individual') || (wheelId ? 'individual' : 'group');

        setGameMode(mode, wheelId || undefined);

        // SYNC WITH TV: Update Supabase screen_state
        if (wheelId) {
            const syncScreen = async () => {
                const { error } = await supabase
                    .from('screen_state')
                    .update({
                        current_wheel_id: wheelId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('screen_number', parseInt(id));

                if (error) console.error("Error syncing screen:", error);
            };
            syncScreen();
        }
    }, [searchParams, setGameMode, id]); // Added id to dependency

    const { nickname, emoji, setQueueId, gameMode, activeWheelId } = useGameStore();

    const handlePayment = async (method: 'cash' | 'mercadopago') => {
        // En producción aquí iría la integración real
        // Por ahora simulamos pago exitoso
        setPaymentStatus(true, method);

        const wheelId = searchParams.get('wheelId');

        // INSERT INTO QUEUE
        try {
            const { data, error } = await supabase
                .from('player_queue')
                .insert({
                    screen_number: parseInt(id),
                    player_name: nickname,
                    player_emoji: emoji,
                    status: 'selecting', // Choosing animals next
                    created_at: new Date().toISOString(),
                    // Optional: store game mode info if table supports it (JSON/columns)
                    // For now, rely on screen_state update later or local flow
                })
                .select()
                .single();

            if (data && !error) {
                console.log("Queue Item Created:", data.id);
                setQueueId(data.id);
            } else {
                console.error("Queue Create Error:", error);
            }
        } catch (err) {
            console.error("Queue Error:", err);
        }

        if (wheelId) {
            // Correct Flow: Payment -> Select Preferences -> Spin
            router.push(`/individual/screen/${id}/select`);
        } else {
            router.push(`/individual/screen/${id}/select`);
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
                        onClick={() => handlePayment('cash')}
                        className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg"
                    >
                        Pagar en Efectivo
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
                        onClick={() => handlePayment('cash')}
                        className="w-full bg-gray-100 text-gray-700 font-semibold py-2 rounded-lg text-sm"
                    >
                        Efectivo
                    </button>
                </div>
            </div>
        </div>
    );
}
