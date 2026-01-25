'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';

interface Wheel {
    id: string;
    name: string;
    theme_category: string;
    segment_count: number;
    background_image: string;
    storage_path: string;
}

export default function WheelSelector({ screenId }: { screenId: string }) {
    const [wheels, setWheels] = useState<Wheel[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadWheels() {
            const { data, error } = await supabase
                .from('individual_wheels')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setWheels(data);
            }
            setLoading(false);
        }

        loadWheels();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-2xl">Cargando ruletas...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <h1 className="text-3xl font-bold text-center mb-8">Elige tu Ruleta</h1>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Static Group Mode - 36 Animals */}
                <button
                    onClick={() => handleSelectWheel('group')}
                    className="group relative bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all hover:scale-105 text-left w-full"
                >
                    <div className="aspect-square relative">
                        <Image
                            src="/animals/1.jpg"
                            alt="Ruleta Grupal"
                            fill
                            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <h3 className="text-2xl font-bold mb-2">🎲 Ruleta Grupal</h3>
                        <p className="text-sm opacity-90">36 Animales Clásicos</p>
                        <div className="mt-3 inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-xs">
                            Modo Sorteo
                        </div>
                    </div>
                </button>

                {/* Dynamic Individual Wheels */}
                {wheels.map((wheel) => (
                    <button
                        key={wheel.id}
                        onClick={() => handleSelectWheel('individual', wheel.id)}
                        className="group relative bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all hover:scale-105 text-left w-full"
                    >
                        <div className="aspect-square relative">
                            <Image
                                src={wheel.background_image}
                                alt={wheel.name}
                                fill
                                className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <h3 className="text-2xl font-bold mb-2">🎮 {wheel.name}</h3>
                            <p className="text-sm opacity-90">{wheel.segment_count} Segmentos</p>
                            <div className="mt-3 inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-xs">
                                {wheel.theme_category}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
