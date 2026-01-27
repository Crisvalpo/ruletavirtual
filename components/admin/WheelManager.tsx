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
            <div className="py-20 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Cargando mundos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wheels.map((wheel) => (
                    <div key={wheel.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300">
                        <div className="aspect-[16/9] relative bg-gray-100 overflow-hidden">
                            {wheel.image_preview && (
                                <Image
                                    src={getImageUrl(wheel.image_preview)}
                                    alt={wheel.name}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md border ${wheel.is_active ? 'bg-green-500/90 border-green-400/50 text-white' : 'bg-gray-500/90 border-gray-400/50 text-white'}`}>
                                    {wheel.is_active ? '● Activa' : '○ Pausada'}
                                </span>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-black text-gray-900 text-xl tracking-tight italic uppercase">{wheel.name}</h3>
                                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                        {wheel.theme_category}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setEditingWheel(wheel)}
                                    className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-black/10 active:scale-95"
                                >
                                    Configurar
                                </button>
                                <button
                                    onClick={() => handleToggleActive(wheel)}
                                    className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${wheel.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-10 py-8 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Configurar Mundo</h3>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">{editingWheel.name}</p>
                            </div>
                            <button onClick={() => { setEditingWheel(null); setNewPreview(null); }} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 text-gray-400 hover:text-gray-600 rounded-full text-xl transition-all active:scale-90">✕</button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Nombre Visual</label>
                                    <input
                                        type="text"
                                        value={editingWheel.name}
                                        onChange={(e) => setEditingWheel({ ...editingWheel, name: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 font-black text-gray-900 focus:border-primary focus:bg-white outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 italic">Categoría</label>
                                    <select
                                        value={editingWheel.theme_category}
                                        onChange={(e) => setEditingWheel({ ...editingWheel, theme_category: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 font-black text-gray-900 focus:border-primary focus:bg-white outline-none transition-all shadow-inner"
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
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 italic">Reemplazar Miniatura (Hero Preview)</label>
                                <div className="flex flex-col md:flex-row items-center gap-8 bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 group-hover:border-primary transition-colors">
                                    <div className="relative w-40 aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl bg-black">
                                        {newPreview ? (
                                            <img src={URL.createObjectURL(newPreview)} className="object-cover w-full h-full" />
                                        ) : (
                                            <Image
                                                src={getImageUrl(editingWheel.image_preview)}
                                                alt="Current Preview"
                                                fill
                                                className="object-cover"
                                            />
                                        )}
                                        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl" />
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <p className="text-[10px] text-gray-400 font-bold mb-4 px-2">Subir archivo para reemplazar imagen mostrada en el selector móvil.</p>
                                        <label className="inline-block bg-white hover:bg-primary hover:text-white text-gray-900 border-2 border-gray-200 hover:border-primary px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-sm active:scale-95">
                                            Seleccionar JPG
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setNewPreview(e.target.files?.[0] || null)}
                                                className="hidden"
                                            />
                                        </label>
                                        {newPreview && (
                                            <p className="mt-2 text-[10px] text-primary font-black uppercase">Pronto para subir: {newPreview.name}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-10 py-8 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row gap-4">
                            <button
                                onClick={() => { setEditingWheel(null); setNewPreview(null); }}
                                className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-100 transition-all active:scale-98"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
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
