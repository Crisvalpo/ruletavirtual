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
        return <div className="flex items-center justify-center p-8">Cargando...</div>;
    }

    const maxSelection = mode === 'group' ? 3 : 3; // Both modes use 3 for now

    return (
        <div className="grid grid-cols-6 gap-2 p-2 bg-gray-800 rounded-xl overflow-y-auto max-h-[60vh]">
            {segments.map((segment) => {
                const isSelected = selectedAnimals.includes(segment.id);

                return (
                    <button
                        key={segment.id}
                        onClick={() => toggleAnimal(segment.id)}
                        className={`
              relative aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-all duration-200
              ${isSelected
                                ? 'bg-primary scale-95 ring-2 ring-white shadow-lg opacity-100'
                                : 'bg-white/10 hover:bg-white/20 opacity-80'}
            `}
                    >
                        {/* Image */}
                        <div className="relative w-8 h-8 mb-1">
                            <Image
                                src={segment.selectorImage}
                                alt={segment.name}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 33vw, 20vw"
                            />
                        </div>

                        <span className={`
              text-[8px] font-bold uppercase truncate w-full text-center
              ${isSelected ? 'text-white' : 'text-gray-300'}
            `}>
                            {segment.name}
                        </span>

                        {/* Selection Number Badge */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {selectedAnimals.indexOf(segment.id) + 1}
                            </div>
                        )}

                        {/* ID Badge */}
                        <div className={`absolute top-0.5 left-1 text-[8px] opacity-50 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {segment.id}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
