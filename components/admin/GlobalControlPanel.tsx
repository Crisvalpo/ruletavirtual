'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function GlobalControlPanel() {
    const [mode, setMode] = useState<'individual' | 'group_event'>('individual');
    const [loading, setLoading] = useState(true);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchSettings();

        // Subscribe to changes
        const channel = supabase
            .channel('venue_settings_admin')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venue_settings' },
                (payload) => setMode(payload.new.current_mode)
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchSettings() {
        const { data } = await supabase.from('venue_settings').select('id, current_mode').single();
        if (data) {
            setMode(data.current_mode as any);
            setSettingsId(data.id);
        }
        setLoading(false);
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
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
            <h2 className="text-xl font-bold mb-4">🎛️ Control Maestro del Local</h2>

            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => toggleMode('individual')}
                    className={`p-4 rounded-xl border-2 transition-all ${mode === 'individual'
                        ? 'border-green-500 bg-green-50 text-green-700 font-bold shadow-sm'
                        : 'border-gray-200 hover:border-green-200 text-gray-400'
                        }`}
                >
                    <div className="text-2xl mb-2">🎡</div>
                    <div>Modo Parque</div>
                    <div className="text-xs opacity-75">Juego Individual</div>
                </button>

                <button
                    onClick={() => toggleMode('group_event')}
                    className={`p-4 rounded-xl border-2 transition-all ${mode === 'group_event'
                        ? 'border-red-500 bg-red-50 text-red-700 font-bold shadow-sm'
                        : 'border-gray-200 hover:border-red-200 text-gray-400'
                        }`}
                >
                    <div className="text-2xl mb-2">🎟️</div>
                    <div>Modo Sorteo</div>
                    <div className="text-xs opacity-75">Show Central</div>
                </button>
            </div>

            <div className="mt-4 text-xs text-gray-400 text-center">
                {mode === 'individual'
                    ? '✅ Todas las pantallas permiten juego individual.'
                    : '⚠️ Pantallas bloqueadas. Solo rueda la ruleta central.'}
            </div>
        </div>
    );
}
