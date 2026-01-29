'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function TicketClientViewPage({
    params
}: {
    params: Promise<{ code: string }>
}) {
    const { code } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<any>(null);
    const [prizes, setPrizes] = useState<any[]>([]);

    useEffect(() => {
        const fetchTicket = async () => {
            const { data: ticketData } = await supabase
                .from('game_packages')
                .select('*')
                .eq('code', code)
                .single();

            if (ticketData) {
                setTicket(ticketData);
                const { data: prizesData } = await supabase
                    .from('player_queue')
                    .select('*')
                    .eq('package_id', ticketData.id)
                    .order('created_at', { ascending: false });

                if (prizesData) setPrizes(prizesData);
            }
            setLoading(false);
        };
        fetchTicket();
    }, [code]);

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-pulse text-2xl font-black text-white italic">CONSULTANDO TICKET...</div>
        </div>
    );

    if (!ticket) return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
            <span className="text-6xl mb-4">😕</span>
            <h1 className="text-2xl font-black mb-2 uppercase italic">Ups...</h1>
            <p className="text-gray-500 mb-8">No encontramos este ticket. Revisa el código e inténtalo de nuevo.</p>
            <button onClick={() => window.location.href = '/'} className="bg-white text-black font-black px-8 py-4 rounded-2xl">
                VOLVER AL INICIO
            </button>
        </div>
    );

    const remaining = ticket.total_plays - (ticket.plays_used || 0);
    const pendingPrizes = prizes.filter(p => p.prize_payout_status === 'pending');

    return (
        <div className="min-h-screen bg-[#080808] text-white p-6 flex flex-col items-center">
            <div className="w-full max-w-sm">
                <header className="text-center mb-10 mt-8">
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Mi Ticket</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em]">{ticket.code}</p>
                </header>

                <main className="space-y-6">
                    {/* STATUS CARD */}
                    <div className="bg-[#151515] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Giros Disponibles</p>
                            <p className="text-7xl font-black text-white italic tracking-tighter">{remaining}</p>
                        </div>

                        <div className="flex justify-center gap-2 mb-8">
                            {[...Array(ticket.total_plays)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full ${i < (ticket.plays_used || 0) ? 'bg-white/10' : 'bg-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]'}`}
                                />
                            ))}
                        </div>

                        {/* INACTIVE WARNING */}
                        {!ticket.is_activated && (
                            <div className="bg-orange-500/10 border border-orange-500/30 p-6 rounded-3xl mb-6 text-center animate-pulse">
                                <span className="text-3xl mb-2 block">🔔</span>
                                <p className="text-orange-500 text-xs font-black uppercase tracking-widest mb-1">Ticket No Activado</p>
                                <p className="text-orange-500/70 text-[10px] uppercase font-bold leading-tight">
                                    Por favor, acérquese al personal para activar su ticket y registrar su compra.
                                </p>
                            </div>
                        )}

                        {ticket.is_activated && remaining > 0 ? (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 py-3 rounded-xl">
                                <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">✨ ¡Tienes giros pendientes! ✨</p>
                            </div>
                        ) : ticket.is_activated && (
                            <div className="bg-white/5 border border-white/10 py-3 rounded-xl">
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest italic">Ticket agotado</p>
                            </div>
                        )}
                    </div>

                    {/* PRIZES CARD */}
                    {pendingPrizes.length > 0 && (
                        <div className="bg-green-600 border border-green-400 rounded-3xl p-8 shadow-2xl shadow-green-600/20 animate-bounce-subtle">
                            <div className="text-center mb-4">
                                <span className="text-4xl">🏆</span>
                                <h2 className="text-xl font-black uppercase tracking-tight text-white mt-2">¡TIENES UN PREMIO!</h2>
                            </div>
                            <p className="text-sm text-green-100 text-center mb-6 leading-relaxed">
                                Acércate al personal y muestra este código para cobrar tu premio ganado por <strong>{pendingPrizes[0].player_name}</strong>.
                            </p>
                            <div className="bg-black/20 p-4 rounded-2xl text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-green-200">Estado</p>
                                <p className="text-lg font-black text-white tracking-widest">PENDIENTE DE PAGO</p>
                            </div>
                        </div>
                    )}

                    {/* HISTORY (Opcional, muy discreto) */}
                    {prizes.length > 0 && (
                        <div className="px-4">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Actividad Reciente</h3>
                            <div className="space-y-3">
                                {prizes.slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex justify-between items-center opacity-60">
                                        <p className="text-xs uppercase font-bold text-gray-400">{p.player_name}</p>
                                        <p className="text-xs text-gray-600 uppercase font-mono">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {/* ACTION BUTTON - PLAY NOW */}
                {!loading && ticket && ticket.is_activated && remaining > 0 && (
                    <div className="fixed bottom-6 left-0 right-0 px-6 z-50 animate-in slide-in-from-bottom-4 duration-700 delay-500">
                        <button
                            onClick={() => router.push(`/?redeemCode=${ticket.code}`)}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-xl font-black py-5 rounded-2xl shadow-2xl shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-2 border-black/10"
                        >
                            <span className="text-2xl">🎮</span>
                            JUGAR AHORA
                        </button>
                    </div>
                )}

                <footer className="mt-24 text-center pb-12">
                    <p className="text-[10px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-4">Ruleta Virtual 2026</p>
                    <button
                        onClick={() => router.push('/')}
                        className="text-white/20 hover:text-white/40 text-[10px] font-black uppercase"
                    >
                        CERRAR SESIÓN
                    </button>
                </footer>
            </div>

            <style jsx global>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
