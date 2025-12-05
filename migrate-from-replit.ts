import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './shared/schema';
import 'dotenv/config';

/**
 * Script de migración de datos desde Replit a Supabase
 * 
 * Uso:
 * 1. Obtén la DATABASE_URL de Replit (desde Secrets en Replit)
 * 2. Configúrala como REPLIT_DATABASE_URL en .env o pásala como variable de entorno
 * 3. Asegúrate de que DATABASE_URL apunte a Supabase
 * 4. Ejecuta: npm run migrate:replit
 */

const REPLIT_DB_URL = process.env.REPLIT_DATABASE_URL || process.env.DATABASE_URL_REPLIT;
const SUPABASE_DB_URL = process.env.DATABASE_URL;

if (!REPLIT_DB_URL) {
  console.error('❌ Error: REPLIT_DATABASE_URL no está configurada');
  console.error('   Configúrala en .env o como variable de entorno');
  console.error('   Ejemplo: REPLIT_DATABASE_URL=postgresql://...');
  process.exit(1);
}

if (!SUPABASE_DB_URL) {
  console.error('❌ Error: DATABASE_URL (Supabase) no está configurada');
  console.error('   Asegúrate de tener DATABASE_URL en .env apuntando a Supabase');
  process.exit(1);
}

console.log('🚀 Iniciando migración de datos desde Replit a Supabase...\n');

// Configurar conexiones
const replitSql = postgres(REPLIT_DB_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const supabaseSql = postgres(SUPABASE_DB_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const replitDb = drizzle(replitSql, { schema });
const supabaseDb = drizzle(supabaseSql, { schema });

// Función para limpiar fechas inválidas
function cleanDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? new Date() : date;
  }
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

// Función para limpiar datos antes de insertar
function cleanData(record: any, tableName: string): any {
  const cleaned: any = {};
  
  // Mapeo de campos antiguos a nuevos (para compatibilidad con schemas antiguos)
  const fieldMappings: Record<string, Record<string, string>> = {
    compradores: {
      'balance_desactualizado': 'balanceDesactualizado',
    },
    minas: {
      'balance_desactualizado': 'balanceDesactualizado',
    },
    volqueteros: {
      'balance_desactualizado': 'balanceDesactualizado',
    },
  };
  
  // Copiar todos los campos del registro original
  for (const key in record) {
    const value = record[key];
    
    // Mapear nombres de campos antiguos a nuevos si es necesario
    const mapping = fieldMappings[tableName];
    const newKey = mapping && mapping[key] ? mapping[key] : key;
    
    // Limpiar fechas
    if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
      const date = cleanDate(value);
      if (date) {
        cleaned[newKey] = date;
      } else {
        // Si la fecha es inválida y es un campo requerido, usar fecha actual
        if (key.includes('fecha') || key.includes('created_at') || key.includes('updated_at')) {
          cleaned[newKey] = new Date();
        } else {
          cleaned[newKey] = null;
        }
      }
    } else {
      cleaned[newKey] = value;
    }
  }
  
  // Agregar valores por defecto para campos nuevos que no existen en el schema antiguo
  if (tableName === 'compradores' || tableName === 'minas' || tableName === 'volqueteros') {
    if (!cleaned.balanceDesactualizado && cleaned.balanceDesactualizado !== false) {
      cleaned.balanceDesactualizado = false;
    }
    if (!cleaned.balanceCalculado) {
      cleaned.balanceCalculado = '0';
    }
    if (!cleaned.ultimoRecalculo) {
      cleaned.ultimoRecalculo = new Date();
    }
  }
  
  return cleaned;
}

// Función para migrar una tabla
async function migrateTable(tableName: string, table: any, orderBy: any = null) {
  console.log(`\n📦 Migrando tabla: ${tableName}...`);
  
  try {
    // Leer datos de Replit usando SQL directo para evitar problemas con columnas faltantes
    let data: any[];
    try {
      // Intentar con Drizzle primero
      let query = replitDb.select().from(table);
      if (orderBy) {
        query = query.orderBy(orderBy);
      }
      data = await query;
    } catch (drizzleError: any) {
      // Si falla por columnas faltantes, usar SQL directo
      console.log(`   ⚠️  Usando SQL directo debido a diferencias de schema...`);
      const tableNameSql = tableName === 'fusionBackups' ? 'fusion_backups' : tableName;
      const result = await replitSql`SELECT * FROM ${replitSql(tableNameSql)}`;
      data = result as any[];
    }
    
    if (data.length === 0) {
      console.log(`   ⚠️  No hay datos en ${tableName}`);
      return { migrated: 0, skipped: 0 };
    }
    
    console.log(`   📊 Encontrados ${data.length} registros`);
    
    // Verificar qué registros ya existen en Supabase
    const existing = await supabaseDb.select().from(table);
    const existingIds = new Set(existing.map((r: any) => r.id));
    
    // Filtrar solo los nuevos y limpiar datos
    const newData = data
      .filter((r: any) => !existingIds.has(r.id))
      .map((r: any) => cleanData(r, tableName));
    
    if (newData.length === 0) {
      console.log(`   ✅ Todos los registros ya existen en Supabase`);
      return { migrated: 0, skipped: data.length };
    }
    
    console.log(`   ➡️  Migrando ${newData.length} registros nuevos...`);
    
    // Insertar en lotes para evitar problemas de memoria
    const batchSize = 100;
    let migrated = 0;
    let errors = 0;
    
    for (let i = 0; i < newData.length; i += batchSize) {
      const batch = newData.slice(i, i + batchSize);
      try {
        await supabaseDb.insert(table).values(batch);
        migrated += batch.length;
        process.stdout.write(`   ⏳ ${migrated}/${newData.length}...\r`);
      } catch (batchError: any) {
        // Si falla el lote, intentar uno por uno
        console.log(`\n   ⚠️  Error en lote, migrando individualmente...`);
        for (const record of batch) {
          try {
            await supabaseDb.insert(table).values(record);
            migrated++;
          } catch (recordError: any) {
            errors++;
            console.log(`   ⚠️  Registro omitido (ID: ${record.id}): ${recordError.message.substring(0, 50)}`);
          }
        }
      }
    }
    
    if (errors > 0) {
      console.log(`   ⚠️  Migrados ${migrated} registros, ${errors} omitidos por errores`);
    } else {
      console.log(`   ✅ Migrados ${migrated} registros`);
    }
    
    return { migrated, skipped: data.length - newData.length };
  } catch (error: any) {
    console.error(`   ❌ Error migrando ${tableName}:`, error.message);
    throw error;
  }
}

// Función principal
async function migrate() {
  try {
    console.log('🔍 Verificando conexiones...');
    
    // Probar conexión a Replit
    await replitSql`SELECT 1`;
    console.log('   ✅ Conexión a Replit establecida');
    
    // Probar conexión a Supabase
    await supabaseSql`SELECT 1`;
    console.log('   ✅ Conexión a Supabase establecida');
    
    const stats: Record<string, { migrated: number; skipped: number }> = {
      users: { migrated: 0, skipped: 0 },
      minas: { migrated: 0, skipped: 0 },
      compradores: { migrated: 0, skipped: 0 },
      volqueteros: { migrated: 0, skipped: 0 },
      viajes: { migrated: 0, skipped: 0 },
      transacciones: { migrated: 0, skipped: 0 },
      inversiones: { migrated: 0, skipped: 0 },
      fusionBackups: { migrated: 0, skipped: 0 },
    };
    
    // Migrar en orden de dependencias
    console.log('\n📋 Iniciando migración de datos...\n');
    
    // 1. Users (sin dependencias)
    stats.users = await migrateTable('users', schema.users);
    
    // 2. Minas (depende de users, pero user_id es opcional)
    stats.minas = await migrateTable('minas', schema.minas);
    
    // 3. Compradores (depende de users, pero user_id es opcional)
    stats.compradores = await migrateTable('compradores', schema.compradores);
    
    // 4. Volqueteros (depende de users, pero user_id es opcional)
    stats.volqueteros = await migrateTable('volqueteros', schema.volqueteros);
    
    // 5. Viajes (depende de minas, compradores)
    stats.viajes = await migrateTable('viajes', schema.viajes);
    
    // 6. Transacciones (depende de users, pero user_id es opcional)
    stats.transacciones = await migrateTable('transacciones', schema.transacciones);
    
    // 7. Inversiones (depende de users, pero user_id es opcional)
    stats.inversiones = await migrateTable('inversiones', schema.inversiones);
    
    // 8. Fusion Backups (depende de users, pero user_id es opcional)
    stats.fusionBackups = await migrateTable('fusion_backups', schema.fusionBackups);
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    for (const [table, stat] of Object.entries(stats)) {
      console.log(`${table.padEnd(20)}: ${stat.migrated.toString().padStart(5)} migrados, ${stat.skipped.toString().padStart(5)} omitidos`);
      totalMigrated += stat.migrated;
      totalSkipped += stat.skipped;
    }
    
    console.log('='.repeat(60));
    console.log(`TOTAL: ${totalMigrated} registros migrados, ${totalSkipped} omitidos`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Migración completada exitosamente!');
    
  } catch (error: any) {
    console.error('\n❌ Error durante la migración:', error);
    throw error;
  } finally {
    // Cerrar conexiones
    await replitSql.end();
    await supabaseSql.end();
  }
}

// Ejecutar migración
migrate()
  .then(() => {
    console.log('\n🎉 ¡Proceso finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });


