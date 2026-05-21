'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

// Emojis eliminados, se usará la foto de Google

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

    useEffect(() => {
        if (profile?.avatar_url) {
            setSelectedEmoji(profile.avatar_url);
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);

        // 1. Update Profile in DB (if logged in)
        if (user) {
            await supabase
                .from('profiles')
                .update({
                    display_name: name.trim(),
                    // Mantener la foto original de Google
                    avatar_url: profile?.avatar_url
                })
                .eq('id', user.id);
        }

        // 2. Update Local Store
        setIdentity(name.trim(), profile?.avatar_url || '😎');

        setIsSubmitting(false);
        onComplete();
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 pwa-mode">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">¡Bienvenido! 👋</h1>
                <p className="text-center text-gray-500 mb-8 leading-tight">
                    Personaliza tu perfil para aparecer en la <span className="text-primary font-black uppercase italic tracking-tighter">Gran Pantalla</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Google Avatar Display */}
                    {profile?.avatar_url && (
                        <div className="flex flex-col items-center justify-center mb-6">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                                <img src={profile.avatar_url} alt="Tu Avatar" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-widest">Cuenta de Google</p>
                        </div>
                    )}

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
                            placeholder={profile?.display_name || "Ej. Juan, La Jefa, Campeón..."}
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
                </form>
            </div>
        </div>
    );
}
