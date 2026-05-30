'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function GlobalControlPanel() {
    const [mode, setMode] = useState<'individual' | 'group_event'>('individual');
    const [loading, setLoading] = useState(true);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        let isMounted = true;
        fetchSettings(isMounted);

        // Subscribe to changes
        const channel = supabase
            .channel('venue_settings_admin')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venue_settings' },
                (payload) => {
                    if (isMounted) {
                        setMode(payload.new.current_mode);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchSettings(isMounted: boolean) {
        try {
            const { data, error } = await supabase.from('venue_settings').select('id, current_mode').single();
            if (error) throw error;
            if (data && isMounted) {
                setMode(data.current_mode as any);
                setSettingsId(data.id);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Error fetching settings:", err);
            }
        } finally {
            if (isMounted) setLoading(false);
        }
    }

    async function toggleMode(newMode: 'individual' | 'group_event') {
        if (!settingsId) return;
        setLoading(true);

        // Update using ID
        const { error } = await supabase
            .from('venue_settings')
            .update({ current_mode: newMode })
            .eq('id', settingsId);

        if (error) {
            console.error("Error updating mode:", error);
            alert("Error actualizando modo: " + error.message);
        }

        setLoading(false);
    }

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => toggleMode('individual')}
                    className={`p-3 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${mode === 'individual'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg shadow-sm ${mode === 'individual' ? 'bg-white text-indigo-600' : 'bg-white text-slate-400'}`}>
                            🎡
                        </div>
                        {mode === 'individual' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <div className={`font-black uppercase tracking-tight text-[10px] ${mode === 'individual' ? 'text-indigo-900' : 'text-slate-400'}`}>Modo Parque</div>
                    </div>
                </button>

                <button
                    onClick={() => toggleMode('group_event')}
                    className={`p-3 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${mode === 'group_event'
                        ? 'border-rose-600 bg-rose-50/50 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg shadow-sm ${mode === 'group_event' ? 'bg-white text-rose-600' : 'bg-white text-slate-400'}`}>
                            🎟️
                        </div>
                        {mode === 'group_event' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <div className={`font-black uppercase tracking-tight text-[10px] ${mode === 'group_event' ? 'text-rose-900' : 'text-slate-400'}`}>Modo Sorteo</div>
                    </div>
                </button>
            </div>

            <div className="mt-6 flex items-center gap-2 px-2">
                <div className={`w-1.5 h-1.5 rounded-full ${mode === 'individual' ? 'bg-indigo-500' : 'bg-rose-500'}`} />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {mode === 'individual'
                        ? 'Configuración Actual: Jugadores pueden unirse libremente a cualquier pantalla.'
                        : 'Configuración Actual: Acceso restringido. Las pantallas individuales están en pausa.'}
                </p>
            </div>
        </div>
    );
}
