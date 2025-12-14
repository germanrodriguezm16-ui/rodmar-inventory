import "dotenv/config";
import { initializeDatabase } from "./init-db";
import { addPasswordPlainColumn } from "./add-password-plain-column";

/**
 * Script de inicialización de base de datos
 * Este script se ejecuta por separado para inicializar la BD
 * y NO debe ejecutarse en el servidor principal
 */
async function runInit() {
  console.log('=== INICIANDO SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS ===');
  
  try {
    // Initialize database on startup (con manejo de errores)
    try {
      console.log('🔧 [INIT] Llamando a initializeDatabase()...');
      await initializeDatabase();
      console.log('✅ [INIT] initializeDatabase() completado');
      
      // Ejecutar migración de password_plain si es necesario
      try {
        console.log('🔧 [INIT] Llamando a addPasswordPlainColumn()...');
        await addPasswordPlainColumn();
        console.log('✅ [INIT] addPasswordPlainColumn() completado');
      } catch (migrationError: any) {
        // Si la columna ya existe o hay otro error, solo loguear pero no fallar
        if (migrationError.message?.includes('ya existe') || migrationError.message?.includes('already exists')) {
          console.log('ℹ️  Columna password_plain ya existe, omitiendo migración');
        } else {
          console.error('⚠️  Error ejecutando migración de password_plain (continuando):', migrationError.message);
        }
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
        console.error('⚠️  No se pudo conectar a PostgreSQL');
        console.error('💡 Asegúrate de que PostgreSQL esté corriendo o configura DATABASE_URL en .env');
        console.error('💡 Puedes usar una base de datos remota gratuita en https://neon.tech');
        console.error('');
        console.error('🔄 El script continuará pero algunas funcionalidades no estarán disponibles');
      } else {
        console.error('❌ Error inicializando base de datos:', error.message);
        throw error;
      }
    }
    
    console.log('✅ [INIT] Script de inicialización completado exitosamente');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ [INIT] Error en script de inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar solo si se llama directamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('run-init.ts')) {
  runInit();
}

