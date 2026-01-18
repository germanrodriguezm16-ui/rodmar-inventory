import { db } from "./db";
import { permissions } from "../shared/schema";
import { eq } from "drizzle-orm";

export function getTerceroPermissionKey(terceroId: number | string): string {
  return `module.RODMAR.tercero.${terceroId}.view`;
}

/**
 * Crea (o reutiliza) el permiso para un tercero específico.
 * Usa el ID como identificador estable del permiso.
 */
export async function createTerceroPermission(
  terceroId: number,
  terceroNombre: string,
): Promise<number | null> {
  try {
    const permissionKey = getTerceroPermissionKey(terceroId);
    const descripcion = `Ver tercero: ${terceroNombre}`;

    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    const [newPermission] = await db
      .insert(permissions)
      .values({
        key: permissionKey,
        descripcion,
        categoria: "account",
      })
      .returning();

    console.log(`✅ Permiso creado para tercero: ${terceroNombre} (${permissionKey})`);
    return newPermission.id;
  } catch (error) {
    console.error(`❌ Error creando permiso para tercero ${terceroNombre}:`, error);
    return null;
  }
}

