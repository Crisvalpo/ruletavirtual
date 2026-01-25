import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
    screenId: string | null;
    playerId: string | null; // UUID from temp session or auth
    nickname: string;

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

    // Actions
    setScreenId: (id: string) => void;
    setGameMode: (mode: 'group' | 'individual', wheelId?: string) => void;
    setNickname: (name: string) => void;
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
            selectedAnimals: [],
            hasPaid: false,
            paymentMethod: null,
            credits: 0,
            status: 'idle',

            setScreenId: (id) => set({ screenId: id }),

            setGameMode: (mode, wheelId) => set({
                gameMode: mode,
                activeWheelId: wheelId || null,
                // Reset selection when mode changes
                selectedAnimals: []
            }),

            setNickname: (name) => set({ nickname: name }),

            toggleAnimalSelection: (index) => set((state) => {
                const isSelected = state.selectedAnimals.includes(index);

                // Deselect
                if (isSelected) {
                    return { selectedAnimals: state.selectedAnimals.filter(i => i !== index) };
                }

                // Select (max 3)
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

            resetGame: () => set({
                selectedAnimals: [],
                hasPaid: false,
                paymentMethod: null,
                status: 'idle',
                gameMode: 'group',
                activeWheelId: null
            })
        }),
        {
            name: 'ruleta-game-storage', // local storage key
        }
    )
);
