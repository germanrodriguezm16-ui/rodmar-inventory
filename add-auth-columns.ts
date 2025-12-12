import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function addAuthColumns() {
  try {
    console.log("=== Agregando columnas de autenticación ===");

    // Agregar columna phone si no existe
    await db.execute(sql`
      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'phone') THEN
              ALTER TABLE users ADD COLUMN phone VARCHAR(20);
          END IF;
      END $$;
    `);
    console.log("✅ Columna 'phone' agregada o ya existe");

    // Crear índice único en phone (después de agregar la columna)
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique 
        ON users(phone) 
        WHERE phone IS NOT NULL;
      `);
      console.log("✅ Índice único en 'phone' creado o ya existe");
    } catch (error: any) {
      // Si el índice ya existe o hay otro error, continuar
      if (error?.code !== '42P07') { // 42P07 = duplicate_table
        console.log("⚠️  Nota sobre índice phone:", error.message);
      }
    }

    // Agregar columna password_hash si no existe
    await db.execute(sql`
      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'password_hash') THEN
              ALTER TABLE users ADD COLUMN password_hash TEXT;
          END IF;
      END $$;
    `);
    console.log("✅ Columna 'password_hash' agregada o ya existe");

    // Agregar columna last_login si no existe
    await db.execute(sql`
      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'last_login') THEN
              ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
          END IF;
      END $$;
    `);
    console.log("✅ Columna 'last_login' agregada o ya existe");

    console.log("\n✅ Todas las columnas de autenticación están listas!");
    console.log("   Ahora puedes ejecutar: npm run create-admin");

  } catch (error) {
    console.error("❌ Error agregando columnas:", error);
    process.exit(1);
  }
}

addAuthColumns();

