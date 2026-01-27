'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Wheel {
    id: string;
    name: string;
    theme_category: string;
    segment_count: number;
    background_image: string;
    image_preview?: string;
    storage_path: string;
}

export default function WheelSelector({ screenId }: { screenId: string }) {
    const [wheels, setWheels] = useState<Wheel[]>([]);
    const [activeWheelId, setActiveWheelId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        async function loadData() {
            // 1. Load Wheels
            const { data: wheelData, error: wheelError } = await supabase
                .from('individual_wheels')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            // 2. Load Current Screen Status
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('current_wheel_id')
                .eq('screen_number', parseInt(screenId))
                .single();

            if (!wheelError && wheelData) {
                const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;
                const processedWheels = wheelData.map(w => ({
                    ...w,
                    background_image: w.background_image?.startsWith('http')
                        ? w.background_image
                        : `${STORAGE_BASE}/${w.background_image}`,
                    image_preview: w.image_preview?.startsWith('http')
                        ? w.image_preview
                        : w.image_preview
                            ? `${STORAGE_BASE}/${w.image_preview}`
                            : null
                }));
                setWheels(processedWheels);
            }

            if (screenData) {
                setActiveWheelId(screenData.current_wheel_id);
            }

            setLoading(false);
        }

        loadData();
    }, [screenId]);

    const handleSelectWheel = (mode: string, wheelId?: string) => {
        console.log("Selected:", mode, wheelId);
        if (wheelId) {
            router.push(`/individual/screen/${screenId}/payment?wheelId=${wheelId}`);
        } else if (mode === 'group') {
            // Handle group mode selection if needed, or default
            router.push(`/individual/screen/${screenId}/payment?mode=group`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-2xl">Cargando ruletas...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 pb-12 pt-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Dynamic Individual Wheels */}
                {wheels.map((wheel) => {
                    const isActive = wheel.id === activeWheelId;
                    return (
                        <button
                            key={wheel.id}
                            onClick={() => handleSelectWheel('individual', wheel.id)}
                            className={`
                                group relative w-full overflow-hidden rounded-2xl transition-all duration-500
                                ${isActive
                                    ? 'ring-4 ring-primary ring-offset-4 ring-offset-[#050505] scale-[1.02] z-10'
                                    : 'hover:scale-[1.01] opacity-70 hover:opacity-100'
                                }
                            `}
                        >
                            {/* Horizontal Card Container (21:9 approx) */}
                            <div className="relative aspect-[21/9] w-full bg-gray-900 shadow-2xl">
                                <Image
                                    src={wheel.image_preview || wheel.background_image}
                                    alt={wheel.name}
                                    fill
                                    className={`
                                        object-cover transition-transform duration-700 
                                        ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                                    `}
                                />

                                {/* Complex Overlays */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black to-transparent" />

                                {/* Content Layer */}
                                <div className="absolute inset-0 p-6 md:p-10 flex flex-col justify-center">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            {isActive && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest mb-3 animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                                    Activa en Pantalla
                                                </span>
                                            )}
                                            <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter flex items-center gap-3">
                                                {wheel.name}
                                            </h3>
                                            <div className="flex gap-2 pt-2">
                                                <span className="px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-tight text-white">
                                                    {wheel.theme_category || 'General'}
                                                </span>
                                                <span className={`px-3 py-1 rounded-lg backdrop-blur-md border text-[10px] font-black uppercase tracking-tight ${
                                                    isActive 
                                                        ? 'bg-primary/20 border-primary text-primary animate-pulse' 
                                                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                                                }`}>
                                                    {isActive ? '🔥 Top Jugada' : '⭐ Recomendada'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="hidden md:flex flex-col items-end">
                                            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}

                {wheels.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-3xl">
                        <p className="text-gray-500 font-bold uppercase tracking-widest">No hay mundos disponibles</p>
                    </div>
                )}
            </div>

            {/* Selection Footer */}
            <div className="max-w-4xl mx-auto mt-12 text-center">
                <p className="text-xs text-gray-600 font-bold uppercase tracking-[0.2em]">Antigravity Engine High-Res</p>
            </div>
        </div>
    );
}
