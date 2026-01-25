'use client';

import { useGameStore } from '@/lib/store/gameStore';
import DynamicAnimalSelector from '@/components/individual/DynamicAnimalSelector';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function SelectionPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();

    const mode = useGameStore((state) => state.gameMode);
    const wheelId = useGameStore((state) => state.activeWheelId);
    const selectedAnimals = useGameStore((state) => state.selectedAnimals);

    const handleConfirm = () => {
        if (selectedAnimals.length === 3) {
            router.push(`/individual/screen/${id}/waiting`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
            <header className="mb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">Elige 3 {mode === 'group' ? 'Animales' : 'Opciones'}</h1>
                    <p className="text-sm text-gray-400">Seleccionados: {selectedAnimals.length}/3</p>
                </div>
                <div className="bg-gray-800 px-3 py-1 rounded-full text-sm">
                    Pantalla {id}
                </div>
            </header>

            {/* Grid Interactivo Real */}
            <div className="flex-1 mb-4 overflow-hidden">
                <DynamicAnimalSelector wheelId={wheelId} mode={mode} />
            </div>

            <button
                onClick={handleConfirm}
                disabled={selectedAnimals.length !== 3}
                className={`
          w-full py-4 rounded-xl font-bold transition-all
          ${selectedAnimals.length === 3
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg transform active:scale-95'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
        `}
            >
                {selectedAnimals.length === 3 ? '✅ CONFIRMAR JUGADA' : `Selecciona ${3 - selectedAnimals.length} más`}
            </button>
        </div>
    );
}

