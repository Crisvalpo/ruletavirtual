'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import RecentSales from '@/components/staff/RecentSales';

interface Package {
    name: string;
    plays: number;
    price: number;
    popular?: boolean;
}

const PACKAGES: Package[] = [
    { name: '1 Jugada', plays: 1, price: 1000 },
    { name: '3 Jugadas', plays: 3, price: 2500, popular: true },
    { name: '5 Jugadas', plays: 5, price: 4000 },
];

export default function KioskPage() {
    const supabase = createClient();
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [customPlays, setCustomPlays] = useState(1);
    const [customPrice, setCustomPrice] = useState(1000);
    const [buyerName, setBuyerName] = useState('');

    const generateCode = () => {
        // Format: RU-XXXX-XXXX (readable, 8 chars after prefix)
        const part1 = nanoid(4).toUpperCase();
        const part2 = nanoid(4).toUpperCase();
        return `RU-${part1}-${part2}`;
    };

    const handleQuickSale = async (pkg: Package) => {
        setIsGenerating(true);
        const code = generateCode();

        try {
            const { error } = await supabase
                .from('game_packages')
                .insert({
                    code,
                    package_type: pkg.name,
                    total_plays: pkg.plays,
                    price_paid: pkg.price,
                    valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days
                    buyer_name: buyerName || 'Cliente',
                    created_via: 'kiosk'
                });

            if (error) throw error;

            setGeneratedCode(code);
            setBuyerName('');
        } catch (err) {
            console.error('Error generando ticket:', err);
            alert('Error al generar el ticket. Intenta de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCustomSale = async () => {
        setIsGenerating(true);
        const code = generateCode();

        try {
            const { error } = await supabase
                .from('game_packages')
                .insert({
                    code,
                    package_type: `${customPlays} Jugadas`,
                    total_plays: customPlays,
                    price_paid: customPrice,
                    valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                    buyer_name: buyerName || 'Cliente',
                    created_via: 'kiosk'
                });

            if (error) throw error;

            setGeneratedCode(code);
            setBuyerName('');
            setCustomPlays(1);
            setCustomPrice(1000);
        } catch (err) {
            console.error('Error generando ticket:', err);
            alert('Error al generar el ticket personalizado.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="text-4xl">🎫</div>
                    <div>
                        <h1 className="text-3xl font-black text-white">Kiosko de Ventas</h1>
                        <p className="text-sm text-gray-500">Genera tickets para tus clientes</p>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {generatedCode && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-2xl font-black text-white mb-2">Ticket Generado</h2>
                            <p className="text-sm text-gray-400">Entrega este código al cliente</p>
                        </div>

                        <div className="bg-yellow-500 text-black p-6 rounded-xl mb-6 text-center">
                            <p className="text-xs font-bold uppercase tracking-widest mb-2">CÓDIGO DE CANJE</p>
                            <p className="text-3xl font-black tracking-tight font-mono">{generatedCode}</p>
                        </div>

                        <button
                            onClick={() => setGeneratedCode(null)}
                            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-3 rounded-lg transition-all active:scale-95"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto grid gap-6">
                {/* Customer Info */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                    <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                        Nombre del Cliente (Opcional)
                    </label>
                    <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                    />
                </div>

                {/* Quick Packs */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                    <h3 className="text-xl font-black text-white mb-4">Packs Rápidos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {PACKAGES.map((pkg) => (
                            <div
                                key={pkg.name}
                                className={`relative bg-black/50 border rounded-xl p-6 transition-all ${pkg.popular ? 'border-yellow-500' : 'border-white/10'
                                    }`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full">
                                        POPULAR
                                    </div>
                                )}
                                <div className="text-center mb-4">
                                    <p className="text-2xl font-black text-white mb-1">{pkg.name}</p>
                                    <p className="text-3xl font-black text-yellow-500">${pkg.price.toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleQuickSale(pkg)}
                                    disabled={isGenerating}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isGenerating ? 'GENERANDO...' : 'GENERAR TICKET'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom Pack */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                    <h3 className="text-xl font-black text-white mb-4">Pack Personalizado</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Cantidad de Jugadas
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={customPlays}
                                onChange={(e) => setCustomPlays(parseInt(e.target.value) || 1)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Precio ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(parseInt(e.target.value) || 0)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCustomSale}
                        disabled={isGenerating}
                        className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isGenerating ? 'GENERANDO...' : 'GENERAR TICKET PERSONALIZADO'}
                    </button>
                </div>

                {/* Recent Sales */}
                <RecentSales />
            </div>
        </div>
    );
}
