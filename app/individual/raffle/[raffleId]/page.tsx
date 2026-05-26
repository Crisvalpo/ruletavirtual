'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import IdentityBadge from '@/components/individual/IdentityBadge';
import Link from 'next/link';

interface RaffleTicket {
    ticket_number: number;
    buyer_name: string;
}

interface RafflePackage {
    id: string;
    code: string;
    total_options: number;
    remaining_options: number;
    status: 'active' | 'exhausted' | 'expired';
}

export default function RaffleSelectionPage({
    params
}: {
    params: Promise<{ raffleId: string }>
}) {
    const { raffleId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading } = useAuth();
    const supabase = createClient();

    // Data states
    const [raffle, setRaffle] = useState<any>(null);
    const [soldTickets, setSoldTickets] = useState<RaffleTicket[]>([]);
    const [packages, setPackages] = useState<RafflePackage[]>([]);
    const [selectedPackageCode, setSelectedPackageCode] = useState<string>('');
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

    // Get URL redeem code
    useEffect(() => {
        const codeParam = searchParams.get('redeem');
        if (codeParam) {
            setRedeemCode(codeParam);
        }
    }, [searchParams]);

    // Force auth
    useEffect(() => {
        if (!isLoading && !user) {
            router.push(`/auth/login?returnUrl=/individual/raffle/${raffleId}`);
        }
    }, [user, isLoading, router, raffleId]);

    // Fetch initial raffle details, sold tickets and player packages
    useEffect(() => {
        if (!user) return;

        fetchData();

        // Subscribe to raffle tickets changes for this raffle
        const ticketsChannel = supabase
            .channel(`raffle_tickets_${raffleId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_tickets', filter: `raffle_id=eq.${raffleId}` }, () => {
                fetchSoldTickets();
            })
            .subscribe();

        // Subscribe to player packages changes
        const packagesChannel = supabase
            .channel(`raffle_packages_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_packages', filter: `player_id=eq.${user.id}` }, () => {
                fetchPlayerPackages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ticketsChannel);
            supabase.removeChannel(packagesChannel);
        };
    }, [user, raffleId]);

    async function fetchData() {
        setLoading(true);
        await Promise.all([fetchRaffleDetails(), fetchSoldTickets(), fetchPlayerPackages()]);
        setLoading(false);
    }

    async function fetchRaffleDetails() {
        const { data, error } = await supabase
            .from('raffles')
            .select('*')
            .eq('id', raffleId)
            .single();
        if (!error && data) {
            setRaffle(data);
        }
    }

    async function fetchSoldTickets() {
        const { data, error } = await supabase
            .from('raffle_tickets')
            .select('ticket_number, buyer_name')
            .eq('raffle_id', raffleId)
            .neq('status', 'cancelled');
        if (!error && data) {
            setSoldTickets(data as RaffleTicket[]);
        }
    }

    async function fetchPlayerPackages() {
        if (!user) return;
        const { data, error } = await supabase
            .from('raffle_packages')
            .select('*')
            .eq('player_id', user.id)
            .eq('status', 'active');
        if (!error && data) {
            const pkgs = data as RafflePackage[];
            setPackages(pkgs);
            if (pkgs.length > 0) {
                // Pre-select first package with remaining credits
                const activePkg = pkgs.find(p => p.remaining_options > 0);
                if (activePkg) {
                    setSelectedPackageCode(activePkg.code);
                } else {
                    setSelectedPackageCode(pkgs[0].code);
                }
            }
        }
    }

    const handleRedeemTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!redeemCode || !user) return;

        setRedeeming(true);
        setMessage(null);

        const { data, error } = await supabase.rpc('redeem_raffle_package', {
            p_code: redeemCode.trim().toUpperCase(),
            p_player_id: user.id
        });

        if (error) {
            setMessage({ text: 'Error al validar el ticket: ' + error.message, type: 'error' });
        } else {
            const res = data as { success: boolean; message: string; remaining_options?: number };
            if (res.success) {
                setMessage({ text: res.message, type: 'success' });
                setRedeemCode('');
                // Refetch packages
                await fetchPlayerPackages();
                // Select the redeemed code
                setSelectedPackageCode(redeemCode.trim().toUpperCase());
            } else {
                setMessage({ text: res.message, type: 'error' });
            }
        }
        setRedeeming(false);
    };

    const handleSelectNumber = (num: number) => {
        const activePkg = packages.find(p => p.code === selectedPackageCode);
        const credits = activePkg ? activePkg.remaining_options : 0;

        if (selectedNumbers.includes(num)) {
            // Deselect
            setSelectedNumbers(prev => prev.filter(n => n !== num));
        } else {
            // Check credits
            if (credits === 0) {
                setMessage({ text: 'No tienes créditos de sorteo disponibles en el ticket seleccionado. Por favor ingresa un código válido.', type: 'warning' });
                return;
            }
            if (selectedNumbers.length >= credits) {
                setMessage({ text: `Solo puedes seleccionar hasta ${credits} animalitos con tu saldo de ticket.`, type: 'warning' });
                return;
            }
            setSelectedNumbers(prev => [...prev, num]);
        }
    };

    const handleConfirmPurchase = async () => {
        if (selectedNumbers.length === 0 || !user || !selectedPackageCode) return;

        setPurchasing(true);
        setMessage(null);

        const { data, error } = await supabase.rpc('buy_raffle_tickets', {
            p_raffle_id: raffleId,
            p_ticket_numbers: selectedNumbers,
            p_player_id: user.id,
            p_package_code: selectedPackageCode
        });

        if (error) {
            setMessage({ text: 'Error de red: ' + error.message, type: 'error' });
        } else {
            const res = data as { success: boolean; message: string; remaining_options?: number };
            if (res.success) {
                setMessage({ text: res.message, type: 'success' });
                setSelectedNumbers([]);
                await Promise.all([fetchSoldTickets(), fetchPlayerPackages()]);
            } else {
                // If collision occurred (someone bought it faster)
                setMessage({ text: res.message, type: 'error' });
                // Parse which animal it was to deselect it
                const match = res.message.match(/#(\d+)/);
                if (match) {
                    const failedNum = parseInt(match[1]);
                    // Deselect that specific number so the player can select another
                    setSelectedNumbers(prev => prev.filter(n => n !== failedNum));
                }
                // Update sold tickets grid instantly
                await fetchSoldTickets();
            }
        }
        setPurchasing(false);
    };

    const activePkg = packages.find(p => p.code === selectedPackageCode);
    const credits = activePkg ? activePkg.remaining_options : 0;

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-white space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold tracking-widest text-white/50 uppercase">Conectando al Sorteo</p>
                    <p className="text-xs text-white/30">Cargando los boletos y tus créditos...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#050505] text-white p-4 font-sans select-none overflow-y-auto">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-650/15 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-650/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-xl mx-auto space-y-6 relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center py-2">
                    <Link
                        href="/"
                        className="bg-white/5 hover:bg-white/10 text-white font-bold p-3 rounded-2xl transition-all border border-white/10 flex items-center justify-center aspect-square"
                    >
                        🏠
                    </Link>
                    <IdentityBadge />
                </div>

                {/* Raffle Info Card */}
                <div className="bg-gradient-to-tr from-indigo-950/40 to-slate-900/60 border border-indigo-500/20 rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-900/65 text-indigo-300 border border-indigo-500/25 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider">
                            Sorteo #{raffle?.code}
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider animate-pulse">
                            Venta Activa
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">{raffle?.name}</h1>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        📅 Sorteo programado: {new Date(raffle?.start_time).toLocaleString()}
                    </p>
                </div>

                {/* Messages Banner */}
                {message && (
                    <div className={`p-4 rounded-2xl font-bold text-sm shadow-md animate-in slide-in-from-top-4 duration-300 border flex items-center gap-3 ${
                        message.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                            : message.type === 'error'
                            ? 'bg-rose-500/10 border-rose-500/35 text-rose-400 animate-shake'
                            : 'bg-amber-500/10 border-amber-500/35 text-amber-400'
                    }`}>
                        <span>{message.type === 'success' ? '✅' : message.type === 'error' ? '❌' : '⚠️'}</span>
                        <p>{message.text}</p>
                    </div>
                )}

                {/* Redeem & Credits Section */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
                    {/* Header showing remaining credits */}
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tus Créditos</h3>
                        <span className="text-sm font-black text-indigo-400 font-mono">
                            Saldo: {credits} animalito(s)
                        </span>
                    </div>

                    {/* Dropdown if user has packages */}
                    {packages.length > 0 ? (
                        <div className="space-y-2">
                            <label className="block text-[10px] text-gray-500 font-black uppercase tracking-wider">
                                Código de Ticket Seleccionado:
                            </label>
                            <select
                                value={selectedPackageCode}
                                onChange={(e) => {
                                    setSelectedPackageCode(e.target.value);
                                    setSelectedNumbers([]);
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold focus:outline-none focus:border-indigo-500 transition-all text-sm"
                            >
                                {packages.map((pkg) => (
                                    <option key={pkg.id} value={pkg.code} className="bg-[#111]">
                                        Ticket {pkg.code} ({pkg.remaining_options} créditos disponibles)
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <p className="text-xs text-rose-400 font-bold text-center py-2 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                            No tienes ningún ticket de sorteo canjeado. ¡Por favor ingresa un código!
                        </p>
                    )}

                    {/* Redeem code input */}
                    <form onSubmit={handleRedeemTicket} className="flex gap-2 pt-2 border-t border-white/5">
                        <input
                            type="text"
                            placeholder="Código SF-XXXX"
                            value={redeemCode}
                            onChange={(e) => setRedeemCode(e.target.value)}
                            disabled={redeeming}
                            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold placeholder-slate-600 outline-none text-sm focus:border-indigo-500 transition-all uppercase"
                        />
                        <button
                            type="submit"
                            disabled={redeeming || !redeemCode}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white font-black px-6 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        >
                            {redeeming ? '...' : 'Canjear'}
                        </button>
                    </form>
                </div>

                {/* 36 Grid section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Selecciona tus animalitos ({selectedNumbers.length} / {credits})
                        </h3>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 36 }, (_, i) => {
                            const num = i + 1;
                            const ticket = soldTickets.find(t => t.ticket_number === num);
                            const isSold = !!ticket;
                            const isSelected = selectedNumbers.includes(num);
                            const animal = ANIMAL_LIST.find(a => a.id === num);
                            const imageSrc = `/animals/${num}.jpg`;

                            return (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => !isSold && handleSelectNumber(num)}
                                    disabled={isSold || purchasing}
                                    className={`relative rounded-2xl aspect-square border transition-all duration-300 overflow-hidden ${
                                        isSold
                                            ? 'border-white/5 opacity-30 grayscale cursor-not-allowed scale-95'
                                            : isSelected
                                            ? 'border-indigo-500 scale-[1.02] shadow-[0_0_15px_rgba(99,102,241,0.5)] ring-2 ring-indigo-500/50'
                                            : 'border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95'
                                    }`}
                                >
                                    {/* Animal Image (Fills the entire button square) */}
                                    <div className="absolute inset-0 w-full h-full">
                                        <Image
                                            src={imageSrc}
                                            alt={animal?.name || `Nº ${num}`}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 25vw, 150px"
                                            priority={num <= 12}
                                        />
                                    </div>

                                    {/* Selection Checkmark Overlay */}
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white shadow-md animate-in zoom-in-50 duration-200 z-10">
                                            <span className="text-[10px] font-black">✓</span>
                                        </div>
                                    )}

                                    {/* Sold Overlay */}
                                    {isSold && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-1 z-10">
                                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black px-1.5 py-0.5 rounded-md text-[7px] uppercase tracking-wider">
                                                Vendido
                                            </span>
                                            {ticket.buyer_name && (
                                                <span className="text-[7px] font-black text-gray-300 truncate w-full text-center mt-1 px-0.5 drop-shadow-md">
                                                    {ticket.buyer_name}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Purchase Button */}
                {selectedNumbers.length > 0 && (
                    <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-full duration-500">
                        <button
                            onClick={handleConfirmPurchase}
                            disabled={purchasing}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-3xl uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/30 transition-all active:scale-[0.98] border border-indigo-400/20 flex items-center justify-center gap-2"
                        >
                            {purchasing ? 'CONFIRMANDO JUGADA...' : `🛒 COMPRAR ${selectedNumbers.length} BOLETOS`}
                        </button>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
            `}</style>
        </main>
    );
}
