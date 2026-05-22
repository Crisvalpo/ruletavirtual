'use client';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { QRCodeCanvas } from 'qrcode.react';

interface PrizeHistory {
    id: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    prize_won: string;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    created_at: string;
    package_code?: string;
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

    // Interactive Prize QR Modal state
    const [activePrizeForQr, setActivePrizeForQr] = useState<PrizeHistory | null>(null);

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
                created_at,
                package_code
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
        <main className="min-h-screen bg-[#050505] text-white flex flex-col pwa-mode">
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

            <div className="flex-1 p-6 max-w-2xl mx-auto w-full pb-20">
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
                                onClick={() => setActivePrizeForQr(prize)}
                                className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl cursor-pointer active:scale-[0.99]"
                            >
                                {/* Payout Indicator Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${prize.prize_payout_status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'
                                    }`} />

                                <div className="text-3xl bg-white/5 w-12 h-12 flex items-center justify-center rounded-xl border border-white/10 group-hover:scale-105 transition-all overflow-hidden">
                                    {prize.player_emoji?.startsWith('http') ? (
                                        <img src={prize.player_emoji} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        prize.player_emoji
                                    )}
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
                                            {prize.prize_payout_status === 'paid' ? 'Cobrado' : 'Por Reclamar'}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black tracking-tight text-white mb-0.5">
                                        {prize.prize_won}
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                        Pantalla #{prize.screen_number}
                                    </p>
                                </div>

                                <div className="flex items-center justify-center">
                                    <span className="bg-white/5 group-hover:bg-primary/20 group-hover:text-white text-white/40 text-[9px] font-black uppercase tracking-widest px-2.5 py-2 rounded-xl transition-all border border-white/5 group-hover:border-primary/20">
                                        VER QR 🎫
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* INTERACTIVE PRIZE QR CODE MODAL */}
            {activePrizeForQr && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 animate-zoom-in backdrop-blur-sm"
                    onClick={() => setActivePrizeForQr(null)}
                >
                    <div
                        className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setActivePrizeForQr(null)}
                            className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-all text-gray-400 hover:text-white"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="text-5xl mb-3 mt-2 flex justify-center">
                            {activePrizeForQr.player_emoji?.startsWith('http') ? (
                                <img src={activePrizeForQr.player_emoji} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                            ) : (
                                activePrizeForQr.player_emoji
                            )}
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">
                            {activePrizeForQr.prize_won}
                        </h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-6">
                            Pantalla #{activePrizeForQr.screen_number} · {new Date(activePrizeForQr.created_at).toLocaleDateString()}
                        </p>

                        {/* QR Code Container */}
                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl mb-6">
                            <QRCodeCanvas
                                value={`${window.location.origin}/staff/validate/${activePrizeForQr.package_code || activePrizeForQr.id.slice(0, 8)}`}
                                size={180}
                                level="H"
                                includeMargin={false}
                                className="rounded-lg"
                            />
                            <p className="mt-2 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">QR VÁLIDO EN MESÓN</p>
                        </div>

                        {/* ID de Transaccion */}
                        <div className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 mb-6 inline-flex flex-col items-center max-w-full">
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">ID de Transacción</span>
                            <span className="font-mono text-[9px] font-bold text-white truncate max-w-xs">{activePrizeForQr.id}</span>
                        </div>

                        <div className="space-y-3">
                            <div className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider ${activePrizeForQr.prize_payout_status === 'paid'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse'
                                }`}>
                                Estado: {activePrizeForQr.prize_payout_status === 'paid' ? 'Cobrado ✅' : 'Pendiente de Cobro ⚠️'}
                            </div>
                            <p className="text-[10px] text-gray-500 leading-tight">
                                Presenta este código QR al personal en el mesón para reclamar tu premio.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8 text-center opacity-20 mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Antigravity Rewards · Historial de Suerte</p>
            </div>
        </main>
    );
}
