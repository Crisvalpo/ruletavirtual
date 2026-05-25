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
    const { user, profile } = useAuth(); // Identidad del usuario autenticado (si hay)

    const mode = useGameStore((state) => state.gameMode);
    const { selectedAnimals, activeWheelId, nickname, emoji, setQueueId, queueId } = useGameStore();
    const storeIsRevenge = useGameStore((state) => state.isRevenge);
    const isRevenge = searchParams.get('isRevenge') === 'true' || storeIsRevenge;
    const maxAnimals = isRevenge ? 6 : 3;

    useEffect(() => {
        const urlIsRevenge = searchParams.get('isRevenge') === 'true';
        if (urlIsRevenge && !storeIsRevenge) {
            useGameStore.getState().setIsRevenge(true);
        }
    }, [searchParams, storeIsRevenge]);

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

    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    // Validar si la sesión actual sigue siendo válida y no ha terminado
    useEffect(() => {
        if (!hasHydrated) return;

        const checkSessionValidity = async () => {
            // 1. Si hay un queueId en Zustand, verificar su estado en BD
            if (queueId) {
                const { data: queueData } = await supabase
                    .from('player_queue')
                    .select('status')
                    .eq('id', queueId)
                    .single();

                if (queueData && (queueData.status === 'completed' || queueData.status === 'abandoned' || queueData.status === 'cancelled')) {
                    console.warn("🚫 Sesión de juego ya finalizada detectada en pre-select. Limpiando.");
                    useGameStore.getState().setQueueId(null);
                    useGameStore.getState().setIsRevenge(false);
                    router.push('/');
                    return;
                }
            }

            // 2. Si no hay ticket de pago activo en localStorage, no es una revancha activa,
            // y tampoco hay una autorización temporal de pago, significa que volvió atrás de forma ilegal.
            const storedPackage = localStorage.getItem('current_package');
            const isRev = searchParams.get('isRevenge') === 'true' || storeIsRevenge;
            const isPayAuth = sessionStorage.getItem('payment_authorized') === 'true';

            if (!storedPackage && !isRev && !isPayAuth) {
                console.warn("🚫 No se detectó ticket de pago activo, revancha ni autorización de pago. Redirigiendo al selector.");
                router.push('/');
                return;
            }

            // 3. Redirigir a la pantalla de bienvenida si no tiene nickname establecido
            if (!nickname && !profile?.display_name) {
                router.push(`/individual/screen/${id}`);
            }
        };

        checkSessionValidity();
    }, [hasHydrated, queueId, storeIsRevenge, searchParams, supabase, id, nickname, router]);

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
        if (selectedAnimals.length !== maxAnimals) return;
        setIsSubmitting(true);

        try {
            // NUEVO: Verificar si ya existe una entrada activa
            if (queueId) {
                const { data: existingQueue } = await supabase
                    .from('player_queue')
                    .select('id, status')
                    .eq('id', queueId)
                    .eq('screen_number', parseInt(id))
                    .in('status', ['selecting', 'waiting', 'playing'])
                    .maybeSingle();

                if (existingQueue) {
                    console.log("✅ Actualizando entrada existente en lugar de duplicar:", queueId);
                    // Actualizar en lugar de insertar
                    const { error } = await supabase
                        .from('player_queue')
                        .update({
                            selected_animals: selectedAnimals,
                            status: 'waiting'
                        })
                        .eq('id', queueId);

                    if (!error) {
                        router.push(`/individual/screen/${id}/select`);
                        return;
                    } else {
                        console.error("Error actualizando entrada existente:", error);
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            // Preparar objeto de inseción
            const insertPayload: any = {
                screen_number: parseInt(id),
                player_name: nickname || profile?.display_name || 'Jugador Anónimo',
                player_emoji: emoji || profile?.avatar_url || '😎',
                player_id: user?.id || null, // VINCULACIÓN DE IDENTIDAD CLAVE
                status: 'waiting', // Entra directo a WAITING
                selected_wheel_id: currentLocalWheelId || null,
                selected_animals: selectedAnimals, // SELECCIÓN PREVIA!
                is_revenge: isRevenge, // Flag de revancha
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

                // Consumir la autorización de pago
                sessionStorage.removeItem('payment_authorized');

                // Redirigir a página de espera (o select si falla algo, pero debería ir a waiting)
                // Usamos la página 'select' actual del sistema que maneja el estado 'waiting' también
                // O mejor, una página dedicada de 'waiting'. 
                // Revisando `select/page.tsx`, maneja 'waiting' y muestra "ESTÁS EN LA FILA".
                // Así que redirigimos a `select` que actuará como Waiting Room.
                router.push(`/individual/screen/${id}/select`);
            } else {
                console.error("❌ Queue Insert Failed:");
                console.error("Error object:", JSON.stringify(error, null, 2));
                console.error("Error message:", error?.message);
                console.error("Error code:", error?.code);
                console.error("Error details:", error?.details);
                console.error("Error hint:", error?.hint);
                console.error("Payload attempted:", JSON.stringify(insertPayload, null, 2));
                alert(`Error al unirse a la fila: ${error?.message || 'Error desconocido'}. Por favor intenta nuevamente.`);
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
                            Elige {maxAnimals} opciones antes de entrar
                        </p>
                    </div>
                </div>
                {isRevenge && (
                    <div className="mt-2 px-3 py-1.5 bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg text-center animate-in slide-in-from-top duration-300">
                        <span className="text-xs font-bold text-orange-400">🔥 GIRO DE REVANCHA ACTIVADO (Premio Nivel 2)</span>
                    </div>
                )}
            </header>

            {/* Selector Reutilizable */}
            <div className="flex-1 overflow-hidden relative">
                <DynamicAnimalSelector wheelId={currentLocalWheelId} mode={mode} />
            </div>

            {/* Botón de Acción */}
            <div className="flex-none p-4 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 pb-8">
                <button
                    onClick={handleConfirmAndJoin}
                    disabled={selectedAnimals.length !== maxAnimals || isSubmitting}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all shadow-lg
                        ${selectedAnimals.length === maxAnimals
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transform active:scale-[0.98] shadow-blue-500/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}
                    `}
                >
                    {isSubmitting ? 'Uniéndose...' : (selectedAnimals.length === maxAnimals ? 'CONFIRMAR Y UNIRSE A LA COLA 🚀' : `Elige ${maxAnimals - selectedAnimals.length} más`)}
                </button>
            </div>
        </div>
    );
}
