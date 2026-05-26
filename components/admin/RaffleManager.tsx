'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Raffle {
    id: string;
    code: string;
    name: string;
    status: 'open' | 'closed_for_sales' | 'spinning' | 'completed' | 'cancelled';
    start_time: string;
    base_price: number;
    tickets_sold: number;
    total_collected: number;
    winning_number: number | null;
    winner_ticket_id: string | null;
}

export default function RaffleManager() {
    const supabase = createClient();
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states for new raffle
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [basePrice, setBasePrice] = useState(1000);
    const [creating, setCreating] = useState(false);

    // Venue settings states
    const [activeRaffleId, setActiveRaffleId] = useState<string | null>(null);
    const [raffleBillboardId, setRaffleBillboardId] = useState<number>(4);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [updatingSettings, setUpdatingSettings] = useState(false);

    // Drawing state
    const [drawingId, setDrawingId] = useState<string | null>(null);
    const [drawResult, setDrawResult] = useState<string | null>(null);

    useEffect(() => {
        fetchData();

        // Subscribe to changes in raffles
        const rafflesChannel = supabase
            .channel('raffles_realtime_admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles' }, () => {
                fetchRaffles();
            })
            .subscribe();

        // Subscribe to changes in raffle_tickets
        const ticketsChannel = supabase
            .channel('tickets_realtime_admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_tickets' }, () => {
                fetchRaffles();
            })
            .subscribe();

        // Subscribe to changes in venue_settings
        const settingsChannel = supabase
            .channel('settings_realtime_admin')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venue_settings' }, (payload) => {
                setActiveRaffleId(payload.new.active_raffle_id);
                setRaffleBillboardId(payload.new.raffle_billboard_screen_id || 4);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(rafflesChannel);
            supabase.removeChannel(ticketsChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, []);

    async function fetchData() {
        setLoading(true);
        await Promise.all([fetchRaffles(), fetchSettings()]);
        setLoading(false);
    }

    async function fetchRaffles() {
        const { data, error } = await supabase
            .from('raffles')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error && data) {
            setRaffles(data as Raffle[]);
            // Auto generate next code if empty
            if (data.length > 0) {
                const codes = data.map(r => parseInt(r.code)).filter(c => !isNaN(c));
                const maxCode = codes.length > 0 ? Math.max(...codes) : 0;
                setCode(String(maxCode + 1).padStart(3, '0'));
            } else {
                setCode('001');
            }
        }
    }

    async function fetchSettings() {
        const { data, error } = await supabase.from('venue_settings').select('*').single();
        if (!error && data) {
            setSettingsId(data.id);
            setActiveRaffleId(data.active_raffle_id);
            setRaffleBillboardId(data.raffle_billboard_screen_id || 4);
        }
    }

    async function handleCreateRaffle(e: React.FormEvent) {
        e.preventDefault();
        if (!code || !name || !startTime) {
            alert('Por favor completa todos los campos.');
            return;
        }

        setCreating(true);
        const { error } = await supabase.from('raffles').insert({
            code: code.trim(),
            name: name.trim(),
            start_time: new Date(startTime).toISOString(),
            base_price: basePrice,
            status: 'open'
        });

        if (error) {
            alert('Error al crear sorteo: ' + error.message);
        } else {
            setName('');
            setStartTime('');
            fetchRaffles();
        }
        setCreating(false);
    }

    async function handleUpdateSettings(billboardId: number, activeId: string | null) {
        if (!settingsId) return;
        setUpdatingSettings(true);
        const { error } = await supabase
            .from('venue_settings')
            .update({
                active_raffle_id: activeId,
                raffle_billboard_screen_id: billboardId
            })
            .eq('id', settingsId);

        if (error) {
            alert('Error al actualizar configuración: ' + error.message);
        } else {
            setActiveRaffleId(activeId);
            setRaffleBillboardId(billboardId);
        }
        setUpdatingSettings(false);
    }

    async function handleUpdateStatus(id: string, newStatus: 'open' | 'closed_for_sales' | 'cancelled') {
        const { data, error } = await supabase.rpc('update_raffle_status', {
            p_raffle_id: id,
            p_status: newStatus
        });

        if (error) {
            alert('Error al cambiar estado: ' + error.message);
        } else {
            const res = data as { success: boolean; message: string };
            if (res.success) {
                fetchRaffles();
            } else {
                alert('No se pudo cambiar el estado: ' + res.message);
            }
        }
    }

    async function handleDrawRaffle(id: string) {
        if (!confirm('¿Estás seguro de que deseas lanzar la ruleta y realizar el sorteo ahora?')) {
            return;
        }

        setDrawingId(id);
        setDrawResult(null);

        const { data, error } = await supabase.rpc('draw_raffle', { p_raffle_id: id });

        if (error) {
            alert('Error al ejecutar sorteo: ' + error.message);
        } else {
            const res = data as { success: boolean; message: string; winning_number?: number };
            if (res.success) {
                setDrawResult(res.message);
                fetchRaffles();
            } else {
                alert('No se pudo realizar el sorteo: ' + res.message);
            }
        }
        setDrawingId(null);
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <span className="text-slate-500 font-medium">Cargando sorteos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Panel de Configuración Global del Sorteo */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                    ⚙️ CONFIGURACIÓN DE PANTALLAS (SORTEO)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            Sorteo Activo en la Sala
                        </label>
                        <select
                            value={activeRaffleId || ''}
                            onChange={(e) => handleUpdateSettings(raffleBillboardId, e.target.value || null)}
                            disabled={updatingSettings}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                        >
                            <option value="">-- Ninguno (Bloquear Sorteos) --</option>
                            {raffles.map(r => (
                                <option key={r.id} value={r.id}>
                                    Sorteo #{r.code} - {r.name} ({r.status})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">
                            Define cuál es el sorteo en curso para canje de boletos y selección.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            TV de Cartelera del Animador (1-4)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="4"
                            value={raffleBillboardId}
                            onChange={(e) => handleUpdateSettings(parseInt(e.target.value) || 4, activeRaffleId)}
                            disabled={updatingSettings}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Especifica qué pantalla mostrará exclusivamente la grilla de boletos vendidos/disponibles.
                        </p>
                    </div>
                </div>
            </div>

            {/* Fila de Creación e Historial */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Crear Sorteo */}
                <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        🎟️ CREAR NUEVO SORTEO
                    </h2>
                    <form onSubmit={handleCreateRaffle} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                Código Correlativo Único
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: 001"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                Título del Sorteo (Premio)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Gana una Batidora"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                Fecha y Hora del Sorteo
                            </label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                Precio Base por Animalito
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={basePrice}
                                onChange={(e) => setBasePrice(parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-indigo-600 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center justify-center shadow-md"
                        >
                            {creating ? 'CREANDO...' : '➕ CREAR SORTEO'}
                        </button>
                    </form>
                </div>

                {/* Listado de Sorteos */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        📋 SORTES PROGRAMADOS Y RECIENTES
                    </h2>

                    {drawResult && (
                        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-in fade-in">
                            🎉 {drawResult}
                        </div>
                    )}

                    <div className="space-y-4">
                        {raffles.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                                <p className="text-slate-400 font-medium">No hay sorteos programados.</p>
                            </div>
                        ) : (
                            raffles.map((raffle) => {
                                const isActive = activeRaffleId === raffle.id;
                                const isDrawing = drawingId === raffle.id;

                                return (
                                    <div
                                        key={raffle.id}
                                        className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                                            isActive
                                                ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                                                : 'border-slate-100 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded text-[10px]">
                                                    #{raffle.code}
                                                </span>
                                                <h3 className="text-lg font-black text-slate-900">{raffle.name}</h3>
                                                {isActive && (
                                                    <span className="bg-indigo-600 text-white font-black px-2 py-0.5 rounded text-[9px] uppercase tracking-wider animate-pulse">
                                                        Activo en Sala
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">
                                                📅 {new Date(raffle.start_time).toLocaleString()} | 💰 Precio: ${raffle.base_price.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-indigo-600 font-black">
                                                🎟️ Boletos vendidos: {raffle.tickets_sold} / 36 | 💵 Recaudado: ${raffle.total_collected.toLocaleString()}
                                            </p>
                                            {raffle.status === 'completed' && raffle.winning_number && (
                                                <p className="text-xs text-emerald-600 font-black uppercase tracking-wider">
                                                    🏆 Ganador: Animal #{raffle.winning_number}
                                                </p>
                                            )}
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                            {raffle.status === 'open' && (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateStatus(raffle.id, 'closed_for_sales')}
                                                        className="bg-amber-500 hover:bg-amber-400 text-white font-black px-3 py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all"
                                                    >
                                                        🔒 Cerrar Ventas
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(raffle.id, 'cancelled')}
                                                        className="bg-rose-500 hover:bg-rose-450 text-white font-black px-3 py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all"
                                                    >
                                                        🚫 Cancelar
                                                    </button>
                                                </>
                                            )}

                                            {raffle.status === 'closed_for_sales' && (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateStatus(raffle.id, 'open')}
                                                        className="bg-slate-500 hover:bg-slate-450 text-white font-black px-3 py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all"
                                                    >
                                                        🔓 Abrir Ventas
                                                    </button>
                                                    <button
                                                        onClick={() => handleDrawRaffle(raffle.id)}
                                                        disabled={isDrawing}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all animate-bounce shadow-md"
                                                    >
                                                        {isDrawing ? 'SORTEANDO...' : '🎰 REALIZAR SORTEO (GIRAR)'}
                                                    </button>
                                                </>
                                            )}

                                            {!isActive && raffle.status !== 'completed' && raffle.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleUpdateSettings(raffleBillboardId, raffle.id)}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-3 py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all"
                                                >
                                                    🎯 Activar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
