import type { RequestHandler } from "express";
import { storage } from "../storage";

// Extender el tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

/**
 * Middleware de autenticación simple
 * AUTENTICACIÓN DESHABILITADA - siempre permite acceso
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    // Siempre crear/obtener usuario principal sin verificar autenticación
    const mainUser = await storage.upsertUser({
      id: "main_user",
      email: "usuario@rodmar.com",
      firstName: "Usuario",
      lastName: "Principal",
    });

    req.user = {
      id: mainUser.id,
      email: mainUser.email || undefined,
      firstName: mainUser.firstName || undefined,
      lastName: mainUser.lastName || undefined,
    };

    return next();
  } catch (error) {
    console.error("Error en autenticación:", error);
    // Continuar de todas formas - autenticación deshabilitada
    req.user = {
      id: "main_user",
      email: "usuario@rodmar.com",
      firstName: "Usuario",
      lastName: "Principal",
    };
    return next();
  }
};

/**
 * Middleware opcional - no requiere autenticación pero la agrega si existe
 */
export const optionalAuth: RequestHandler = async (req, res, next) => {
  try {
    const mainUser = await storage.upsertUser({
      id: "main_user",
      email: "usuario@rodmar.com",
      firstName: "Usuario",
      lastName: "Principal",
    });

    req.user = {
      id: mainUser.id,
      email: mainUser.email || undefined,
      firstName: mainUser.firstName || undefined,
      lastName: mainUser.lastName || undefined,
    };

    next();
  } catch (error) {
    // Continuar sin autenticación en caso de error
    next();
  }
};

