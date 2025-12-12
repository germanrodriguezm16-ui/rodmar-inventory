import "dotenv/config";
import postgres from "postgres";
import { hashPassword } from "./server/middleware/auth-helpers";

async function createAdminUser() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL no está configurada");
    process.exit(1);
  }

  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("=== CREANDO USUARIO ADMIN ===");

    // Obtener el rol ADMIN usando SQL directo
    const adminRoleResult = await sql`
      SELECT id, nombre, descripcion
      FROM roles
      WHERE nombre = 'ADMIN'
      LIMIT 1
    `;

    if (adminRoleResult.length === 0) {
      console.error("❌ Error: No se encontró el rol ADMIN. Ejecuta primero la inicialización de la base de datos.");
      await sql.end();
      process.exit(1);
    }

    const adminRole = adminRoleResult[0] as any;

    // Verificar si ya existe un usuario admin
    const existingAdminResult = await sql`
      SELECT id, phone, first_name, last_name
      FROM users
      WHERE role_id = ${adminRole.id}
      LIMIT 1
    `;

    if (existingAdminResult.length > 0) {
      const existingAdmin = existingAdminResult[0] as any;
      console.log("⚠️  Ya existe un usuario con rol ADMIN:");
      console.log(`   ID: ${existingAdmin.id}`);
      console.log(`   Celular: ${existingAdmin.phone || "N/A"}`);
      console.log("\n   Si necesitas crear otro admin, elimina primero el existente o usa el panel de administración.");
      await sql.end();
      process.exit(0);
    }

    // Solicitar datos del admin
    const phone = process.argv[2] || process.env.ADMIN_PHONE || "3000000000";
    const password = process.argv[3] || process.env.ADMIN_PASSWORD || "admin123";
    const firstName = process.argv[4] || "Administrador";
    const lastName = process.argv[5] || "Sistema";

    // Verificar que el celular no esté en uso
    const existingUserResult = await sql`
      SELECT id
      FROM users
      WHERE phone = ${phone}
      LIMIT 1
    `;

    if (existingUserResult.length > 0) {
      console.error(`❌ Error: El celular ${phone} ya está registrado por otro usuario.`);
      await sql.end();
      process.exit(1);
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);
    const userId = `admin_${Date.now()}`;

    // Crear usuario admin usando SQL directo
    await sql`
      INSERT INTO users (id, phone, first_name, last_name, password_hash, role_id, created_at, updated_at)
      VALUES (${userId}, ${phone}, ${firstName || null}, ${lastName || null}, ${passwordHash}, ${adminRole.id}, NOW(), NOW())
    `;

    // Obtener el usuario creado
    const newAdminResult = await sql`
      SELECT id, phone, first_name, last_name, role_id
      FROM users
      WHERE id = ${userId}
    `;
    
    const newAdmin = newAdminResult[0] as any;

    console.log("\n✅ Usuario ADMIN creado exitosamente!");
    console.log(`   📱 Celular: ${phone}`);
    console.log(`   🔑 Contraseña: ${password}`);
    console.log(`   👤 Nombre: ${firstName} ${lastName}`);
    console.log(`   🆔 ID: ${newAdmin.id}`);
    console.log("\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión desde el panel de administración.");
    console.log("\n💡 Uso del script:");
    console.log("   npm run create-admin <celular> <contraseña> [nombre] [apellido]");
    console.log("   Ejemplo: npm run create-admin 3001234567 miPassword123");

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creando usuario admin:", error);
    await sql.end();
    process.exit(1);
  }
}

createAdminUser();
