'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TicketSettingsManager() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        id: '',
        ticket_header: '',
        ticket_subheader: '',
        ticket_terms_line1: '',
        ticket_terms_line2: '',
        base_url: '',
        max_failed_attempts: 3,
        cooldown_minutes: 5
    });

    useEffect(() => {
        let isMounted = true;
        fetchSettings(isMounted);
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchSettings(isMounted: boolean) {
        try {
            const { data, error } = await supabase.from('venue_settings').select('*').single();
            if (error) throw error;
            if (data && isMounted) {
                setSettings(data);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Error fetching ticket settings:", err);
            }
        } finally {
            if (isMounted) setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        const { error } = await supabase
            .from('venue_settings')
            .update({
                ticket_header: settings.ticket_header,
                ticket_subheader: settings.ticket_subheader,
                ticket_terms_line1: settings.ticket_terms_line1,
                ticket_terms_line2: settings.ticket_terms_line2,
                base_url: settings.base_url,
                max_failed_attempts: settings.max_failed_attempts,
                cooldown_minutes: settings.cooldown_minutes
            })
            .eq('id', settings.id);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            alert('Configuración guardada con éxito');
        }
        setSaving(false);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: name.includes('max') || name.includes('min') ? parseInt(value) || 0 : value }));
    };

    if (loading) return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-pulse">
            <div className="h-6 w-48 bg-slate-100 rounded mb-6"></div>
            <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg"></div>)}
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="space-y-4">
                {/* Text Customization */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-xs">
                            ✍️
                        </div>
                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personalización</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Encabezado</label>
                            <input
                                name="ticket_header"
                                value={settings.ticket_header}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Sub-encabezado</label>
                            <input
                                name="ticket_subheader"
                                value={settings.ticket_subheader}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Términos 1</label>
                            <input
                                name="ticket_terms_line1"
                                value={settings.ticket_terms_line1}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Términos 2</label>
                            <input
                                name="ticket_terms_line2"
                                value={settings.ticket_terms_line2}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div className="col-span-2 md:col-span-4">
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Dominio Base QR</label>
                            <input
                                name="base_url"
                                value={settings.base_url || ''}
                                onChange={handleChange}
                                placeholder="Ej: https://ruleta.lukeapp.me"
                                className="w-full bg-amber-50/50 border border-amber-100 rounded-lg p-2 text-xs font-bold focus:border-amber-600 focus:bg-white outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-slate-100" />

                {/* Security Settings */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center text-xs">
                            🛡️
                        </div>
                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seguridad</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <input
                                type="number"
                                name="max_failed_attempts"
                                value={settings.max_failed_attempts}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 px-1">Intentos máximos</p>
                        </div>

                        <div>
                            <input
                                type="number"
                                name="cooldown_minutes"
                                value={settings.cooldown_minutes}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 px-1">Minutos enfriamiento</p>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
                {saving ? (
                    <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Guardando...
                    </>
                ) : (
                    <>💾 Guardar</>
                )}
            </button>
        </div>
    );
}
