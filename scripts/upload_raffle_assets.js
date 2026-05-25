const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = 'individual-wheels';
const LOCAL_IMG_DIR = path.resolve(__dirname, '../REF/Grupal/image');

async function uploadFile(localPath, remotePath, contentType) {
  if (!fs.existsSync(localPath)) {
    console.warn(`⚠️ Archivo no encontrado localmente: ${localPath}`);
    return false;
  }
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(remotePath, fileBuffer, {
      contentType: contentType,
      upsert: true
    });

  if (error) {
    console.error(`❌ Error subiendo ${remotePath}:`, error.message);
    return false;
  }
  console.log(`✅ Subido con éxito: ${remotePath}`);
  return true;
}

async function run() {
  console.log("🚀 Iniciando carga de assets para Ruleta de Sorteo Grupal...");

  // 1. Subir fondo
  const backgroundLocal = path.join(LOCAL_IMG_DIR, 'fondo.jpg');
  await uploadFile(backgroundLocal, 'group_sorteo/background.jpg', 'image/jpeg');

  // 2. Subir segmentos de la rueda (1-36)
  for (let i = 1; i <= 36; i++) {
    const pngLocal = path.join(LOCAL_IMG_DIR, `${i}.png`);
    await uploadFile(pngLocal, `group_sorteo/segments/${i}.png`, 'image/png');
  }

  // 3. Subir selectores de resultados (1-36)
  for (let i = 1; i <= 36; i++) {
    const jpgLocal = path.join(LOCAL_IMG_DIR, `${i}.jpg`);
    await uploadFile(jpgLocal, `group_sorteo/selector/${i}.jpg`, 'image/jpeg');
  }

  console.log("🎉 ¡Proceso de subida finalizado!");
}

run();
