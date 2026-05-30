'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ANIMAL_LIST } from '@/lib/constants/animals';

interface RaffleTicket {
    id: string;
    ticket_number: number;
    buyer_name: string;
    status: 'confirmed' | 'cancelled';
}

interface DisplayRaffleBillboardProps {
    activeRaffleId: string | null;
    baseUrl: string;
    supabase: any;
}

export default function DisplayRaffleBillboard({
    activeRaffleId,
    baseUrl,
    supabase
}: DisplayRaffleBillboardProps) {
    const [raffle, setRaffle] = useState<any>(null);
    const [tickets, setTickets] = useState<RaffleTicket[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeRaffleId) {
            setRaffle(null);
            setTickets([]);
            setLoading(false);
            return;
        }

        async function fetchRaffleDetails() {
            setLoading(true);
            const { data: raffleData } = await supabase
                .from('raffles')
                .select('*')
                .eq('id', activeRaffleId)
                .single();
            if (raffleData) {
                setRaffle(raffleData);
            }

            const { data: ticketsData } = await supabase
                .from('raffle_tickets')
                .select('*')
                .eq('raffle_id', activeRaffleId)
                .neq('status', 'cancelled');
            if (ticketsData) {
                setTickets(ticketsData as RaffleTicket[]);
            }
            setLoading(false);
        }

        fetchRaffleDetails();

        // Subscribe to raffle changes (e.g. status)
        const raffleSub = supabase
            .channel('raffle_billboard_details')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles', filter: `id=eq.${activeRaffleId}` }, (payload: any) => {
                if (payload.new) {
                    setRaffle(payload.new);
                }
            })
            .subscribe();

        // Subscribe to tickets changes (when someone buys a ticket)
        const ticketsSub = supabase
            .channel('raffle_billboard_tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_tickets', filter: `raffle_id=eq.${activeRaffleId}` }, () => {
                // Refetch tickets
                supabase
                    .from('raffle_tickets')
                    .select('*')
                    .eq('raffle_id', activeRaffleId)
                    .neq('status', 'cancelled')
                    .then(({ data }: any) => {
                        if (data) setTickets(data as RaffleTicket[]);
                    });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(raffleSub);
            supabase.removeChannel(ticketsSub);
        };
    }, [activeRaffleId, supabase]);

    if (!activeRaffleId) {
        return (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8 font-sans">
                <div className="text-6xl mb-6">🎟️</div>
                <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Esperando Sorteo...</h1>
                <p className="text-slate-400 text-lg max-w-md font-medium leading-relaxed">
                    El administrador aún no ha activado ningún sorteo en el panel de control.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8 font-sans">
                <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest animate-pulse">Cargando Tablero...</h2>
            </div>
        );
    }

    const soldCount = tickets.length;

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between text-center p-0 overflow-hidden font-sans select-none animate-in fade-in duration-300">
            {/* Grid of 36 animals */}
            <div className="flex-1 w-full grid grid-cols-6 gap-3 p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/60 overflow-y-auto">
                {Array.from({ length: 36 }, (_, i) => {
                    const num = i + 1;
                    const ticket = tickets.find(t => t.ticket_number === num);
                    const isSold = !!ticket;
                    const animal = ANIMAL_LIST.find(a => a.id === num);
                    const imageSrc = `/animals/${num}.jpg`;

                    return (
                        <div
                            key={num}
                            className={`relative rounded-[1.5rem] aspect-square border transition-all duration-500 overflow-hidden shadow-lg ${
                                isSold
                                    ? 'border-rose-500/40 grayscale opacity-75 scale-95'
                                    : 'border-white/10 hover:border-indigo-500/50 hover:scale-105 cursor-default'
                            }`}
                        >
                            {/* Animal Image (Fills 100% of the square cell) */}
                            <div className="absolute inset-0 w-full h-full">
                                <Image
                                    src={imageSrc}
                                    alt={animal?.name || `Animal ${num}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1200px) 15vw, 200px"
                                    priority={num <= 12}
                                />
                            </div>

                            {/* Badge with number */}
                            <div className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border backdrop-blur-md z-15 ${
                                isSold
                                    ? 'bg-rose-950/80 border-rose-500/30 text-rose-450'
                                    : 'bg-black/60 border-white/10 text-white'
                            }`}>
                                {num}
                            </div>

                            {/* Sold Overlay */}
                            {isSold && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-3 z-10 animate-in fade-in duration-300">
                                    <span className="bg-rose-600 text-white font-black px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-widest shadow-md">
                                        VENDIDO
                                    </span>
                                    <span className="text-[12px] font-black text-white truncate w-full text-center mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                                        {ticket.buyer_name}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
