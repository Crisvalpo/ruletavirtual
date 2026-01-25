export default function HomePage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-light">
            <div className="text-center text-white p-8">
                <h1 className="text-6xl font-bold mb-4">
                    🎰 Ruleta Animalitos
                </h1>
                <p className="text-2xl mb-8">
                    Fiestas Patrias 2026
                </p>
                <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-2">✅ Proyecto Inicializado</h2>
                        <p className="text-sm">Next.js 16 + TypeScript + Tailwind CSS</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="text-4xl mb-2">🎮</div>
                            <div className="font-semibold">Individual</div>
                            <div className="text-xs text-white/70">4 pantallas</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="text-4xl mb-2">🎫</div>
                            <div className="font-semibold">Grupal</div>
                            <div className="text-xs text-white/70">Sorteos c/15min</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="text-4xl mb-2">⭐</div>
                            <div className="font-semibold">Especial</div>
                            <div className="text-xs text-white/70">Premios grandes</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
