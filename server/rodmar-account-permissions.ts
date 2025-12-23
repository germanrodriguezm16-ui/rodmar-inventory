import { db } from './db';
import { permissions } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Crea un permiso para una cuenta RodMar específica
 * Útil cuando se crean cuentas dinámicamente en el futuro
 */
export async function createRodMarAccountPermission(cuentaNombre: string): Promise<number | null> {
  try {
    const permissionKey = `module.RODMAR.account.${cuentaNombre}.view`;
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
 * (Función síncrona para uso en filtros)
 */
export function canViewRodMarAccount(
  userPermissions: string[],
  cuentaNombre: string
): boolean {
  // Si tiene el permiso general de ver todas las cuentas, puede ver todas
  if (userPermissions.includes('module.RODMAR.accounts.view')) {
    return true;
  }
  // Si tiene el permiso específico de esta cuenta, puede verla
  const permisoCuenta = `module.RODMAR.account.${cuentaNombre}.view`;
  return userPermissions.includes(permisoCuenta);
}

