/**
 * Script para sincronizar secuencias de PostgreSQL después de migración
 * 
 * Cuando se migran datos con IDs específicos, las secuencias no se actualizan automáticamente.
 * Este script sincroniza las secuencias con el máximo ID existente en cada tabla.
 */

import 'dotenv/config';
import postgres from 'postgres';

const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!RAILWAY_DATABASE_URL) {
  console.error('❌ Error: RAILWAY_DATABASE_URL o DATABASE_URL no está configurada');
  process.exit(1);
}

console.log('🔧 Sincronizando secuencias de PostgreSQL...\n');

const sql = postgres(RAILWAY_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function syncSequence(tableName: string, sequenceName: string) {
  try {
    // Obtener el máximo ID de la tabla (usar SQL directo para nombres dinámicos)
    const result = await sql.unsafe(`
      SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}
    `);
    
    const maxId = parseInt(result[0].max_id);
    
    if (maxId === 0) {
      console.log(`⚠️  ${tableName}: No hay registros, secuencia permanece en valor inicial`);
      return true;
    }
    
    // Sincronizar la secuencia: setval(sequence, maxId, true)
    // true significa que el último valor usado fue maxId, entonces el siguiente nextval() devolverá maxId + 1
    await sql`
      SELECT setval(${sequenceName}, ${maxId}, true)
    `;
    
    console.log(`✅ ${tableName}: Secuencia ${sequenceName} sincronizada`);
    console.log(`   Máximo ID actual: ${maxId}`);
    console.log(`   Siguiente ID será: ${maxId + 1}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ Error sincronizando ${tableName}: ${error.message}`);
    return false;
  }
}

async function main() {
  const sequences = [
    { table: 'minas', sequence: 'minas_id_seq' },
    { table: 'compradores', sequence: 'compradores_id_seq' },
    { table: 'volqueteros', sequence: 'volqueteros_id_seq' },
    { table: 'transacciones', sequence: 'transacciones_id_seq' },
    { table: 'inversiones', sequence: 'inversiones_id_seq' },
    { table: 'roles', sequence: 'roles_id_seq' },
    { table: 'permissions', sequence: 'permissions_id_seq' },
    { table: 'fusion_backups', sequence: 'fusion_backups_id_seq' },
  ];

  console.log('📋 Tablas a sincronizar:\n');
  for (const seq of sequences) {
    console.log(`   - ${seq.table} → ${seq.sequence}`);
  }
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const seq of sequences) {
    const success = await syncSequence(seq.table, seq.sequence);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`✅ Sincronización completada: ${successCount} exitosas, ${errorCount} errores`);
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 Ahora puedes crear nuevas minas, compradores y volqueteros sin problemas.');
  console.log('');

  await sql.end();
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

