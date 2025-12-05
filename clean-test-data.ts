import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './shared/schema';
import { sql, eq, and, or, like, lt, gt } from 'drizzle-orm';
import 'dotenv/config';
import * as readline from 'readline';

/**
 * Script para limpiar datos de ensayo/prueba de la base de datos
 * 
 * Este script te permite eliminar transacciones y viajes de prueba de forma segura
 * antes o después de la migración.
 * 
 * Uso:
 * 1. Configura DATABASE_URL en .env (puede ser Replit o Supabase)
 * 2. Ejecuta: npm run clean:test-data
 * 3. Sigue las instrucciones interactivas
 */

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('❌ Error: DATABASE_URL no está configurada');
  console.error('   Configúrala en .env');
  process.exit(1);
}

// Configurar conexión
const sqlClient = postgres(DB_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const db = drizzle(sqlClient, { schema });

// Interfaz para leer input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Función para mostrar estadísticas
async function showStats() {
  console.log('\n📊 Estadísticas actuales de la base de datos:\n');
  
  const [transaccionesCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.transacciones);
  const [viajesCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.viajes);
  const [minasCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.minas);
  const [compradoresCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.compradores);
  const [volqueterosCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.volqueteros);
  
  console.log(`   Transacciones: ${transaccionesCount.count}`);
  console.log(`   Viajes: ${viajesCount.count}`);
  console.log(`   Minas: ${minasCount.count}`);
  console.log(`   Compradores: ${compradoresCount.count}`);
  console.log(`   Volqueteros: ${volqueterosCount.count}`);
}

// Función para buscar transacciones de prueba
async function findTestTransactions(criteria: {
  conceptos?: string[];
  fechasAntesDe?: Date;
  fechasDespuesDe?: Date;
  valorMaximo?: number;
}) {
  let query = db.select().from(schema.transacciones);
  const conditions = [];

  // Filtrar por conceptos comunes de prueba
  if (criteria.conceptos && criteria.conceptos.length > 0) {
    const conceptoConditions = criteria.conceptos.map(concepto =>
      like(schema.transacciones.concepto, `%${concepto}%`)
    );
    conditions.push(or(...conceptoConditions));
  }

  // Filtrar por fecha
  if (criteria.fechasAntesDe) {
    conditions.push(lt(schema.transacciones.fecha, criteria.fechasAntesDe));
  }
  if (criteria.fechasDespuesDe) {
    conditions.push(gt(schema.transacciones.fecha, criteria.fechasDespuesDe));
  }

  // Filtrar por valor máximo (transacciones de prueba suelen ser pequeñas)
  if (criteria.valorMaximo) {
    conditions.push(sql`CAST(${schema.transacciones.valor} AS DECIMAL) <= ${criteria.valorMaximo}`);
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return await query;
}

// Función para buscar viajes de prueba
async function findTestTrips(criteria: {
  conductores?: string[];
  placas?: string[];
  fechasAntesDe?: Date;
  fechasDespuesDe?: Date;
}) {
  let query = db.select().from(schema.viajes);
  const conditions = [];

  // Filtrar por conductores de prueba
  if (criteria.conductores && criteria.conductores.length > 0) {
    const conductorConditions = criteria.conductores.map(conductor =>
      like(schema.viajes.conductor, `%${conductor}%`)
    );
    conditions.push(or(...conductorConditions));
  }

  // Filtrar por placas de prueba
  if (criteria.placas && criteria.placas.length > 0) {
    const placaConditions = criteria.placas.map(placa =>
      like(schema.viajes.placa, `%${placa}%`)
    );
    conditions.push(or(...placaConditions));
  }

  // Filtrar por fecha
  if (criteria.fechasAntesDe) {
    conditions.push(lt(schema.viajes.fechaCargue, criteria.fechasAntesDe));
  }
  if (criteria.fechasDespuesDe) {
    conditions.push(gt(schema.viajes.fechaCargue, criteria.fechasDespuesDe));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return await query;
}

// Función para eliminar transacciones
async function deleteTransactions(ids: number[]) {
  if (ids.length === 0) return 0;
  
  let deleted = 0;
  for (const id of ids) {
    try {
      await db.delete(schema.transacciones).where(eq(schema.transacciones.id, id));
      deleted++;
    } catch (error: any) {
      console.error(`   ⚠️  Error eliminando transacción ${id}: ${error.message}`);
    }
  }
  return deleted;
}

// Función para eliminar viajes
async function deleteTrips(ids: string[]) {
  if (ids.length === 0) return 0;
  
  let deleted = 0;
  for (const id of ids) {
    try {
      await db.delete(schema.viajes).where(eq(schema.viajes.id, id));
      deleted++;
    } catch (error: any) {
      console.error(`   ⚠️  Error eliminando viaje ${id}: ${error.message}`);
    }
  }
  return deleted;
}

// Función principal
async function cleanTestData() {
  try {
    console.log('🧹 Script de Limpieza de Datos de Ensayo\n');
    console.log('⚠️  ADVERTENCIA: Esta operación eliminará datos permanentemente.');
    console.log('   Asegúrate de tener un backup antes de continuar.\n');

    // Mostrar estadísticas actuales
    await showStats();

    // Preguntar qué base de datos está usando
    console.log('\n📋 ¿En qué base de datos quieres limpiar datos?');
    console.log('   1. Replit (antes de migrar)');
    console.log('   2. Supabase (después de migrar)');
    const dbChoice = await question('\n   Selecciona (1 o 2): ');
    
    if (dbChoice !== '1' && dbChoice !== '2') {
      console.log('❌ Opción inválida');
      process.exit(1);
    }

    const dbName = dbChoice === '1' ? 'Replit' : 'Supabase';
    console.log(`\n✅ Limpiando datos en: ${dbName}\n`);

    // Confirmar
    const confirm = await question('⚠️  ¿Estás seguro de que quieres continuar? (escribe "SI" para confirmar): ');
    if (confirm !== 'SI') {
      console.log('❌ Operación cancelada');
      process.exit(0);
    }

    // Opciones de limpieza
    console.log('\n📋 Opciones de limpieza:\n');
    console.log('   1. Limpiar por criterios automáticos (recomendado)');
    console.log('   2. Limpiar por criterios personalizados');
    console.log('   3. Ver datos antes de limpiar');
    console.log('   4. Limpiar todo (PELIGROSO - elimina TODAS las transacciones y viajes)');
    
    const option = await question('\n   Selecciona una opción (1-4): ');

    let transactionsToDelete: number[] = [];
    let tripsToDelete: string[] = [];

    if (option === '1') {
      // Criterios automáticos
      console.log('\n🔍 Buscando datos de prueba con criterios automáticos...\n');
      
      // Conceptos comunes de prueba
      const testConcepts = ['prueba', 'test', 'ensayo', 'demo', 'ejemplo', 'temporal'];
      
      // Buscar transacciones de prueba
      const testTransactions = await findTestTransactions({
        conceptos: testConcepts,
        valorMaximo: 1000, // Transacciones menores a $1000 pueden ser de prueba
      });
      
      console.log(`   📊 Encontradas ${testTransactions.length} transacciones de prueba`);
      
      // Mostrar algunas para confirmar
      if (testTransactions.length > 0) {
        console.log('\n   Primeras 5 transacciones encontradas:');
        testTransactions.slice(0, 5).forEach((t, i) => {
          console.log(`   ${i + 1}. ID: ${t.id}, Concepto: ${t.concepto}, Valor: ${t.valor}, Fecha: ${t.fecha}`);
        });
        
        const confirmDelete = await question(`\n   ¿Eliminar estas ${testTransactions.length} transacciones? (s/n): `);
        if (confirmDelete.toLowerCase() === 's') {
          transactionsToDelete = testTransactions.map(t => t.id);
        }
      }

      // Buscar viajes de prueba (por conductor o placa)
      const testConductors = ['prueba', 'test', 'demo', 'ejemplo'];
      const testPlacas = ['TEST', 'PRUEBA', 'DEMO', '0000'];
      
      const testTrips = await findTestTrips({
        conductores: testConductors,
        placas: testPlacas,
      });
      
      console.log(`\n   📊 Encontrados ${testTrips.length} viajes de prueba`);
      
      if (testTrips.length > 0) {
        console.log('\n   Primeros 5 viajes encontrados:');
        testTrips.slice(0, 5).forEach((v, i) => {
          console.log(`   ${i + 1}. ID: ${v.id}, Conductor: ${v.conductor}, Placa: ${v.placa}, Fecha: ${v.fechaCargue}`);
        });
        
        const confirmDelete = await question(`\n   ¿Eliminar estos ${testTrips.length} viajes? (s/n): `);
        if (confirmDelete.toLowerCase() === 's') {
          tripsToDelete = testTrips.map(v => v.id);
        }
      }

    } else if (option === '2') {
      // Criterios personalizados
      console.log('\n📝 Configuración de criterios personalizados:\n');
      
      // Conceptos a buscar
      const conceptosInput = await question('   Conceptos a buscar (separados por comas, ej: prueba,test,demo): ');
      const conceptos = conceptosInput.split(',').map(c => c.trim()).filter(c => c);
      
      // Valor máximo
      const valorMaxInput = await question('   Valor máximo de transacciones (deja vacío para no filtrar): ');
      const valorMax = valorMaxInput ? parseFloat(valorMaxInput) : undefined;
      
      // Fecha límite (antes de esta fecha)
      const fechaInput = await question('   Fecha límite - eliminar antes de (YYYY-MM-DD, deja vacío para no filtrar): ');
      const fechaLimite = fechaInput ? new Date(fechaInput) : undefined;
      
      // Buscar transacciones
      const testTransactions = await findTestTransactions({
        conceptos: conceptos.length > 0 ? conceptos : undefined,
        valorMaximo: valorMax,
        fechasAntesDe: fechaLimite,
      });
      
      console.log(`\n   📊 Encontradas ${testTransactions.length} transacciones`);
      
      if (testTransactions.length > 0) {
        console.log('\n   Primeras 10 transacciones:');
        testTransactions.slice(0, 10).forEach((t, i) => {
          console.log(`   ${i + 1}. ID: ${t.id}, Concepto: ${t.concepto}, Valor: ${t.valor}, Fecha: ${t.fecha}`);
        });
        
        const confirmDelete = await question(`\n   ¿Eliminar estas ${testTransactions.length} transacciones? (s/n): `);
        if (confirmDelete.toLowerCase() === 's') {
          transactionsToDelete = testTransactions.map(t => t.id);
        }
      }

      // Viajes
      const conductoresInput = await question('\n   Conductores a buscar (separados por comas): ');
      const conductores = conductoresInput.split(',').map(c => c.trim()).filter(c => c);
      
      const placasInput = await question('   Placas a buscar (separados por comas): ');
      const placas = placasInput.split(',').map(p => p.trim()).filter(p => p);
      
      const testTrips = await findTestTrips({
        conductores: conductores.length > 0 ? conductores : undefined,
        placas: placas.length > 0 ? placas : undefined,
        fechasAntesDe: fechaLimite,
      });
      
      console.log(`\n   📊 Encontrados ${testTrips.length} viajes`);
      
      if (testTrips.length > 0) {
        console.log('\n   Primeros 10 viajes:');
        testTrips.slice(0, 10).forEach((v, i) => {
          console.log(`   ${i + 1}. ID: ${v.id}, Conductor: ${v.conductor}, Placa: ${v.placa}, Fecha: ${v.fechaCargue}`);
        });
        
        const confirmDelete = await question(`\n   ¿Eliminar estos ${testTrips.length} viajes? (s/n): `);
        if (confirmDelete.toLowerCase() === 's') {
          tripsToDelete = testTrips.map(v => v.id);
        }
      }

    } else if (option === '3') {
      // Solo ver datos
      console.log('\n👀 Modo de visualización (no se eliminará nada)\n');
      
      const allTransactions = await db.select().from(schema.transacciones).limit(50);
      const allTrips = await db.select().from(schema.viajes).limit(50);
      
      console.log(`   Transacciones (mostrando primeras 50 de ${(await db.select({ count: sql<number>`count(*)` }).from(schema.transacciones))[0].count}):`);
      allTransactions.forEach((t, i) => {
        console.log(`   ${i + 1}. ID: ${t.id}, Concepto: ${t.concepto}, Valor: ${t.valor}, Fecha: ${t.fecha}`);
      });
      
      console.log(`\n   Viajes (mostrando primeros 50 de ${(await db.select({ count: sql<number>`count(*)` }).from(schema.viajes))[0].count}):`);
      allTrips.forEach((v, i) => {
        console.log(`   ${i + 1}. ID: ${v.id}, Conductor: ${v.conductor}, Placa: ${v.placa}, Fecha: ${v.fechaCargue}`);
      });
      
      console.log('\n✅ Visualización completada. No se eliminó nada.');
      process.exit(0);

    } else if (option === '4') {
      // Limpiar TODO (muy peligroso)
      console.log('\n⚠️  ⚠️  ⚠️  ADVERTENCIA CRÍTICA ⚠️  ⚠️  ⚠️');
      console.log('   Estás a punto de eliminar TODAS las transacciones y viajes.');
      console.log('   Esta operación NO se puede deshacer.\n');
      
      const confirm1 = await question('   Escribe "ELIMINAR TODO" para confirmar: ');
      if (confirm1 !== 'ELIMINAR TODO') {
        console.log('❌ Operación cancelada');
        process.exit(0);
      }
      
      const confirm2 = await question('   ¿Estás ABSOLUTAMENTE seguro? Escribe "SI ESTOY SEGURO": ');
      if (confirm2 !== 'SI ESTOY SEGURO') {
        console.log('❌ Operación cancelada');
        process.exit(0);
      }
      
      // Obtener todos los IDs
      const allTransactions = await db.select({ id: schema.transacciones.id }).from(schema.transacciones);
      const allTrips = await db.select({ id: schema.viajes.id }).from(schema.viajes);
      
      transactionsToDelete = allTransactions.map(t => t.id);
      tripsToDelete = allTrips.map(v => v.id);
      
      console.log(`\n   Se eliminarán ${transactionsToDelete.length} transacciones y ${tripsToDelete.length} viajes.`);
    } else {
      console.log('❌ Opción inválida');
      process.exit(1);
    }

    // Ejecutar eliminación
    if (transactionsToDelete.length > 0 || tripsToDelete.length > 0) {
      console.log('\n🗑️  Eliminando datos...\n');
      
      if (transactionsToDelete.length > 0) {
        console.log(`   Eliminando ${transactionsToDelete.length} transacciones...`);
        const deleted = await deleteTransactions(transactionsToDelete);
        console.log(`   ✅ ${deleted} transacciones eliminadas`);
      }
      
      if (tripsToDelete.length > 0) {
        console.log(`   Eliminando ${tripsToDelete.length} viajes...`);
        const deleted = await deleteTrips(tripsToDelete);
        console.log(`   ✅ ${deleted} viajes eliminados`);
      }
      
      // Mostrar estadísticas finales
      console.log('\n📊 Estadísticas después de la limpieza:');
      await showStats();
      
      console.log('\n✅ Limpieza completada exitosamente!');
    } else {
      console.log('\n✅ No se eliminó nada.');
    }

  } catch (error: any) {
    console.error('\n❌ Error durante la limpieza:', error);
    throw error;
  } finally {
    rl.close();
    await sqlClient.end();
  }
}

// Ejecutar
cleanTestData()
  .then(() => {
    console.log('\n🎉 ¡Proceso finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

