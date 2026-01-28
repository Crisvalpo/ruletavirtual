'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QRCodeCanvas } from 'qrcode.react';

interface BatchTicketGeneratorProps {
    generateCode: () => string;
}

export default function BatchTicketGenerator({ generateCode }: BatchTicketGeneratorProps) {
    const supabase = createClient();
    const [batchSize, setBatchSize] = useState(10);
    const [playsPerTicket, setPlaysPerTicket] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastBatch, setLastBatch] = useState<string[]>([]);
    const [showPrintView, setShowPrintView] = useState(false);
    const [batchTimestamp, setBatchTimestamp] = useState<string | null>(null);
    const [isActivating, setIsActivating] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

    // Dynamic settings for ticket
    const [settings, setSettings] = useState({
        ticket_header: 'RULETA VIRTUAL',
        ticket_subheader: 'VALDIVIA 2026',
        ticket_terms_line1: 'CANJEA EN TU CELULAR',
        ticket_terms_line2: 'PRESENTA ESTE TICKET SI GANAS',
        base_url: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('venue_settings').select('*').single();
            if (data) {
                setSettings({
                    ticket_header: data.ticket_header,
                    ticket_subheader: data.ticket_subheader,
                    ticket_terms_line1: data.ticket_terms_line1,
                    ticket_terms_line2: data.ticket_terms_line2,
                    base_url: data.base_url || ''
                });
            }
        };
        fetchSettings();
    }, []);

    const handleGenerateBatch = async () => {
        if (batchSize <= 0) return;
        setIsGenerating(true);
        setIsActivated(false);
        const newCodes: string[] = [];
        const timestamp = new Date().toISOString();
        setBatchTimestamp(timestamp);

        try {
            for (let i = 0; i < batchSize; i++) {
                newCodes.push(generateCode());
            }

            const { error } = await supabase
                .from('game_packages')
                .insert(
                    newCodes.map(code => ({
                        code,
                        package_type: `Batch: ${playsPerTicket} Jugadas`,
                        total_plays: playsPerTicket,
                        price_paid: 0,
                        valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                        buyer_name: 'Impresión Masiva',
                        created_via: 'kiosk_batch',
                        created_at: timestamp,
                        is_activated: false, // Force deactivated for batch
                        sale_status: 'pre_printed' // Flow: born as pre-printed, not a sale yet
                    }))
                );

            if (error) throw error;

            setLastBatch(newCodes);
            setShowPrintView(true);
        } catch (err) {
            console.error('Error generating batch:', err);
            alert('Error al generar lote de tickets');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleActivateBatch = async () => {
        if (!batchTimestamp) return;
        setIsActivating(true);
        try {
            // Updated RPC to handle sale_status change
            const { data, error } = await supabase.rpc('activate_ticket_batch', {
                p_created_via: 'kiosk_batch',
                p_created_at_after: batchTimestamp
            });

            if (error) throw error;
            setIsActivated(true);
            alert(`✅ ${data} tickets activados y registrados como venta.`);
        } catch (err) {
            console.error('Error activating batch:', err);
            alert('Error al activar el lote');
        } finally {
            setIsActivating(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-[#111] border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                📦 Generación Masiva (Lotes)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                        Cantidad de Tickets
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                        Jugadas por Ticket
                    </label>
                    <select
                        value={playsPerTicket}
                        onChange={(e) => setPlaysPerTicket(parseInt(e.target.value))}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                    >
                        <option value={1}>1 Jugada</option>
                        <option value={3}>3 Jugadas</option>
                        <option value={5}>5 Jugadas</option>
                    </select>
                </div>
            </div>

            <button
                onClick={handleGenerateBatch}
                disabled={isGenerating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isGenerating ? 'GENERANDO...' : `🚀 GENERAR LOTE DE ${batchSize} TICKETS`}
            </button>

            {showPrintView && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-4 md:p-8 overflow-y-auto no-print-background">
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="flex justify-between items-center mb-8 no-print bg-[#111] p-6 rounded-2xl border border-white/10 shadow-2xl">
                            <div>
                                <h2 className="text-2xl font-black text-white">Vista de Impresión</h2>
                                <p className="text-sm text-gray-400 font-bold uppercase tracking-tight">Flujo: Impresión Masiva (No Venta)</p>
                            </div>
                            <div className="flex gap-4">
                                {!isActivated ? (
                                    <button
                                        onClick={handleActivateBatch}
                                        disabled={isActivating}
                                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 py-2 rounded-xl transition-all active:scale-95"
                                    >
                                        {isActivating ? 'ACTIVANDO...' : '⚡ ACTIVAR TODO EL LOTE'}
                                    </button>
                                ) : (
                                    <div className="bg-green-500/20 text-green-500 px-6 py-2 rounded-xl font-bold flex items-center border border-green-500/30">
                                        ✅ LOTE ACTIVADO
                                    </div>
                                )}
                                <button
                                    onClick={handlePrint}
                                    className="bg-white text-black font-black px-6 py-2 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                                >
                                    🖨️ IMPRIMIR
                                </button>
                                <button
                                    onClick={() => setShowPrintView(false)}
                                    className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-xl border border-white/10"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-0 items-center bg-white p-4 rounded-xl print:p-0 print:bg-transparent">
                            {lastBatch.map((code, idx) => {
                                const origin = (settings.base_url || window.location.origin).trim();
                                const clientUrl = `${origin}/ticket/view/${code}`;
                                return (
                                    <div
                                        key={idx}
                                        className="w-[80mm] border-b border-black border-dashed py-10 px-4 flex flex-col items-center justify-center text-black bg-white"
                                    >
                                        <h4 className="text-[12px] font-black uppercase tracking-widest mb-2 font-sans text-center">
                                            {settings.ticket_header}<br />
                                            <span className="text-[8px] font-bold">{settings.ticket_subheader}</span>
                                        </h4>

                                        <div className="border-2 border-black p-2 mb-3 w-full text-center bg-gray-50">
                                            <p className="text-[10px] uppercase font-bold mb-1">CÓDIGO DE JUEGO</p>
                                            <p className="text-4xl font-black font-mono tracking-tighter">{code}</p>
                                        </div>

                                        <div className="bg-white p-2 border-2 border-black mb-4">
                                            <QRCodeCanvas
                                                value={clientUrl}
                                                size={120}
                                                level="H"
                                                includeMargin={false}
                                            />
                                        </div>

                                        <p className="text-xl font-black mb-4 uppercase">
                                            {playsPerTicket} {playsPerTicket === 1 ? 'JUGADA' : 'JUGADAS'}
                                        </p>

                                        <div className="text-[8px] font-bold text-center border-t border-black/10 pt-4 w-full">
                                            {settings.ticket_terms_line1}<br />
                                            {settings.ticket_terms_line2}
                                        </div>

                                        <p className="mt-4 text-[7px] font-bold uppercase tracking-widest opacity-30 italic">Escanee para ver sus jugadas</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; width: 80mm !important; }
                    .no-print-background { background: white !important; position: static !important; overflow: visible !important; display: block !important; }
                }
            `}</style>
        </div>
    );
}
