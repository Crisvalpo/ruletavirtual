'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import RecentSales from '@/components/staff/RecentSales';
import BatchTicketGenerator from '@/components/staff/BatchTicketGenerator';
import { QRCodeCanvas } from 'qrcode.react';

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

    // Dynamic settings for ticket
    const [settings, setSettings] = useState({
        ticket_header: 'RULETA VIRTUAL',
        ticket_subheader: 'VALDIVIA 2026',
        ticket_terms_line1: 'CANJEA EN TU CELULAR',
        ticket_terms_line2: 'PRESENTA ESTE TICKET SI GANAS'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('venue_settings').select('*').single();
            if (data) {
                setSettings({
                    ticket_header: data.ticket_header,
                    ticket_subheader: data.ticket_subheader,
                    ticket_terms_line1: data.ticket_terms_line1,
                    ticket_terms_line2: data.ticket_terms_line2
                });
            }
        };
        fetchSettings();
    }, []);

    const generateCode = () => {
        const letters = 'ABCDEF';
        const numbers = '0123456789';
        let res = '';
        for (let i = 0; i < 2; i++) res += letters.charAt(Math.floor(Math.random() * letters.length));
        res += '-';
        for (let i = 0; i < 3; i++) res += numbers.charAt(Math.floor(Math.random() * numbers.length));
        return res;
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
                    valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                    buyer_name: buyerName || 'Cliente',
                    created_via: 'kiosk',
                    is_activated: true, // Individual sales are pre-activated
                    sale_status: 'sold' // Born as sale
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
                    created_via: 'kiosk',
                    is_activated: true, // Individual sales are pre-activated
                    sale_status: 'sold' // Born as sale
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
        <div className="min-h-screen bg-[#050505] p-6 text-white">
            <div className="max-w-5xl mx-auto mb-8 bg-[#111] p-6 rounded-2xl border border-white/10 flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="text-4xl">🎫</div>
                    <div>
                        <h1 className="text-3xl font-black text-white">Kiosko de Ventas</h1>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Punto de Venta Autorizado</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.location.href = '/staff/scanner'}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                    >
                        📷 ESCÁNER
                    </button>
                    <button
                        onClick={() => window.location.href = '/admin'}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2 rounded-xl text-xs font-black transition-all"
                    >
                        ⚓ VOLVER AL PANEL
                    </button>
                </div>
            </div>

            {generatedCode && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-2xl font-black text-white mb-2">Ticket Generado</h2>
                            <p className="text-sm text-gray-400">Entrega este código al cliente</p>
                        </div>

                        <div className="bg-yellow-500 text-black p-6 rounded-xl mb-6 text-center shadow-xl print:bg-white print:border-2 print:border-black print:p-8 print:shadow-none min-h-[400px] flex flex-col items-center justify-center">
                            <div className="hidden print:block mb-4">
                                <h4 className="text-[14px] font-black uppercase text-center mb-1">
                                    {settings.ticket_header}<br />
                                    <span className="text-[10px]">{settings.ticket_subheader}</span>
                                </h4>
                            </div>

                            <p className="text-xs font-bold uppercase tracking-widest mb-2 print:text-black print:text-[10px]">CÓDIGO DE JUEGO</p>
                            <p className="text-4xl font-black tracking-tight font-mono mb-6 print:text-5xl print:text-black">{generatedCode}</p>

                            <div className="bg-white p-3 rounded-xl mb-6 shadow-inner print:shadow-none print:border print:border-black">
                                <QRCodeCanvas
                                    value={`${window.location.origin}/ticket/view/${generatedCode}`}
                                    size={150}
                                    level="H"
                                />
                            </div>

                            <div className="flex flex-col items-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4 print:text-black print:opacity-100">
                                    Escanea para ver tus jugadas
                                </p>

                                <div className="hidden print:block text-black">
                                    <div className="text-[10px] font-bold text-center border-t border-black/20 pt-4 px-4 leading-tight">
                                        {settings.ticket_terms_line1}<br />
                                        {settings.ticket_terms_line2}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 no-print">
                            <button
                                onClick={() => window.print()}
                                className="bg-white text-black font-black py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                🖨️ Imprimir
                            </button>
                            <button
                                onClick={() => setGeneratedCode(null)}
                                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-4 rounded-xl transition-all active:scale-95"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto grid gap-6">
                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Nombre del Cliente (Opcional)
                    </label>
                    <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-500 outline-none text-lg"
                    />
                </div>

                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight">⚡ Packs Rápidos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PACKAGES.map((pkg) => (
                            <div
                                key={pkg.name}
                                className={`relative bg-black border-2 rounded-2xl p-6 transition-all group ${pkg.popular ? 'border-yellow-500 shadow-lg shadow-yellow-500/10' : 'border-white/10'
                                    }`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-tighter">
                                        POPULAR
                                    </div>
                                )}
                                <div className="text-center mb-6">
                                    <p className="text-2xl font-black text-white mb-1">{pkg.name}</p>
                                    <p className="text-4xl font-black text-yellow-500 tracking-tighter">${pkg.price.toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleQuickSale(pkg)}
                                    disabled={isGenerating}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isGenerating ? '...' : 'GENERAR TICKET'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight">🛠️ Pack Personalizado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                Cantidad de Jugadas
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={customPlays}
                                onChange={(e) => setCustomPlays(parseInt(e.target.value) || 1)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-500 outline-none text-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                Precio ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(parseInt(e.target.value) || 0)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-500 outline-none text-lg"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCustomSale}
                        disabled={isGenerating}
                        className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isGenerating ? 'GENERANDO...' : 'GENERAR TICKET PERSONALIZADO'}
                    </button>
                </div>

                <BatchTicketGenerator generateCode={generateCode} />
                <RecentSales />
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 0; }
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; width: 80mm !important; }
                }
            `}</style>
        </div>
    );
}
