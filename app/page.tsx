import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
            <div className="text-center text-white mb-8">
                <h1 className="text-6xl font-black mb-2 drop-shadow-lg">
                    🎰 Ruleta Animalitos
                </h1>
                <p className="text-2xl font-medium opacity-90">
                    Fiestas Patrias 2026 - Dev Hub
                </p>
            </div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mobile / Player Links */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                        📱 Modo Jugador (Celular)
                    </h2>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((id) => (
                            <Link
                                key={id}
                                href={`/individual/screen/${id}`}
                                className="block w-full bg-white text-primary font-bold py-3 px-4 rounded-xl hover:bg-gray-100 hover:scale-[1.02] transition-all flex justify-between items-center group"
                            >
                                <span>Pantalla #{id}</span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">👉</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Display / TV Links */}
                <div className="bg-black/40 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
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
            </div>

            {/* Admin & Tools - Unified Entry */}
            <div className="mt-8 w-full max-w-4xl">
                <div className="bg-indigo-900/40 backdrop-blur-md rounded-3xl p-6 border border-indigo-500/30 flex justify-center">
                    <Link
                        href="/admin"
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-tighter italic text-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex items-center justify-center gap-3"
                    >
                        <span>📊</span>
                        ADMIN DASHBOARD
                    </Link>
                </div>
            </div>

            <div className="mt-12 text-white/40 text-sm">
                Crisvalpo Dev Environment • Next.js 16
            </div>
        </main>
    );
}
