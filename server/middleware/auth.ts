import type { RequestHandler } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "./auth-helpers";

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

const isDev = process.env.NODE_ENV !== "production";

/**
 * Middleware de autenticación - verifica JWT token
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    // Logging solo en desarrollo
    if (isDev) {
      console.log("🔐 [AUTH] Verificando autenticación para:", req.path);
    }
    
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (isDev) {
        console.log("❌ [AUTH] No hay token en el header Authorization");
      }
      return res.status(401).json({ error: "No autenticado" });
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    if (isDev) {
      console.log("🔑 [AUTH] Token recibido:", token.substring(0, 20) + "...");
    }

    // Verificar token
    const tokenData = verifyToken(token);
    if (!tokenData) {
      if (isDev) {
        console.log("❌ [AUTH] Token inválido o expirado");
      }
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const userId = tokenData.userId;
    if (isDev) {
      console.log("✅ [AUTH] Token válido para usuario:", userId);
    }

    // Obtener usuario de la base de datos
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
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
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const tokenData = verifyToken(token);
      
      if (tokenData) {
        const userId = tokenData.userId;
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
    }
    next();
  } catch (error) {
    // Continuar sin autenticación en caso de error
    next();
  }
};

