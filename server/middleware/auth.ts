import type { RequestHandler } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { shouldExpireSession } from "./auth-helpers";

// Extender el tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phone?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        roleId?: number | null;
      };
    }
  }
}

/**
 * Middleware de autenticación - verifica sesión real
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    // Verificar si hay sesión
    if (!req.session || !(req.session as any).userId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const userId = (req.session as any).userId;
    const sessionCreatedAt = (req.session as any).createdAt || new Date();

    // Verificar si la sesión debe expirar (cierre automático a las 2:00 AM)
    if (shouldExpireSession(sessionCreatedAt)) {
      req.session.destroy((err) => {
        if (err) console.error("Error destruyendo sesión:", err);
      });
      return res.status(401).json({ error: "Sesión expirada" });
    }

    // Obtener usuario de la base de datos
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      req.session.destroy((err) => {
        if (err) console.error("Error destruyendo sesión:", err);
      });
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    req.user = {
      id: user[0].id,
      phone: user[0].phone || undefined,
      email: user[0].email || undefined,
      firstName: user[0].firstName || undefined,
      lastName: user[0].lastName || undefined,
      roleId: user[0].roleId || undefined,
    };

    return next();
  } catch (error) {
    console.error("Error en autenticación:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

/**
 * Middleware opcional - no requiere autenticación pero la agrega si existe
 */
export const optionalAuth: RequestHandler = async (req, res, next) => {
  try {
    if (req.session && (req.session as any).userId) {
      const userId = (req.session as any).userId;
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length > 0) {
        req.user = {
          id: user[0].id,
          phone: user[0].phone || undefined,
          email: user[0].email || undefined,
          firstName: user[0].firstName || undefined,
          lastName: user[0].lastName || undefined,
          roleId: user[0].roleId || undefined,
        };
      }
    }
    next();
  } catch (error) {
    // Continuar sin autenticación en caso de error
    next();
  }
};

