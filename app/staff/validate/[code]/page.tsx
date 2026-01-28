'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TicketData {
    code: string;
    sale_status: 'pre_printed' | 'sold';
    is_activated: boolean;
    total_plays: number;
    used_plays: number;
    buyer_name: string;
    created_at: string;
    package_type: string;
}

interface PrizeData {
    id: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    created_at: string;
}

import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function StaffValidatePage({
    params
}: {
    params: Promise<{ code: string }>
}) {
    return (
        <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <ValidateContent params={params} />
        </ProtectedRoute>
    );
}

function ValidateContent({
    params
}: {
    params: Promise<{ code: string }>
}) {
    const { code } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [prizes, setPrizes] = useState<PrizeData[]>([]);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch Ticket
        const { data: ticketData, error: ticketError } = await supabase
            .from('game_packages')
            .select('*')
            .eq('code', code)
            .single();

        if (ticketData) {
            setTicket(ticketData);

            // 2. Fetch Prizes associated with this ticket (package_id in player_queue)
            const { data: prizesData } = await supabase
                .from('player_queue')
                .select('id, screen_number, player_name, player_emoji, prize_payout_status, created_at')
                .eq('package_id', ticketData.id)
                .order('created_at', { ascending: false });

            if (prizesData) {
                setPrizes(prizesData as any);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [code]);

    const handleActivate = async () => {
        setActionLoading(true);
        const { data, error } = await supabase.rpc('activate_single_ticket', { p_code: code });
        if (error) {
            alert(error.message);
        } else {
            alert(data.message);
            fetchData();
        }
        setActionLoading(false);
    };

    const handlePayout = async (prizeId: string) => {
        const confirmed = window.confirm('¿Seguro que deseas marcar este premio como ENTREGADO?');
        if (!confirmed) return;

        setActionLoading(true);
        const { error } = await supabase
            .from('player_queue')
            .update({
                prize_payout_status: 'paid',
                prize_payout_at: new Date().toISOString()
            })
            .eq('id', prizeId);

        if (error) {
            alert(error.message);
        } else {
            fetchData();
        }
        setActionLoading(false);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-spin text-4xl">🎲</div>
        </div>
    );

    if (!ticket) return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
            <span className="text-6xl mb-4">⚠️</span>
            <h1 className="text-2xl font-black mb-2 uppercase">Ticket No Encontrado</h1>
            <p className="text-gray-500 mb-8">El código {code} no existe en el sistema.</p>
            <button onClick={() => router.push('/staff/scanner')} className="bg-white text-black font-black px-8 py-4 rounded-2xl">
                VOLVER AL ESCÁNER
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8">
            <div className="max-w-2xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🎫</span>
                        <h1 className="text-2xl font-black uppercase italic tracking-tighter">Validación Staff</h1>
                    </div>
                    <button
                        onClick={() => router.push('/staff/scanner')}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold"
                    >
                        ESCÁNER
                    </button>
                </header>

                <main className="space-y-6">
                    {/* TICKET CARD */}
                    <div className={`bg-[#111] border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden ${ticket.is_activated ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CÓDIGO</p>
                                <p className="text-4xl font-mono font-black text-white">{ticket.code}</p>
                            </div>
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${ticket.is_activated ? 'bg-green-500 text-black' : 'bg-yellow-500 text-black'}`}>
                                {ticket.is_activated ? 'ACTIVO' : 'INACTIVO'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">TIPO</p>
                                <p className="font-bold text-white">{ticket.package_type}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CLIENTE</p>
                                <p className="font-bold text-white">{ticket.buyer_name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">GIROS</p>
                                <p className="font-bold text-white">{ticket.total_plays - ticket.used_plays} DISPONIBLES</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ESTADO VENTA</p>
                                <p className={`font-bold uppercase ${ticket.sale_status === 'sold' ? 'text-green-400' : 'text-yellow-500'}`}>
                                    {ticket.sale_status === 'sold' ? 'VENDIDO' : 'PRE-IMPRESO'}
                                </p>
                            </div>
                        </div>

                        {!ticket.is_activated && (
                            <button
                                onClick={handleActivate}
                                disabled={actionLoading}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-yellow-500/10"
                            >
                                {actionLoading ? 'PROCESANDO...' : '💰 REGISTRAR VENTA Y ACTIVAR'}
                            </button>
                        )}
                    </div>

                    {/* PRIZES LIST */}
                    {prizes.length > 0 && (
                        <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                🎁 PREMIOS PENDIENTES
                            </h2>
                            <div className="space-y-4">
                                {prizes.filter(p => p.prize_payout_status === 'pending').map((prize) => (
                                    <div key={prize.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{prize.player_emoji}</span>
                                            <div>
                                                <p className="font-bold text-white uppercase tracking-tight">{prize.player_name}</p>
                                                <p className="text-[10px] text-gray-500 uppercase">Pantalla {prize.screen_number} • {new Date(prize.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handlePayout(prize.id)}
                                            disabled={actionLoading}
                                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-tighter"
                                        >
                                            PAGAR
                                        </button>
                                    </div>
                                ))}
                                {prizes.filter(p => p.prize_payout_status === 'pending').length === 0 && (
                                    <p className="text-center text-gray-600 font-bold uppercase text-[10px] py-4">No hay premios pendientes de entrega</p>
                                )}
                            </div>

                            <hr className="my-8 border-white/5" />

                            <h2 className="text-sm font-black text-gray-500 mb-6 uppercase tracking-widest italic">
                                Historial de Premios Pagados
                            </h2>
                            <div className="space-y-4 opacity-40">
                                {prizes.filter(p => p.prize_payout_status === 'paid').map((prize) => (
                                    <div key={prize.id} className="bg-black/20 border border-white/5 p-3 rounded-xl flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{prize.player_emoji}</span>
                                            <div>
                                                <p className="font-bold text-white text-xs">{prize.player_name}</p>
                                                <p className="text-[8px] text-gray-500">PAGADO EL {new Date(prize.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className="text-green-500 text-[10px] font-black tracking-widest">PAGADO</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {prizes.length === 0 && ticket.is_activated && (
                        <div className="text-center py-10 opacity-30">
                            <p className="text-4xl mb-4">🎡</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">El ticket aún no ha registrado jugadas ganadoras</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
