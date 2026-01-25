const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin operations
);

async function uploadMarioWheel() {
    const basePath = path.join(__dirname, '..', 'REF', 'Individual', 'Mario');
    const storagePath = 'mario';

    try {
        console.log('🚀 Starting Mario wheel upload...');

        // Upload background
        const bgFile = fs.readFileSync(path.join(basePath, 'Fondo.jpg'));
        const { error: bgError } = await supabase.storage
            .from('individual-wheels')
            .upload(`${storagePath}/background.jpg`, bgFile, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (bgError) throw bgError;
        console.log('✅ Background uploaded');

        // Upload 12 PNGs (segments)
        for (let i = 1; i <= 12; i++) {
            const pngFile = fs.readFileSync(path.join(basePath, `${i}.png`));
            const { error } = await supabase.storage
                .from('individual-wheels')
                .upload(`${storagePath}/segments/${i}.png`, pngFile, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (error) throw error;
            console.log(`✅ Segment ${i}.png uploaded`);
        }

        // Upload 12 JPGs (selectors)
        for (let i = 1; i <= 12; i++) {
            const jpgFile = fs.readFileSync(path.join(basePath, `${i}.jpg`));
            const { error } = await supabase.storage
                .from('individual-wheels')
                .upload(`${storagePath}/selector/${i}.jpg`, jpgFile, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;
            console.log(`✅ Selector ${i}.jpg uploaded`);
        }

        // Get background public URL
        const { data: publicUrlData } = supabase.storage
            .from('individual-wheels')
            .getPublicUrl(`${storagePath}/background.jpg`);

        // Create database record
        const { data, error: dbError } = await supabase
            .from('individual_wheels')
            .insert({
                name: 'Mario Bros',
                theme_category: 'videogames',
                segment_count: 12,
                is_active: true,
                storage_path: storagePath,
                background_image: publicUrlData.publicUrl
            })
            .select();

        if (dbError) throw dbError;

        console.log('🎉 All Mario assets uploaded successfully!');
        console.log('📦 Database record created:', data[0].id);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

uploadMarioWheel();
