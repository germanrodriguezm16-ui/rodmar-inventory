/**
 * Script de Migración: Supabase → Railway PostgreSQL
 * 
 * Este script migra todos los datos de Supabase a Railway PostgreSQL.
 * 
 * REQUISITOS:
 * 1. Backup completo de Supabase (recomendado hacer antes)
 * 2. Base de datos PostgreSQL creada en Railway
 * 3. Esquema aplicado a Railway (npm run db:push con DATABASE_URL de Railway)
 * 
 * CONFIGURACIÓN:
 * - SUPABASE_DATABASE_URL: URL de conexión a Supabase (origen)
 * - RAILWAY_DATABASE_URL: URL de conexión a Railway PostgreSQL (destino)
 * 
 * USO:
 * 1. Configura las variables de entorno en .env:
 *    SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres
 *    RAILWAY_DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway
 * 
 * 2. Ejecuta: npm run migrate:supabase-to-railway
 *    O: tsx migrate-supabase-to-railway.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema.js';

// Importar todas las tablas del schema
const {
  users,
  minas,
  compradores,
  volqueteros,
  viajes,
  transacciones,
  inversiones,
  fusionBackups,
  roles,
  permissions,
  rolePermissions,
  userOverrides,
  transaccionesPendientes,
} = schema;

// Configuración
const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL;
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL;

if (!SUPABASE_DATABASE_URL) {
  console.error('❌ Error: SUPABASE_DATABASE_URL no está configurada');
  console.error('   Agrega SUPABASE_DATABASE_URL a tu archivo .env');
  process.exit(1);
}

if (!RAILWAY_DATABASE_URL) {
  console.error('❌ Error: RAILWAY_DATABASE_URL no está configurada');
  console.error('   Agrega RAILWAY_DATABASE_URL a tu archivo .env');
  process.exit(1);
}

// Conectar a ambas bases de datos
console.log('🔌 Conectando a Supabase (origen)...');
const supabaseSql = postgres(SUPABASE_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1, // Solo necesitamos una conexión para leer
});

const supabaseDb = drizzle(supabaseSql, { schema });

console.log('🔌 Conectando a Railway PostgreSQL (destino)...');
const railwaySql = postgres(RAILWAY_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const railwayDb = drizzle(railwaySql, { schema });

// Función para limpiar datos antes de insertar
function cleanData(record: any, tableName: string): any {
  const cleaned = { ...record };
  
  // Eliminar campos undefined
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  
  return cleaned;
}

// Función para migrar una tabla
async function migrateTable(
  tableName: string,
  table: any,
  orderBy: any = null,
  skipExisting: boolean = true
) {
  console.log(`\n📦 Migrando tabla: ${tableName}...`);
  
  try {
    // Leer datos de Supabase
    let query = supabaseDb.select().from(table);
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const data = await query;
    
    if (data.length === 0) {
      console.log(`   ⚠️  No hay datos en ${tableName}`);
      return { migrated: 0, skipped: 0, errors: 0 };
    }
    
    console.log(`   📊 Encontrados ${data.length} registros en Supabase`);
    
    // Si skipExisting, verificar qué registros ya existen en Railway
    let existingIds = new Set();
    if (skipExisting) {
      try {
        const existing = await railwayDb.select().from(table);
        existingIds = new Set(existing.map((r: any) => r.id));
        console.log(`   📋 ${existingIds.size} registros ya existen en Railway`);
      } catch (error: any) {
        console.log(`   ⚠️  No se pudo verificar registros existentes: ${error.message}`);
        console.log(`   ➡️  Continuando sin verificación...`);
      }
    }
    
    // Filtrar solo los nuevos y limpiar datos
    const newData = data
      .filter((r: any) => !skipExisting || !existingIds.has(r.id))
      .map((r: any) => cleanData(r, tableName));
    
    if (newData.length === 0) {
      console.log(`   ✅ Todos los registros ya existen en Railway`);
      return { migrated: 0, skipped: data.length, errors: 0 };
    }
    
    console.log(`   ➡️  Migrando ${newData.length} registros nuevos a Railway...`);
    
    // Insertar en lotes para evitar problemas de memoria
    const batchSize = 100;
    let migrated = 0;
    let errors = 0;
    
    for (let i = 0; i < newData.length; i += batchSize) {
      const batch = newData.slice(i, i + batchSize);
      try {
        await railwayDb.insert(table).values(batch);
        migrated += batch.length;
        process.stdout.write(`   ⏳ Progreso: ${migrated}/${newData.length} (${Math.round((migrated / newData.length) * 100)}%)\r`);
      } catch (error: any) {
        console.error(`\n   ❌ Error insertando lote ${i / batchSize + 1}: ${error.message}`);
        errors += batch.length;
        
        // Intentar insertar uno por uno para identificar el problema
        for (const record of batch) {
          try {
            await railwayDb.insert(table).values(record);
            migrated++;
            errors--;
          } catch (singleError: any) {
            console.error(`      ❌ Error con registro ID ${record.id}: ${singleError.message}`);
          }
        }
      }
    }
    
    console.log(`\n   ✅ Migración completada: ${migrated} migrados, ${data.length - migrated} omitidos, ${errors} errores`);
    return { migrated, skipped: data.length - migrated, errors };
    
  } catch (error: any) {
    console.error(`   ❌ Error migrando ${tableName}: ${error.message}`);
    if (error.message.includes('undefined') || error.message.includes('Symbol')) {
      console.error(`   ⚠️  La tabla ${tableName} no existe en el schema. Omitiendo...`);
    }
    return { migrated: 0, skipped: 0, errors: 0 };
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando migración de Supabase a Railway PostgreSQL\n');
  console.log('⚠️  IMPORTANTE: Asegúrate de haber hecho backup de Supabase antes de continuar\n');
  
  // Confirmar antes de continuar (simple, sin readline para evitar problemas)
  console.log('⚠️  Presiona Ctrl+C ahora si NO has hecho backup.\n');
  console.log('   Esperando 5 segundos antes de continuar...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('✅ Continuando con la migración...\n');
  
  const startTime = Date.now();
  const results: Record<string, { migrated: number; skipped: number; errors: number }> = {};
  
  try {
    // Migrar en orden de dependencias
    // 1. Tablas base (sin dependencias)
    results.roles = await migrateTable('roles', roles);
    results.permissions = await migrateTable('permissions', permissions);
    
    // 2. Tablas que dependen de roles/permissions
    results.users = await migrateTable('users', users);
    results.rolePermissions = await migrateTable('rolePermissions', rolePermissions);
    // userOverrides no existe en el schema, omitiendo
    
    // 3. Entidades principales (sin dependencias de otras entidades)
    results.minas = await migrateTable('minas', minas);
    results.compradores = await migrateTable('compradores', compradores);
    results.volqueteros = await migrateTable('volqueteros', volqueteros);
    
    // 4. Tablas con dependencias de entidades
    results.viajes = await migrateTable('viajes', viajes);
    results.transacciones = await migrateTable('transacciones', transacciones);
    results.transaccionesPendientes = await migrateTable('transaccionesPendientes', transaccionesPendientes);
    results.inversiones = await migrateTable('inversiones', inversiones);
    results.fusionBackups = await migrateTable('fusionBackups', fusionBackups);
    
    // Resumen
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const [table, result] of Object.entries(results)) {
      console.log(`${table.padEnd(25)}: ${result.migrated.toString().padStart(5)} migrados, ${result.skipped.toString().padStart(5)} omitidos, ${result.errors.toString().padStart(5)} errores`);
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    console.log('='.repeat(60));
    console.log(`Total: ${totalMigrated} migrados, ${totalSkipped} omitidos, ${totalErrors} errores`);
    console.log(`Tiempo: ${duration} segundos`);
    console.log('='.repeat(60));
    
    if (totalErrors === 0) {
      console.log('\n✅ Migración completada exitosamente!');
      console.log('   Ahora puedes actualizar DATABASE_URL en Railway para usar la nueva base de datos.');
    } else {
      console.log('\n⚠️  Migración completada con algunos errores.');
      console.log('   Revisa los errores arriba y corrige los problemas antes de cambiar DATABASE_URL.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error fatal durante la migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cerrar conexiones
    await supabaseSql.end();
    await railwaySql.end();
    console.log('\n🔌 Conexiones cerradas');
  }
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});

