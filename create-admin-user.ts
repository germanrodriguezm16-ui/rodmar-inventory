import "dotenv/config";
import { db } from "./server/db";
import { users, roles } from "./shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./server/middleware/auth-helpers";

async function createAdminUser() {
  try {
    console.log("=== CREANDO USUARIO ADMIN ===");

    // Obtener el rol ADMIN
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.nombre, "ADMIN"))
      .limit(1);

    if (adminRole.length === 0) {
      console.error("❌ Error: No se encontró el rol ADMIN. Ejecuta primero la inicialización de la base de datos.");
      process.exit(1);
    }

    // Verificar si ya existe un usuario admin
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.roleId, adminRole[0].id))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log("⚠️  Ya existe un usuario con rol ADMIN:");
      console.log(`   ID: ${existingAdmin[0].id}`);
      console.log(`   Celular: ${existingAdmin[0].phone || "N/A"}`);
      console.log("\n   Si necesitas crear otro admin, elimina primero el existente o usa el panel de administración.");
      process.exit(0);
    }

    // Solicitar datos del admin
    const phone = process.argv[2] || process.env.ADMIN_PHONE || "3000000000";
    const password = process.argv[3] || process.env.ADMIN_PASSWORD || "admin123";
    const firstName = process.argv[4] || "Administrador";
    const lastName = process.argv[5] || "Sistema";

    // Verificar que el celular no esté en uso
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existingUser.length > 0) {
      console.error(`❌ Error: El celular ${phone} ya está registrado por otro usuario.`);
      process.exit(1);
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario admin
    const [newAdmin] = await db
      .insert(users)
      .values({
        id: `admin_${Date.now()}`,
        phone,
        firstName,
        lastName,
        passwordHash,
        roleId: adminRole[0].id,
      })
      .returning();

    console.log("\n✅ Usuario ADMIN creado exitosamente!");
    console.log(`   📱 Celular: ${phone}`);
    console.log(`   🔑 Contraseña: ${password}`);
    console.log(`   👤 Nombre: ${firstName} ${lastName}`);
    console.log(`   🆔 ID: ${newAdmin.id}`);
    console.log("\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión desde el panel de administración.");
    console.log("\n💡 Uso del script:");
    console.log("   npm run create-admin <celular> <contraseña> [nombre] [apellido]");
    console.log("   Ejemplo: npm run create-admin 3001234567 miPassword123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creando usuario admin:", error);
    process.exit(1);
  }
}

createAdminUser();

