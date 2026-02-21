import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
    // Session & Identity
    screenId: string | null;
    nickname: string;
    emoji: string;
    queueId: string | null;
    currentQueueId: string | null; // Sync for TV

    // Game State
    status: 'idle' | 'spinning' | 'result';
    lastSpinResult: number | null;
    isDemo: boolean;
    idleSpeed: number;
    gameMode: 'individual' | 'group';
    activeWheelId: string | null;
    selectedAnimals: number[];

    // Actions
    setScreenId: (id: string | null) => void;
    setIdentity: (nickname: string, emoji: string) => void;
    setQueueId: (id: string | null) => void;
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
            nickname: 'Jugador',
            emoji: '😎',
            queueId: null,
            currentQueueId: null,

            status: 'idle',
            lastSpinResult: null,
            isDemo: false,
            idleSpeed: 1.0,
            gameMode: 'individual',
            activeWheelId: null,
            selectedAnimals: [],

            setScreenId: (id) => set({ screenId: id }),
            setIdentity: (nickname, emoji) => set({ nickname, emoji }),
            setQueueId: (id) => set({ queueId: id }),

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
                if (state.selectedAnimals.length < 3) {
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
            }),
            resetIdentity: () => set({
                nickname: 'Jugador',
                emoji: '😎'
            }),
        }),
        {
            name: 'ruleta-game-storage',
            partialize: (state) => ({
                nickname: state.nickname,
                emoji: state.emoji,
                // Do NOT persist screenId, activeWheelId, or gameMode
                // because multiple screens in different tabs/windows on the SAME machine
                // share localStorage. Persisting these would cause Tab 1 to overwrite Tab 2.
            }),
        }
    )
);
