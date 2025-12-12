import "dotenv/config";
import postgres from "postgres";

async function fixDbAuth() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL no está configurada");
    process.exit(1);
  }

  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("=== Verificando y agregando columnas de autenticación ===");

    // Verificar columnas existentes
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('phone', 'password_hash', 'last_login');
    `;

    const existing = columns.map((row: any) => row.column_name);
    console.log("Columnas existentes:", existing);

    // Agregar phone
    if (!existing.includes('phone')) {
      await sql`ALTER TABLE users ADD COLUMN phone VARCHAR(20);`;
      console.log("✅ Columna 'phone' agregada");
    } else {
      console.log("✅ Columna 'phone' ya existe");
    }

    // Agregar password_hash
    if (!existing.includes('password_hash')) {
      await sql`ALTER TABLE users ADD COLUMN password_hash TEXT;`;
      console.log("✅ Columna 'password_hash' agregada");
    } else {
      console.log("✅ Columna 'password_hash' ya existe");
    }

    // Agregar last_login
    if (!existing.includes('last_login')) {
      await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP;`;
      console.log("✅ Columna 'last_login' agregada");
    } else {
      console.log("✅ Columna 'last_login' ya existe");
    }

    // Verificar nuevamente
    const columnsAfter = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('phone', 'password_hash', 'last_login');
    `;
    console.log("\n✅ Columnas después de la operación:", columnsAfter.map((row: any) => row.column_name));

    await sql.end();
    console.log("\n✅ Base de datos actualizada correctamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await sql.end();
    process.exit(1);
  }
}

fixDbAuth();

