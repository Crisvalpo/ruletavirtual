'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ScreenLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const { id } = useParams();
    const router = useRouter();
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = React.useMemo(() => createClient(), []);

    useEffect(() => {
        if (!id) return;
        const screenNum = parseInt(id as string);

        const channel = supabase.channel('global_presence_monitor_layout');

        const syncPresence = () => {
            const state = channel.presenceState();
            let active = false;

            Object.values(state).forEach((presences: any) => {
                presences.forEach((p: any) => {
                    if (p.type === 'display' && p.screen === screenNum) {
                        active = true;
                    }
                });
            });

            setIsOnline(active);
            if (active) {
                setLoading(false);
            }
        };

        channel
            .on('presence', { event: 'sync' }, syncPresence)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Esperamos un momento corto para dar tiempo a la sincronización inicial
                    setTimeout(() => {
                        syncPresence();
                    }, 500);
                }
            });

        // Timeout máximo de 2.5 segundos para declarar offline
        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 2500);

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(timeoutId);
        };
    }, [id, supabase]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6">
                {/* Premium Background Blobs */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                </div>
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-white/5 border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-md" />
                </div>
                <div className="text-center space-y-2 z-10">
                    <p className="text-sm font-black tracking-[0.2em] text-primary uppercase animate-pulse">Verificando Pantalla</p>
                    <p className="text-xs text-white/40">Comprobando conexión con la TV #{id}...</p>
                </div>
            </div>
        );
    }

    if (!isOnline) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center space-y-8 relative overflow-hidden">
                {/* Premium Background Blobs */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-500/15 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full animate-pulse delay-1000" />
                </div>

                <div className="w-24 h-24 bg-red-500/10 backdrop-blur-xl rounded-3xl flex items-center justify-center shadow-2xl border border-red-500/20 z-10 relative">
                    <span className="text-4xl text-red-500 animate-pulse">📡</span>
                    <div className="absolute inset-0 bg-red-500/5 rounded-3xl blur-md" />
                </div>

                <div className="space-y-4 max-w-sm z-10">
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
                        TV #{id} <span className="text-red-500">Offline</span>
                    </h1>
                    <p className="text-gray-400 text-sm font-medium leading-relaxed">
                        La pantalla seleccionada no se encuentra conectada en este momento.
                    </p>
                    <p className="text-xs text-white/30 font-medium">
                        Por favor, asegúrate de que la TV física esté encendida y conectada a internet antes de jugar o usar tus tickets.
                    </p>
                </div>

                <div className="w-full max-w-xs space-y-3 z-10">
                    <button
                        onClick={() => router.push('/')}
                        className="w-full bg-white/10 hover:bg-white/15 active:scale-95 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs border border-white/10 shadow-lg shadow-white/5"
                    >
                        Volver al Selector
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
