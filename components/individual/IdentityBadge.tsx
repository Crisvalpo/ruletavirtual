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

    if (isLoading) return <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />;

    const isGuest = !user?.email;

    return (
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/5 p-1.5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-3 px-2">
                <div className="relative">
                    <img
                        src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id}`}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-white/10"
                    />
                    {isGuest && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-500 border-2 border-[#1a1a1a] rounded-full" title="Invitado" />
                    )}
                    {!isGuest && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full" title="Persistente" />
                    )}
                </div>
                <div className="hidden sm:block">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                        {isGuest ? 'Invitado' : 'Jugador'}
                    </p>
                    <p className="text-[12px] font-black text-white tracking-tight leading-tight">
                        {profile?.display_name || 'Sin Nombre'}
                    </p>
                </div>
            </div>

            <div className="h-6 w-[1px] bg-white/10 mx-1" />

            {isGuest ? (
                <button
                    onClick={signInWithGoogle}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all group"
                    title="Vincular con Google"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-50 group-hover:opacity-100 transition-opacity">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
                        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="currentColor" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                    </svg>
                </button>
            ) : (
                <button
                    onClick={handleSignOut}
                    className="p-2 hover:bg-red-500/10 rounded-xl transition-all group"
                    title="Cerrar Sesión"
                >
                    <span className="text-xl opacity-50 group-hover:opacity-100 transition-opacity">🚪</span>
                </button>
            )}
        </div>
    );
}
