'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import IdentityBadge from '@/components/individual/IdentityBadge';

export default function HomePage() {
    const { profile, isLoading, user } = useAuth();

    const isAdmin = profile?.role === 'admin';
    const isStaff = profile?.role === 'staff' || isAdmin;

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4 relative">
            {/* Header / Auth Status */}
            <div className="absolute top-4 right-4 z-50">
                <IdentityBadge />
            </div>

            <div className="text-center text-white mb-8 mt-12">
                <h1 className="text-5xl md:text-7xl font-black mb-2 drop-shadow-lg tracking-tighter">
                    🎰 Ruleta Animalitos
                </h1>
                <p className="text-xl md:text-2xl font-medium opacity-90">
                    Fiestas Patrias 2026 - Hub Central
                </p>
            </div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mobile / Player Links - ALWAYS PUBLIC */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 font-mono uppercase tracking-widest text-sm opacity-50">
                        📱 Modo Jugador (Celular)
                    </h2>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((id) => (
                            <Link
                                key={id}
                                href={`/individual/screen/${id}`}
                                className="block w-full bg-white text-primary font-bold py-3 px-4 rounded-xl hover:bg-gray-100 hover:scale-[1.02] transition-all flex justify-between items-center group shadow-xl"
                            >
                                <span>Pantalla #{id}</span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">👉</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Display / TV Links - ONLY STAFF/ADMIN */}
                {isStaff && (
                    <div className="bg-black/40 backdrop-blur-md rounded-3xl p-6 border border-white/10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 font-mono uppercase tracking-widest text-sm opacity-50">
                            📺 Modo Pantalla (TV)
                        </h2>
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((id) => (
                                <Link
                                    key={id}
                                    href={`/display/individual/${id}`}
                                    target="_blank"
                                    className="block w-full bg-gray-900 border border-gray-700 text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-800 hover:border-primary transition-all flex justify-between items-center"
                                >
                                    <span>Display #{id}</span>
                                    <span>🖥️</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Placeholder if not staff */}
                {!isStaff && !isLoading && (
                    <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                        <div className="text-4xl mb-4 opacity-20">🔒</div>
                        <p className="text-white/30 font-bold uppercase tracking-widest text-xs">
                            Área Restringida
                        </p>
                        <p className="text-white/20 text-[10px] mt-2 px-6">
                            Identifícate como Staff para activar paneles de visualización
                        </p>
                    </div>
                )}
            </div>

            {/* Admin & Tools - ONLY ADMIN */}
            {isAdmin && (
                <div className="mt-8 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-indigo-900/40 backdrop-blur-md rounded-3xl p-6 border border-indigo-500/30 flex justify-center">
                        <Link
                            href="/admin"
                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-tighter italic text-2xl transition-all hover:scale-[1.05] active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                        >
                            <span>📊</span>
                            ADMIN DASHBOARD
                        </Link>
                    </div>
                </div>
            )}

            <div className="mt-12 text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">
                Crisvalpo Dev • Next.js 16 • Fiestas Patrias 2026
            </div>
        </main>
    );
}
