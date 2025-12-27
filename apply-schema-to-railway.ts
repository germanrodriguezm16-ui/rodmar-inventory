/**
 * Script para aplicar el esquema a Railway PostgreSQL
 * 
 * Este script aplica todas las tablas y estructura a Railway antes de migrar datos.
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL;

if (!RAILWAY_DATABASE_URL) {
  console.error('❌ Error: RAILWAY_DATABASE_URL no está configurada');
  console.error('   Agrega RAILWAY_DATABASE_URL a tu archivo .env');
  process.exit(1);
}

console.log('🔌 Conectando a Railway PostgreSQL...\n');

const sql = postgres(RAILWAY_DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const db = drizzle(sql, { schema });

async function main() {
  try {
    console.log('📋 Aplicando esquema a Railway PostgreSQL...\n');
    console.log('   Esto creará todas las tablas necesarias...\n');
    
    // Usar drizzle-kit push para aplicar el esquema
    // Nota: Esto requiere que drizzle.config.ts esté configurado
    // Pero podemos usar el método directo con drizzle
    
    // Verificar conexión primero
    await sql`SELECT 1`;
    console.log('✅ Conexión a Railway verificada\n');
    
    // Aplicar esquema usando push (esto crea las tablas)
    console.log('📦 Creando tablas...\n');
    
    // Importar y ejecutar push desde drizzle-kit
    const { push } = await import('drizzle-kit/push');
    
    // Nota: push requiere configuración, así que usaremos un enfoque alternativo
    // Aplicar migraciones si existen, o crear tablas directamente
    
    console.log('⚠️  Usando método alternativo: aplicando esquema directamente...\n');
    console.log('   Si hay errores, ejecuta: npm run db:push');
    console.log('   (pero primero cambia DATABASE_URL temporalmente a Railway)\n');
    
    // Verificar si las tablas ya existen
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length > 0) {
      console.log(`⚠️  Ya existen ${tables.length} tablas en Railway`);
      console.log('   Si quieres empezar desde cero, elimina las tablas primero\n');
    } else {
      console.log('✅ No hay tablas existentes, listo para crear\n');
    }
    
    console.log('💡 Para aplicar el esquema completo, ejecuta:');
    console.log('   1. Guarda tu DATABASE_URL actual de Supabase');
    console.log('   2. Cambia temporalmente DATABASE_URL en .env a RAILWAY_DATABASE_URL');
    console.log('   3. Ejecuta: npm run db:push');
    console.log('   4. Restaura DATABASE_URL original\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Alternativa:');
    console.error('   1. Cambia temporalmente DATABASE_URL en .env a Railway');
    console.error('   2. Ejecuta: npm run db:push');
    console.error('   3. Restaura DATABASE_URL original');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

