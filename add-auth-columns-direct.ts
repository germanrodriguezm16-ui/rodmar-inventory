import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function addAuthColumnsDirect() {
  try {
    console.log("=== Agregando columnas de autenticación (método directo) ===");

    // Verificar si las columnas existen
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('phone', 'password_hash', 'last_login');
    `);

    const existingColumns = checkColumns.map((row: any) => row.column_name);
    console.log("Columnas existentes:", existingColumns);

    // Agregar phone si no existe
    if (!existingColumns.includes('phone')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN phone VARCHAR(20);`);
      console.log("✅ Columna 'phone' agregada");
    } else {
      console.log("✅ Columna 'phone' ya existe");
    }

    // Agregar password_hash si no existe
    if (!existingColumns.includes('password_hash')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
      console.log("✅ Columna 'password_hash' agregada");
    } else {
      console.log("✅ Columna 'password_hash' ya existe");
    }

    // Agregar last_login si no existe
    if (!existingColumns.includes('last_login')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP;`);
      console.log("✅ Columna 'last_login' agregada");
    } else {
      console.log("✅ Columna 'last_login' ya existe");
    }

    // Crear índice único en phone (solo si la columna existe)
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique 
        ON users(phone) 
        WHERE phone IS NOT NULL;
      `);
      console.log("✅ Índice único en 'phone' creado");
    } catch (error: any) {
      console.log("⚠️  Nota sobre índice:", error.message);
    }

    console.log("\n✅ Todas las columnas de autenticación están listas!");
    console.log("   Ahora puedes ejecutar: npm run create-admin");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error agregando columnas:", error);
    process.exit(1);
  }
}

addAuthColumnsDirect();

