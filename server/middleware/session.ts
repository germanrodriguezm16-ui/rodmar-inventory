import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";

const PgStore = connectPgSimple(session);
const MemoryStoreSession = MemoryStore(session);

/**
 * Configuración de sesiones
 * Usa PostgreSQL si está disponible, sino usa memoria
 */
export function setupSession(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "rodmar-secret-key-change-in-production";
  const isProduction = process.env.NODE_ENV === "production";

  let store: session.Store;

  // Intentar usar PostgreSQL si hay DATABASE_URL
  if (process.env.DATABASE_URL && process.env.USE_PG_SESSIONS !== "false") {
    try {
      store = new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: "sessions",
        createTableIfMissing: true,
      });
      console.log("✅ Usando PostgreSQL para sesiones");
    } catch (error) {
      console.warn("⚠️  No se pudo usar PostgreSQL para sesiones, usando memoria:", error);
      store = new MemoryStoreSession({
        checkPeriod: 86400000, // 24 horas
      });
    }
  } else {
    // Usar memoria en desarrollo
    store = new MemoryStoreSession({
      checkPeriod: 86400000, // 24 horas
    });
    console.log("✅ Usando memoria para sesiones");
  }

  // Determinar si estamos en un entorno cross-origin (frontend y backend en diferentes dominios)
  const isCrossOrigin = !!process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "false";
  
  app.use(
    session({
      store,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "rodmar.sid",
      cookie: {
        httpOnly: true,
        // En producción cross-origin, necesitamos secure: true y sameSite: "none"
        // En desarrollo o mismo origen, podemos usar sameSite: "lax"
        secure: isProduction && isCrossOrigin ? true : isProduction,
        sameSite: isProduction && isCrossOrigin ? "none" : isProduction ? "lax" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        path: "/",
        // Agregar dominio explícito si es necesario (normalmente no es necesario)
        // domain: isProduction && isCrossOrigin ? undefined : undefined,
      },
    })
  );
}

