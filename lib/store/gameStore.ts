import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
    screenId: string | null;
    playerId: string | null; // UUID from temp session or auth
    nickname: string;
    emoji: string; // New field

    // Mode
    gameMode: 'group' | 'individual';
    activeWheelId: string | null;

    // Selection
    selectedAnimals: number[]; // Indices 1-36

    // Payment
    hasPaid: boolean;
    paymentMethod: 'cash' | 'mercadopago' | null;
    credits: number;

    // Status
    status: 'idle' | 'selecting' | 'waiting' | 'ready_to_spin' | 'spinning' | 'won' | 'lost';

    // Queue
    queueId: string | null;
    setQueueId: (id: string) => void;

    // Actions
    setScreenId: (id: string) => void;
    setGameMode: (mode: 'group' | 'individual', wheelId?: string) => void;
    setIdentity: (name: string, emoji: string) => void; // Consolidated action
    setNickname: (name: string) => void; // Deprecated but kept for compat
    toggleAnimalSelection: (index: number) => void;
    setPaymentStatus: (paid: boolean, method: 'cash' | 'mercadopago') => void;
    resetGame: () => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            screenId: null,
            playerId: null,
            nickname: 'Jugador',
            emoji: '😎', // Default
            selectedAnimals: [],
            hasPaid: false,
            paymentMethod: null,
            credits: 0,
            status: 'idle',
            queueId: null,

            setScreenId: (id) => set({ screenId: id }),

            setGameMode: (mode, wheelId) => set({
                gameMode: mode,
                activeWheelId: wheelId || null,
                selectedAnimals: []
            }),

            setIdentity: (name, emoji) => set({ nickname: name, emoji: emoji }),
            setNickname: (name) => set({ nickname: name }),

            toggleAnimalSelection: (index) => set((state) => {
                const isSelected = state.selectedAnimals.includes(index);

                if (isSelected) {
                    return { selectedAnimals: state.selectedAnimals.filter(i => i !== index) };
                }

                if (state.selectedAnimals.length < 3) {
                    return { selectedAnimals: [...state.selectedAnimals, index] };
                }

                return state;
            }),

            setPaymentStatus: (paid, method) => set({
                hasPaid: paid,
                paymentMethod: method,
                status: paid ? 'selecting' : 'idle'
            }),

            setQueueId: (id) => set({ queueId: id }),

            resetGame: () => set({
                selectedAnimals: [],
                hasPaid: false,
                paymentMethod: null,
                status: 'idle',
                gameMode: 'group',
                activeWheelId: null,
                queueId: null,
                // Keep identity if preferred, or reset? Let's reset for fresh start
                // nickname: 'Jugador',
                // emoji: '😎'
            })
        }),
        {
            name: 'ruleta-game-storage',
        }
    )
);
