/**
 * Script de Verificación: Comparar datos entre Supabase y Railway PostgreSQL
 * 
 * Este script compara los conteos de registros entre ambas bases de datos
 * para verificar que la migración fue exitosa.
 */

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './shared/schema.js';

const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL;

if (!SUPABASE_DATABASE_URL) {
  console.error('❌ Error: SUPABASE_DATABASE_URL o DATABASE_URL no está configurada');
  process.exit(1);
}

if (!RAILWAY_DATABASE_URL) {
  console.error('❌ Error: RAILWAY_DATABASE_URL no está configurada');
  process.exit(1);
}

console.log('🔍 Verificando migración...\n');

const supabaseSql = postgres(SUPABASE_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const railwaySql = postgres(RAILWAY_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const supabaseDb = drizzle(supabaseSql, { schema });
const railwayDb = drizzle(railwaySql, { schema });

async function countTable(db: any, table: any, tableName: string): Promise<number> {
  try {
    const data = await db.select().from(table);
    return data.length;
  } catch (error: any) {
    console.error(`   ⚠️  Error contando ${tableName}: ${error.message}`);
    return -1;
  }
}

async function main() {
  const tables = {
    users: schema.users,
    roles: schema.roles,
    permissions: schema.permissions,
    rolePermissions: schema.rolePermissions,
    minas: schema.minas,
    compradores: schema.compradores,
    volqueteros: schema.volqueteros,
    viajes: schema.viajes,
    transacciones: schema.transacciones,
    inversiones: schema.inversiones,
    fusionBackups: schema.fusionBackups,
  };

  console.log('📊 Comparando conteos de registros:\n');
  console.log('Tabla'.padEnd(25) + 'Supabase'.padStart(12) + 'Railway'.padStart(12) + 'Estado'.padStart(12));
  console.log('='.repeat(61));

  let allMatch = true;
  let totalSupabase = 0;
  let totalRailway = 0;

  for (const [tableName, table] of Object.entries(tables)) {
    const supabaseCount = await countTable(supabaseDb, table, tableName);
    const railwayCount = await countTable(railwayDb, table, tableName);

    if (supabaseCount >= 0 && railwayCount >= 0) {
      totalSupabase += supabaseCount;
      totalRailway += railwayCount;

      const match = supabaseCount === railwayCount;
      const status = match ? '✅ OK' : '❌ DIF';
      
      if (!match) {
        allMatch = false;
      }

      console.log(
        tableName.padEnd(25) + 
        supabaseCount.toString().padStart(12) + 
        railwayCount.toString().padStart(12) + 
        status.padStart(12)
      );
    }
  }

  console.log('='.repeat(61));
  console.log(
    'TOTAL'.padEnd(25) + 
    totalSupabase.toString().padStart(12) + 
    totalRailway.toString().padStart(12) + 
    (totalSupabase === totalRailway ? '✅ OK' : '❌ DIF').padStart(12)
  );
  console.log('='.repeat(61));

  if (allMatch && totalSupabase === totalRailway) {
    console.log('\n✅ ¡Verificación exitosa! Todos los conteos coinciden.');
  } else {
    console.log('\n⚠️  Hay diferencias en los conteos. Revisa las tablas marcadas con ❌');
  }

  // Verificación adicional: probar algunas consultas específicas
  console.log('\n🔍 Verificaciones adicionales:\n');

  try {
    // Verificar algunos registros específicos
    const supabaseUsers = await supabaseDb.select().from(schema.users);
    const railwayUsers = await railwayDb.select().from(schema.users);

    if (supabaseUsers.length === railwayUsers.length) {
      console.log('✅ Usuarios: Conteo coincide');
      
      // Verificar que los IDs coincidan
      const supabaseUserIds = new Set(supabaseUsers.map((u: any) => u.id));
      const railwayUserIds = new Set(railwayUsers.map((u: any) => u.id));
      
      const allIdsMatch = supabaseUserIds.size === railwayUserIds.size &&
        [...supabaseUserIds].every(id => railwayUserIds.has(id));
      
      if (allIdsMatch) {
        console.log('✅ Usuarios: IDs coinciden');
      } else {
        console.log('❌ Usuarios: Algunos IDs no coinciden');
      }
    } else {
      console.log('❌ Usuarios: Conteo no coincide');
    }

    // Verificar transacciones (tabla más grande)
    const supabaseTransacciones = await supabaseDb.select().from(schema.transacciones);
    const railwayTransacciones = await railwayDb.select().from(schema.transacciones);

    if (supabaseTransacciones.length === railwayTransacciones.length) {
      console.log('✅ Transacciones: Conteo coincide');
      
      // Verificar algunos campos importantes
      const supabaseFirst = supabaseTransacciones[0];
      const railwayFirst = railwayTransacciones.find((t: any) => t.id === supabaseFirst?.id);
      
      if (railwayFirst && supabaseFirst) {
        const valuesMatch = 
          supabaseFirst.valor === railwayFirst.valor &&
          supabaseFirst.fecha?.getTime() === railwayFirst.fecha?.getTime() &&
          supabaseFirst.deQuienTipo === railwayFirst.deQuienTipo;
        
        if (valuesMatch) {
          console.log('✅ Transacciones: Campos importantes coinciden');
        } else {
          console.log('⚠️  Transacciones: Algunos campos no coinciden');
        }
      }
    } else {
      console.log('❌ Transacciones: Conteo no coincide');
    }

    // Verificar viajes
    const supabaseViajes = await supabaseDb.select().from(schema.viajes);
    const railwayViajes = await railwayDb.select().from(schema.viajes);

    if (supabaseViajes.length === railwayViajes.length) {
      console.log('✅ Viajes: Conteo coincide');
    } else {
      console.log('❌ Viajes: Conteo no coincide');
    }

  } catch (error: any) {
    console.error('❌ Error en verificaciones adicionales:', error.message);
  }

  console.log('\n💡 Próximos pasos:');
  console.log('   1. Verifica que la aplicación funcione correctamente en producción');
  console.log('   2. Prueba crear/editar/eliminar algunos registros');
  console.log('   3. Verifica que los balances sean correctos');
  console.log('   4. Si todo está bien, puedes mantener Supabase como backup o eliminarlo');
  console.log('');
}

main()
  .then(() => {
    supabaseSql.end();
    railwaySql.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    supabaseSql.end();
    railwaySql.end();
    process.exit(1);
  });
