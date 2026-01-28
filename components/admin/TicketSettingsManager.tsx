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
        fetchSettings();
    }, []);

    async function fetchSettings() {
        const { data, error } = await supabase.from('venue_settings').select('*').single();
        if (data) {
            setSettings(data);
        }
        setLoading(false);
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
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2 uppercase tracking-tight">
                🎫 Configuración de Tickets & Seguridad
            </h2>

            <div className="space-y-10">
                {/* Text Customization */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            ✍️
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personalización de Texto</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Encabezado Principal</label>
                            <input
                                name="ticket_header"
                                value={settings.ticket_header}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Sub-encabezado</label>
                            <input
                                name="ticket_subheader"
                                value={settings.ticket_subheader}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Términos Línea 1</label>
                            <input
                                name="ticket_terms_line1"
                                value={settings.ticket_terms_line1}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Términos Línea 2</label>
                            <input
                                name="ticket_terms_line2"
                                value={settings.ticket_terms_line2}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Dominio Base para QR (Opcional)</label>
                            <input
                                name="base_url"
                                value={settings.base_url || ''}
                                onChange={handleChange}
                                placeholder="Ej: https://mi-tunel.trycloudflare.com"
                                className="w-full bg-amber-50 border-2 border-amber-100 rounded-xl p-4 text-amber-900 font-bold focus:border-amber-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-[9px] text-amber-600 font-bold uppercase mt-2 px-1">Si se deja vacío, se usará la URL actual del navegador. Úselo para túneles temporales.</p>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-slate-100" />

                {/* Security Settings */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                            🛡️
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seguridad Antifraude</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Max. Intentos Fallidos</label>
                            <input
                                type="number"
                                name="max_failed_attempts"
                                value={settings.max_failed_attempts}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 px-1">Bloqueo tras N intentos por pantalla.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Minutos de Enfriamiento</label>
                            <input
                                type="number"
                                name="cooldown_minutes"
                                value={settings.cooldown_minutes}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 px-1">Duración del bloqueo temporal.</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex gap-4">
                        <span className="text-xl">⚠️</span>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                            <span className="font-black uppercase tracking-tight">Nota de Seguridad:</span> Los tickets generados en lote se crean <span className="font-black underline">desactivados</span> por defecto. Deberá activarlos manualmente tras la impresión desde el escáner de staff.
                        </p>
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-10 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
                {saving ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Guardando...
                    </>
                ) : (
                    <>💾 Guardar Configuración</>
                )}
            </button>
        </div>
    );
}
