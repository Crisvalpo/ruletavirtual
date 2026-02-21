'use client';

import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/lib/store/gameStore';

export default function IdentityBadge() {
    const { user, profile, isLoading, signInWithGoogle, signOut } = useAuth();
    const resetIdentity = useGameStore(state => state.resetIdentity);

    const handleSignOut = async () => {
        await signOut();
        resetIdentity();
    };

    if (isLoading || !user) return <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />;

    return (
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/5 p-1.5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 px-2">
                <div className="relative">
                    <img
                        src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id}`}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-white/10"
                    />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full" title="Conectado" />
                </div>
                <div className="hidden sm:block">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                        Jugador
                    </p>
                    <button
                        onClick={() => (window.location.href = '/individual/prizes')}
                        className="text-[12px] font-black tracking-tight leading-tight text-left hover:text-primary transition-colors text-white"
                    >
                        {profile?.display_name || 'Sin Nombre'}
                        <span className="ml-1 text-[8px] opacity-30">🏆</span>
                    </button>
                </div>
            </div>

            <div className="h-6 w-[1px] bg-white/10 mx-1" />

            <button
                onClick={handleSignOut}
                className="p-2.5 hover:bg-red-500/10 rounded-xl transition-all group"
                title="Cerrar Sesión"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-40 group-hover:opacity-100 group-hover:text-red-500 transition-all">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
            </button>
        </div>
    );
}
