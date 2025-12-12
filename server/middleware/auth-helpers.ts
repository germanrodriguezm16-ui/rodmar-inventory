import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "rodmar-secret-key-change-in-production";

/**
 * Verifica si una sesión debe expirar (cierre automático a las 2:00 AM hora Colombia)
 */
export function shouldExpireSession(sessionCreatedAt: Date): boolean {
  const now = new Date();
  
  // Convertir a hora Colombia (UTC-5)
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const nowColombia = new Date(now.getTime() + (now.getTimezoneOffset() + colombiaOffset) * 60 * 1000);
  const sessionColombia = new Date(sessionCreatedAt.getTime() + (sessionCreatedAt.getTimezoneOffset() + colombiaOffset) * 60 * 1000);
  
  // Obtener hora actual en Colombia
  const currentHour = nowColombia.getHours();
  
  // Si son las 2:00 AM o más, y la sesión fue creada antes de las 2:00 AM de hoy
  if (currentHour >= 2) {
    const today2AM = new Date(nowColombia);
    today2AM.setHours(2, 0, 0, 0);
    
    // Si la sesión fue creada antes de las 2:00 AM de hoy, debe expirar
    if (sessionColombia < today2AM) {
      return true;
    }
  } else {
    // Si es antes de las 2:00 AM, verificar si la sesión es de ayer (después de las 2:00 AM de ayer)
    const yesterday2AM = new Date(nowColombia);
    yesterday2AM.setDate(yesterday2AM.getDate() - 1);
    yesterday2AM.setHours(2, 0, 0, 0);
    
    // Si la sesión fue creada antes de las 2:00 AM de ayer, debe expirar
    if (sessionColombia < yesterday2AM) {
      return true;
    }
  }
  
  return false;
}

/**
 * Hashea una contraseña usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifica si una contraseña coincide con el hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Busca un usuario por número de celular
 */
export async function findUserByPhone(phone: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Actualiza el último login de un usuario
 */
export async function updateLastLogin(userId: string) {
  await db
    .update(users)
    .set({ 
      lastLogin: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Genera un JWT token para un usuario
 */
export function generateToken(userId: string): string {
  const now = new Date();
  const payload = {
    userId,
    iat: Math.floor(now.getTime() / 1000),
    createdAt: now.toISOString(),
  };
  
  // El token expira en 24 horas, pero verificaremos manualmente la expiración a las 2:00 AM
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
  });
}

/**
 * Verifica y decodifica un JWT token
 */
export function verifyToken(token: string): { userId: string; createdAt: Date } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      iat: number;
      createdAt: string;
    };
    
    const createdAt = new Date(decoded.createdAt);
    
    // Verificar si el token debe expirar (cierre automático a las 2:00 AM)
    if (shouldExpireSession(createdAt)) {
      return null;
    }
    
    return {
      userId: decoded.userId,
      createdAt,
    };
  } catch (error) {
    console.error("Error verificando token:", error);
    return null;
  }
}

