import type { RequestHandler } from "express";
import { db } from "../db";
import { users, roles, permissions, rolePermissions, userPermissionsOverride } from "../../shared/schema";
import { eq, and, or } from "drizzle-orm";

/**
 * Obtiene todos los permisos efectivos de un usuario
 * Incluye permisos del rol + overrides individuales (allow/deny)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    // Obtener usuario con su rol
    const user = await db
      .select({
        userId: users.id,
        roleId: users.roleId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return [];
    }

    const userRoleId = user[0].roleId;

    // Si no tiene rol, no tiene permisos
    if (!userRoleId) {
      return [];
    }

    // Obtener permisos del rol
    const rolePerms = await db
      .select({
        permissionKey: permissions.key,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, userRoleId));

    const rolePermissionKeys = rolePerms.map((p) => p.permissionKey);

    // Obtener overrides del usuario
    const overrides = await db
      .select({
        permissionKey: permissions.key,
        overrideType: userPermissionsOverride.overrideType,
      })
      .from(userPermissionsOverride)
      .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
      .where(eq(userPermissionsOverride.userId, userId));

    // Aplicar overrides: deny quita permisos, allow agrega permisos
    const deniedPermissions = new Set(
      overrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey)
    );
    const allowedPermissions = new Set(
      overrides.filter((o) => o.overrideType === "allow").map((o) => o.permissionKey)
    );

    // Construir conjunto final de permisos
    const effectivePermissions = new Set<string>();

    // Agregar permisos del rol (excepto los denegados)
    rolePermissionKeys.forEach((key) => {
      if (!deniedPermissions.has(key)) {
        effectivePermissions.add(key);
      }
    });

    // Agregar permisos permitidos explícitamente
    allowedPermissions.forEach((key) => {
      effectivePermissions.add(key);
    });

    return Array.from(effectivePermissions);
  } catch (error) {
    console.error("Error obteniendo permisos del usuario:", error);
    return [];
  }
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export async function can(userId: string, permissionKey: string): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return userPermissions.includes(permissionKey);
}

/**
 * Middleware que requiere un permiso específico
 * Debe usarse después de requireAuth
 */
export function requirePermission(permissionKey: string): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const hasPermission = await can(req.user.id, permissionKey);

      if (!hasPermission) {
        return res.status(403).json({
          error: "No tienes permiso para realizar esta acción",
          requiredPermission: permissionKey,
        });
      }

      next();
    } catch (error) {
      console.error("Error verificando permiso:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  };
}

