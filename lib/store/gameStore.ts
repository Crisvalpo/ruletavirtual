import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface GameState {
    // Session & Identity
    screenId: string | null;
    nickname: string;
    emoji: string; // Can be a literal emoji or a profile photo URL
    queueId: string | null;
    currentQueueId: string | null; // Sync for TV

    // Game State
    status: 'idle' | 'spinning' | 'result';
    lastSpinResult: number | null;
    isDemo: boolean;
    idleSpeed: number;
    gameMode: 'individual' | 'group';
    activeWheelId: string | null;
    isRevenge: boolean;
    selectedAnimals: number[];

    // Actions
    setScreenId: (id: string | null) => void;
    setIdentity: (nickname: string, emoji: string) => void;
    setQueueId: (id: string | null) => void;
    setIsRevenge: (isRevenge: boolean) => void;
    setGameMode: (mode: 'individual' | 'group', wheelId?: string) => void;
    setSelectedAnimals: (animals: number[]) => void;
    toggleAnimal: (id: number) => void;
    resetGame: () => void;
    resetIdentity: () => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            screenId: null,
            nickname: '',
            emoji: '😎',
            queueId: null,
            currentQueueId: null,

            status: 'idle',
            lastSpinResult: null,
            isDemo: false,
            idleSpeed: 4.0,
            gameMode: 'individual',
            activeWheelId: null,
            isRevenge: false,
            selectedAnimals: [],

            setScreenId: (id) => set({ screenId: id }),
            setIdentity: (nickname, emoji) => set({ nickname, emoji }),
            setQueueId: (id) => set({ queueId: id }),
            setIsRevenge: (isRevenge) => set({ isRevenge }),

            setGameMode: (mode, wheelId) => set({
                gameMode: mode,
                activeWheelId: wheelId || null
            }),

            setSelectedAnimals: (animals) => set({ selectedAnimals: animals }),

            toggleAnimal: (id) => set((state) => {
                const isSelected = state.selectedAnimals.includes(id);
                if (isSelected) {
                    return { selectedAnimals: state.selectedAnimals.filter(a => a !== id) };
                }
                const maxAnimals = state.isRevenge ? 6 : 3;
                if (state.selectedAnimals.length < maxAnimals) {
                    return { selectedAnimals: [...state.selectedAnimals, id] };
                }
                return state;
            }),

            resetGame: () => set({
                selectedAnimals: [],
                status: 'idle',
                isDemo: false,
                gameMode: 'group',
                activeWheelId: null,
                queueId: null,
                currentQueueId: null,
                isRevenge: false,
            }),
            resetIdentity: () => set({
                nickname: '',
                emoji: '😎'
            }),
        }),
        {
            name: 'ruleta-game-storage',
            storage: createJSONStorage(() => sessionStorage),
            // Al usar sessionStorage, ya no hay riesgo de interferencia entre pestañas en una misma máquina,
            // por lo que persistimos todo el estado del juego para soportar F5 sin problemas.
        }
    )
);
