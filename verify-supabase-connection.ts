/**
 * Script para verificar conexión a Supabase antes de migrar
 */

import 'dotenv/config';
import postgres from 'postgres';
import * as schema from './shared/schema.js';
import { drizzle } from 'drizzle-orm/postgres-js';

const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!SUPABASE_DATABASE_URL) {
  console.error('❌ Error: SUPABASE_DATABASE_URL o DATABASE_URL no está configurada');
  process.exit(1);
}

console.log('🔌 Verificando conexión a Supabase...\n');

const sql = postgres(SUPABASE_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const db = drizzle(sql, { schema });

async function main() {
  try {
    // Contar registros en cada tabla
    const tables = {
      users: schema.users,
      minas: schema.minas,
      compradores: schema.compradores,
      volqueteros: schema.volqueteros,
      viajes: schema.viajes,
      transacciones: schema.transacciones,
      inversiones: schema.inversiones,
      roles: schema.roles,
      permissions: schema.permissions,
    };

    console.log('📊 Contando registros en Supabase:\n');
    
    let total = 0;
    for (const [tableName, table] of Object.entries(tables)) {
      try {
        const count = await db.select().from(table);
        console.log(`   ${tableName.padEnd(20)}: ${count.length.toString().padStart(6)} registros`);
        total += count.length;
      } catch (error: any) {
        console.log(`   ${tableName.padEnd(20)}: Error - ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(40));
    console.log(`   Total aproximado: ${total} registros`);
    console.log('='.repeat(40));
    console.log('\n✅ Conexión a Supabase verificada correctamente');
    
  } catch (error: any) {
    console.error('\n❌ Error verificando conexión:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

