/**
 * SCRIPT DE PRUEBA: test_rls_security.js
 * 
 * Este script valida el comportamiento de las nuevas políticas RLS (Row Level Security) 
 * aplicadas a la tabla 'player_queue'. Simula un cliente móvil (anon) e intenta realizar
 * operaciones autorizadas y no autorizadas.
 * 
 * Ejecución: node scripts/test_rls_security.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("❌ Error: Faltan variables de entorno en .env.local.");
  process.exit(1);
}

// 1. Inicializar clientes de Supabase
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE SEGURIDAD RLS (PLAYER_QUEUE) ===");
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  let testQueueId = null;

  try {
    // ------------------------------------------------------------------------
    // PREPARACIÓN: Crear un registro de prueba usando Service Role (bypass RLS)
    // ------------------------------------------------------------------------
    console.log("\n[Prep] Creando registro de prueba con Service Role...");
    const { data: newRow, error: insertError } = await supabaseService
      .from('player_queue')
      .insert({
        player_name: 'Test Hacker',
        player_emoji: '👾',
        status: 'selecting',
        selected_animals: ['🦁', '🐯'],
        screen_number: 1 // ID de pantalla de prueba (entero)
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`No se pudo crear el registro de prueba: ${insertError.message}`);
    }

    testQueueId = newRow.id;
    console.log(`✅ Registro de prueba creado con ID: ${testQueueId} (Estado inicial: 'selecting')`);

    // ------------------------------------------------------------------------
    // PRUEBA 1: Permitir al cliente Anon actualizar animales en fase 'selecting'
    // ------------------------------------------------------------------------
    console.log("\n[Prueba 1] Intentando actualizar 'selected_animals' como cliente Anon...");
    const { data: update1Data, error: update1Error } = await supabaseAnon
      .from('player_queue')
      .update({ selected_animals: ['🐨', '🐼'] })
      .eq('id', testQueueId)
      .select();

    if (update1Error) {
      console.log(`❌ Error inesperado en Prueba 1: ${update1Error.message}`);
    } else if (update1Data && update1Data.length > 0) {
      console.log("✅ Prueba 1 EXITOSA: El cliente Anon pudo actualizar su selección de animales.");
      console.log(`   Nuevos animales: ${JSON.stringify(update1Data[0].selected_animals)}`);
    } else {
      console.log("❌ Prueba 1 FALLIDA: No se actualizó ningún registro.");
    }

    // ------------------------------------------------------------------------
    // PRUEBA 2: Impedir al cliente Anon cambiarse el estado a 'playing'
    // ------------------------------------------------------------------------
    console.log("\n[Prueba 2] Intentando forzar cambio de estado a 'playing' como cliente Anon (Hackeo)...");
    const { data: update2Data, error: update2Error } = await supabaseAnon
      .from('player_queue')
      .update({ status: 'playing' })
      .eq('id', testQueueId)
      .select();

    if (update2Error) {
      console.log(`✅ Prueba 2 EXITOSA: Supabase bloqueó la consulta con error: ${update2Error.message}`);
    } else if (update2Data && update2Data.length > 0 && update2Data[0].status === 'playing') {
      console.log("❌ Prueba 2 FALLIDA (VULNERABILIDAD): El cliente Anon pudo cambiar su estado a 'playing'!");
    } else {
      // Si la consulta no da error pero devuelve un array vacío, significa que el RLS ocultó o rechazó la mutación
      console.log("✅ Prueba 2 EXITOSA: No se realizaron cambios en la base de datos (bloqueado por RLS).");
    }

    // ------------------------------------------------------------------------
    // PRUEBA 3: Impedir al cliente Anon alterar nada si el registro ya está en 'playing'
    // ------------------------------------------------------------------------
    console.log("\n[Prep 2] Promoviendo registro a 'playing' de forma legítima (Service Role)...");
    const { error: prep2Error } = await supabaseService
      .from('player_queue')
      .update({ status: 'playing' })
      .eq('id', testQueueId);

    if (prep2Error) {
      throw new Error(`No se pudo cambiar el estado a 'playing' en la prep: ${prep2Error.message}`);
    }
    console.log("✅ Registro de prueba establecido en 'playing'.");

    console.log("[Prueba 3] Intentando modificar animales o emoji de fila activa 'playing' como cliente Anon...");
    const { data: update3Data, error: update3Error } = await supabaseAnon
      .from('player_queue')
      .update({ player_emoji: '💀', selected_animals: ['🦖'] })
      .eq('id', testQueueId)
      .select();

    if (update3Error) {
      console.log(`✅ Prueba 3 EXITOSA: Supabase bloqueó la modificación con error: ${update3Error.message}`);
    } else if (update3Data && update3Data.length > 0) {
      console.log("❌ Prueba 3 FALLIDA (VULNERABILIDAD): El cliente Anon modificó el registro activo!");
    } else {
      console.log("✅ Prueba 3 EXITOSA: No se modificó el registro (bloqueado por RLS ya que el estado es 'playing').");
    }

    // ------------------------------------------------------------------------
    // PRUEBA 4: Permitir al Staff autenticado/Service Role actualizar en cualquier estado
    // ------------------------------------------------------------------------
    console.log("\n[Prueba 4] Intentando actualizar prize_payout_status como Service Role/Staff...");
    const { data: update4Data, error: update4Error } = await supabaseService
      .from('player_queue')
      .update({ prize_payout_status: 'paid', prize_payout_at: new Date().toISOString(), status: 'completed' })
      .eq('id', testQueueId)
      .select();

    if (update4Error) {
      console.log(`❌ Prueba 4 FALLIDA: El administrador no pudo actualizar: ${update4Error.message}`);
    } else if (update4Data && update4Data.length > 0) {
      console.log("✅ Prueba 4 EXITOSA: El personal administrativo actualizó el registro a 'completed' y 'paid'.");
    } else {
      console.log("❌ Prueba 4 FALLIDA: No se afectó ninguna fila.");
    }

  } catch (err) {
    console.error(`❌ Error durante la ejecución del test: ${err.message}`);
  } finally {
    // ------------------------------------------------------------------------
    // LIMPIEZA
    // ------------------------------------------------------------------------
    if (testQueueId) {
      console.log("\n[Limpieza] Eliminando registro de prueba...");
      const { error: deleteError } = await supabaseService
        .from('player_queue')
        .delete()
        .eq('id', testQueueId);

      if (deleteError) {
        console.error(`❌ Error al limpiar el registro de prueba: ${deleteError.message}`);
      } else {
        console.log("✅ Limpieza completada con éxito.");
      }
    }
  }

  console.log("\n=== FIN DE LAS PRUEBAS DE SEGURIDAD ===");
}

runTests();
