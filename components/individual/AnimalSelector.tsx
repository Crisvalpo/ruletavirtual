'use client';

import { ANIMAL_LIST } from '@/lib/constants/animals';
import { useGameStore } from '@/lib/store/gameStore';
import Image from 'next/image';

export default function AnimalSelector() {
    const selectedAnimals = useGameStore((state) => state.selectedAnimals);
    const toggleAnimal = useGameStore((state) => state.toggleAnimalSelection);

    return (
        <div className="grid grid-cols-6 gap-2 p-2 bg-gray-800 rounded-xl overflow-y-auto max-h-[60vh]">
            {ANIMAL_LIST.map((animal) => {
                const isSelected = selectedAnimals.includes(animal.id);

                return (
                    <button
                        key={animal.id}
                        onClick={() => toggleAnimal(animal.id)}
                        className={`
              relative aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-all duration-200
              ${isSelected
                                ? 'bg-primary scale-95 ring-2 ring-white shadow-lg opacity-100'
                                : 'bg-white/10 hover:bg-white/20 opacity-80'}
            `}
                    >
                        {/* Show JPG image for selection UI */}
                        <div className="relative w-8 h-8 mb-1">
                            <Image
                                src={animal.imageSelector}
                                alt={animal.name}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 33vw, 20vw"
                            />
                        </div>

                        <span className={`
              text-[8px] font-bold uppercase truncate w-full text-center
              ${isSelected ? 'text-white' : 'text-gray-300'}
            `}>
                            {animal.name}
                        </span>

                        {/* Selection Number Badge */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {selectedAnimals.indexOf(animal.id) + 1}
                            </div>
                        )}

                        {/* ID Badge */}
                        <div className={`absolute top-0.5 left-1 text-[8px] opacity-50 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {animal.id}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
