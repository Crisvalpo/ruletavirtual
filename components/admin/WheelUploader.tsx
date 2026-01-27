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
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-3xl">📤</span>
                Subir Nueva Ruleta Individual
            </h2>

            <div className="space-y-6">
                {/* Wheel Name & Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <label htmlFor="wheelName" className="block text-sm font-bold text-gray-700 mb-2">
                            1. Nombre del Tema
                        </label>
                        <input
                            id="wheelName"
                            type="text"
                            value={wheelName}
                            onChange={(e) => setWheelName(e.target.value)}
                            placeholder="ej: Batman, Frozen..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-black"
                        />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                        <label htmlFor="themeCategory" className="block text-sm font-bold text-gray-700 mb-2">
                            Categoría / Etiqueta
                        </label>
                        <select
                            id="themeCategory"
                            value={themeCategory}
                            onChange={(e) => setThemeCategory(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-black"
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

                {/* Segment PNGs */}
                <div className="p-4 bg-gray-50 rounded-lg">
                    <label htmlFor="segments" className="block text-sm font-bold text-gray-700 mb-2">
                        2. Imágenes de la Ruleta (12 archivos .png)
                    </label>
                    <input
                        id="segments"
                        type="file"
                        accept=".png"
                        multiple
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            console.log('Segments selected:', files.length);
                            setSegmentPngs(files);
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                    />
                    <div className="mt-2 flex items-center gap-2">
                        <span className={segmentPngs.length === 12 ? "text-green-600 font-bold" : "text-gray-500"}>
                            {segmentPngs.length === 12 ? '✅' : '⚪'} {segmentPngs.length}/12 seleccionados
                        </span>
                    </div>
                </div>

                {/* Selector JPGs */}
                <div className="p-4 bg-gray-50 rounded-lg">
                    <label htmlFor="selectors" className="block text-sm font-bold text-gray-700 mb-2">
                        3. Íconos del Celular (12 archivos .jpg)
                    </label>
                    <input
                        id="selectors"
                        type="file"
                        accept=".jpg,.jpeg"
                        multiple
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            console.log('Selectors selected:', files.length);
                            setSelectorJpgs(files);
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                    />
                    <div className="mt-2 flex items-center gap-2">
                        <span className={selectorJpgs.length === 12 ? "text-green-600 font-bold" : "text-gray-500"}>
                            {selectorJpgs.length === 12 ? '✅' : '⚪'} {selectorJpgs.length}/12 seleccionados
                        </span>
                    </div>
                </div>

                {/* Preview Image */}
                <div className="p-4 bg-gray-50 rounded-lg">
                    <label htmlFor="preview" className="block text-sm font-bold text-gray-700 mb-2">
                        4. Miniatura del Menú (1 archivo .jpg)
                    </label>
                    <input
                        id="preview"
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            console.log('Preview selected:', file?.name);
                            setPreviewImage(file);
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                    />
                    <p className="mt-2 text-sm">
                        {previewImage ? (
                            <span className="text-green-600 font-bold">✅ Seleccionado: {previewImage.name}</span>
                        ) : (
                            <span className="text-gray-400 font-medium">⚪ Sin seleccionar</span>
                        )}
                    </p>
                </div>

                {/* Background */}
                <div className="p-4 bg-gray-50 rounded-lg">
                    <label htmlFor="background" className="block text-sm font-bold text-gray-700 mb-2">
                        5. Fondo del Juego (1 archivo .jpg)
                    </label>
                    <input
                        id="background"
                        type="file"
                        accept=".jpg,.jpeg"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            console.log('Background selected:', file?.name);
                            setBackground(file);
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                    />
                    <p className="mt-2 text-sm">
                        {background ? (
                            <span className="text-green-600 font-bold">✅ Seleccionado: {background.name}</span>
                        ) : (
                            <span className="text-gray-400 font-medium">⚪ Sin seleccionar</span>
                        )}
                    </p>
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all
                        ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}
                    `}
                >
                    {uploading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Subiendo assets...
                        </span>
                    ) : '🚀 Subir Ruleta'}
                </button>
            </div>
        </div>
    );
}
