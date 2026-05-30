'use client';

import { useState, useEffect } from 'react';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import { QRCodeCanvas } from 'qrcode.react';

const BASE_FREQUENCIES: Record<number, number> = {
    1: 4, 2: 1, 3: 2, 4: 5, 5: 8, 6: 3, 7: 2, 8: 6, 9: 1, 10: 4,
    11: 3, 12: 9, 13: 2, 14: 5, 15: 1, 16: 4, 17: 7, 18: 3, 19: 2, 20: 8,
    21: 5, 22: 1, 23: 3, 24: 6, 25: 4, 26: 2, 27: 5, 28: 1, 29: 7, 30: 3,
    31: 2, 32: 6, 33: 4, 34: 2, 35: 5, 36: 3
};

interface StatsRaffle {
    id: string;
    code: string;
    name: string;
    winning_number: number;
    winner_name: string | null;
    winner_avatar: string | null;
}

interface DisplayRaffleStatsProps {
    baseUrl: string;
    supabase: any;
}

export default function DisplayRaffleStats({
    baseUrl,
    supabase
}: DisplayRaffleStatsProps) {
    const [recentWinners, setRecentWinners] = useState<StatsRaffle[]>([]);
    const [lastWinner, setLastWinner] = useState<StatsRaffle | null>(null);
    const [hotAnimals, setHotAnimals] = useState<{ id: number; name: string; count: number }[]>([]);
    const [coldAnimals, setColdAnimals] = useState<{ id: number; name: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStatsData = async () => {
        try {
            // 1. Obtener todos los sorteos finalizados para calcular frecuencias y últimos ganadores
            const { data: rafflesData, error: rafflesError } = await supabase
                .from('raffles')
                .select(`
                    id,
                    code,
                    name,
                    winning_number,
                    winner_ticket_id,
                    updated_at,
                    raffle_tickets (
                        buyer_name,
                        player_id,
                        profiles (
                            avatar_url
                        )
                    )
                `)
                .eq('status', 'completed')
                .is('winning_number', 'not.null')
                .order('updated_at', { ascending: false });

            if (rafflesError) {
                console.error("Error cargando estadísticas desde base de datos:", rafflesError);
                return;
            }

            let list: StatsRaffle[] = [];
            let lastWin: StatsRaffle | null = null;

            if (rafflesData && rafflesData.length > 0) {
                rafflesData.forEach((r: any) => {
                    const ticket = Array.isArray(r.raffle_tickets) ? r.raffle_tickets[0] : r.raffle_tickets;
                    const profileData = ticket?.profiles;
                    
                    const item: StatsRaffle = {
                        id: r.id,
                        code: r.code,
                        name: r.name,
                        winning_number: r.winning_number,
                        winner_name: ticket?.buyer_name || null,
                        winner_avatar: profileData?.avatar_url || null
                    };
                    list.push(item);
                });
                
                // Buscamos el último ganador real (el primero que tenga winner_name no nulo)
                lastWin = list.find(item => item.winner_name !== null) || list[0] || null;
            }

            // 3. Fallback si no hay sorteos completados
            if (!lastWin) {
                const { data: historyData } = await supabase
                    .from('game_history')
                    .select('result_index, player_name, created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (historyData) {
                    lastWin = {
                        id: 'individual-last',
                        code: 'IND',
                        name: 'Juego Individual',
                        winning_number: historyData.result_index,
                        winner_name: historyData.player_name,
                        winner_avatar: null
                    };
                } else {
                    lastWin = {
                        id: 'fallback',
                        code: '001',
                        name: 'Sorteo Inaugural',
                        winning_number: 12,
                        winner_name: 'Cristian Luke',
                        winner_avatar: null
                    };
                }
            }

            // 4. Calcular frecuencias (Semilla base + Real)
            const freq = { ...BASE_FREQUENCIES };
            if (rafflesData) {
                rafflesData.forEach((r: any) => {
                    if (r.winning_number) {
                        freq[r.winning_number] = (freq[r.winning_number] || 0) + 1;
                    }
                });
            }

            const animalFreqs = Object.entries(freq).map(([numStr, count]) => {
                const num = parseInt(numStr);
                const animal = ANIMAL_LIST.find(a => a.id === num);
                return {
                    id: num,
                    name: animal?.name || `Nº ${num}`,
                    count: count as number
                };
            });

            const hot = [...animalFreqs].sort((a, b) => b.count - a.count).slice(0, 4);
            const cold = [...animalFreqs].sort((a, b) => a.count - b.count).slice(0, 4);

            setRecentWinners(list.slice(0, 5));
            setLastWinner(lastWin);
            setHotAnimals(hot);
            setColdAnimals(cold);

        } catch (err) {
            console.error("Error al calcular estadísticas en el componente:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatsData();

        const channel = supabase
            .channel('stats_display_realtime_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'raffles' },
                () => {
                    console.log('🔄 Sorteo actualizado, recalculando estadísticas...');
                    fetchStatsData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    if (loading) {
        return (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8 font-sans">
                <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest animate-pulse">Cargando Estadísticas...</h2>
            </div>
        );
    }

    const lastWinnerAnimal = lastWinner ? ANIMAL_LIST.find(a => a.id === lastWinner.winning_number) : null;
    
    const getAnimalImage = (num: number) => {
        return `/animals/${num}.jpg`;
    };

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between text-center p-0 overflow-hidden font-sans select-none animate-in fade-in duration-300">
            {/* Header del Tablero */}
            <div className="w-full bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 py-6 px-12 shadow-2xl flex justify-between items-center z-20 border-b border-white/5">
                <div className="text-left flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                        📊
                    </div>
                    <div>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] leading-none mb-1">PANTALLA DE EVENTOS</p>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
                            Tablero de Estadísticas y Resultados
                        </h1>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-black px-4 py-2 rounded-2xl text-[10px] uppercase tracking-widest animate-pulse">
                        En Vivo 📡
                    </span>
                </div>
            </div>

            {/* Grid Principal de Datos */}
            <div className="flex-1 w-full grid grid-cols-12 gap-6 p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/20 overflow-hidden">
                
                {/* 1. SECCIÓN IZQUIERDA: ÚLTIMO GANADOR DESTACADO */}
                <div className="col-span-5 bg-white/5 border border-white/10 rounded-[3rem] p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl group">
                    {/* Imagen de perfil difuminada al 100% de fondo */}
                    {lastWinner && (
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[3rem]">
                            <img
                                src={lastWinner.winner_avatar || `/animals/${lastWinner.winning_number}.jpg`}
                                alt="Profile Background Blur"
                                className="w-full h-full object-cover filter blur-3xl opacity-20 scale-150 transition-all duration-[8000ms] group-hover:scale-110 select-none"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950" />
                        </div>
                    )}

                    {/* Contenido flotante */}
                    <div className="relative z-10 w-full flex flex-col items-center justify-between h-full py-4">
                        <span className="bg-yellow-500/20 border border-yellow-500/35 text-yellow-400 font-mono font-black px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest shadow-md">
                            👑 Último Ganador de Sorteo
                        </span>

                        {/* Avatar e Identidad */}
                        <div className="my-6 flex flex-col items-center">
                            <div className="relative w-28 h-28 mb-4">
                                {/* Halo de resplandor dorado */}
                                <div className="absolute inset-0 rounded-full bg-yellow-500/30 blur-2xl animate-pulse" />
                                
                                {/* Avatar real */}
                                <div className="w-full h-full rounded-full border-4 border-yellow-500 bg-slate-800 overflow-hidden relative shadow-2xl flex items-center justify-center text-4xl">
                                    {lastWinner?.winner_avatar ? (
                                        <img 
                                            src={lastWinner.winner_avatar} 
                                            alt="Avatar" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        "😎"
                                    )}
                                </div>
                            </div>
                            
                            <h2 className="text-3xl font-black text-white tracking-tight uppercase leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                {lastWinner?.winner_name || 'Acumulado'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
                                {lastWinner?.code === 'IND' ? 'Giro en Pantalla' : `Sorteo #${lastWinner?.code || '---'}`}
                            </p>
                        </div>

                        {/* Tarjeta del Animal Ganador */}
                        {lastWinner && lastWinnerAnimal && (
                            <div className="w-full max-w-xs bg-black/40 border border-white/5 backdrop-blur-md p-4 rounded-2xl flex items-center gap-4 shadow-lg">
                                <div className="w-16 h-16 relative bg-white/5 rounded-xl border border-white/10 flex-none overflow-hidden p-1">
                                    <img
                                        src={getAnimalImage(lastWinner.winning_number)}
                                        alt={lastWinnerAnimal.name}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">ANIMAL GANADOR</p>
                                    <p className="text-sm font-black text-indigo-300 leading-none">
                                        #{lastWinner.winning_number}
                                    </p>
                                    <h4 className="text-lg font-black text-white uppercase truncate mt-0.5 leading-tight">
                                        {lastWinnerAnimal.name}
                                    </h4>
                                </div>
                                <div className="text-4xl pr-1">🎉</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. SECCIÓN DERECHA: ESTADÍSTICAS HOT/COLD Y RECIENTES */}
                <div className="col-span-7 flex flex-col justify-between gap-6 overflow-hidden">
                    
                    {/* Fila superior: Calientes y Fríos */}
                    <div className="grid grid-cols-2 gap-6 flex-1">
                        
                        {/* Más Salidos (Calientes) */}
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-lg">
                            <h3 className="text-md font-black text-orange-500 uppercase tracking-widest text-left flex items-center gap-2 mb-4">
                                <span>🔥</span> Los Más Salidos (Hot)
                            </h3>
                            <div className="grid grid-cols-2 gap-3 flex-1 items-center">
                                {hotAnimals.map((item, idx) => (
                                    <div key={idx} className="bg-black/30 border border-orange-500/10 rounded-2xl p-2.5 flex items-center gap-3">
                                        <div className="w-10 h-10 relative bg-white/5 rounded-xl border border-white/5 overflow-hidden flex-none p-0.5">
                                            <img src={getAnimalImage(item.id)} alt={item.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <h4 className="text-xs font-black text-white truncate uppercase leading-none mb-1">{item.name}</h4>
                                            <p className="text-[10px] text-orange-400 font-bold font-mono tracking-tighter leading-none">{item.count} veces</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Menos Salidos (Fríos) */}
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-lg">
                            <h3 className="text-md font-black text-cyan-400 uppercase tracking-widest text-left flex items-center gap-2 mb-4">
                                <span>❄️</span> Los Menos Salidos (Cold)
                            </h3>
                            <div className="grid grid-cols-2 gap-3 flex-1 items-center">
                                {coldAnimals.map((item, idx) => (
                                    <div key={idx} className="bg-black/30 border border-cyan-500/10 rounded-2xl p-2.5 flex items-center gap-3">
                                        <div className="w-10 h-10 relative bg-white/5 rounded-xl border border-white/5 overflow-hidden flex-none p-0.5">
                                            <img src={getAnimalImage(item.id)} alt={item.name} className="w-full h-full object-contain grayscale opacity-60" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <h4 className="text-xs font-black text-white truncate uppercase leading-none mb-1">{item.name}</h4>
                                            <p className="text-[10px] text-cyan-400 font-bold font-mono tracking-tighter leading-none">{item.count} veces</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Fila inferior: Historial de últimos sorteos */}
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col shadow-lg h-[40%] min-h-[160px] justify-between">
                        <h3 className="text-md font-black text-indigo-400 uppercase tracking-widest text-left flex items-center gap-2 mb-4 leading-none">
                            <span>🎟️</span> Historial de Últimos Ganadores
                        </h3>
                        <div className="flex gap-4 overflow-x-auto py-1 flex-1 items-center">
                            {recentWinners.length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center w-full py-4">Esperando sorteos completados...</p>
                            ) : (
                                recentWinners.map((win, idx) => {
                                    const animal = ANIMAL_LIST.find(a => a.id === win.winning_number);
                                    return (
                                        <div 
                                            key={idx}
                                            className="flex-1 min-w-[130px] bg-black/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden"
                                        >
                                            {win.winner_name && (
                                                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-yellow-500 text-black font-black text-[6px] flex items-center justify-center" title={win.winner_name}>
                                                    {win.winner_name.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}

                                            <div className="w-10 h-10 relative mb-1.5 p-0.5">
                                                <img src={getAnimalImage(win.winning_number)} alt={animal?.name} className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-[8px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                                                Sorteo #{win.code}
                                            </span>
                                            <h4 className="text-[10px] font-black text-white truncate uppercase mt-1 w-full text-center">
                                                #{win.winning_number} {animal?.name}
                                            </h4>
                                            <p className="text-[8px] text-emerald-400 font-bold truncate mt-0.5">
                                                {win.winner_name ? `Ganó: ${win.winner_name}` : 'Acumulado'}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer QR Promocional */}
            <div className="w-full bg-black/60 border-t border-white/5 py-4 px-12 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center gap-6 text-left">
                    <span className="text-slate-400 text-xs font-black uppercase tracking-widest">¿Quieres tu boleto?</span>
                    <span className="text-2xl font-black text-indigo-400 tracking-wider">¡COMPRA TU TICKET EN EL KIOSKO Y PARTICIPA EN EL PRÓXIMO SORTEO!</span>
                </div>
                <div className="flex gap-4 items-center bg-white/5 p-2 px-4 rounded-xl border border-white/10">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold leading-tight">ESCANEA PARA JUGAR</p>
                        <p className="text-[10px] text-indigo-300 font-black tracking-widest font-mono uppercase leading-tight">RULETA.LUKEAPP.ME</p>
                    </div>
                    <div className="bg-white p-1 rounded-lg w-12 h-12 flex items-center justify-center">
                        <QRCodeCanvas
                            value={baseUrl}
                            size={40}
                            level="H"
                            className="w-full h-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
