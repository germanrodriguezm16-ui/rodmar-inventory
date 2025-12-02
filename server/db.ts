import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Lazy connection - solo se conecta cuando se usa
let sql: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      const error = new Error('DATABASE_URL no está configurada. Verifica las variables de entorno en Railway/Vercel.');
      (error as any).code = 'NO_DATABASE_URL';
      throw error;
    }
    
    try {
      sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        max: 10,
        connection: {
          application_name: 'rodmar-inventory',
        },
        onnotice: () => {}, // Silenciar notificaciones
        connect_timeout: 15, // 15 segundos timeout
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
      dbInstance = drizzle(sql, { schema });
      console.log('✅ Conexión a base de datos configurada');
      
      // Probar la conexión de forma asíncrona (se hará en la primera query)
      // No podemos hacer await aquí porque getDb() no es async
    } catch (error: any) {
      console.error('❌ Error configurando conexión a la base de datos:', error.message);
      console.error('   Código:', error.code);
      console.error('   Hostname:', error.hostname || 'N/A');
      
      // Si es error de IPv6, sugerir solución
      if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo')) {
        console.error('');
        console.error('💡 El DNS se resuelve pero la conexión falla.');
        console.error('💡 Esto puede ser un problema de IPv6. Prueba:');
        console.error('   1. Verificar que el proyecto de Supabase esté activo');
        console.error('   2. Esperar unos minutos y volver a intentar');
        console.error('   3. Usar el formato de connection pooling en lugar de directo');
      }
      
      // Marcar el error con código para que las rutas lo capturen
      (error as any).code = error.code || 'DB_CONNECTION_ERROR';
      throw error;
    }
  }
  return dbInstance;
}

export { getDb };
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  }
});