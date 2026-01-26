'use client';

import { ANIMAL_LIST } from '@/lib/constants/animals';
import { useGameStore } from '@/lib/store/gameStore';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DynamicSegment {
    id: number;
    name: string;
    emoji: string;
    selectorImage: string;
}

interface DynamicSelectorProps {
    wheelId?: string | null; // If provided, load from storage
    mode?: 'group' | 'individual';
}

export default function DynamicAnimalSelector({ wheelId, mode = 'group' }: DynamicSelectorProps) {
    const selectedAnimals = useGameStore((state) => state.selectedAnimals);
    const toggleAnimal = useGameStore((state) => state.toggleAnimalSelection);
    const [segments, setSegments] = useState<DynamicSegment[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadSegments() {
            if (mode === 'group') {
                // Use static 36 animals
                setSegments(ANIMAL_LIST.map(a => ({
                    id: a.id,
                    name: a.name,
                    emoji: a.emoji,
                    selectorImage: a.imageSelector
                })));
                setLoading(false);
            } else if (wheelId) {
                // Load from storage
                const { data: wheel } = await supabase
                    .from('individual_wheels')
                    .select('storage_path')
                    .eq('id', wheelId)
                    .single();

                if (wheel) {
                    const storagePath = wheel.storage_path;
                    const tempSegments: DynamicSegment[] = [];

                    for (let i = 1; i <= 12; i++) {
                        const { data } = supabase.storage
                            .from('individual-wheels')
                            .getPublicUrl(`${storagePath}/selector/${i}.jpg`);

                        tempSegments.push({
                            id: i,
                            name: `Segmento ${i}`,
                            emoji: '🎮',
                            selectorImage: data.publicUrl
                        });
                    }

                    setSegments(tempSegments);
                }
                setLoading(false);
            }
        }

        loadSegments();
    }, [wheelId, mode]);

    if (loading) {
        return <div className="flex items-center justify-center p-8 text-white/50">Cargando opciones...</div>;
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-2 overflow-y-auto h-full content-start">
            {segments.map((segment) => {
                const isSelected = selectedAnimals.includes(segment.id);

                return (
                    <button
                        key={segment.id}
                        onClick={() => toggleAnimal(segment.id)}
                        className={`
              relative aspect-square rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all duration-300
              ${isSelected
                                ? 'bg-gradient-to-br from-green-500/20 to-green-600/30 ring-2 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)] scale-95'
                                : 'bg-white/5 hover:bg-white/10 ring-1 ring-white/10'}
            `}
                    >
                        {/* Image */}
                        <div className="relative w-full h-full rounded-xl overflow-hidden">
                            <Image
                                src={segment.selectorImage}
                                alt={segment.name}
                                fill
                                className={`object-cover transition-all duration-300 ${isSelected ? 'scale-110' : 'scale-100 opacity-90'}`}
                                sizes="(max-width: 768px) 33vw, 20vw"
                            />

                            {/* Overlay specifically for non-selected items to make selected pop more */}
                            {!isSelected && (
                                <div className="absolute inset-0 bg-black/10" />
                            )}
                        </div>

                        {/* Selection Number Badge */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 z-10 bg-green-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-md ring-2 ring-black/50">
                                {selectedAnimals.indexOf(segment.id) + 1}
                            </div>
                        )}

                        {/* ID Badge - Minimalist */}
                        <div className={`absolute bottom-1 left-1.5 z-10 text-[10px] font-medium px-1.5 py-0.5 rounded-md backdrop-blur-md ${isSelected ? 'bg-green-500/80 text-white' : 'bg-black/40 text-white/70'
                            }`}>
                            #{segment.id}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
