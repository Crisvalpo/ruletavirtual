'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

interface NickEntryProps {
    screenId: string;
    onComplete: () => void;
}

export default function NickEntry({ screenId, onComplete }: NickEntryProps) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Updated store action
    const setIdentity = useGameStore((state) => state.setIdentity);
    const { user, profile, isLoading } = useAuth();
    const supabase = createClient();

    useEffect(() => {
        if (profile?.display_name) {
            setName(profile.display_name);
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;

        if (trimmedName.toLowerCase() === 'jugador') {
            setError('El nombre "Jugador" está reservado por el sistema. Por favor elige otro.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // 1. Update Profile in DB (if logged in)
        if (user) {
            await supabase
                .from('profiles')
                .update({
                    display_name: trimmedName,
                    avatar_url: profile?.avatar_url
                })
                .eq('id', user.id);
        }

        // 2. Update Local Store
        setIdentity(trimmedName, profile?.avatar_url || '😎');

        setIsSubmitting(false);
        onComplete();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 pwa-mode relative overflow-hidden">
            {/* Premium Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[130px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[130px] rounded-full animate-pulse delay-1000" />
            </div>

            <div className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative z-10">
                <h1 className="text-3xl font-black text-center mb-2 text-white uppercase italic tracking-tighter">
                    ¡Bienvenido! 👋
                </h1>
                <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-wider mb-8 leading-tight">
                    Personaliza tu perfil para aparecer en la <span className="text-primary font-black italic tracking-tighter">Gran Pantalla</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Google Avatar Display */}
                    {profile?.avatar_url ? (
                        <div className="flex flex-col items-center justify-center mb-6">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary shadow-lg shadow-primary/20">
                                <img src={profile.avatar_url} alt="Tu Avatar" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-[9px] text-gray-500 mt-2 font-black uppercase tracking-widest">Cuenta de Google</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-md">
                                😎
                            </div>
                        </div>
                    )}

                    {/* Name Input */}
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">
                            Tu Nombre o Apodo
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (error) setError(null);
                            }}
                            maxLength={15}
                            placeholder={profile?.display_name || "Ej. Juan, La Jefa, Campeón..."}
                            className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 focus:border-primary focus:outline-none text-lg font-bold text-center text-white placeholder-gray-600 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 text-red-400 text-xs p-3.5 rounded-xl text-center border border-red-500/20 font-bold">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!name.trim() || isSubmitting}
                        className={`
                            w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all text-white
                            ${!name.trim() || isSubmitting
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                : 'bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-95 transform hover:-translate-y-0.5'}
                        `}
                    >
                        {isSubmitting ? 'Guardando...' : '¡Comenzar a Jugar! 🚀'}
                    </button>
                </form>
            </div>
        </div>
    );
}
