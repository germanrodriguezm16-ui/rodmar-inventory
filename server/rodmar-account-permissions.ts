import { db } from './db';
import { permissions, roles, rolePermissions } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Crea un permiso para una cuenta RodMar específica
 * Ahora usa el código de la cuenta en lugar del nombre para que sea persistente
 */
export async function createRodMarAccountPermission(cuentaCodigo: string, cuentaNombre: string): Promise<number | null> {
  try {
    // Usar el código en lugar del nombre para que sea persistente aunque cambie el nombre
    const permissionKey = `module.RODMAR.account.${cuentaCodigo}.view`;
    const descripcion = `Ver cuenta RodMar: ${cuentaNombre}`;

    // Verificar si el permiso ya existe
    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Crear el permiso
    const [newPermission] = await db
      .insert(permissions)
      .values({
        key: permissionKey,
        descripcion,
        categoria: 'account',
      })
      .returning();

    console.log(`✅ Permiso creado para cuenta RodMar: ${cuentaNombre} (${permissionKey})`);
    return newPermission.id;
  } catch (error) {
    console.error(`❌ Error creando permiso para cuenta RodMar ${cuentaNombre}:`, error);
    return null;
  }
}

/**
 * Verifica si un usuario tiene permiso para ver una cuenta RodMar específica
 * Ahora usa el código de la cuenta en lugar del nombre
 * 
 * NOTA: El permiso general module.RODMAR.accounts.view solo habilita la pestaña,
 * pero NO otorga acceso a las cuentas. Solo los permisos específicos dan acceso.
 */
export function canViewRodMarAccount(
  userPermissions: string[],
  cuentaCodigo: string
): boolean {
  // Solo verificar el permiso específico de esta cuenta usando el código
  // El permiso general NO otorga acceso automático
  const permisoCuenta = `module.RODMAR.account.${cuentaCodigo}.view`;
  return userPermissions.includes(permisoCuenta);
}

/**
 * Asigna un permiso al rol ADMIN automáticamente
 */
export async function assignPermissionToAdminRole(permissionKey: string): Promise<void> {
  try {
    // Buscar el permiso
    const [permission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1);

    if (!permission) {
      console.warn(`⚠️ Permiso no encontrado: ${permissionKey}`);
      return;
    }

    // Buscar el rol ADMIN
    const [adminRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.nombre, 'ADMIN'))
      .limit(1);

    if (!adminRole) {
      console.warn(`⚠️ Rol ADMIN no encontrado`);
      return;
    }

    // Verificar si ya está asignado
    const existing = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, adminRole.id),
          eq(rolePermissions.permissionId, permission.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`✅ Permiso ${permissionKey} ya está asignado al rol ADMIN`);
      return;
    }

    // Asignar el permiso al rol ADMIN
    await db.insert(rolePermissions).values({
      roleId: adminRole.id,
      permissionId: permission.id,
    });

    console.log(`✅ Permiso ${permissionKey} asignado al rol ADMIN`);
  } catch (error: any) {
    // Si ya existe (error 23505), ignorar
    if (error.code === '23505') {
      console.log(`✅ Permiso ${permissionKey} ya está asignado al rol ADMIN`);
      return;
    }
    console.error(`❌ Error asignando permiso ${permissionKey} al rol ADMIN:`, error);
  }
}

