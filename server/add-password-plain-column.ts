import "dotenv/config";
import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Script para agregar la columna password_plain a la tabla users
 * Esta columna almacena la contraseña en texto plano para recuperación por ADMIN
 */
async function addPasswordPlainColumn() {
  console.log('=== AGREGANDO COLUMNA password_plain ===');

  try {
    // Asegurarse de que DATABASE_URL esté configurada
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada. Verifica las variables de entorno en Railway/Vercel.');
    }

    // Verificar si la columna ya existe
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'password_plain'
    `);

    if (checkColumn.length > 0) {
      console.log('✅ La columna password_plain ya existe en la tabla users');
      return;
    }

    // Agregar la columna password_plain
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN password_plain TEXT
    `);

    console.log('✅ Columna password_plain agregada exitosamente a la tabla users');

    // Actualizar las contraseñas existentes (copiar desde password_hash no es posible, pero podemos dejar null)
    console.log('ℹ️  Las contraseñas existentes no se pueden recuperar. Se actualizarán cuando se cambien las contraseñas.');

    console.log('=== COLUMNA password_plain AGREGADA EXITOSAMENTE ===');

  } catch (error) {
    console.error('=== ERROR AGREGANDO COLUMNA password_plain ===', error);
    throw error;
  }
}

// Si se ejecuta directamente, llamar a la función
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('add-password-plain-column.ts')) {
  addPasswordPlainColumn()
    .then(() => {
      console.log('✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

export { addPasswordPlainColumn };

