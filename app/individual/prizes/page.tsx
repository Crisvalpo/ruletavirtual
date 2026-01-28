'use client';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import IdentityBadge from '@/components/individual/IdentityBadge';

interface PrizeHistory {
    id: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    prize_won: string;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    created_at: string;
    screens: {
        wheel_id: string;
        individual_wheels?: {
            name: string;
        };
    };
}

export default function MyPrizesPage() {
    const { user, profile, isLoading } = useAuth();
    const [prizes, setPrizes] = useState<PrizeHistory[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user?.email) {
            router.push('/');
            return;
        }

        if (user?.email) {
            fetchPrizes();
        }
    }, [user, isLoading]);

    const fetchPrizes = async () => {
        setIsFetching(true);
        const { data, error } = await supabase
            .from('player_queue')
            .select(`
                id, 
                screen_number, 
                player_name, 
                player_emoji, 
                prize_won, 
                prize_payout_status, 
                created_at
            `)
            .eq('player_id', user?.id)
            .neq('prize_won', null)
            .neq('prize_won', '')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setPrizes(data as any);
        }
        setIsFetching(false);
    };

    if (isLoading || isFetching) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#050505] text-white flex flex-col">
            {/* Header Sticky */}
            <div className="bg-[#111] border-b border-white/5 px-4 py-3 flex justify-between items-center z-20 sticky top-0 backdrop-blur-md">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-black uppercase tracking-tighter italic">Mis Victorias 🏆</h1>
                <IdentityBadge />
            </div>

            <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
                {prizes.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <div className="text-6xl mb-6">🏆</div>
                        <p className="text-sm font-black uppercase tracking-[0.2em]">¡Tu vitrina de premios está vacía!</p>
                        <p className="text-[10px] mt-2 italic">Gira la ruleta y reclama tu primera victoria</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prizes.map((prize) => (
                            <div
                                key={prize.id}
                                className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl"
                            >
                                {/* Payout Indicator Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${prize.prize_payout_status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'
                                    }`} />

                                <div className="text-3xl bg-white/5 w-12 h-12 flex items-center justify-center rounded-xl border border-white/10">
                                    {prize.player_emoji}
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                            {new Date(prize.created_at).toLocaleDateString()}
                                        </p>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${prize.prize_payout_status === 'paid'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                            {prize.prize_payout_status === 'paid' ? 'Cobrado' : 'Pendiente'}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black tracking-tight text-white mb-0.5">
                                        {prize.prize_won}
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                        Pantalla #{prize.screen_number}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-8 text-center opacity-20">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Antigravity Rewards · Historial de Suerte</p>
            </div>
        </main>
    );
}
