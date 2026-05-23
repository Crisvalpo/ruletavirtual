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
    id: string;
}

interface PrizeData {
    id: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    created_at: string;
    prize_won: string | null;
    package_code?: string;
    package_id?: string;
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
    const [singlePrize, setSinglePrize] = useState<PrizeData | null>(null);
    const [associatedTicket, setAssociatedTicket] = useState<TicketData | null>(null);
    const [prizes, setPrizes] = useState<PrizeData[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setNotification(null);
        setTicket(null);
        setSinglePrize(null);
        setAssociatedTicket(null);
        setPrizes([]);

        try {
            // 1. Intentar buscar en game_packages por code
            const { data: ticketData } = await supabase
                .from('game_packages')
                .select('*')
                .eq('code', code)
                .maybeSingle();

            if (ticketData) {
                setTicket(ticketData as any);

                // 2. Traer premios asociados con este combo (buscando por package_id o por package_code)
                const { data: prizesData } = await supabase
                    .from('player_queue')
                    .select('id, screen_number, player_name, player_emoji, prize_payout_status, created_at, prize_won, package_code')
                    .or(`package_id.eq.${ticketData.id},package_code.eq.${ticketData.code}`)
                    .order('created_at', { ascending: false });

                if (prizesData) {
                    setPrizes(prizesData as any);
                }
            } else {
                // Si no es un ticket, podría ser un premio individual en player_queue
                const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(code);
                const isPartialHex = code.length === 8 && /^[0-9a-fA-F]{8}$/.test(code);

                let prizeData = null;

                if (isUuid) {
                    const { data } = await supabase
                        .from('player_queue')
                        .select('id, screen_number, player_name, player_emoji, prize_payout_status, created_at, prize_won, package_code, package_id')
                        .eq('id', code)
                        .maybeSingle();
                    if (data) prizeData = data;
                } else if (isPartialHex) {
                    // Soporte para códigos QR antiguos con slice(0, 8)
                    const { data } = await supabase
                        .from('player_queue')
                        .select('id, screen_number, player_name, player_emoji, prize_payout_status, created_at, prize_won, package_code, package_id')
                        .filter('id', 'like', `${code.toLowerCase()}%`)
                        .maybeSingle();
                    if (data) prizeData = data;
                }

                if (prizeData && prizeData.prize_won) {
                    setSinglePrize(prizeData as any);
                    setPrizes([prizeData as any]);

                    // Si el premio tiene package_id o package_code, traer info del combo asociado
                    if (prizeData.package_id || prizeData.package_code) {
                        const { data: assocTicket } = await supabase
                            .from('game_packages')
                            .select('*')
                            .or(`id.eq.${prizeData.package_id || '00000000-0000-0000-0000-000000000000'},code.eq.${prizeData.package_code || ''}`)
                            .maybeSingle();
                        if (assocTicket) {
                            setAssociatedTicket(assocTicket as any);
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error("Error al cargar datos:", err);
            setNotification({ message: 'Error cargando datos: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [code]);

    const handleActivate = async () => {
        setActionLoading(true);
        setNotification(null);
        try {
            const { data, error } = await supabase.rpc('activate_single_ticket', { p_code: code });
            if (error) {
                setNotification({ message: error.message, type: 'error' });
            } else {
                setNotification({ message: data.message || 'Ticket activado con éxito', type: 'success' });
                fetchData();
            }
        } catch (err: any) {
            setNotification({ message: 'Error al activar: ' + err.message, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePayout = async (prizeId: string) => {
        const confirmed = window.confirm('¿Seguro que deseas marcar este premio como ENTREGADO?');
        if (!confirmed) return;

        setActionLoading(true);
        setNotification(null);
        try {
            const { error } = await supabase
                .from('player_queue')
                .update({
                    prize_payout_status: 'paid',
                    prize_payout_at: new Date().toISOString()
                })
                .eq('id', prizeId);

            if (error) {
                setNotification({ message: error.message, type: 'error' });
            } else {
                setNotification({ message: '¡Premio marcado como ENTREGADO con éxito! ✅', type: 'success' });
                fetchData();
            }
        } catch (err: any) {
            setNotification({ message: 'Error al entregar premio: ' + err.message, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-spin text-5xl">🎲</div>
        </div>
    );

    const noEncontrado = !ticket && !singlePrize;

    if (noEncontrado) return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
            <span className="text-6xl mb-6">⚠️</span>
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tight italic">Código No Encontrado</h1>
            <p className="text-gray-500 mb-8 max-w-sm text-sm">El código "{code}" no corresponde a un ticket activo ni a una jugada ganadora registrada.</p>
            <button onClick={() => router.push('/staff/scanner')} className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black px-8 py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs tracking-widest uppercase">
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
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    >
                        ESCÁNER 📷
                    </button>
                </header>

                {/* Banner de notificaciones en pantalla */}
                {notification && (
                    <div className={`mb-6 p-4 rounded-2xl border text-sm font-bold text-center animate-zoom-in flex items-center justify-center gap-2 ${
                        notification.type === 'success' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : notification.type === 'error'
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                        <span>{notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}</span>
                        <span>{notification.message}</span>
                    </div>
                )}

                <main className="space-y-6">
                    {/* MODO A: PREMIO INDIVIDUAL ESCANEADO */}
                    {singlePrize && (
                        <div className="space-y-6">
                            <div className={`relative overflow-hidden rounded-[2rem] border p-8 shadow-2xl transition-all ${
                                singlePrize.prize_won === 'PREMIO NIVEL 1'
                                    ? 'bg-gradient-to-br from-[#241e0c] via-[#111] to-[#111] border-yellow-500/40 shadow-yellow-500/5'
                                    : 'bg-gradient-to-br from-[#2c1a0e] via-[#111] to-[#111] border-orange-500/40 shadow-orange-500/5'
                            }`}>
                                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-[80px] opacity-10 bg-white" />

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">ID DE JUGADA</span>
                                        <p className="font-mono text-[10px] text-gray-400 select-all">{singlePrize.id}</p>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        singlePrize.prize_payout_status === 'paid' 
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                                    }`}>
                                        {singlePrize.prize_payout_status === 'paid' ? 'ENTREGADO' : 'PENDIENTE'}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center text-center my-6 pb-6 border-b border-white/5">
                                    <div className="text-6xl bg-white/5 w-24 h-24 flex items-center justify-center rounded-3xl border border-white/10 mb-4 shadow-xl overflow-hidden">
                                        {singlePrize.player_emoji?.startsWith('http') ? (
                                            <img src={singlePrize.player_emoji} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            singlePrize.player_emoji || '😎'
                                        )}
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">{singlePrize.player_name || 'Jugador'}</h2>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                        Pantalla #{singlePrize.screen_number} · {new Date(singlePrize.created_at).toLocaleDateString()} {new Date(singlePrize.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>

                                <div className="my-6">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-3">Recompensa a Entregar</p>
                                    
                                    {singlePrize.prize_won === 'PREMIO NIVEL 1' ? (
                                        <div className="bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center shadow-lg">
                                            <span className="text-4xl block mb-2 animate-bounce">👑</span>
                                            <h3 className="text-2xl font-black text-yellow-400 tracking-tight uppercase">PREMIO NIVEL 1</h3>
                                            <p className="text-[10px] text-yellow-500/70 font-black mt-1.5 uppercase tracking-widest">Premio Mayor de la Ruleta</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/20 to-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-center shadow-lg">
                                            <span className="text-4xl block mb-2 animate-bounce">🥈</span>
                                            <h3 className="text-2xl font-black text-orange-400 tracking-tight uppercase">PREMIO NIVEL 2</h3>
                                            <p className="text-[10px] text-orange-500/70 font-black mt-1.5 uppercase tracking-widest">Premio de Consuelo / Revancha Ganada</p>
                                        </div>
                                    )}
                                </div>

                                {singlePrize.prize_payout_status === 'pending' ? (
                                    <button
                                        onClick={() => handlePayout(singlePrize.id)}
                                        disabled={actionLoading}
                                        className={`w-full font-black py-5 rounded-2xl transition-all active:scale-[0.98] shadow-xl uppercase tracking-wider text-xs ${
                                            singlePrize.prize_won === 'PREMIO NIVEL 1'
                                                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/10'
                                                : 'bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/10'
                                        }`}
                                    >
                                        {actionLoading ? 'PROCESANDO...' : '🎁 ENTREGAR PREMIO'}
                                    </button>
                                ) : (
                                    <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl text-center text-green-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <span>✓ PREMIO ENTREGADO Y COBRADO</span>
                                    </div>
                                )}
                            </div>

                            {/* Info del Combo Asociado en segundo plano */}
                            {associatedTicket && (
                                <div className="bg-[#111] border border-white/5 rounded-[1.5rem] p-6 shadow-xl">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Combo Vinculado</h3>
                                    <div className="flex justify-between items-center text-xs">
                                        <div>
                                            <p className="font-mono font-black text-white text-sm">{associatedTicket.code}</p>
                                            <p className="text-[10px] text-gray-500 mt-1 uppercase">Cliente: {associatedTicket.buyer_name || 'No especificado'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="bg-white/5 text-gray-300 px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest">
                                                {associatedTicket.package_type}
                                            </span>
                                            <p className="text-[9px] text-gray-500 mt-1.5 uppercase font-bold">Giros: {associatedTicket.total_plays - associatedTicket.used_plays} Restantes</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODO B: TICKET / COMBO ESCANEADO */}
                    {ticket && (
                        <div className="space-y-6">
                            <div className={`bg-[#111] border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden ${ticket.is_activated ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CÓDIGO DE COMBO</p>
                                        <p className="text-4xl font-mono font-black text-white">{ticket.code}</p>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${ticket.is_activated ? 'bg-green-500 text-black' : 'bg-yellow-500 text-black'}`}>
                                        {ticket.is_activated ? 'ACTIVO' : 'INACTIVO'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-8 text-xs">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">TIPO</p>
                                        <p className="font-black text-white">{ticket.package_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CLIENTE</p>
                                        <p className="font-black text-white">{ticket.buyer_name || 'No especificado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">GIROS</p>
                                        <p className="font-black text-white">{ticket.total_plays - ticket.used_plays} DISPONIBLES DE {ticket.total_plays}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ESTADO VENTA</p>
                                        <p className={`font-black uppercase ${ticket.sale_status === 'sold' ? 'text-green-400' : 'text-yellow-500'}`}>
                                            {ticket.sale_status === 'sold' ? 'VENDIDO' : 'PRE-IMPRESO'}
                                        </p>
                                    </div>
                                </div>

                                {!ticket.is_activated && (
                                    <button
                                        onClick={handleActivate}
                                        disabled={actionLoading}
                                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-yellow-500/10 text-xs tracking-wider"
                                    >
                                        {actionLoading ? 'PROCESANDO...' : '💰 REGISTRAR VENTA Y ACTIVAR'}
                                    </button>
                                )}
                            </div>

                            {/* LISTA DE PREMIOS ASOCIADOS */}
                            <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                                <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                    🎁 PREMIOS PENDIENTES
                                </h2>
                                <div className="space-y-4">
                                    {prizes.filter(p => p.prize_payout_status === 'pending').map((prize) => (
                                        <div key={prize.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center group">
                                            <div className="flex items-center gap-3">
                                                {prize.player_emoji?.startsWith('http') ? (
                                                    <img src={prize.player_emoji} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border border-white/10 flex-none" />
                                                ) : (
                                                    <span className="text-3xl flex-none">{prize.player_emoji}</span>
                                                )}
                                                <div>
                                                    <div className="font-bold text-white uppercase tracking-tight flex items-center flex-wrap gap-2">
                                                        <span>{prize.player_name}</span>
                                                        {prize.prize_won && (
                                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-black ${
                                                                prize.prize_won === 'PREMIO NIVEL 1'
                                                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                                            }`}>
                                                                {prize.prize_won === 'PREMIO NIVEL 1' ? '👑 NIVEL 1' : '🥈 NIVEL 2'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 uppercase mt-0.5">Pantalla {prize.screen_number} • {new Date(prize.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handlePayout(prize.id)}
                                                disabled={actionLoading}
                                                className={`font-black px-4 py-2 rounded-xl text-xs uppercase tracking-tight transition-all active:scale-95 ${
                                                    prize.prize_won === 'PREMIO NIVEL 1'
                                                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                                        : 'bg-orange-500 hover:bg-orange-400 text-white'
                                                }`}
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
                                                {prize.player_emoji?.startsWith('http') ? (
                                                    <img src={prize.player_emoji} alt="Avatar" className="w-6 h-6 rounded-lg object-cover border border-white/10 flex-none" />
                                                ) : (
                                                    <span className="text-xl flex-none">{prize.player_emoji}</span>
                                                )}
                                                <div>
                                                    <div className="font-bold text-white text-xs flex items-center gap-2">
                                                        <span>{prize.player_name}</span>
                                                        {prize.prize_won && (
                                                            <span className={`text-[8px] px-1.5 py-0.2 rounded border font-bold ${
                                                                prize.prize_won === 'PREMIO NIVEL 1'
                                                                    ? 'bg-yellow-500/10 text-yellow-500/80 border-yellow-500/10'
                                                                    : 'bg-orange-500/10 text-orange-500/80 border-orange-500/10'
                                                            }`}>
                                                                {prize.prize_won === 'PREMIO NIVEL 1' ? '👑 NIVEL 1' : '🥈 NIVEL 2'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] text-gray-500 mt-0.5">PAGADO EL {new Date(prize.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="text-green-500 text-[10px] font-black tracking-widest">PAGADO</span>
                                        </div>
                                    ))}
                                    {prizes.filter(p => p.prize_payout_status === 'paid').length === 0 && (
                                        <p className="text-center text-gray-600 font-bold uppercase text-[9px] py-2">No hay registro de premios pagados aún</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
