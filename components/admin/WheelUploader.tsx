'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function WheelUploader() {
    const [wheelName, setWheelName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [segmentPngs, setSegmentPngs] = useState<File[]>([]);
    const [selectorJpgs, setSelectorJpgs] = useState<File[]>([]);
    const [background, setBackground] = useState<File | null>(null);

    const supabase = createClient();

    const handleUpload = async () => {
        if (!wheelName || segmentPngs.length !== 12 || selectorJpgs.length !== 12 || !background) {
            alert('Por favor completa todos los campos (12 PNG, 12 JPG, 1 Background)');
            return;
        }

        setUploading(true);

        try {
            const storagePath = wheelName.toLowerCase().replace(/\s+/g, '-');

            // 1. Upload background
            const bgPath = `${storagePath}/background.jpg`;
            const { error: bgError } = await supabase.storage
                .from('individual-wheels')
                .upload(bgPath, background, { upsert: true });

            if (bgError) throw bgError;

            // 2. Upload segment PNGs
            for (let i = 0; i < 12; i++) {
                const segmentPath = `${storagePath}/segments/${i + 1}.png`;
                const { error } = await supabase.storage
                    .from('individual-wheels')
                    .upload(segmentPath, segmentPngs[i], { upsert: true });

                if (error) throw error;
            }

            // 3. Upload selector JPGs
            for (let i = 0; i < 12; i++) {
                const selectorPath = `${storagePath}/selector/${i + 1}.jpg`;
                const { error } = await supabase.storage
                    .from('individual-wheels')
                    .upload(selectorPath, selectorJpgs[i], { upsert: true });

                if (error) throw error;
            }

            // 4. Create wheel record in database
            const { data: publicUrlData } = supabase.storage
                .from('individual-wheels')
                .getPublicUrl(bgPath);

            const { error: dbError } = await supabase
                .from('individual_wheels')
                .insert({
                    name: wheelName,
                    theme_category: 'custom',
                    segment_count: 12,
                    is_active: true,
                    storage_path: storagePath,
                    background_image: publicUrlData.publicUrl
                });

            if (dbError) throw dbError;

            alert('✅ Ruleta subida exitosamente!');

            // Reset form
            setWheelName('');
            setSegmentPngs([]);
            setSelectorJpgs([]);
            setBackground(null);

        } catch (error: any) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6">📤 Subir Nueva Ruleta Individual</h2>

            <div className="space-y-4">
                {/* Wheel Name */}
                <div>
                    <label className="block text-sm font-medium mb-2">Nombre de la Ruleta</label>
                    <input
                        type="text"
                        value={wheelName}
                        onChange={(e) => setWheelName(e.target.value)}
                        placeholder="ej: Paw Patrol"
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>

                {/* Segment PNGs */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Segmentos PNG (12 archivos) - Para la Ruleta
                    </label>
                    <input
                        type="file"
                        accept=".png"
                        multiple
                        onChange={(e) => setSegmentPngs(Array.from(e.target.files || []))}
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {segmentPngs.length}/12 archivos seleccionados
                    </p>
                </div>

                {/* Selector JPGs */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Selector JPG (12 archivos) - Para Selección
                    </label>
                    <input
                        type="file"
                        accept=".jpg,.jpeg"
                        multiple
                        onChange={(e) => setSelectorJpgs(Array.from(e.target.files || []))}
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {selectorJpgs.length}/12 archivos seleccionados
                    </p>
                </div>

                {/* Background */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Fondo de Ruleta (1 archivo)
                    </label>
                    <input
                        type="file"
                        accept=".jpg,.jpeg"
                        onChange={(e) => setBackground(e.target.files?.[0] || null)}
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {background ? '✅ Fondo seleccionado' : 'Sin fondo'}
                    </p>
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className={`
            w-full py-3 rounded-lg font-bold text-white
            ${uploading ? 'bg-gray-400' : 'bg-primary hover:bg-primary-dark'}
          `}
                >
                    {uploading ? 'Subiendo...' : '🚀 Subir Ruleta'}
                </button>
            </div>
        </div>
    );
}
