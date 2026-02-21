'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function WheelUploader() {
    const [wheelName, setWheelName] = useState('');
    const [themeCategory, setThemeCategory] = useState('General');
    const [uploading, setUploading] = useState(false);
    const [segmentPngs, setSegmentPngs] = useState<File[]>([]);
    const [selectorJpgs, setSelectorJpgs] = useState<File[]>([]);
    const [background, setBackground] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<File | null>(null);

    const supabase = createClient();

    const handleUpload = async () => {
        const errors = [];
        if (!wheelName.trim()) errors.push('- Nombre de la ruleta (está vacío)');
        if (segmentPngs.length !== 12) errors.push(`- Segmentos PNG (tienes ${segmentPngs.length}, deben ser 12)`);
        if (selectorJpgs.length !== 12) errors.push(`- Selector JPG (tienes ${selectorJpgs.length}, deben ser 12)`);
        if (!background) errors.push('- Fondo de la ruleta (no seleccionado)');
        if (!previewImage) errors.push('- Póster / Miniatura (no seleccionado)');

        if (errors.length > 0) {
            alert(`Por favor completa los siguientes campos:\n${errors.join('\n')}`);
            return;
        }

        setUploading(true);
        console.log('🚀 Starting upload for:', wheelName);

        try {
            const storagePath = wheelName.toLowerCase().trim().replace(/\s+/g, '-');

            // 1. Upload background
            const bgPath = `${storagePath}/background.jpg`;
            console.log('Uploading background to:', bgPath);
            const { error: bgError } = await supabase.storage
                .from('individual-wheels')
                .upload(bgPath, background!, { upsert: true });
            if (bgError) throw new Error(`Error subiendo fondo: ${bgError.message}`);

            // 2. Upload preview
            const previewPath = `${storagePath}/preview.jpg`;
            console.log('Uploading preview to:', previewPath);
            const { error: previewError } = await supabase.storage
                .from('individual-wheels')
                .upload(previewPath, previewImage!, { upsert: true });
            if (previewError) throw new Error(`Error subiendo miniatura: ${previewError.message}`);

            // 3. Upload segment PNGs
            console.log('Uploading 12 segment PNGs...');
            for (let i = 0; i < 12; i++) {
                const segmentPath = `${storagePath}/segments/${i + 1}.png`;
                const { error: segError } = await supabase.storage
                    .from('individual-wheels')
                    .upload(segmentPath, segmentPngs[i], { upsert: true });
                if (segError) throw new Error(`Error subiendo segmento ${i + 1}: ${segError.message}`);
            }

            // 4. Upload selector JPGs
            console.log('Uploading 12 selector JPGs...');
            for (let i = 0; i < 12; i++) {
                const selectorPath = `${storagePath}/selector/${i + 1}.jpg`;
                const { error: selError } = await supabase.storage
                    .from('individual-wheels')
                    .upload(selectorPath, selectorJpgs[i], { upsert: true });
                if (selError) throw new Error(`Error subiendo selector ${i + 1}: ${selError.message}`);
            }

            // 5. Create wheel record in database
            console.log('Saving to database...');
            const { data: newWheel, error: wheelError } = await supabase
                .from('individual_wheels')
                .insert({
                    name: wheelName,
                    theme_category: themeCategory,
                    background_image: `${storagePath}/background.jpg`,
                    image_preview: `${storagePath}/preview.jpg`,
                    storage_path: storagePath,
                    segment_count: 12,
                    is_active: true // Keep is_active as it was in the original code
                })
                .select()
                .single();

            if (wheelError) throw new Error(`Error base de datos (ruleta): ${wheelError.message}`);

            // 6. Bulk Insert Segments
            const segmentsToInsert = Array.from({ length: 12 }, (_, i) => ({
                wheel_id: newWheel.id,
                position: i + 1,
                name: `Item ${i + 1}`,
                segment_image: `${storagePath}/segments/${i + 1}.png`,
                selector_image: `${storagePath}/selector/${i + 1}.jpg`,
                color: 'transparent'
            }));

            const { error: segmentError } = await supabase
                .from('individual_wheel_segments')
                .insert(segmentsToInsert);

            if (segmentError) throw new Error(`Error base de datos (segmentos): ${segmentError.message}`);

            alert('✅ Ruleta y 12 segmentos creados exitosamente!');

            // Reset form
            setWheelName('');
            setSegmentPngs([]);
            setSelectorJpgs([]);
            setBackground(null);
            setPreviewImage(null);

        } catch (error: any) {
            console.error('Upload Error:', error);
            alert(`⚠️ No se pudo completar la carga:\n${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label htmlFor="wheelName" className="block text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                            1. Nombre Tema
                        </label>
                        <input
                            id="wheelName"
                            type="text"
                            value={wheelName}
                            onChange={(e) => setWheelName(e.target.value)}
                            placeholder="ej: Barbie"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="themeCategory" className="block text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Categoría
                        </label>
                        <select
                            id="themeCategory"
                            value={themeCategory}
                            onChange={(e) => setThemeCategory(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                        <label htmlFor="segments" className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            2. Ruleta (12 .png)
                        </label>
                        <input
                            id="segments"
                            type="file"
                            accept=".png"
                            multiple
                            onChange={(e) => setSegmentPngs(Array.from(e.target.files || []))}
                            className="w-full text-[8px] text-slate-400 font-bold"
                        />
                        {segmentPngs.length > 0 && (
                            <p className={`text-[7px] font-black uppercase mt-1 ${segmentPngs.length === 12 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {segmentPngs.length}/12
                            </p>
                        )}
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                        <label htmlFor="selectors" className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            3. Íconos (12 .jpg)
                        </label>
                        <input
                            id="selectors"
                            type="file"
                            accept=".jpg,.jpeg"
                            multiple
                            onChange={(e) => setSelectorJpgs(Array.from(e.target.files || []))}
                            className="w-full text-[8px] text-slate-400 font-bold"
                        />
                        {selectorJpgs.length > 0 && (
                            <p className={`text-[7px] font-black uppercase mt-1 ${selectorJpgs.length === 12 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {selectorJpgs.length}/12
                            </p>
                        )}
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                        <label htmlFor="preview" className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            4. Miniatura
                        </label>
                        <input
                            id="preview"
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={(e) => setPreviewImage(e.target.files?.[0] || null)}
                            className="w-full text-[8px] text-slate-400 font-bold"
                        />
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                        <label htmlFor="background" className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            5. Fondo
                        </label>
                        <input
                            id="background"
                            type="file"
                            accept=".jpg,.jpeg"
                            onChange={(e) => setBackground(e.target.files?.[0] || null)}
                            className="w-full text-[8px] text-slate-400 font-bold"
                        />
                    </div>
                </div>

                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full bg-slate-900 text-white font-black py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50 text-[10px] uppercase tracking-widest"
                >
                    {uploading ? 'Subiendo...' : '🚀 Publicar'}
                </button>
            </div>
        </div>
    );
}
