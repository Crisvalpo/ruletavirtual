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
