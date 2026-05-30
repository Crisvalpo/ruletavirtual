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
    player_id?: string;
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

    // Ref to avoid dependency loop in useEffect
    const soldTicketsRef = React.useRef<RaffleTicket[]>([]);
    useEffect(() => {
        soldTicketsRef.current = soldTickets;
    }, [soldTickets]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [redeemCode, setRedeemCode] = useState('SF-');
    const [redeeming, setRedeeming] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

    // Slot machine animation states
    const [showSlotMachine, setShowSlotMachine] = useState(false);
    const [slotWinner, setSlotWinner] = useState<number | null>(null);
    const [animationOffset, setAnimationOffset] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [slotItems, setSlotItems] = useState<number[]>([]);
    const [hasEnded, setHasEnded] = useState(false);
    const [userWon, setUserWon] = useState(false);

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

    // Function to trigger slot machine animation on the mobile view
    const triggerSlotMachineAnimation = (winnerNum: number) => {
        const items: number[] = [];
        
        // Add 3 rounds of all 36 animals (108 items total) to simulate fast spinning
        for (let round = 0; round < 3; round++) {
            for (let a = 1; a <= 36; a++) {
                items.push(a);
            }
        }
        
        // The index of the winner in our list
        const winnerIndex = items.length + 15;
        
        // Fill up to that index
        for (let a = 1; a <= 15; a++) {
            const nextNum = ((a - 1) % 36) + 1;
            if (a === 15) {
                items.push(winnerNum);
            } else {
                items.push(nextNum);
            }
        }
        
        // Add 5 extra items past the winner so it stops perfectly centered with items on the right too
        for (let a = 1; a <= 5; a++) {
            items.push(((winnerNum + a - 1) % 36) + 1);
        }

        setSlotItems(items);
        setSlotWinner(winnerNum);
        setShowSlotMachine(true);
        setIsSpinning(true);
        setHasEnded(false);
        setAnimationOffset(0);

        // Check if the current user purchased the winning ticket (using the Ref to prevent React closure stale values)
        const myTickets = soldTicketsRef.current.filter(t => t.player_id === user?.id).map(t => t.ticket_number);
        const won = myTickets.includes(winnerNum);
        setUserWon(won);

        // Animate the slide on the next event loop tick
        setTimeout(() => {
            const cardWidthWithGap = 108; // w-[100px] = 100px + gap-2 = 8px
            const cardWidth = 100;
            const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
            const targetOffset = - (winnerIndex * cardWidthWithGap) + (screenWidth / 2) - (cardWidth / 2);
            setAnimationOffset(targetOffset);
        }, 100);

        // Transition takes 8.2s to match the central wheel spin and finish smoothly
        setTimeout(() => {
            setIsSpinning(false);
            setHasEnded(true);
        }, 8500);
    };

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

        // Subscribe to raffle changes to detect when it's drawn
        const raffleChannel = supabase
            .channel(`raffle_changes_${raffleId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'raffles', filter: `id=eq.${raffleId}` }, (payload) => {
                const updatedRaffle = payload.new;
                setRaffle(updatedRaffle);
                if (updatedRaffle.status === 'completed' && updatedRaffle.winning_number) {
                    triggerSlotMachineAnimation(updatedRaffle.winning_number);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ticketsChannel);
            supabase.removeChannel(packagesChannel);
            supabase.removeChannel(raffleChannel);
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
            .select('ticket_number, buyer_name, player_id')
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
                setRedeemCode('SF-');
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

    // Tickets already purchased by this user for the current raffle
    const myTickets = soldTickets.filter(t => t.player_id === user?.id).map(t => t.ticket_number);
    const myNumbersSorted = [...myTickets].sort((a, b) => a - b);

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

                    {myNumbersSorted.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-2">
                            <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest flex items-center gap-1">
                                🎟️ Estás participando con ({myNumbersSorted.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {myNumbersSorted.map(num => {
                                    const animal = ANIMAL_LIST.find(a => a.id === num);
                                    return (
                                        <span 
                                            key={num} 
                                            className="bg-indigo-950/60 text-indigo-200 border border-indigo-500/25 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shadow-sm"
                                        >
                                            <span className="text-yellow-400 font-mono">#{num}</span> {animal?.name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                if (val.startsWith('SF-')) {
                                    setRedeemCode(val);
                                } else if (val.length < 3) {
                                    setRedeemCode('SF-');
                                } else {
                                    setRedeemCode(`SF-${val}`);
                                }
                            }}
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

                {/* Espacio para evitar que el botón flotante inferior tape la última fila de animales */}
                <div className="h-28" />

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

            {/* Slot Machine / Tragamonedas Horizontal Modal Overlay */}
            {showSlotMachine && (
                <div className="fixed inset-0 bg-[#030303]/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 overflow-hidden animate-in fade-in duration-300">
                    
                    {/* Confetti if User Won */}
                    {hasEnded && userWon && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                            {Array.from({ length: 25 }, (_, idx) => {
                                const left = Math.random() * 100;
                                const delay = Math.random() * 4;
                                const duration = 3 + Math.random() * 2;
                                const color = ['bg-yellow-400', 'bg-red-400', 'bg-blue-400', 'bg-emerald-400', 'bg-pink-400', 'bg-indigo-400'][idx % 6];
                                return (
                                    <div
                                        key={idx}
                                        className={`absolute w-3.5 h-3.5 rounded-sm ${color} animate-confetti`}
                                        style={{
                                            left: `${left}%`,
                                            animationDelay: `${delay}s`,
                                            animationDuration: `${duration}s`,
                                            top: `-20px`
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}

                    <div className="max-w-md w-full text-center space-y-6 relative z-10 px-4">
                        <div className="space-y-2">
                            <span className="bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 font-black px-3 py-1 rounded-xl text-xs uppercase tracking-widest animate-pulse">
                                Sorteo en Vivo 🎰
                            </span>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                                {isSpinning ? '¡Girando la Ruleta!' : hasEnded ? 'Resultado' : 'Preparando Giro'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                {isSpinning 
                                    ? 'Espera a que se detenga el tragamonedas...' 
                                    : 'Los animales a color son tus elecciones, en gris las de otros.'}
                            </p>
                        </div>

                        {/* Slot Machine Horizontal Window */}
                        <div className="relative w-full bg-black/80 rounded-3xl border border-white/10 p-1 shadow-2xl overflow-hidden py-8">
                            {/* Central Selector Lines (Golden border and arrows) */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[108px] border-x-2 border-yellow-400 pointer-events-none z-20 bg-yellow-400/5 shadow-[0_0_20px_rgba(234,179,8,0.15)] flex flex-col justify-between py-1">
                                <div className="text-yellow-400 text-[10px] font-black tracking-widest text-center animate-bounce">▼ GANADOR</div>
                                <div className="text-yellow-400 text-[10px] font-black tracking-widest text-center animate-bounce">▲ GANADOR</div>
                            </div>

                            {/* Carousel items strip */}
                            <div className="w-full overflow-hidden">
                                <div
                                    style={{
                                        transform: `translateX(${animationOffset}px)`,
                                        transition: isSpinning ? 'transform 8.2s cubic-bezier(0.05, 0.9, 0.15, 1)' : 'none'
                                    }}
                                    className="flex gap-2"
                                >
                                    {slotItems.map((num, idx) => {
                                        const animal = ANIMAL_LIST.find(a => a.id === num);
                                        const myTickets = soldTickets.filter(t => t.player_id === user?.id).map(t => t.ticket_number);
                                        const isMyChoice = myTickets.includes(num);
                                        
                                        return (
                                            <div
                                                key={idx}
                                                className={`w-[100px] h-[100px] flex-shrink-0 relative rounded-2xl overflow-hidden border transition-all duration-300 ${
                                                    isMyChoice
                                                        ? 'border-indigo-500/50 shadow-md shadow-indigo-500/10'
                                                        : 'border-white/5'
                                                }`}
                                            >
                                                <Image
                                                    src={`/animals/${num}.jpg`}
                                                    alt={animal?.name || `Nº ${num}`}
                                                    fill
                                                    className={`object-cover transition-all duration-500 ${
                                                        isMyChoice
                                                            ? 'grayscale-0 brightness-110 contrast-110'
                                                            : 'grayscale opacity-35 brightness-50'
                                                    }`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Detened/End Info */}
                        {hasEnded && (
                            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                {userWon ? (
                                    <div className="space-y-2">
                                        <div className="text-4xl text-yellow-400 font-extrabold uppercase animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                                            ¡Felicidades! 🎉
                                        </div>
                                        <p className="text-lg font-bold text-emerald-400">
                                            ¡El número ganador es el {ANIMAL_LIST.find(a => a.id === slotWinner)?.name || `#${slotWinner}`} y es tu boleto!
                                        </p>
                                        <p className="text-xs text-slate-400">Tus créditos han sido actualizados con tu jugada ganadora.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-2xl text-slate-300 font-extrabold uppercase">
                                            Resultado del Sorteo
                                        </div>
                                        <p className="text-sm text-rose-400 font-bold">
                                            El número ganador es el {ANIMAL_LIST.find(a => a.id === slotWinner)?.name || `#${slotWinner}`}.
                                        </p>
                                        <p className="text-xs text-slate-500">Esta vez no ganaste, ¡pero sigue intentando en el próximo sorteo! 🍀</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setShowSlotMachine(false);
                                        // Refetch status to show updated view
                                        fetchData();
                                    }}
                                    className="bg-indigo-650 hover:bg-indigo-600 text-white font-black px-8 py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
                                >
                                    Volver al Juego
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
                @keyframes confetti-fall {
                    0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
                .animate-confetti {
                    animation: confetti-fall 4s linear infinite;
                }
            `}</style>
        </main>
    );
}
