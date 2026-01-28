'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

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
    const { user, profile, signInWithGoogle, isLoading } = useAuth();
    const supabase = createClient();

    // Pre-fill name from profile if available (only once)
    useEffect(() => {
        if (profile?.display_name && !name) {
            setName(profile.display_name);
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);

        // 1. Update Profile in DB (even if anonymous)
        if (user) {
            await supabase
                .from('profiles')
                .update({
                    display_name: name.trim(),
                    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${name.trim()}`
                })
                .eq('id', user.id);
        }

        // 2. Update Local Store
        setIdentity(name, selectedEmoji);

        setIsSubmitting(false);
        onComplete();
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">¡Bienvenido! 👋</h1>
                <p className="text-center text-gray-500 mb-8 leading-tight">
                    Personaliza tu perfil para aparecer en la <span className="text-primary font-black uppercase italic tracking-tighter">Gran Pantalla</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Emoji Selector */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 text-center">
                            Elige tu Amuleto de la Suerte
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
                        {isSubmitting ? 'Guardando...' : '¡Comenzar a Jugar! 🚀'}
                    </button>

                    {/* Show Google login only if anonymous */}
                    {(!user || user.is_anonymous) && (
                        <>
                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">O Únete con tu cuenta</span></div>
                            </div>

                            <button
                                type="button"
                                onClick={signInWithGoogle}
                                className="w-full py-4 rounded-xl font-bold text-lg transition-all bg-white border-2 border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 text-gray-700"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                CONTINUAR CON GOOGLE
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
