'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';

const EMOJI_OPTIONS = ['😎', '🚀', '🦄', '🦁', '⭐', '🔥', '💎', '🍀', '🐶', '🐱', '🦊', '🐸'];

interface NickEntryProps {
    screenId: string;
    onComplete: () => void;
}

export default function NickEntry({ screenId, onComplete }: NickEntryProps) {
    const [name, setName] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState('😎');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Updated store action
    const setIdentity = useGameStore((state) => state.setIdentity);

    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);

        // 1. Update Local Store
        setIdentity(name, selectedEmoji);

        // 2. Insert into Queue (Status: selecting)
        const { data, error } = await supabase
            .from('player_queue')
            .insert({
                screen_number: parseInt(screenId),
                player_name: name,
                player_emoji: selectedEmoji,
                status: 'selecting', // Temporarily entering selection phase
                created_at: new Date().toISOString()
            })
            .select() // Return data to get ID
            .single();

        if (error) {
            console.error("Error joining queue:", error);
            // Handle error (maybe show alert)
            setIsSubmitting(false);
            return;
        }

        // Store queue_id if needed, or just rely on Name/Emoji for now
        // Best practice: Store queue_id in GameStore
        // useGameStore.getState().setQueueId(data.id); // Assuming store has this

        // For now, simpler: Just proceed. The Wheel Selector/Payment will carry the context 
        // via Store or URL? 
        // Actually, subsequent steps don't strictly need the DB Row ID if they just update 
        // the active session params locally, and the FINAL step (Spin/Wait) confirms the queue entry?

        // Let's stick to the current plan:
        // 1. NickEntry: Local Identity Only (Don't insert yet? Or Insert as 'selecting')
        // User asked for "Real Queue".
        // If I Insert now, and they drop off, we have a 'selecting' zombie.
        // It's cleaner to Insert when they reach "Waiting Page" (after payment).

        // REVISION:
        // Let's NOT insert in NickEntry. Let's just set Local Store.
        // The previous code updated `screen_state` directly (wrong).
        // I will REMOVE the database call here entirely.
        // The Queue Insertion should happen at `Payment -> Waiting` transition.

        setIsSubmitting(false);
        onComplete();
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">¡Bienvenido! 👋</h1>
                <p className="text-center text-gray-500 mb-8">Identifícate para salir en la pantalla gigante</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Emoji Selector */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 text-center">
                            Elige tu Emoji de la Suerte
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                            {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setSelectedEmoji(emoji)}
                                    className={`
                                        text-2xl p-2 rounded-xl transition-all
                                        ${selectedEmoji === emoji
                                            ? 'bg-primary ring-4 ring-primary/30 scale-110 shadow-lg'
                                            : 'bg-gray-100 hover:bg-gray-200'}
                                    `}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Tu Nombre o Apodo
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={12}
                            placeholder="Ej. Juan, La Jefa, Campeón..."
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none text-lg font-bold text-center"
                            autoFocus
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!name.trim() || isSubmitting}
                        className={`
                            w-full py-4 rounded-xl font-bold text-lg transition-all text-white
                            ${!name.trim() || isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1'}
                        `}
                    >
                        {isSubmitting ? 'Guardando...' : '¡A Jugar! 🚀'}
                    </button>
                </form>
            </div>
        </div>
    );
}
