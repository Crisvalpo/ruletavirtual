'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Raffle {
    id: string;
    code: string;
    name: string;
    status: 'open' | 'closed_for_sales' | 'spinning' | 'completed' | 'cancelled';
    start_time: string;
    base_price: number;
}

export default function RaffleList() {
    const supabase = createClient();
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchRaffles();

        // Subscribe to raffles changes
        const channel = supabase
            .channel('raffles_list_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles' }, () => {
                fetchRaffles();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchRaffles() {
        try {
            // Fetch only non-completed and non-cancelled raffles
            const { data, error } = await supabase
                .from('raffles')
                .select('*')
                .in('status', ['open', 'closed_for_sales', 'spinning'])
                .order('start_time', { ascending: true });

            if (!error && data) {
                setRaffles(data as Raffle[]);

                // For each raffle, fetch the sold tickets count
                const counts: Record<string, number> = {};
                await Promise.all(
                    data.map(async (r) => {
                        const { count } = await supabase
                            .from('raffle_tickets')
                            .select('*', { count: 'exact', head: true })
                            .eq('raffle_id', r.id)
                            .neq('status', 'cancelled');
                        counts[r.id] = count || 0;
                    })
                );
                setTicketCounts(counts);
            }
        } catch (err) {
            console.error('Error fetching active raffles:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="w-full bg-[#111]/30 backdrop-blur-md rounded-3xl p-6 border border-white/5 animate-pulse text-center">
                <span className="text-xs text-gray-500 uppercase tracking-widest font-black">Cargando sorteos activos...</span>
            </div>
        );
    }

    if (raffles.length === 0) {
        return null; // Don't show anything if there are no active raffles
    }

    return (
        <div className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden space-y-6">
            {/* Glow de fondo decorativo */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-between items-center z-10 relative">
                <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    🎟️ Sorteos
                </h2>
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-black px-2.5 py-1 rounded-xl text-[9px] uppercase tracking-wider">
                    Online
                </span>
            </div>

            <div className="space-y-3 z-10 relative">
                {raffles.map((raffle) => {
                    const sold = ticketCounts[raffle.id] || 0;
                    const available = 36 - sold;
                    const isClosed = raffle.status === 'closed_for_sales' || raffle.status === 'spinning';

                    return (
                        <div
                            key={raffle.id}
                            className="w-full bg-gradient-to-tr from-indigo-950/20 via-slate-900/40 to-slate-900/60 border border-indigo-500/20 hover:border-indigo-500/40 rounded-3xl p-5 transition-all shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden group"
                        >
                            {/* Decorative background glow */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />

                            <div className="space-y-1.5 z-10 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-indigo-900/65 text-indigo-300 border border-indigo-500/25 font-black px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider">
                                        SORTEO #{raffle.code}
                                    </span>
                                    {isClosed && (
                                        <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 font-black px-2 py-0.5 rounded-lg text-[8px] uppercase tracking-wider">
                                            VENTAS CERRADAS
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-black text-white leading-tight">🏆 {raffle.name}</h3>
                                <p className="text-[10px] text-gray-400 font-medium">
                                    📅 Fecha: {new Date(raffle.start_time).toLocaleString()} | 💰 Valor: ${raffle.base_price.toLocaleString()}
                                </p>
                                <div className="flex gap-4 text-[10px] font-black tracking-tight mt-1">
                                    <span className="text-emerald-400">🟢 Libres: {available}</span>
                                    <span className="text-yellow-400">🔴 Vendidos: {sold}</span>
                                </div>
                            </div>

                            <div className="w-full md:w-auto z-10 flex-none self-end md:self-center">
                                {isClosed ? (
                                    <span className="block w-full md:w-auto bg-slate-800 text-slate-500 text-center font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-white/5 cursor-not-allowed">
                                        Cerrado
                                    </span>
                                ) : (
                                    <Link
                                        href={`/individual/raffle/${raffle.id}`}
                                        className="block w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-center font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 hover:scale-102"
                                    >
                                        Elegir Boletos 🎟️
                                    </Link>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
