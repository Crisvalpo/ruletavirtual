'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

interface Wheel {
    id: string;
    name: string;
    theme_category: string;
    background_image: string;
    image_preview: string;
    is_active: boolean;
    storage_path: string;
}

export default function WheelManager() {
    const [wheels, setWheels] = useState<Wheel[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingWheel, setEditingWheel] = useState<Wheel | null>(null);
    const [newPreview, setNewPreview] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const supabase = createClient();
    const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;

    const fetchWheels = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('individual_wheels')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setWheels(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchWheels();
    }, []);

    const handleToggleActive = async (wheel: Wheel) => {
        const { error } = await supabase
            .from('individual_wheels')
            .update({ is_active: !wheel.is_active })
            .eq('id', wheel.id);

        if (!error) {
            setWheels(wheels.map(w => w.id === wheel.id ? { ...w, is_active: !w.is_active } : w));
        }
    };

    const handleSaveEdit = async () => {
        if (!editingWheel) return;
        setSaving(true);

        try {
            let previewUrl = editingWheel.image_preview;

            // 1. If new preview image, upload it
            if (newPreview) {
                // Determine existing path or create one
                const path = editingWheel.image_preview.split('?')[0] || `${editingWheel.storage_path}/preview.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from('individual-wheels')
                    .upload(path, newPreview, { upsert: true });

                if (uploadError) throw uploadError;
                // Add timestamp to break cache
                previewUrl = `${path}?t=${Date.now()}`;
            }

            // 2. Update DB
            const { error: dbError } = await supabase
                .from('individual_wheels')
                .update({
                    name: editingWheel.name,
                    theme_category: editingWheel.theme_category,
                    image_preview: previewUrl
                })
                .eq('id', editingWheel.id);

            if (dbError) throw dbError;

            alert('✅ Ruleta actualizada correctamente');
            setEditingWheel(null);
            setNewPreview(null);
            fetchWheels();
        } catch (error: any) {
            console.error('Update Error:', error);
            alert(`❌ Error al actualizar: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const getImageUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${STORAGE_BASE}/${path}`;
    };

    if (loading) {
        return (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando mundos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {wheels.map((wheel) => (
                    <div key={wheel.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                        <div className="aspect-[16/9] relative bg-slate-100 overflow-hidden">
                            {wheel.image_preview && (
                                <Image
                                    src={getImageUrl(wheel.image_preview)}
                                    alt={wheel.name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-60" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border backdrop-blur-md ${wheel.is_active ? 'bg-emerald-500/90 border-emerald-400/50 text-white' : 'bg-slate-500/90 border-slate-400/50 text-white'}`}>
                                    {wheel.is_active ? '● Activa' : '○ Pausada'}
                                </span>
                            </div>
                            <div className="absolute bottom-4 left-4">
                                <h3 className="font-black text-white text-xl tracking-tight uppercase drop-shadow-md">{wheel.name}</h3>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {wheel.theme_category}
                                </span>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">12 Segmentos</div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setEditingWheel(wheel)}
                                    className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-100 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                >
                                    Configurar
                                </button>
                                <button
                                    onClick={() => handleToggleActive(wheel)}
                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${wheel.is_active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                >
                                    {wheel.is_active ? 'Pausar' : 'Activar'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingWheel && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="px-10 py-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Configurar Mundo</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{editingWheel.name}</p>
                            </div>
                            <button onClick={() => { setEditingWheel(null); setNewPreview(null); }} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-full text-xl transition-all active:scale-90">✕</button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Nombre Visual</label>
                                    <input
                                        type="text"
                                        value={editingWheel.name}
                                        onChange={(e) => setEditingWheel({ ...editingWheel, name: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-indigo-600 focus:bg-white outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Categoría</label>
                                    <select
                                        value={editingWheel.theme_category}
                                        onChange={(e) => setEditingWheel({ ...editingWheel, theme_category: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-indigo-600 focus:bg-white outline-none transition-all"
                                    >
                                        <option value="General">General</option>
                                        <option value="Infantil">Infantil</option>
                                        <option value="Nueva">Nueva</option>
                                        <option value="Popular">Popular</option>
                                        <option value="Premium">Premium</option>
                                        <option value="Especial">Especial</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Reemplazar Miniatura (Hero Preview)</label>
                                <div className="flex flex-col md:flex-row items-center gap-6 bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                                    <div className="relative w-40 aspect-[16/9] rounded-2xl overflow-hidden shadow-lg bg-slate-900">
                                        {newPreview ? (
                                            <img src={URL.createObjectURL(newPreview)} className="object-cover w-full h-full" />
                                        ) : (
                                            <Image
                                                src={getImageUrl(editingWheel.image_preview)}
                                                alt="Current Preview"
                                                fill
                                                className="object-cover opacity-80"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <p className="text-[10px] text-slate-400 font-bold mb-4">La imagen se mostrará en el selector de mundos del jugador.</p>
                                        <label className="inline-block bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-200 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-sm active:scale-95">
                                            Seleccionar JPG
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setNewPreview(e.target.files?.[0] || null)}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4">
                            <button
                                onClick={() => { setEditingWheel(null); setNewPreview(null); }}
                                className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Actualizando...
                                    </>
                                ) : 'Publicar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
