'use client';

import { useGameStore } from '@/lib/store/gameStore';
import DynamicAnimalSelector from '@/components/individual/DynamicAnimalSelector';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function PreSelectPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const { user } = useAuth(); // Identidad del usuario autenticado (si hay)

    const mode = useGameStore((state) => state.gameMode);
    const { selectedAnimals, activeWheelId, nickname, emoji, setQueueId } = useGameStore();

    // Estado local para wheelId
    const [currentLocalWheelId, setCurrentLocalWheelId] = useState<string | null>(activeWheelId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [packageInfo, setPackageInfo] = useState<{
        packageId?: string;
        spinNumber: number;
        totalSpins: number;
        code?: string;
    } | null>(null);

    // 1. Cargar Info de Paquete y WheelId
    useEffect(() => {
        // Wheel ID desde URL prioridad, fallback al store
        const urlWheelId = searchParams.get('wheelId');
        if (urlWheelId) {
            setCurrentLocalWheelId(urlWheelId);
            useGameStore.getState().setGameMode('individual', urlWheelId);
        }

        // Package Info desde localStorage (seteado en Payment)
        const stored = localStorage.getItem('current_package');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                setPackageInfo(data);
            } catch (e) {
                console.error('Error parsing package info:', e);
            }
        } else {
            // Si no hay paquete, ¿deberíamos redirigir a payment?
            // Depende. Si es "Cash" directo quizás no hay localStorage.
            // Por ahora asumimos que vienen de PaymentPage.
        }
    }, [searchParams]);


    // 2. REALTIME BROADCAST (Restore visual magic)
    useEffect(() => {
        // Only broadcast if we have a nickname (identity established)
        if (!nickname) return;

        const channel = supabase.channel(`screen_${id}`);

        // Debounce simple para no saturar
        const timer = setTimeout(() => {
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'preview_update',
                        payload: {
                            nickname: nickname,
                            emoji: emoji || '😎',
                            selections: selectedAnimals
                        }
                    });
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [id, nickname, emoji, selectedAnimals]);

    const handleConfirmAndJoin = async () => {
        if (selectedAnimals.length !== 3) return;
        setIsSubmitting(true);

        try {
            // Preparar objeto de inseción
            const insertPayload: any = {
                screen_number: parseInt(id),
                player_name: nickname || 'Jugador',
                player_emoji: emoji || '😎',
                player_id: user?.id || null, // VINCULACIÓN DE IDENTIDAD CLAVE
                status: 'waiting', // Entra directo a WAITING
                selected_wheel_id: currentLocalWheelId || null,
                selected_animals: selectedAnimals, // SELECCIÓN PREVIA!
                created_at: new Date().toISOString()
            };

            // Si hay paquete activo, vincularlo
            if (packageInfo) {
                insertPayload.package_code = packageInfo.code;
                insertPayload.package_tracking_id = packageInfo.packageId;
                insertPayload.spin_number = packageInfo.spinNumber;
            }

            // INSERTAR EN COLA
            const { data, error } = await supabase
                .from('player_queue')
                .insert(insertPayload)
                .select()
                .single();

            if (data && !error) {
                console.log("✅ Joined Queue with Selections:", data.id);
                setQueueId(data.id);

                // Redirigir a página de espera (o select si falla algo, pero debería ir a waiting)
                // Usamos la página 'select' actual del sistema que maneja el estado 'waiting' también
                // O mejor, una página dedicada de 'waiting'. 
                // Revisando `select/page.tsx`, maneja 'waiting' y muestra "ESTÁS EN LA FILA".
                // Así que redirigimos a `select` que actuará como Waiting Room.
                router.push(`/individual/screen/${id}/select`);
            } else {
                console.error("❌ Link Error:", error);
                alert("Error al unirse a la fila. Intenta nuevamente.");
                setIsSubmitting(false);
            }

        } catch (err) {
            console.error("Critical Error:", err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden">
            <header className="px-4 py-3 bg-gray-900/90 backdrop-blur-sm z-10 flex-none border-b border-gray-800">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent animate-pulse">
                            ¡Prepara tu Jugada!
                        </h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">
                            Elige 3 opciones antes de entrar
                        </p>
                    </div>
                </div>
            </header>

            {/* Selector Reutilizable */}
            <div className="flex-1 overflow-hidden relative">
                <DynamicAnimalSelector wheelId={currentLocalWheelId} mode={mode} />
            </div>

            {/* Botón de Acción */}
            <div className="flex-none p-4 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 pb-8">
                <button
                    onClick={handleConfirmAndJoin}
                    disabled={selectedAnimals.length !== 3 || isSubmitting}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all shadow-lg
                        ${selectedAnimals.length === 3
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transform active:scale-[0.98] shadow-blue-500/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}
                    `}
                >
                    {isSubmitting ? 'Uniéndose...' : (selectedAnimals.length === 3 ? 'CONFIRMAR Y UNIRSE A LA COLA 🚀' : `Elige ${3 - selectedAnimals.length} más`)}
                </button>
            </div>
        </div>
    );
}
