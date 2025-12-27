/**
 * Script para verificar si las transacciones adicionales en Railway son nuevas
 */

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './shared/schema.js';

const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL;

if (!SUPABASE_DATABASE_URL || !RAILWAY_DATABASE_URL) {
  console.error('❌ Variables de entorno no configuradas');
  process.exit(1);
}

const supabaseSql = postgres(SUPABASE_DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const railwaySql = postgres(RAILWAY_DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });

const supabaseDb = drizzle(supabaseSql, { schema });
const railwayDb = drizzle(railwaySql, { schema });

async function main() {
  console.log('🔍 Analizando diferencia en transacciones...\n');

  const supabaseTransacciones = await supabaseDb.select().from(schema.transacciones);
  const railwayTransacciones = await railwayDb.select().from(schema.transacciones);

  const supabaseIds = new Set(supabaseTransacciones.map((t: any) => t.id));
  const railwayIds = new Set(railwayTransacciones.map((t: any) => t.id));

  // Transacciones que están en Railway pero no en Supabase (nuevas)
  const nuevasEnRailway = railwayTransacciones.filter((t: any) => !supabaseIds.has(t.id));
  
  // Transacciones que están en Supabase pero no en Railway (faltantes)
  const faltantesEnRailway = supabaseTransacciones.filter((t: any) => !railwayIds.has(t.id));

  console.log(`📊 Supabase: ${supabaseTransacciones.length} transacciones`);
  console.log(`📊 Railway: ${railwayTransacciones.length} transacciones`);
  console.log(`📊 Diferencia: ${railwayTransacciones.length - supabaseTransacciones.length} transacciones\n`);

  if (nuevasEnRailway.length > 0) {
    console.log(`✅ Encontré ${nuevasEnRailway.length} transacciones nuevas en Railway (creadas después de la migración):`);
    nuevasEnRailway.slice(0, 10).forEach((t: any) => {
      console.log(`   - ID: ${t.id}, Fecha: ${t.fecha?.toISOString().split('T')[0]}, Valor: ${t.valor}`);
    });
    if (nuevasEnRailway.length > 10) {
      console.log(`   ... y ${nuevasEnRailway.length - 10} más`);
    }
    console.log('');
  }

  if (faltantesEnRailway.length > 0) {
    console.log(`❌ Encontré ${faltantesEnRailway.length} transacciones en Supabase que NO están en Railway:`);
    faltantesEnRailway.slice(0, 10).forEach((t: any) => {
      console.log(`   - ID: ${t.id}, Fecha: ${t.fecha?.toISOString().split('T')[0]}, Valor: ${t.valor}`);
    });
    if (faltantesEnRailway.length > 10) {
      console.log(`   ... y ${faltantesEnRailway.length - 10} más`);
    }
    console.log('');
  }

  if (nuevasEnRailway.length > 0 && faltantesEnRailway.length === 0) {
    console.log('✅ CONCLUSIÓN: Las transacciones adicionales en Railway son NUEVAS.');
    console.log('   Esto es normal y esperado si la aplicación ya está usando Railway.');
    console.log('   La migración fue exitosa.\n');
  } else if (faltantesEnRailway.length > 0) {
    console.log('⚠️  CONCLUSIÓN: Hay transacciones en Supabase que no están en Railway.');
    console.log('   Esto podría indicar un problema en la migración.\n');
  } else {
    console.log('✅ CONCLUSIÓN: Todas las transacciones coinciden.\n');
  }

  await supabaseSql.end();
  await railwaySql.end();
}

main().catch(console.error);

