import type { Express } from "express";
import { Router } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, optionalAuth } from "./middleware/auth";
import { getUserPermissions, requirePermission, invalidateUserPermissionsCache } from "./middleware/permissions";
import { canViewRodMarAccount } from "./rodmar-account-permissions";
import { createTerceroPermission, getTerceroPermissionKey } from "./tercero-permissions";
import { emitTransactionUpdate } from "./socket";
import { db } from "./db";
import { roles, permissions, rolePermissions, users, userPermissionsOverride, transacciones, terceroLoans, terceroLoanInterestRuns, terceroLoanPaymentAllocations, viajes, volqueteros as volqueterosTable } from "../shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { findUserByPhone, verifyPassword, updateLastLogin, hashPassword, generateToken, verifyToken } from "./middleware/auth-helpers";
import {
  insertMinaSchema,
  insertCompradorSchema,
  insertVolqueteroSchema,
  insertTerceroSchema,
  insertViajeSchema,
  excelImportViajeSchema,
  updateViajeSchema,
  insertTransaccionSchema,
  insertInversionSchema,
  updateMinaNombreSchema,
  updateCompradorNombreSchema,
  updateVolqueteroNombreSchema,
  updateTerceroNombreSchema,
  insertRodmarCuentaSchema,
  updateRodmarCuentaNombreSchema,
  fusionSchema,
  revertFusionSchema,
  rodmarCuentas,
} from "@shared/schema";
import { createRodMarAccountPermission, assignPermissionToAdminRole } from "./rodmar-account-permissions";
import { parseColombiaDate } from "@shared/date-colombia";
import { ViajeIdGenerator } from "./id-generator";
import { normalizeNombreToCodigo, nombreToCodigoMap } from "./rodmar-utils";
import { or } from "drizzle-orm";

// Variable de debug - activar solo cuando se necesite diagnóstico
const DEBUG = process.env.DEBUG_ROUTES === 'true';
const debugLog = (...args: any[]) => DEBUG && console.log(...args);

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware global para prevenir caché del navegador
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    next();
  });

  // Middleware de debug para rutas de transacciones - Solo cuando DEBUG está activo
  app.use((req, res, next) => {
    if (DEBUG && req.path.includes('/transacciones') && req.method === 'PATCH') {
      debugLog(`🔍 [ROUTE DEBUG] ===== INICIO PATCH TRANSACCIONES =====`);
      debugLog(`🔍 [ROUTE DEBUG] Method: ${req.method}, Path: ${req.path}`);
      debugLog(`🔍 [ROUTE DEBUG] ===== FIN DEBUG =====`);
    }
    next();
  });

  const resolveRodmarCuentaCodigo = async (rawId: string): Promise<string | null> => {
    const input = rawId?.trim();
    if (!input) return null;

    const numericId = parseInt(input, 10);
    if (!isNaN(numericId)) {
      const [cuenta] = await db
        .select({ codigo: rodmarCuentas.codigo })
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.id, numericId))
        .limit(1);
      if (cuenta?.codigo) return cuenta.codigo;
    }

    const inputUpper = input.toUpperCase();
    const [cuentaByCodigo] = await db
      .select({ codigo: rodmarCuentas.codigo, nombre: rodmarCuentas.nombre })
      .from(rodmarCuentas)
      .where(eq(rodmarCuentas.codigo, inputUpper))
      .limit(1);
    if (cuentaByCodigo?.codigo) return cuentaByCodigo.codigo;

    const cuentas = await db
      .select({ codigo: rodmarCuentas.codigo, nombre: rodmarCuentas.nombre })
      .from(rodmarCuentas);
    const inputLower = input.toLowerCase();
    const slugify = (value: string) => value.toLowerCase().replace(/\s+/g, "-");
    const match = cuentas.find((cuenta) => {
      if (!cuenta) return false;
      if (cuenta.codigo?.toLowerCase() === inputLower) return true;
      if (cuenta.codigo?.toLowerCase().replace(/_/g, "-") === inputLower) return true;
      if (cuenta.nombre?.toLowerCase() === inputLower) return true;
      if (cuenta.nombre && slugify(cuenta.nombre) === inputLower) return true;
      return false;
    });

    return match?.codigo || null;
  };

  const resolveVolqueteroId = async (rawId: string): Promise<number | null> => {
    const input = rawId?.trim();
    if (!input) return null;

    const numericId = parseInt(input, 10);
    if (!isNaN(numericId)) {
      return numericId;
    }

    const volqueteros = await storage.getVolqueteros();
    const match = volqueteros.find(
      (v) => v.nombre?.toLowerCase() === input.toLowerCase(),
    );
    return match?.id ?? null;
  };

  const buildUsePermissionKey = async (tipo: string, rawId: string) => {
    switch (tipo) {
      case "mina":
      case "comprador":
      case "tercero": {
        const idNum = parseInt(rawId, 10);
        if (isNaN(idNum)) {
          return { error: `ID inválido para ${tipo}` } as const;
        }
        return { key: `action.TRANSACCIONES.${tipo}.${idNum}.use` } as const;
      }
      case "volquetero": {
        const idNum = await resolveVolqueteroId(rawId);
        if (!idNum) {
          return { error: "Volquetero no encontrado" } as const;
        }
        return { key: `action.TRANSACCIONES.volquetero.${idNum}.use` } as const;
      }
      case "rodmar": {
        const codigo = await resolveRodmarCuentaCodigo(rawId);
        if (!codigo) {
          return { error: "Cuenta RodMar no encontrada" } as const;
        }
        return { key: `action.TRANSACCIONES.rodmar.account.${codigo}.use` } as const;
      }
      default:
        return { key: null } as const;
    }
  };

  const permissionExists = async (key: string, cache: Map<string, boolean>) => {
    if (cache.has(key)) return cache.get(key) as boolean;
    const exists = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);
    const value = exists.length > 0;
    cache.set(key, value);
    return value;
  };

  const checkUsePermission = async (params: {
    userPermissions: string[];
    deniedPermissions: Set<string>;
    permissionExistsCache: Map<string, boolean>;
    tipo: string;
    id: string;
  }) => {
    const { userPermissions, deniedPermissions, permissionExistsCache, tipo, id } = params;
    const { key, error } = await buildUsePermissionKey(tipo, id);

    if (error) {
      return { allowed: false, status: 400, message: error };
    }

    if (!key) {
      return { allowed: true };
    }

    const exists = await permissionExists(key, permissionExistsCache);
    if (!exists) {
      return { allowed: true };
    }

    if (deniedPermissions.has(key)) {
      return {
        allowed: false,
        status: 403,
        message: "No tienes permiso para usar esta entidad en transacciones",
        requiredPermission: key,
      };
    }

    if (!userPermissions.includes(key)) {
      return {
        allowed: false,
        status: 403,
        message: "No tienes permiso para usar esta entidad en transacciones",
        requiredPermission: key,
      };
    }

    return { allowed: true, requiredPermission: key };
  };

  const buildViewPermissionKey = (tipo: string, rawId: string | number) => {
    const idNum = typeof rawId === "number" ? rawId : parseInt(rawId, 10);
    if (Number.isNaN(idNum)) return null;
    switch (tipo) {
      case "mina":
        return `module.MINAS.mina.${idNum}.view`;
      case "comprador":
        return `module.COMPRADORES.comprador.${idNum}.view`;
      case "volquetero":
        if (idNum >= 1000) return null;
        return `module.VOLQUETEROS.volquetero.${idNum}.view`;
      default:
        return null;
    }
  };

  const checkViewPermission = async (params: {
    userPermissions: string[];
    deniedPermissions: Set<string>;
    permissionExistsCache: Map<string, boolean>;
    tipo: string;
    id: string | number;
  }) => {
    const { userPermissions, deniedPermissions, permissionExistsCache, tipo, id } = params;
    const key = buildViewPermissionKey(tipo, id);
    if (!key) {
      return { allowed: true };
    }

    const exists = await permissionExists(key, permissionExistsCache);
    if (!exists) {
      return { allowed: true };
    }

    if (deniedPermissions.has(key)) {
      return {
        allowed: false,
        status: 403,
        message: "No tienes permiso para ver esta entidad",
        requiredPermission: key,
      };
    }

    if (!userPermissions.includes(key)) {
      return {
        allowed: false,
        status: 403,
        message: "No tienes permiso para ver esta entidad",
        requiredPermission: key,
      };
    }

    return { allowed: true, requiredPermission: key };
  };

  const filterEntitiesByUsePermission = async <T>(params: {
    entities: T[];
    userPermissions: string[];
    deniedPermissions: Set<string>;
    permissionExistsCache: Map<string, boolean>;
    getPermissionKey: (entity: T) => string | null;
  }): Promise<T[]> => {
    const { entities, userPermissions, deniedPermissions, permissionExistsCache, getPermissionKey } = params;
    const results: T[] = [];

    for (const entity of entities) {
      const key = getPermissionKey(entity);
      if (!key) {
        results.push(entity);
        continue;
      }

      const exists = await permissionExists(key, permissionExistsCache);
      if (!exists) {
        results.push(entity);
        continue;
      }

      if (deniedPermissions.has(key)) {
        continue;
      }

      if (userPermissions.includes(key)) {
        results.push(entity);
      }
    }

    return results;
  };

  const ensurePermission = async (params: {
    key: string;
    descripcion: string;
    categoria: string;
  }): Promise<number | null> => {
    const { key, descripcion, categoria } = params;
    const existing = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    try {
      const [created] = await db
        .insert(permissions)
        .values({ key, descripcion, categoria })
        .returning();
      return created.id;
    } catch (error: any) {
      if (error?.code === "23505") {
        const fallback = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(eq(permissions.key, key))
          .limit(1);
        return fallback[0]?.id ?? null;
      }
      throw error;
    }
  };

  const updatePermissionDescription = async (key: string, descripcion: string) => {
    await db.update(permissions).set({ descripcion }).where(eq(permissions.key, key));
  };

  const assignAllowOverride = async (permissionId: number, userId: string) => {
    try {
      await db.insert(userPermissionsOverride).values({
        userId,
        permissionId,
        overrideType: "allow",
      });
    } catch (error: any) {
      if (error?.code !== "23505") {
        throw error;
      }
    }
  };

  const deletePermissionByKey = async (key: string) => {
    const [permiso] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);

    if (!permiso) return;

    await db.delete(rolePermissions).where(eq(rolePermissions.permissionId, permiso.id));
    await db.delete(userPermissionsOverride).where(eq(userPermissionsOverride.permissionId, permiso.id));
    await db.delete(permissions).where(eq(permissions.id, permiso.id));
  };

  // ============================================
  // AUTH ENDPOINTS - Autenticación con celular y contraseña
  // ============================================

  // Login - Iniciar sesión con celular y contraseña
  app.post("/api/auth/login", async (req, res) => {
    try {
      debugLog("🔐 [LOGIN] Intento de login recibido");
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ error: "Celular y contraseña son requeridos" });
      }

      // Buscar usuario por celular
      const user = await findUserByPhone(phone);

      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: "Usuario no tiene contraseña configurada" });
      }

      // Verificar contraseña
      const isValidPassword = await verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Actualizar último login
      await updateLastLogin(user.id);

      // Generar token JWT
      const token = generateToken(user.id);

      // Obtener permisos del usuario
      const permissions = await getUserPermissions(user.id);

      // Asegurar que los headers CORS estén configurados antes de enviar la respuesta
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      res.json({
        token,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
        },
        permissions,
      });
    } catch (error) {
      console.error("❌ [LOGIN] Error en login:", error);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  // Logout - Cerrar sesión
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    // Con JWT, el logout es principalmente del lado del cliente
    // El token se elimina del localStorage en el frontend
    res.json({ success: true });
  });

  // Obtener usuario actual con permisos
  app.get("/api/auth/me", optionalAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const userId = req.user.id;
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const permissions = await getUserPermissions(userId);

      res.json({
        user: {
          id: user[0].id,
          phone: user[0].phone,
          email: user[0].email,
          firstName: user[0].firstName,
          lastName: user[0].lastName,
          roleId: user[0].roleId,
        },
        permissions,
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Error al obtener usuario" });
    }
  });

  // Endpoint legacy para compatibilidad
  app.get("/api/auth/user", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({
        id: user[0].id,
        phone: user[0].phone,
        email: user[0].email,
        firstName: user[0].firstName,
        lastName: user[0].lastName,
        roleId: user[0].roleId,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Endpoint para obtener permisos del usuario actual
  app.get("/api/user/permissions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const permissions = await getUserPermissions(userId);
      res.json({ permissions });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // Minas routes - ahora devuelve balance calculado para mejor rendimiento
  app.get("/api/minas", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const isUseMode = req.query.mode === "use";

      if (isUseMode) {
        const userOverrides = await db
          .select({
            permissionKey: permissions.key,
            overrideType: userPermissionsOverride.overrideType,
          })
          .from(userPermissionsOverride)
          .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
          .where(eq(userPermissionsOverride.userId, userId));

        const deniedPermissions = new Set(
          userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
        );
        const permissionExistsCache = new Map<string, boolean>();

        const allMinas = await storage.getMinas();
        const minasPermitidas = await filterEntitiesByUsePermission({
          entities: allMinas,
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          getPermissionKey: (mina) => `action.TRANSACCIONES.mina.${mina.id}.use`,
        });

        return res.json(minasPermitidas);
      }

      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      // Si el usuario tiene permisos de transacciones, devolver TODAS las minas
      // (sin filtrar por userId) para que pueda seleccionarlas en transacciones
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      const minas = hasTransactionPermissions 
        ? await storage.getMinas() // Sin userId = todas las minas
        : await storage.getMinas(userId); // Con userId = solo las del usuario
      const minasPermitidas = await filterEntitiesByUsePermission({
        entities: minas,
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        getPermissionKey: (mina) => buildViewPermissionKey("mina", mina.id),
      });
      res.json(minasPermitidas);
    } catch (error: any) {
      console.error("Error fetching minas:", error.message);
      console.error("Error code:", error.code);
      console.error("Error stack:", error.stack);
      // Si es error de conexión a BD, retornar array vacío en lugar de error 500
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible, retornando array vacío");
        res.json([]);
      } else {
        console.error("Error completo:", error);
        res.status(500).json({ error: "Failed to fetch minas", details: error.message });
      }
    }
  });

  // Endpoint para recalcular todos los balances (útil después de migración o para mantenimiento)
  app.post(
    "/api/balances/recalculate",
    requireAuth,
    async (req, res) => {
      try {
        debugLog("🔄 Iniciando recálculo manual de balances desde endpoint...");
        await storage.recalculateAllBalances();
        res.json({
          success: true,
          message: "Todos los balances han sido recalculados exitosamente",
        });
      } catch (error) {
        console.error("Error recalculando balances:", error);
        res.status(500).json({ error: "Failed to recalculate balances" });
      }
    },
  );

  // Endpoints optimizados para balances agregados (evitan cargar todos los viajes)
  app.get("/api/balances/minas", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const canViewListBalances = userPermissions.includes("module.MINAS.list.BALANCES.view");
      if (!canViewListBalances) {
        return res.json({});
      }
      const balances = await storage.getMinasBalances(userId);
      res.json(balances);
    } catch (error: any) {
      console.error("Error fetching minas balances:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible, retornando objeto vacío");
        res.json({});
      } else {
        res.status(500).json({ error: "Failed to fetch minas balances" });
      }
    }
  });

  app.get("/api/balances/compradores", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const canViewListBalances = userPermissions.includes("module.COMPRADORES.list.BALANCES.view");
      if (!canViewListBalances) {
        return res.json({});
      }
      const balances = await storage.getCompradoresBalances(userId);
      res.json(balances);
    } catch (error: any) {
      console.error("Error fetching compradores balances:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible, retornando objeto vacío");
        res.json({});
      } else {
        res.status(500).json({ error: "Failed to fetch compradores balances" });
      }
    }
  });

  app.get("/api/balances/volqueteros", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const canViewListBalances = userPermissions.includes("module.VOLQUETEROS.list.BALANCES.view");
      if (!canViewListBalances) {
        return res.json({});
      }
      debugLog(`🔍 [ROUTE] /api/balances/volqueteros - INICIANDO (userId: ${userId})`);
      const balances = await storage.getVolqueterosBalances(userId);
      debugLog(`🔍 [ROUTE] /api/balances/volqueteros - COMPLETADO (${Object.keys(balances).length} volqueteros con balance)`);
      res.json(balances);
    } catch (error: any) {
      console.error("❌ [ROUTE] Error fetching volqueteros balances:", error.message);
      console.error("❌ [ROUTE] Error stack:", error.stack);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible, retornando objeto vacío");
        res.json({});
      } else {
        res.status(500).json({ error: "Failed to fetch volqueteros balances" });
      }
    }
  });

  app.get("/api/balances/rodmar", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const balances = await storage.getRodMarBalances(userId);
      res.json(balances);
    } catch (error: any) {
      console.error("Error fetching RodMar balances:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible, retornando objeto vacío");
        res.json({});
      } else {
        res.status(500).json({ error: "Failed to fetch RodMar balances" });
      }
    }
  });

  // Endpoint optimizado para listado de volqueteros con placas/conteos (sin cargar todos los viajes en Node)
  // IMPORTANTE: Debe ir ANTES de /api/volqueteros para evitar conflictos de rutas
  app.get(
    "/api/volqueteros/resumen",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const userPermissions = await getUserPermissions(userId);

        const userOverrides = await db
          .select({
            permissionKey: permissions.key,
            overrideType: userPermissionsOverride.overrideType,
          })
          .from(userPermissionsOverride)
          .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
          .where(eq(userPermissionsOverride.userId, userId));

        const deniedPermissions = new Set(
          userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
        );
        const permissionExistsCache = new Map<string, boolean>();

        const hasTransactionPermissions =
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");

        const volqueterosSource = hasTransactionPermissions
          ? await storage.getVolqueteros()
          : await storage.getVolqueteros(userId);

        const volqueterosPermitidos = await filterEntitiesByUsePermission({
          entities: volqueterosSource,
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          getPermissionKey: (v) => buildViewPermissionKey("volquetero", v.id),
        });

        // Agregar conteos por placa/tipoCarro desde DB (solo viajes completados con fechaDescargue)
        const placaRows = await db
          .select({
            volqueteroId: volqueterosTable.id,
            placa: viajes.placa,
            tipoCarro: viajes.tipoCarro,
            count: sql<number>`count(*)::int`,
          })
          .from(viajes)
          .innerJoin(
            volqueterosTable,
            sql`LOWER(CAST(${volqueterosTable.nombre} AS TEXT)) = LOWER(CAST(${viajes.conductor} AS TEXT))`,
          )
          .where(
            and(
              eq(viajes.estado, "completado"),
              sql`${viajes.fechaDescargue} IS NOT NULL`,
              hasTransactionPermissions ? sql`TRUE` : eq(viajes.userId, userId),
            ),
          )
          .groupBy(volqueterosTable.id, viajes.placa, viajes.tipoCarro);

        const placasByVolqId = new Map<
          number,
          Array<{ placa: string; tipoCarro: string; viajesCount: number }>
        >();

        for (const row of placaRows) {
          const volqId = row.volqueteroId;
          const placa = row.placa || "Sin placa";
          const tipoCarro = row.tipoCarro || "Sin especificar";
          const viajesCount = row.count || 0;

          const arr = placasByVolqId.get(volqId) || [];
          arr.push({ placa, tipoCarro, viajesCount });
          placasByVolqId.set(volqId, arr);
        }

        const result = (volqueterosPermitidos as any[]).map((v) => {
          const placas = placasByVolqId.get(v.id) || [];

          // Asegurar que al menos exista la placa principal del registro si no hay viajes
          if (placas.length === 0 && v.placa) {
            placas.push({ placa: v.placa, tipoCarro: "Sin especificar", viajesCount: 0 });
          }

          // Si existe placa en tabla y no está en el agregado, agregarla (conteo 0)
          if (v.placa && !placas.some((p) => p.placa === v.placa)) {
            placas.push({ placa: v.placa, tipoCarro: "Sin especificar", viajesCount: 0 });
          }

          const viajesCount = placas.reduce((sum, p) => sum + (p.viajesCount || 0), 0);
          const saldo = v.saldo === null || v.saldo === undefined ? "0" : String(v.saldo);

          return {
            id: v.id,
            nombre: v.nombre,
            placas,
            viajesCount,
            saldo,
          };
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error in /api/volqueteros/resumen:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch volqueteros resumen" });
      }
    },
  );

  // Endpoint optimizado para resumen de minas con datos pre-calculados
  // IMPORTANTE: Debe ir ANTES de /api/minas/:id para evitar conflictos de rutas
  app.get(
    "/api/minas/resumen",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const resumen = await storage.getMinasResumen(userId);
        console.log(
          `=== Endpoint /api/minas/resumen - Returning ${resumen.length} minas with pre-calculated data ===`,
        );
        res.json(resumen);
      } catch (error) {
        console.error("Error in /api/minas/resumen:", error);
        res.status(500).json({ error: "Failed to fetch minas resumen" });
      }
    },
  );

  app.get("/api/minas/:id", requireAuth, async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "mina",
        id: minaId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver esta mina",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      const mina = await storage.getMina(minaId);
      if (!mina) {
        return res.status(404).json({ error: "Mina not found" });
      }
      res.json(mina);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mina" });
    }
  });

  app.post("/api/minas", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertMinaSchema.parse(req.body);
      const mina = await storage.createMina({ ...data, userId });
      try {
        const useKey = `action.TRANSACCIONES.mina.${mina.id}.use`;
        const permissionId = await ensurePermission({
          key: useKey,
          descripcion: `Usar mina: ${mina.nombre}`,
          categoria: "action",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(useKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso use para mina:", permError);
      }
      try {
        const viewKey = `module.MINAS.mina.${mina.id}.view`;
        const permissionId = await ensurePermission({
          key: viewKey,
          descripcion: `Ver mina: ${mina.nombre}`,
          categoria: "entity",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(viewKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso view para mina:", permError);
      }
      res.json(mina);
    } catch (error: any) {
      console.error("Error creating mina:", error.message);
      console.error("Error code:", error.code);
      console.error("Error stack:", error.stack);
      
      // Si es error de conexión a BD, retornar error 503 (Service Unavailable)
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        console.warn("⚠️  Base de datos no disponible al crear mina");
        res.status(503).json({ 
          error: "Base de datos no disponible", 
          details: "No se pudo conectar a la base de datos. El proyecto de Supabase puede estar pausado o las credenciales son incorrectas." 
        });
      } else if (error.name === 'ZodError' || error.message?.includes('parse')) {
        // Error de validación
        res.status(400).json({ error: "Invalid mina data", details: error.message });
      } else {
        // Otro error
        res.status(500).json({ error: "Failed to create mina", details: error.message });
      }
    }
  });

  // Endpoint para recalcular balance de una mina específica
  app.post("/api/minas/:id/recalculate-balance", async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
      }

      await storage.calculateAndUpdateMinaBalance(minaId);

      res.json({
        success: true,
        message: `Balance recalculado para mina ${minaId}`,
      });
    } catch (error) {
      console.error("Error recalculating mina balance:", error);
      res.status(500).json({ error: "Failed to recalculate balance" });
    }
  });

  // Endpoint para recalcular balances de todas las minas
  app.post("/api/minas/recalculate-all-balances", async (req, res) => {
    try {
      const minas = await storage.getMinas();
      let updated = 0;

      for (const mina of minas) {
        await storage.calculateAndUpdateMinaBalance(mina.id);
        updated++;
      }

      res.json({
        success: true,
        message: `Balances recalculados para ${updated} minas`,
        updated,
      });
    } catch (error) {
      console.error("Error recalculating all mina balances:", error);
      res.status(500).json({ error: "Failed to recalculate all balances" });
    }
  });

  app.get("/api/minas/:id/viajes", requireAuth, async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "mina",
        id: minaId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver esta mina",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      const includeHidden = req.query.includeHidden === 'true';
      const viajes = await storage.getViajesByMina(minaId);
      
      // Si includeHidden es false, filtrar viajes ocultos (comportamiento por defecto)
      const viajesFiltrados = includeHidden 
        ? viajes 
        : viajes.filter(v => !v.oculta);
      
      res.json(viajesFiltrados);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viajes for mina" });
    }
  });

  app.get("/api/minas/:id/transacciones", requireAuth, async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "mina",
        id: minaId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver esta mina",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      const transacciones = await storage.getTransaccionesBySocio(
        "mina",
        minaId,
      );
      res.json(transacciones);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transacciones for mina" });
    }
  });

  // Delete mina (only if no viajes or transacciones)
  app.delete(
    "/api/minas/:id",
    requireAuth,
    async (req, res) => {
      try {
        const minaId = parseInt(req.params.id);

        console.log(
          `=== DELETE MINA REQUEST - ID: ${minaId} ===`,
        );

        // Verificar primero si la mina existe (sin filtrar por userId)
        const mina = await storage.getMinaById(minaId);
        if (!mina) {
          debugLog(`=== Mina ${minaId} not found ===`);
          return res.status(404).json({ error: "Mina no encontrada" });
        }

        // Check if mina has viajes (sin filtrar por userId - similar a compradores)
        // Solo contar viajes NO ocultos
        const viajes = await storage.getViajesByMina(minaId);
        const viajesVisibles = viajes.filter(v => !v.oculta);
        if (viajesVisibles.length > 0) {
          return res.status(400).json({
            error: "No se puede eliminar la mina porque tiene viajes asociados",
          });
        }

        // Check if mina has transacciones (sin filtrar por userId - similar a compradores)
        // Nota: El ocultamiento de transacciones ahora es local en el frontend
        const transacciones = await storage.getTransaccionesBySocio(
          "mina",
          minaId,
        );
        if (transacciones.length > 0) {
          return res.status(400).json({
            error:
              "No se puede eliminar la mina porque tiene transacciones asociadas",
          });
        }

        // Eliminar sin filtrar por userId (similar a compradores)
        const deleteResult = await storage.deleteMina(minaId);

        if (deleteResult) {
          try {
            await deletePermissionByKey(`action.TRANSACCIONES.mina.${minaId}.use`);
            await deletePermissionByKey(`module.MINAS.mina.${minaId}.view`);
          } catch (permError) {
            console.warn("⚠️  No se pudo eliminar permiso use de mina:", permError);
          }
          res.json({ message: "Mina eliminada exitosamente" });
        } else {
          res.status(500).json({ error: "Error al eliminar la mina" });
        }
      } catch (error) {
        console.error("Error deleting mina:", error);
        res.status(500).json({ error: "Failed to delete mina" });
      }
    },
  );

  // Endpoint para editar nombre de mina
  app.patch(
    "/api/minas/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const minaId = parseInt(req.params.id);
        if (isNaN(minaId)) {
          return res.status(400).json({ error: "Invalid mina ID" });
        }

        const data = updateMinaNombreSchema.parse(req.body);
        const updatedMina = await storage.updateMinaNombre(
          minaId,
          data.nombre,
          userId,
        );

        if (!updatedMina) {
          return res
            .status(404)
            .json({ error: "Mina not found or access denied" });
        }

      try {
        const useKey = `action.TRANSACCIONES.mina.${minaId}.use`;
        await ensurePermission({
          key: useKey,
          descripcion: `Usar mina: ${data.nombre}`,
          categoria: "action",
        });
        await updatePermissionDescription(useKey, `Usar mina: ${data.nombre}`);
        const viewKey = `module.MINAS.mina.${minaId}.view`;
        await ensurePermission({
          key: viewKey,
          descripcion: `Ver mina: ${data.nombre}`,
          categoria: "entity",
        });
        await updatePermissionDescription(viewKey, `Ver mina: ${data.nombre}`);
      } catch (permError) {
        console.warn("⚠️  No se pudo actualizar permiso use de mina:", permError);
      }

        res.json(updatedMina);
      } catch (error) {
        console.error("Error updating mina nombre:", error);
        if (error instanceof Error && error.message.includes("parse")) {
          res.status(400).json({ error: "Invalid data format" });
        } else {
          res.status(500).json({ error: "Failed to update mina nombre" });
        }
      }
    },
  );

  // Compradores routes
  app.get(
    "/api/compradores",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const userPermissions = await getUserPermissions(userId);
        const isUseMode = req.query.mode === "use";

        if (isUseMode) {
          const userOverrides = await db
            .select({
              permissionKey: permissions.key,
              overrideType: userPermissionsOverride.overrideType,
            })
            .from(userPermissionsOverride)
            .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
            .where(eq(userPermissionsOverride.userId, userId));

          const deniedPermissions = new Set(
            userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
          );
          const permissionExistsCache = new Map<string, boolean>();

          const allCompradores = await storage.getCompradores();
          const compradoresPermitidos = await filterEntitiesByUsePermission({
            entities: allCompradores,
            userPermissions,
            deniedPermissions,
            permissionExistsCache,
            getPermissionKey: (comprador) => `action.TRANSACCIONES.comprador.${comprador.id}.use`,
          });

          return res.json(compradoresPermitidos);
        }

        const userOverrides = await db
          .select({
            permissionKey: permissions.key,
            overrideType: userPermissionsOverride.overrideType,
          })
          .from(userPermissionsOverride)
          .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
          .where(eq(userPermissionsOverride.userId, userId));

        const deniedPermissions = new Set(
          userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
        );
        const permissionExistsCache = new Map<string, boolean>();

        // Si el usuario tiene permisos de transacciones, devolver TODOS los compradores
        // (sin filtrar por userId) para que pueda seleccionarlos en transacciones
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        const compradores = hasTransactionPermissions 
          ? await storage.getCompradores() // Sin userId = todos los compradores
          : await storage.getCompradores(userId); // Con userId = solo los del usuario
        const compradoresPermitidos = await filterEntitiesByUsePermission({
          entities: compradores,
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          getPermissionKey: (comprador) => buildViewPermissionKey("comprador", comprador.id),
        });
        res.json(compradoresPermitidos);
      } catch (error: any) {
        console.error("Error fetching compradores:", error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
            error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
            error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
            error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
          console.warn("⚠️  Base de datos no disponible, retornando array vacío");
          res.json([]);
        } else {
          res.status(500).json({ error: "Failed to fetch compradores" });
        }
      }
    },
  );

  app.get("/api/compradores/:id", requireAuth, async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "comprador",
        id: compradorId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este comprador",
          requiredPermission: viewCheck.requiredPermission,
        });
      }

      const comprador = await storage.getComprador(compradorId);
      if (!comprador) {
        return res.status(404).json({ error: "Comprador not found" });
      }

      res.json(comprador);
    } catch (error: any) {
      console.error("Error fetching comprador:", error);
      res.status(500).json({ error: "Failed to fetch comprador" });
    }
  });

  app.post("/api/compradores", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertCompradorSchema.parse(req.body);
      const comprador = await storage.createComprador({ ...data, userId });
      try {
        const useKey = `action.TRANSACCIONES.comprador.${comprador.id}.use`;
        const permissionId = await ensurePermission({
          key: useKey,
          descripcion: `Usar comprador: ${comprador.nombre}`,
          categoria: "action",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(useKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso use para comprador:", permError);
      }
      try {
        const viewKey = `module.COMPRADORES.comprador.${comprador.id}.view`;
        const permissionId = await ensurePermission({
          key: viewKey,
          descripcion: `Ver comprador: ${comprador.nombre}`,
          categoria: "entity",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(viewKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso view para comprador:", permError);
      }
      res.json(comprador);
    } catch (error: any) {
      console.error("Error creating comprador:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        res.status(503).json({ 
          error: "Base de datos no disponible", 
          details: "No se pudo conectar a la base de datos. El proyecto de Supabase puede estar pausado o las credenciales son incorrectas." 
        });
      } else if (error.name === 'ZodError' || error.message?.includes('parse')) {
        res.status(400).json({ error: "Invalid comprador data", details: error.message });
      } else {
        res.status(500).json({ error: "Failed to create comprador", details: error.message });
      }
    }
  });

  app.get("/api/compradores/:id/viajes", requireAuth, async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "comprador",
        id: compradorId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este comprador",
          requiredPermission: viewCheck.requiredPermission,
        });
      }

      const viajes = await storage.getViajesByComprador(compradorId);
      res.json(viajes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viajes for comprador" });
    }
  });

  // Get viajes by comprador (alternative route)
  app.get("/api/viajes/comprador/:compradorId", requireAuth, async (req, res) => {
    try {
      const compradorId = parseInt(req.params.compradorId);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "comprador",
        id: compradorId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este comprador",
          requiredPermission: viewCheck.requiredPermission,
        });
      }

      const includeHidden = req.query.includeHidden === 'true';
      const viajes = await storage.getViajesByComprador(compradorId);

      // Si includeHidden es false, filtrar viajes ocultos (comportamiento por defecto)
      const viajesFiltrados = includeHidden 
        ? viajes 
        : viajes.filter(v => !v.oculta);

      // Debug específico para comprador 97
      if (compradorId === 97) {
        debugLog("🔍 DEBUG COMPRADOR 97 - Total viajes:", viajes.length);
        const g24 = viajes.find((v) => v.id === "G24");
        if (g24) {
          debugLog("🔍 DEBUG G24:", {
            id: g24.id,
            valorConsignar: g24.valorConsignar,
            totalVenta: g24.totalVenta,
            totalFlete: g24.totalFlete,
            quienPagaFlete: g24.quienPagaFlete,
          });
        } else {
          debugLog("🔍 DEBUG: G24 not found for comprador 97");
        }
      }

      res.json(viajesFiltrados);
    } catch (error: any) {
      console.error("Error fetching viajes by comprador:", error);
      res.status(500).json({ error: "Failed to fetch viajes for comprador" });
    }
  });

  app.get("/api/compradores/:id/transacciones", requireAuth, async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
      }

      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "comprador",
        id: compradorId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este comprador",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      const transacciones = await storage.getTransaccionesBySocio(
        "comprador",
        compradorId,
      );
      res.json(transacciones);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch transacciones for comprador" });
    }
  });

  // Terceros routes
  app.get("/api/terceros", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const isUseMode = req.query.mode === "use";

      if (!isUseMode && !userPermissions.includes("module.RODMAR.tab.TERCEROS.view")) {
        return res.status(403).json({
          error: "No tienes permiso para ver esta sección",
          requiredPermission: "module.RODMAR.tab.TERCEROS.view",
        });
      }

      // Overrides del usuario para denegar terceros específicos
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const terceros = await storage.getTerceros();
      let tercerosPermitidos = terceros;

      if (isUseMode) {
        const permissionExistsCache = new Map<string, boolean>();
        tercerosPermitidos = await filterEntitiesByUsePermission({
          entities: terceros,
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          getPermissionKey: (tercero) => `action.TRANSACCIONES.tercero.${tercero.id}.use`,
        });
      } else {
        tercerosPermitidos = terceros.filter((tercero) => {
          const permisoKey = getTerceroPermissionKey(tercero.id);
          if (deniedPermissions.has(permisoKey)) return false;
          return userPermissions.includes(permisoKey);
        });
      }
      
      // Obtener todas las transacciones para calcular balances dinámicamente
      const transacciones = await storage.getTransacciones();
      
      // Calcular balance de cada tercero desde las transacciones (similar a cuentas RodMar)
      const tercerosConBalance = tercerosPermitidos.map((tercero) => {
        let positivos = 0;
        let negativos = 0;

        // Filtrar transacciones que afectan este tercero específico
        transacciones.forEach((transaccion: any) => {
          const valor = parseFloat(transaccion.valor || "0");
          const terceroIdStr = tercero.id.toString();

          // Positivos: Transacciones desde tercero (RodMar le debe al tercero)
          if (
            transaccion.deQuienTipo === "tercero" &&
            transaccion.deQuienId === terceroIdStr
          ) {
            positivos += valor;
          }

          // Negativos: Transacciones hacia tercero (El tercero le debe a RodMar)
          if (
            transaccion.paraQuienTipo === "tercero" &&
            transaccion.paraQuienId === terceroIdStr
          ) {
            negativos += valor;
          }
        });

        const balance = positivos - negativos;

        return {
          ...tercero,
          balance, // Balance calculado dinámicamente
        };
      });

      res.json(tercerosConBalance);
    } catch (error: any) {
      console.error("Error fetching terceros:", error.message);
      res.status(500).json({ error: "Failed to fetch terceros" });
    }
  });

  app.get("/api/terceros/:id", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const userId = req.user!.id;
      const tercero = await storage.getTerceroById(terceroId);
      if (!tercero) {
        return res.status(404).json({ error: "Tercero not found" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const permisoKey = getTerceroPermissionKey(terceroId);
      if (deniedPermissions.has(permisoKey) || !userPermissions.includes(permisoKey)) {
        return res.status(403).json({
          error: "No tienes permiso para ver este tercero",
          requiredPermission: permisoKey,
        });
      }

      res.json(tercero);
    } catch (error: any) {
      console.error("Error fetching tercero:", error);
      res.status(500).json({ error: "Failed to fetch tercero" });
    }
  });

  app.post("/api/terceros", requireAuth, requirePermission("module.RODMAR.tab.TERCEROS.view"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = insertTerceroSchema.parse(req.body);
      const tercero = await storage.createTercero({ ...data, userId });

      // Crear permiso por tercero y asignarlo al ADMIN
      const permisoId = await createTerceroPermission(tercero.id, tercero.nombre);
      if (permisoId) {
        const permisoKey = getTerceroPermissionKey(tercero.id);
        await assignPermissionToAdminRole(permisoKey);

        // Asegurar acceso al creador (override allow)
        try {
          await db.insert(userPermissionsOverride).values({
            userId,
            permissionId: permisoId,
            overrideType: "allow",
          });
        } catch (error: any) {
          if (error?.code !== "23505") throw error;
        }
      }

      try {
        const useKey = `action.TRANSACCIONES.tercero.${tercero.id}.use`;
        const usePermissionId = await ensurePermission({
          key: useKey,
          descripcion: `Usar tercero: ${tercero.nombre}`,
          categoria: "action",
        });
        if (usePermissionId) {
          await assignPermissionToAdminRole(useKey);
          await assignAllowOverride(usePermissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso use para tercero:", permError);
      }

      res.json(tercero);
    } catch (error: any) {
      console.error("Error creating tercero:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        res.status(503).json({ 
          error: "Base de datos no disponible", 
          details: "No se pudo conectar a la base de datos." 
        });
      } else if (error.name === 'ZodError' || error.message?.includes('parse')) {
        res.status(400).json({ error: "Invalid tercero data", details: error.message });
      } else {
        res.status(500).json({ error: "Failed to create tercero", details: error.message });
      }
    }
  });

  app.patch("/api/terceros/:id/nombre", requireAuth, requirePermission("module.RODMAR.tab.TERCEROS.view"), async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const userId = req.user!.id;
      const data = updateTerceroNombreSchema.parse(req.body);
      const terceroExistente = await storage.getTerceroById(terceroId);
      if (!terceroExistente) {
        return res.status(404).json({ error: "Tercero not found" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const permisoKey = getTerceroPermissionKey(terceroId);
      if (deniedPermissions.has(permisoKey) || !userPermissions.includes(permisoKey)) {
        return res.status(403).json({
          error: "No tienes permiso para editar este tercero",
          requiredPermission: permisoKey,
        });
      }

      const tercero = await storage.updateTerceroNombre(terceroId, data.nombre);
      if (!tercero) {
        return res.status(404).json({ error: "Tercero not found" });
      }

      // Asegurar que el permiso exista y actualizar descripción
      const permisoId = await createTerceroPermission(terceroId, data.nombre);
      if (permisoId) {
        await db
          .update(permissions)
          .set({ descripcion: `Ver tercero: ${data.nombre}` })
          .where(eq(permissions.key, permisoKey));
      }

      try {
        const useKey = `action.TRANSACCIONES.tercero.${terceroId}.use`;
        await ensurePermission({
          key: useKey,
          descripcion: `Usar tercero: ${data.nombre}`,
          categoria: "action",
        });
        await updatePermissionDescription(useKey, `Usar tercero: ${data.nombre}`);
      } catch (permError) {
        console.warn("⚠️  No se pudo actualizar permiso use de tercero:", permError);
      }

      res.json(tercero);
    } catch (error: any) {
      console.error("Error updating tercero nombre:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid data", details: error.message });
      } else {
        res.status(500).json({ error: "Failed to update tercero nombre" });
      }
    }
  });

  app.delete("/api/terceros/:id", requireAuth, requirePermission("module.RODMAR.tab.TERCEROS.view"), async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const userId = req.user!.id;

      // Verificar primero si el tercero existe
      const tercero = await storage.getTerceroById(terceroId);
      if (!tercero) {
        return res.status(404).json({ error: "Tercero no encontrado" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const permisoKey = getTerceroPermissionKey(terceroId);
      if (deniedPermissions.has(permisoKey) || !userPermissions.includes(permisoKey)) {
        return res.status(403).json({
          error: "No tienes permiso para eliminar este tercero",
          requiredPermission: permisoKey,
        });
      }

      // Verificar si el tercero tiene transacciones asociadas
      const transacciones = await storage.getTransacciones();
      const terceroIdStr = terceroId.toString();
      
      const tieneTransacciones = transacciones.some((transaccion: any) => 
        (transaccion.deQuienTipo === "tercero" && transaccion.deQuienId === terceroIdStr) ||
        (transaccion.paraQuienTipo === "tercero" && transaccion.paraQuienId === terceroIdStr)
      );

      if (tieneTransacciones) {
        return res.status(400).json({
          error: "No se puede eliminar el tercero porque tiene transacciones asociadas",
        });
      }

      // Eliminar permisos y asignaciones antes de borrar
      try {
        await deletePermissionByKey(permisoKey);
        await deletePermissionByKey(`action.TRANSACCIONES.tercero.${terceroId}.use`);
      } catch (permError) {
        console.warn("⚠️  No se pudieron eliminar permisos de tercero:", permError);
      }

      // Si no tiene transacciones, proceder con la eliminación
      const deleted = await storage.deleteTercero(terceroId);

      if (!deleted) {
        return res.status(404).json({ error: "Tercero not found" });
      }

      res.json({ success: true, message: "Tercero eliminado exitosamente" });
    } catch (error: any) {
      console.error("Error deleting tercero:", error);
      res.status(500).json({ error: "Failed to delete tercero" });
    }
  });

  app.get("/api/terceros/:id/transacciones", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const userId = req.user!.id;
      const tercero = await storage.getTerceroById(terceroId);
      if (!tercero) {
        return res.status(404).json({ error: "Tercero not found" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const permisoKey = getTerceroPermissionKey(terceroId);
      if (deniedPermissions.has(permisoKey) || !userPermissions.includes(permisoKey)) {
        return res.status(403).json({
          error: "No tienes permiso para ver transacciones de este tercero",
          requiredPermission: permisoKey,
        });
      }

      const transacciones = await storage.getTransaccionesBySocio(
        "tercero",
        terceroId,
        undefined,
      );
      res.json(transacciones);
    } catch (error) {
      console.error("Error fetching transacciones for tercero:", error);
      res.status(500).json({ error: "Failed to fetch transacciones for tercero" });
    }
  });

  // === Préstamos (MVP: solo terceros) ===
  const parseAmount = (value: any) => {
    const num = typeof value === "string" ? parseFloat(value) : Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  };

  const parseDateOnly = (value: any) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string") {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) return date;
      }
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  const buildPeriodKey = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
  };

  const computeNextRunAt = (startDate: Date, dayOfMonth: number) => {
    const next = new Date(startDate);
    next.setHours(0, 0, 0, 0);
    next.setDate(dayOfMonth);
    if (next <= startDate) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  };

  const ensureTerceroAccess = async (req: any, res: any, terceroId: number) => {
    const userId = req.user!.id;
    const tercero = await storage.getTerceroById(terceroId);
    if (!tercero) {
      res.status(404).json({ error: "Tercero not found" });
      return null;
    }

    const userPermissions = await getUserPermissions(userId);
    const userOverrides = await db
      .select({
        permissionKey: permissions.key,
        overrideType: userPermissionsOverride.overrideType,
      })
      .from(userPermissionsOverride)
      .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
      .where(eq(userPermissionsOverride.userId, userId));

    const deniedPermissions = new Set(
      userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
    );

    const permisoKey = getTerceroPermissionKey(terceroId);
    if (deniedPermissions.has(permisoKey) || !userPermissions.includes(permisoKey)) {
      res.status(403).json({
        error: "No tienes permiso para ver este tercero",
        requiredPermission: permisoKey,
      });
      return null;
    }

    return { userId, tercero };
  };

  app.get("/api/terceros/:id/loans", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const loans = await db
        .select()
        .from(terceroLoans)
        .where(eq(terceroLoans.terceroId, terceroId));

      if (loans.length === 0) return res.json([]);

      const loanIds = loans.map((l) => l.id);
      const runs = await db
        .select()
        .from(terceroLoanInterestRuns)
        .where(inArray(terceroLoanInterestRuns.loanId, loanIds));

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(inArray(terceroLoanPaymentAllocations.loanId, loanIds));

      const runsByLoan = new Map<number, typeof runs>();
      runs.forEach((run) => {
        const list = runsByLoan.get(run.loanId) || [];
        list.push(run);
        runsByLoan.set(run.loanId, list);
      });

      const allocByLoan = new Map<number, typeof allocations>();
      allocations.forEach((alloc) => {
        const list = allocByLoan.get(alloc.loanId) || [];
        list.push(alloc);
        allocByLoan.set(alloc.loanId, list);
      });

      const response = loans.map((loan) => {
        const loanRuns = runsByLoan.get(loan.id) || [];
        const loanAllocs = allocByLoan.get(loan.id) || [];
        const interestGenerated = loanRuns.reduce((sum, r) => sum + parseAmount(r.interestAmount), 0);
        const appliedInterest = loanAllocs.reduce((sum, a) => sum + parseAmount(a.appliedInterest), 0);
        const appliedPrincipal = loanAllocs.reduce((sum, a) => sum + parseAmount(a.appliedPrincipal), 0);
        const principalInitial = parseAmount(loan.principalAmount);
        const interestPending = Math.max(interestGenerated - appliedInterest, 0);
        const principalPending = Math.max(principalInitial - appliedPrincipal, 0);
        return {
          ...loan,
          interestGenerated,
          appliedInterest,
          appliedPrincipal,
          interestPending,
          principalPending,
          totalDue: interestPending + principalPending,
        };
      });

      res.json(response);
    } catch (error: any) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ error: "Failed to fetch loans" });
    }
  });

  app.post("/api/terceros/:id/loans", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      if (isNaN(terceroId)) {
        return res.status(400).json({ error: "Invalid tercero ID" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const {
        name,
        principalTransactionId,
        ratePercent,
        dayOfMonth,
        direction,
        startDate,
        notes,
      } = req.body || {};

      if (!name || !principalTransactionId || !ratePercent || !dayOfMonth) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const day = parseInt(dayOfMonth);
      if (isNaN(day) || day < 1 || day > 28) {
        return res.status(400).json({ error: "dayOfMonth debe estar entre 1 y 28" });
      }

      const rateValue = parseFloat(ratePercent);
      if (!Number.isFinite(rateValue) || rateValue <= 0) {
        return res.status(400).json({ error: "ratePercent inválido" });
      }

      const [principalTx] = await db
        .select()
        .from(transacciones)
        .where(eq(transacciones.id, Number(principalTransactionId)))
        .limit(1);

      if (!principalTx) {
        return res.status(404).json({ error: "Transacción base no encontrada" });
      }

      const terceroIdStr = terceroId.toString();
      const matchesTercero =
        (principalTx.deQuienTipo === "tercero" && principalTx.deQuienId === terceroIdStr) ||
        (principalTx.paraQuienTipo === "tercero" && principalTx.paraQuienId === terceroIdStr);

      if (!matchesTercero) {
        return res.status(400).json({ error: "La transacción no pertenece a este tercero" });
      }

      const principalAmount = parseAmount(principalTx.valor);
      const start =
        parseDateOnly(startDate) ||
        (principalTx.fecha ? new Date(principalTx.fecha) : new Date());
      const nextRunAt = computeNextRunAt(start, day);
      const rate = rateValue / 100;

      const [created] = await db
        .insert(terceroLoans)
        .values({
          terceroId,
          name,
          principalTransactionId: Number(principalTransactionId),
          principalAmount: principalAmount.toFixed(2),
          rate: rate.toFixed(6),
          ratePeriod: "monthly",
          rateType: "simple",
          direction: direction === "receive" ? "receive" : "pay",
          dayOfMonth: day,
          startDate: start,
          nextRunAt,
          status: "active",
          notes,
          createdBy: access.userId,
        })
        .returning();

      res.json(created);
    } catch (error: any) {
      console.error("Error creating loan:", error);
      res.status(500).json({ error: "Failed to create loan" });
    }
  });

  app.get("/api/terceros/:id/loans/:loanId/history", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const events: any[] = [];
      const txIds: number[] = [];

      if (loan.principalTransactionId) {
        txIds.push(loan.principalTransactionId);
      }

      const runs = await db
        .select()
        .from(terceroLoanInterestRuns)
        .where(eq(terceroLoanInterestRuns.loanId, loanId));

      runs.forEach((r) => txIds.push(r.interestTransactionId));

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId));

      allocations.forEach((a) => txIds.push(a.paymentTransactionId));

      const transactions = txIds.length > 0
        ? await db.select().from(transacciones).where(inArray(transacciones.id, Array.from(new Set(txIds))))
        : [];

      const txMap = new Map<number, any>();
      transactions.forEach((tx) => txMap.set(tx.id, tx));

      const principalTx = txMap.get(loan.principalTransactionId);
      if (principalTx) {
        events.push({
          type: "principal",
          label: "Desembolso",
          amount: parseAmount(loan.principalAmount),
          transaction: principalTx,
          date: principalTx.fecha,
        });
      }

      runs.forEach((run) => {
        const tx = txMap.get(run.interestTransactionId);
        events.push({
          type: "interest",
          label: `Interés ${run.periodKey}`,
          amount: parseAmount(run.interestAmount),
          baseAmount: parseAmount(run.baseAmount),
          rate: parseAmount(run.rate),
          runId: run.id,
          interestTransactionId: run.interestTransactionId,
          transaction: tx,
          date: tx?.fecha || run.createdAt,
        });
      });

      allocations.forEach((alloc) => {
        const tx = txMap.get(alloc.paymentTransactionId);
        events.push({
          type: "payment",
          label: "Pago aplicado",
          amount: parseAmount(alloc.appliedInterest) + parseAmount(alloc.appliedPrincipal),
          appliedInterest: parseAmount(alloc.appliedInterest),
          appliedPrincipal: parseAmount(alloc.appliedPrincipal),
          paymentTransactionId: alloc.paymentTransactionId,
          transaction: tx,
          date: tx?.fecha || alloc.createdAt,
        });
      });

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json({ loan, events });
    } catch (error: any) {
      console.error("Error fetching loan history:", error);
      res.status(500).json({ error: "Failed to fetch loan history" });
    }
  });

  app.post("/api/terceros/:id/loans/:loanId/generate-interest", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }
      if (loan.status && loan.status !== "active") {
        return res.status(400).json({ error: "El préstamo está cerrado" });
      }

      const requestedDate = parseDateOnly(req.body?.periodDate);
      const periodDate = requestedDate || new Date();
      if (Number.isNaN(periodDate.getTime())) {
        return res.status(400).json({ error: "Fecha de interés inválida" });
      }
      const minDate = loan.resumeAt ? new Date(loan.resumeAt) : (loan.startDate ? new Date(loan.startDate) : null);
      if (minDate && periodDate < minDate) {
        return res.status(400).json({ error: "La fecha debe ser posterior al inicio de intereses" });
      }

      const periodKey = buildPeriodKey(periodDate);
      const existingRun = await db
        .select()
        .from(terceroLoanInterestRuns)
        .where(and(eq(terceroLoanInterestRuns.loanId, loanId), eq(terceroLoanInterestRuns.periodKey, periodKey)))
        .limit(1);

      if (existingRun.length > 0) {
        return res.status(400).json({ error: "Ya existe interés generado para este periodo" });
      }

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId));

      const appliedPrincipal = allocations.reduce((sum, a) => sum + parseAmount(a.appliedPrincipal), 0);
      const principalPending = Math.max(parseAmount(loan.principalAmount) - appliedPrincipal, 0);
      const rate = parseAmount(loan.rate);
      const interestAmount = Math.max(principalPending * rate, 0);

      if (interestAmount <= 0) {
        return res.status(400).json({ error: "No hay base para generar interés" });
      }

      const terceroIdStr = terceroId.toString();
      const interestValue = interestAmount.toFixed(2);
      const baseConcept = `Interés préstamo ${loan.name} (${periodKey})`;

      const interestTxPayload: any = {
        concepto: baseConcept,
        valor: interestValue,
        fecha: periodDate,
        formaPago: "Interés",
        comentario: `AUTO_INTEREST loanId=${loan.id}`,
        tipoTransaccion: "auto_interest",
        estado: "completada",
        userId: access.userId,
      };

      if (loan.direction === "pay") {
        interestTxPayload.deQuienTipo = "tercero";
        interestTxPayload.deQuienId = terceroIdStr;
        interestTxPayload.paraQuienTipo = "rodmar";
        interestTxPayload.paraQuienId = "interest";
      } else {
        interestTxPayload.deQuienTipo = "rodmar";
        interestTxPayload.deQuienId = "interest";
        interestTxPayload.paraQuienTipo = "tercero";
        interestTxPayload.paraQuienId = terceroIdStr;
      }

      const [interestTx] = await db
        .insert(transacciones)
        .values(interestTxPayload)
        .returning();

      const [run] = await db
        .insert(terceroLoanInterestRuns)
        .values({
          loanId,
          periodKey,
          interestTransactionId: interestTx.id,
          baseAmount: principalPending.toFixed(2),
          rate: loan.rate,
          interestAmount: interestValue,
          createdBy: access.userId,
        })
        .returning();

      res.json({ run, transaction: interestTx });
    } catch (error: any) {
      console.error("Error generating interest:", error);
      res.status(500).json({ error: "Failed to generate interest" });
    }
  });

  app.post("/api/terceros/:id/loans/:loanId/apply-payment", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const { paymentTransactionId, appliedInterest, appliedPrincipal } = req.body || {};
      if (!paymentTransactionId) {
        return res.status(400).json({ error: "paymentTransactionId requerido" });
      }

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }
      if (loan.status && loan.status !== "active") {
        return res.status(400).json({ error: "El préstamo está cerrado" });
      }

      const [paymentTx] = await db
        .select()
        .from(transacciones)
        .where(eq(transacciones.id, Number(paymentTransactionId)))
        .limit(1);

      if (!paymentTx) {
        return res.status(404).json({ error: "Transacción de pago no encontrada" });
      }

      const terceroIdStr = terceroId.toString();
      const matchesTercero =
        (paymentTx.deQuienTipo === "tercero" && paymentTx.deQuienId === terceroIdStr) ||
        (paymentTx.paraQuienTipo === "tercero" && paymentTx.paraQuienId === terceroIdStr);

      if (!matchesTercero) {
        return res.status(400).json({ error: "La transacción no pertenece a este tercero" });
      }

      const runs = await db
        .select()
        .from(terceroLoanInterestRuns)
        .where(eq(terceroLoanInterestRuns.loanId, loanId));

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId));

      const interestGenerated = runs.reduce((sum, r) => sum + parseAmount(r.interestAmount), 0);
      const appliedInterestTotal = allocations.reduce((sum, a) => sum + parseAmount(a.appliedInterest), 0);
      const appliedPrincipalTotal = allocations.reduce((sum, a) => sum + parseAmount(a.appliedPrincipal), 0);
      const interestPending = Math.max(interestGenerated - appliedInterestTotal, 0);
      const principalPending = Math.max(parseAmount(loan.principalAmount) - appliedPrincipalTotal, 0);

      const paymentAmount = parseAmount(paymentTx.valor);
      const requestedInterest = appliedInterest !== undefined ? parseAmount(appliedInterest) : null;
      const requestedPrincipal = appliedPrincipal !== undefined ? parseAmount(appliedPrincipal) : null;

      let finalInterest = 0;
      let finalPrincipal = 0;

      if (requestedInterest !== null || requestedPrincipal !== null) {
        finalInterest = Math.min(requestedInterest || 0, interestPending);
        finalPrincipal = Math.min(requestedPrincipal || 0, principalPending);
        if (finalInterest + finalPrincipal > paymentAmount) {
          return res.status(400).json({ error: "Asignación supera el valor del pago" });
        }
      } else {
        finalInterest = Math.min(paymentAmount, interestPending);
        finalPrincipal = Math.min(paymentAmount - finalInterest, principalPending);
      }

      if (finalInterest <= 0 && finalPrincipal <= 0) {
        return res.status(400).json({ error: "No hay saldo pendiente para aplicar" });
      }

      const [allocation] = await db
        .insert(terceroLoanPaymentAllocations)
        .values({
          loanId,
          paymentTransactionId: Number(paymentTransactionId),
          appliedInterest: finalInterest.toFixed(2),
          appliedPrincipal: finalPrincipal.toFixed(2),
          createdBy: access.userId,
        })
        .returning();

      res.json({ allocation });
    } catch (error: any) {
      console.error("Error applying payment:", error);
      res.status(500).json({ error: "Failed to apply payment" });
    }
  });

  app.patch("/api/terceros/:id/loans/:loanId/close", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const [updated] = await db
        .update(terceroLoans)
        .set({ status: "closed", pausedAt: new Date() })
        .where(eq(terceroLoans.id, loanId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error closing loan:", error);
      res.status(500).json({ error: "Failed to close loan" });
    }
  });

  app.delete("/api/terceros/:id/loans/:loanId", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const runs = await db
        .select({ id: terceroLoanInterestRuns.id })
        .from(terceroLoanInterestRuns)
        .where(eq(terceroLoanInterestRuns.loanId, loanId))
        .limit(1);

      if (runs.length > 0) {
        return res.status(400).json({ error: "No se puede eliminar: ya tiene intereses generados" });
      }

      const allocations = await db
        .select({ id: terceroLoanPaymentAllocations.id })
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId))
        .limit(1);

      if (allocations.length > 0) {
        return res.status(400).json({ error: "No se puede eliminar: ya tiene pagos aplicados" });
      }

      await db.delete(terceroLoans).where(eq(terceroLoans.id, loanId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting loan:", error);
      res.status(500).json({ error: "Failed to delete loan" });
    }
  });

  app.patch("/api/terceros/:id/loans/:loanId/reopen", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const resumeDate = parseDateOnly(req.body?.resumeDate) || new Date();
      if (Number.isNaN(resumeDate.getTime())) {
        return res.status(400).json({ error: "Fecha de reanudación inválida" });
      }

      const updates: any = {
        status: "active",
        resumeAt: resumeDate,
      };

      if (req.body?.ratePercent) {
        const rateValue = parseFloat(req.body.ratePercent);
        if (!Number.isFinite(rateValue) || rateValue <= 0) {
          return res.status(400).json({ error: "ratePercent inválido" });
        }
        updates.rate = (rateValue / 100).toFixed(6);
      }

      if (req.body?.dayOfMonth) {
        const day = parseInt(req.body.dayOfMonth);
        if (isNaN(day) || day < 1 || day > 28) {
          return res.status(400).json({ error: "dayOfMonth debe estar entre 1 y 28" });
        }
        updates.dayOfMonth = day;
      }

      const [updated] = await db
        .update(terceroLoans)
        .set(updates)
        .where(eq(terceroLoans.id, loanId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error reopening loan:", error);
      res.status(500).json({ error: "Failed to reopen loan" });
    }
  });

  app.post("/api/terceros/:id/loans/:loanId/reopen-stage", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      if (isNaN(terceroId) || isNaN(loanId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const resumeDate = parseDateOnly(req.body?.resumeDate) || new Date();
      if (Number.isNaN(resumeDate.getTime())) {
        return res.status(400).json({ error: "Fecha de reanudación inválida" });
      }

      const day = req.body?.dayOfMonth ? parseInt(req.body.dayOfMonth) : loan.dayOfMonth;
      if (!day || day < 1 || day > 28) {
        return res.status(400).json({ error: "dayOfMonth debe estar entre 1 y 28" });
      }

      const ratePercent = req.body?.ratePercent ? parseFloat(req.body.ratePercent) : parseAmount(loan.rate) * 100;
      if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
        return res.status(400).json({ error: "ratePercent inválido" });
      }

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId));

      const appliedPrincipal = allocations.reduce((sum, a) => sum + parseAmount(a.appliedPrincipal), 0);
      const principalPending = Math.max(parseAmount(loan.principalAmount) - appliedPrincipal, 0);
      if (principalPending <= 0) {
        return res.status(400).json({ error: "No hay capital pendiente para reabrir en nueva etapa" });
      }

      await db
        .update(terceroLoans)
        .set({ status: "closed", pausedAt: resumeDate })
        .where(eq(terceroLoans.id, loanId));

      const name = (req.body?.name || "").trim() || `${loan.name} (Etapa ${buildPeriodKey(resumeDate)})`;
      const [created] = await db
        .insert(terceroLoans)
        .values({
          terceroId,
          name,
          principalTransactionId: loan.principalTransactionId,
          principalAmount: principalPending.toFixed(2),
          rate: (ratePercent / 100).toFixed(6),
          ratePeriod: "monthly",
          rateType: "simple",
          direction: loan.direction,
          dayOfMonth: day,
          startDate: resumeDate,
          nextRunAt: computeNextRunAt(resumeDate, day),
          status: "active",
          notes: loan.notes,
          createdBy: access.userId,
        })
        .returning();

      res.json(created);
    } catch (error: any) {
      console.error("Error reopening loan stage:", error);
      res.status(500).json({ error: "Failed to reopen loan stage" });
    }
  });

  app.delete("/api/terceros/:id/loans/:loanId/interest/:runId", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      const runId = parseInt(req.params.runId);
      if (isNaN(terceroId) || isNaN(loanId) || isNaN(runId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const [run] = await db
        .select()
        .from(terceroLoanInterestRuns)
        .where(and(eq(terceroLoanInterestRuns.id, runId), eq(terceroLoanInterestRuns.loanId, loanId)))
        .limit(1);

      if (!run) {
        return res.status(404).json({ error: "Interés no encontrado" });
      }

      const allocations = await db
        .select()
        .from(terceroLoanPaymentAllocations)
        .where(eq(terceroLoanPaymentAllocations.loanId, loanId));

      const appliedInterestTotal = allocations.reduce((sum, a) => sum + parseAmount(a.appliedInterest), 0);
      if (appliedInterestTotal > 0) {
        return res.status(400).json({
          error: "No se puede eliminar: hay pagos aplicados a intereses de este préstamo",
        });
      }

      await db
        .delete(terceroLoanInterestRuns)
        .where(eq(terceroLoanInterestRuns.id, runId));

      await db
        .delete(transacciones)
        .where(eq(transacciones.id, run.interestTransactionId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting interest run:", error);
      res.status(500).json({ error: "Failed to delete interest" });
    }
  });

  app.delete("/api/terceros/:id/loans/:loanId/payments/:paymentTransactionId", requireAuth, async (req, res) => {
    try {
      const terceroId = parseInt(req.params.id);
      const loanId = parseInt(req.params.loanId);
      const paymentTransactionId = parseInt(req.params.paymentTransactionId);
      if (isNaN(terceroId) || isNaN(loanId) || isNaN(paymentTransactionId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const access = await ensureTerceroAccess(req, res, terceroId);
      if (!access) return;

      const [loan] = await db
        .select()
        .from(terceroLoans)
        .where(and(eq(terceroLoans.id, loanId), eq(terceroLoans.terceroId, terceroId)))
        .limit(1);

      if (!loan) {
        return res.status(404).json({ error: "Préstamo no encontrado" });
      }

      const deleted = await db
        .delete(terceroLoanPaymentAllocations)
        .where(
          and(
            eq(terceroLoanPaymentAllocations.loanId, loanId),
            eq(terceroLoanPaymentAllocations.paymentTransactionId, paymentTransactionId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "No se encontró el pago aplicado" });
      }

      res.json({ success: true, deletedCount: deleted.length });
    } catch (error: any) {
      console.error("Error unlinking payment:", error);
      res.status(500).json({ error: "Failed to unlink payment" });
    }
  });

  // Delete comprador (only if no viajes or transacciones)
  app.delete(
    "/api/compradores/:id",
    requireAuth,
    async (req, res) => {
      try {
        const compradorId = parseInt(req.params.id);

        // Check if comprador has viajes
        const viajes = await storage.getViajesByComprador(compradorId);
        if (viajes.length > 0) {
          return res.status(400).json({
            error:
              "No se puede eliminar el comprador porque tiene viajes asociados",
          });
        }

        // Check if comprador has transacciones
        const transacciones = await storage.getTransaccionesBySocio(
          "comprador",
          compradorId,
        );
        if (transacciones.length > 0) {
          return res.status(400).json({
            error:
              "No se puede eliminar el comprador porque tiene transacciones asociadas",
          });
        }

        await storage.deleteComprador(compradorId);
        try {
          await deletePermissionByKey(`action.TRANSACCIONES.comprador.${compradorId}.use`);
          await deletePermissionByKey(`module.COMPRADORES.comprador.${compradorId}.view`);
        } catch (permError) {
          console.warn("⚠️  No se pudo eliminar permiso use de comprador:", permError);
        }
        res.json({ message: "Comprador eliminado exitosamente" });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete comprador" });
      }
    },
  );

  // Endpoint para editar nombre de comprador
  app.patch(
    "/api/compradores/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const compradorId = parseInt(req.params.id);
        if (isNaN(compradorId)) {
          return res.status(400).json({ error: "Invalid comprador ID" });
        }

        const data = updateCompradorNombreSchema.parse(req.body);
        const updatedComprador = await storage.updateCompradorNombre(
          compradorId,
          data.nombre,
          userId,
        );

        if (!updatedComprador) {
          return res
            .status(404)
            .json({ error: "Comprador not found or access denied" });
        }

        try {
          const useKey = `action.TRANSACCIONES.comprador.${compradorId}.use`;
          await ensurePermission({
            key: useKey,
            descripcion: `Usar comprador: ${data.nombre}`,
            categoria: "action",
          });
          await updatePermissionDescription(useKey, `Usar comprador: ${data.nombre}`);
          const viewKey = `module.COMPRADORES.comprador.${compradorId}.view`;
          await ensurePermission({
            key: viewKey,
            descripcion: `Ver comprador: ${data.nombre}`,
            categoria: "entity",
          });
          await updatePermissionDescription(viewKey, `Ver comprador: ${data.nombre}`);
        } catch (permError) {
          console.warn("⚠️  No se pudo actualizar permiso use de comprador:", permError);
        }

        res.json(updatedComprador);
      } catch (error) {
        console.error("Error updating comprador nombre:", error);
        if (error instanceof Error && error.message.includes("parse")) {
          res.status(400).json({ error: "Invalid data format" });
        } else {
          res.status(500).json({ error: "Failed to update comprador nombre" });
        }
      }
    },
  );

  // Volqueteros routes
  app.get(
    "/api/volqueteros",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const userPermissions = await getUserPermissions(userId);
        const isUseMode = req.query.mode === "use";

        if (isUseMode) {
          const userOverrides = await db
            .select({
              permissionKey: permissions.key,
              overrideType: userPermissionsOverride.overrideType,
            })
            .from(userPermissionsOverride)
            .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
            .where(eq(userPermissionsOverride.userId, userId));

          const deniedPermissions = new Set(
            userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
          );
          const permissionExistsCache = new Map<string, boolean>();

          const allVolqueteros = await storage.getVolqueteros();
          const volqueterosPermitidos = await filterEntitiesByUsePermission({
            entities: allVolqueteros,
            userPermissions,
            deniedPermissions,
            permissionExistsCache,
            getPermissionKey: (volquetero) => `action.TRANSACCIONES.volquetero.${volquetero.id}.use`,
          });

          return res.json(volqueterosPermitidos);
        }

        const userOverrides = await db
          .select({
            permissionKey: permissions.key,
            overrideType: userPermissionsOverride.overrideType,
          })
          .from(userPermissionsOverride)
          .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
          .where(eq(userPermissionsOverride.userId, userId));

        const deniedPermissions = new Set(
          userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
        );
        const permissionExistsCache = new Map<string, boolean>();
        
        // Si el usuario tiene permisos de transacciones, obtener TODOS los viajes
        // (sin filtrar por userId) para que pueda ver todos los volqueteros en transacciones
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        const viajes = hasTransactionPermissions 
          ? await storage.getViajes() // Sin userId = todos los viajes
          : await storage.getViajes(userId); // Con userId = solo los del usuario

        // Obtener volqueteros reales de la tabla para usar IDs correctos
        // Si tiene permisos de transacciones, obtener TODOS los volqueteros
        const volqueterosReales = hasTransactionPermissions
          ? await storage.getVolqueteros() // Sin userId = todos los volqueteros
          : await storage.getVolqueteros(userId); // Con userId = solo los del usuario
        const volqueterosPorNombre: Record<string, any> = {};
        volqueterosReales.forEach((v) => {
          volqueterosPorNombre[v.nombre.toLowerCase()] = v;
        });

        // Agrupar datos por conductor
        const conductoresPorNombre: Record<
          string,
          {
            id: number | null; // ID real de la tabla volqueteros
            nombre: string;
            placas: Record<
              string,
              {
                placa: string;
                tipoCarro: string;
                viajesCount: number;
              }
            >;
            totalViajes: number;
            saldo: string;
          }
        > = {};

        // Procesar viajes para agrupar por conductor y extraer placas
        // IMPORTANTE: Solo contar viajes completados con fechaDescargue para que el conteo
        // sea consistente con lo que se muestra en la pestaña de viajes
        viajes.forEach((viaje) => {
          if (viaje.conductor) {
            // Filtrar solo viajes completados con fechaDescargue (igual que en /api/volqueteros/:id/viajes)
            if (viaje.estado !== "completado" || !viaje.fechaDescargue) {
              return; // Saltar viajes no completados o sin fechaDescargue
            }
            
            const nombreLower = viaje.conductor.toLowerCase();
            const nombre = viaje.conductor;
            const volqueteroReal = volqueterosPorNombre[nombreLower];

            if (!conductoresPorNombre[nombreLower]) {
              conductoresPorNombre[nombreLower] = {
                id: volqueteroReal?.id || null, // ID real o null
                nombre: nombre,
                placas: {},
                totalViajes: 0,
                saldo: volqueteroReal?.saldo?.toString() || "0",
              };
            }

            const placa = viaje.placa || "Sin placa";
            const tipoCarro = viaje.tipoCarro || "Sin especificar";

            if (!conductoresPorNombre[nombreLower].placas[placa]) {
              conductoresPorNombre[nombreLower].placas[placa] = {
                placa: placa,
                tipoCarro: tipoCarro,
                viajesCount: 0,
              };
            }

            conductoresPorNombre[nombreLower].placas[placa].viajesCount++;
            conductoresPorNombre[nombreLower].totalViajes++;
          }
        });

        // Agregar volqueteros de la tabla que no tienen viajes asociados
        volqueterosReales.forEach((volquetero) => {
          const nombreLower = volquetero.nombre.toLowerCase();
          
          // Si el volquetero no está en conductoresPorNombre (no tiene viajes), agregarlo
          if (!conductoresPorNombre[nombreLower]) {
            conductoresPorNombre[nombreLower] = {
              id: volquetero.id,
              nombre: volquetero.nombre,
              placas: {
                [volquetero.placa]: {
                  placa: volquetero.placa,
                  tipoCarro: "Sin especificar", // Valor por defecto si no hay viajes
                  viajesCount: 0,
                },
              },
              totalViajes: 0,
              saldo: volquetero.saldo?.toString() || "0",
            };
          } else {
            // Si ya existe pero no tiene la placa del volquetero en la tabla, agregarla
            const placaEnTabla = volquetero.placa;
            if (!conductoresPorNombre[nombreLower].placas[placaEnTabla]) {
              conductoresPorNombre[nombreLower].placas[placaEnTabla] = {
                placa: placaEnTabla,
                tipoCarro: "Sin especificar",
                viajesCount: 0,
              };
            }
            // Asegurar que el ID real esté presente
            if (!conductoresPorNombre[nombreLower].id) {
              conductoresPorNombre[nombreLower].id = volquetero.id;
            }
            // Actualizar saldo si está disponible
            if (volquetero.saldo) {
              conductoresPorNombre[nombreLower].saldo = volquetero.saldo.toString();
            }
          }
        });

        // Convertir a array con IDs reales cuando estén disponibles
        let artificialIdCounter = 1000; // Empezar IDs artificiales desde 1000 para evitar conflictos
        const volqueterosConPlacas = Object.entries(conductoresPorNombre).map(
          ([nombreKey, data]) => ({
            id: data.id || artificialIdCounter++, // Usar ID real o asignar artificial alto
            nombre: data.nombre,
            placas: Object.values(data.placas),
            viajesCount: data.totalViajes,
            saldo: data.saldo,
            isRealId: data.id !== null, // Flag para identificar IDs reales vs artificiales
          }),
        );

        // Ordenar: volqueteros con IDs reales primero, luego artificiales
        volqueterosConPlacas.sort((a, b) => {
          if (a.isRealId && !b.isRealId) return -1;
          if (!a.isRealId && b.isRealId) return 1;
          return a.id - b.id;
        });

        debugLog("=== VOLQUETEROS ENDPOINT DEBUG ===");
        console.log(
          "Volqueteros con IDs reales:",
          volqueterosConPlacas
            .filter((v) => v.isRealId)
            .map((v) => `${v.nombre} (ID: ${v.id})`),
        );
        console.log(
          "Volqueteros con IDs artificiales:",
          volqueterosConPlacas
            .filter((v) => !v.isRealId)
            .map((v) => `${v.nombre} (ID: ${v.id})`),
        );

        const volqueterosPermitidos: typeof volqueterosConPlacas = [];
        for (const volquetero of volqueterosConPlacas) {
          if (!volquetero.isRealId) {
            volqueterosPermitidos.push(volquetero);
            continue;
          }

          const key = buildViewPermissionKey("volquetero", volquetero.id);
          if (!key) {
            volqueterosPermitidos.push(volquetero);
            continue;
          }

          const exists = await permissionExists(key, permissionExistsCache);
          if (!exists) {
            volqueterosPermitidos.push(volquetero);
            continue;
          }

          if (deniedPermissions.has(key)) {
            continue;
          }

          if (userPermissions.includes(key)) {
            volqueterosPermitidos.push(volquetero);
          }
        }

        res.json(volqueterosPermitidos);
      } catch (error: any) {
        console.error("Error fetching volqueteros:", error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
            error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
            error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
            error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
          console.warn("⚠️  Base de datos no disponible, retornando array vacío");
          res.json([]);
        } else {
          res.status(500).json({ error: "Failed to fetch volqueteros" });
        }
      }
    },
  );

  app.post("/api/volqueteros", requireAuth, async (req, res) => {
    try {
      const data = insertVolqueteroSchema.parse(req.body);
      const userId = req.user!.id;
      const volquetero = await storage.createVolquetero({
        ...data,
        userId,
      });
      try {
        const useKey = `action.TRANSACCIONES.volquetero.${volquetero.id}.use`;
        const permissionId = await ensurePermission({
          key: useKey,
          descripcion: `Usar volquetero: ${volquetero.nombre}`,
          categoria: "action",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(useKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso use para volquetero:", permError);
      }
      try {
        const viewKey = `module.VOLQUETEROS.volquetero.${volquetero.id}.view`;
        const permissionId = await ensurePermission({
          key: viewKey,
          descripcion: `Ver volquetero: ${volquetero.nombre}`,
          categoria: "entity",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(viewKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso view para volquetero:", permError);
      }
      res.json(volquetero);
    } catch (error: any) {
      console.error("Error creating volquetero:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
          error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
          error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
          error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
        res.status(503).json({ 
          error: "Base de datos no disponible", 
          details: "No se pudo conectar a la base de datos. El proyecto de Supabase puede estar pausado o las credenciales son incorrectas." 
        });
      } else if (error.name === 'ZodError' || error.message?.includes('parse')) {
        res.status(400).json({ error: "Invalid volquetero data", details: error.message });
      } else {
        res.status(500).json({ error: "Failed to create volquetero", details: error.message });
      }
    }
  });

  app.get("/api/volqueteros/:id/transacciones", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const volqueteroId = parseInt(req.params.id);
      if (isNaN(volqueteroId)) {
        return res.status(400).json({ error: "ID de volquetero inválido" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "volquetero",
        id: volqueteroId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este volquetero",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      // Usar getTransaccionesForModule con módulo 'volquetero' para filtrado correcto
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");

      // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
      const effectiveUserId = hasTransactionPermissions ? undefined : userId;

      const transacciones = await storage.getTransaccionesForModule(
        "volquetero",
        volqueteroId,
        effectiveUserId,
        false, // includeHidden
        'volquetero', // módulo correcto
      );
      res.json(transacciones);
    } catch (error: any) {
      console.error("Error fetching transacciones for volquetero:", error);
      console.error("Error details:", error.message, error.stack);
      res
        .status(500)
        .json({ error: "Failed to fetch transacciones for volquetero" });
    }
  });

  // Endpoint para obtener viajes de un volquetero específico (optimización)
  app.get("/api/volqueteros/:id/viajes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const volqueteroId = parseInt(req.params.id);
      
      if (isNaN(volqueteroId)) {
        return res.status(400).json({ error: "ID de volquetero inválido" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const viewCheck = await checkViewPermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: "volquetero",
        id: volqueteroId,
      });
      if (!viewCheck.allowed) {
        return res.status(viewCheck.status || 403).json({
          error: viewCheck.message || "No tienes permiso para ver este volquetero",
          requiredPermission: viewCheck.requiredPermission,
        });
      }
      
      // Si el usuario tiene permisos de transacciones, obtener TODOS los viajes
      // (sin filtrar por userId) para que pueda ver todos los viajes del volquetero
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Si el ID es >= 1000, es un ID artificial (no existe en la base de datos)
      // En este caso, debemos obtener el nombre desde la lista de volqueteros
      let volqueteroNombre: string | null = null;
      
      if (volqueteroId >= 1000) {
        // ID artificial: obtener desde la lista de volqueteros
        const viajes = hasTransactionPermissions 
          ? await storage.getViajes() // Sin userId = todos los viajes
          : await storage.getViajes(userId); // Con userId = solo los del usuario
        
        const volqueterosReales = hasTransactionPermissions
          ? await storage.getVolqueteros() // Sin userId = todos los volqueteros
          : await storage.getVolqueteros(userId); // Con userId = solo los del usuario
        const volqueterosPorNombre: Record<string, any> = {};
        volqueterosReales.forEach((v) => {
          volqueterosPorNombre[v.nombre.toLowerCase()] = v;
        });

        // Agrupar datos por conductor (mismo código que en GET /api/volqueteros)
        const conductoresPorNombre: Record<
          string,
          {
            id: number | null;
            nombre: string;
            placas: Record<string, any>;
            totalViajes: number;
            saldo: string;
          }
        > = {};

        viajes.forEach((viaje) => {
          if (viaje.conductor) {
            if (viaje.estado !== "completado" || !viaje.fechaDescargue) {
              return;
            }
            
            const nombreLower = viaje.conductor.toLowerCase();
            const nombre = viaje.conductor;
            const volqueteroReal = volqueterosPorNombre[nombreLower];

            if (!conductoresPorNombre[nombreLower]) {
              conductoresPorNombre[nombreLower] = {
                id: volqueteroReal?.id || null,
                nombre: nombre,
                placas: {},
                totalViajes: 0,
                saldo: volqueteroReal?.saldo?.toString() || "0",
              };
            }

            const placa = viaje.placa || "Sin placa";
            const tipoCarro = viaje.tipoCarro || "Sin especificar";

            if (!conductoresPorNombre[nombreLower].placas[placa]) {
              conductoresPorNombre[nombreLower].placas[placa] = {
                placa: placa,
                tipoCarro: tipoCarro,
                viajesCount: 0,
              };
            }

            conductoresPorNombre[nombreLower].placas[placa].viajesCount++;
            conductoresPorNombre[nombreLower].totalViajes++;
          }
        });

        // Agregar volqueteros de la tabla que no tienen viajes asociados
        volqueterosReales.forEach((volquetero) => {
          const nombreLower = volquetero.nombre.toLowerCase();
          
          if (!conductoresPorNombre[nombreLower]) {
            conductoresPorNombre[nombreLower] = {
              id: volquetero.id,
              nombre: volquetero.nombre,
              placas: {
                [volquetero.placa]: {
                  placa: volquetero.placa,
                  tipoCarro: "Sin especificar",
                  viajesCount: 0,
                },
              },
              totalViajes: 0,
              saldo: volquetero.saldo?.toString() || "0",
            };
          } else {
            const placaEnTabla = volquetero.placa;
            if (!conductoresPorNombre[nombreLower].placas[placaEnTabla]) {
              conductoresPorNombre[nombreLower].placas[placaEnTabla] = {
                placa: placaEnTabla,
                tipoCarro: "Sin especificar",
                viajesCount: 0,
              };
            }
            if (!conductoresPorNombre[nombreLower].id) {
              conductoresPorNombre[nombreLower].id = volquetero.id;
            }
            if (volquetero.saldo) {
              conductoresPorNombre[nombreLower].saldo = volquetero.saldo.toString();
            }
          }
        });

        // Convertir a array con IDs (igual que en GET /api/volqueteros)
        let artificialIdCounter = 1000;
        const volqueterosConPlacas = Object.entries(conductoresPorNombre).map(
          ([nombreKey, data]) => ({
            id: data.id || artificialIdCounter++,
            nombre: data.nombre,
            placas: Object.values(data.placas),
            viajesCount: data.totalViajes,
            saldo: data.saldo,
            isRealId: data.id !== null,
          }),
        );

        // Buscar el volquetero por ID en la lista generada
        const volqueteroEncontrado = volqueterosConPlacas.find(v => v.id === volqueteroId);
        if (volqueteroEncontrado) {
          volqueteroNombre = volqueteroEncontrado.nombre;
        }
      } else {
        // ID real: buscar en la base de datos
        const volquetero = hasTransactionPermissions
          ? await storage.getVolqueteroById(volqueteroId) // Sin userId = todos los volqueteros
          : await storage.getVolqueteroById(volqueteroId, userId); // Con userId = solo los del usuario
        
        if (!volquetero) {
          return res.status(404).json({ error: "Volquetero no encontrado" });
        }
        
        volqueteroNombre = volquetero.nombre;
      }
      
      if (!volqueteroNombre) {
        return res.status(404).json({ error: "Volquetero no encontrado" });
      }
      
      // Logging condicional para reducir overhead
      const DEBUG_VOLQUETEROS = process.env.DEBUG_VOLQUETEROS === 'true';
      if (DEBUG_VOLQUETEROS) {
        debugLog(`🔍 [GET /api/volqueteros/:id/viajes] Volquetero encontrado: ID=${volqueteroId}, nombre="${volqueteroNombre}"`);
      }
      
      const includeHidden = req.query.includeHidden === 'true';
      
      // Obtener viajes del volquetero por nombre del conductor
      // Si tiene permisos de transacciones, no filtrar por userId
      const viajes = hasTransactionPermissions
        ? await storage.getViajesByVolquetero(volqueteroNombre) // Sin userId = todos los viajes
        : await storage.getViajesByVolquetero(volqueteroNombre, userId); // Con userId = solo los del usuario
      
      if (DEBUG_VOLQUETEROS) {
        debugLog(`🔍 [GET /api/volqueteros/:id/viajes] Viajes encontrados: ${viajes.length} viajes con conductor="${volqueteroNombre}"`);
      }
      
      // Filtrar solo los completados (mostrar todos los viajes, independientemente de quién paga el flete)
      const viajesFiltrados = viajes.filter(v => 
        v.estado === "completado" && 
        v.fechaDescargue
      );
      
      if (DEBUG_VOLQUETEROS) {
        debugLog(`🔍 [GET /api/volqueteros/:id/viajes] Viajes completados con fechaDescargue: ${viajesFiltrados.length}`);
      }
      
      // Si includeHidden es false, filtrar viajes ocultos (comportamiento por defecto)
      const viajesFinales = includeHidden 
        ? viajesFiltrados 
        : viajesFiltrados.filter(v => !v.oculta);
      
      if (DEBUG_VOLQUETEROS) {
        debugLog(`🔍 [GET /api/volqueteros/:id/viajes] Viajes finales (includeHidden=${includeHidden}): ${viajesFinales.length}`);
      }
      if (viajesFinales.length === 0 && viajes.length > 0 && DEBUG_VOLQUETEROS) {
        debugLog(`⚠️ [GET /api/volqueteros/:id/viajes] ADVERTENCIA: Hay ${viajes.length} viajes pero ninguno pasó los filtros. Ejemplo:`, {
          primerViaje: viajes[0] ? {
            id: viajes[0].id,
            conductor: viajes[0].conductor,
            estado: viajes[0].estado,
            fechaDescargue: viajes[0].fechaDescargue,
            oculta: viajes[0].oculta
          } : null
        });
      }
      
      res.json(viajesFinales);
    } catch (error) {
      console.error("Error fetching viajes for volquetero:", error);
      res.status(500).json({ error: "Failed to fetch viajes for volquetero" });
    }
  });

  // Endpoint para editar nombre de volquetero
  app.patch(
    "/api/volqueteros/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const volqueteroId = parseInt(req.params.id);
        if (isNaN(volqueteroId)) {
          return res.status(400).json({ error: "Invalid volquetero ID" });
        }

        const data = updateVolqueteroNombreSchema.parse(req.body);
        const updatedVolquetero = await storage.updateVolqueteroNombre(
          volqueteroId,
          data.nombre,
          userId,
        );

        if (!updatedVolquetero) {
          return res
            .status(404)
            .json({ error: "Volquetero not found or access denied" });
        }

        try {
          const useKey = `action.TRANSACCIONES.volquetero.${volqueteroId}.use`;
          await ensurePermission({
            key: useKey,
            descripcion: `Usar volquetero: ${data.nombre}`,
            categoria: "action",
          });
          await updatePermissionDescription(useKey, `Usar volquetero: ${data.nombre}`);
          const viewKey = `module.VOLQUETEROS.volquetero.${volqueteroId}.view`;
          await ensurePermission({
            key: viewKey,
            descripcion: `Ver volquetero: ${data.nombre}`,
            categoria: "entity",
          });
          await updatePermissionDescription(viewKey, `Ver volquetero: ${data.nombre}`);
        } catch (permError) {
          console.warn("⚠️  No se pudo actualizar permiso use de volquetero:", permError);
        }

        res.json(updatedVolquetero);
      } catch (error) {
        console.error("Error updating volquetero nombre:", error);
        if (error instanceof Error && error.message.includes("parse")) {
          res.status(400).json({ error: "Invalid data format" });
        } else {
          res.status(500).json({ error: "Failed to update volquetero nombre" });
        }
      }
    },
  );

  // PUT endpoints for EditableTitle component
  app.put(
    "/api/minas/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const minaId = parseInt(req.params.id);
        if (isNaN(minaId)) {
          return res.status(400).json({ error: "Invalid mina ID" });
        }

        const { nombre } = req.body;
        if (!nombre || !nombre.trim()) {
          return res.status(400).json({ error: "Nombre is required" });
        }

        const updatedMina = await storage.updateMinaNombre(
          minaId,
          nombre.trim(),
          userId,
        );

        if (!updatedMina) {
          return res
            .status(404)
            .json({ error: "Mina not found or access denied" });
        }

        try {
          const useKey = `action.TRANSACCIONES.mina.${minaId}.use`;
          await ensurePermission({
            key: useKey,
            descripcion: `Usar mina: ${nombre.trim()}`,
            categoria: "action",
          });
          await updatePermissionDescription(useKey, `Usar mina: ${nombre.trim()}`);
        const viewKey = `module.MINAS.mina.${minaId}.view`;
        await ensurePermission({
          key: viewKey,
          descripcion: `Ver mina: ${nombre.trim()}`,
          categoria: "entity",
        });
        await updatePermissionDescription(viewKey, `Ver mina: ${nombre.trim()}`);
        } catch (permError) {
          console.warn("⚠️  No se pudo actualizar permiso use de mina:", permError);
        }

        res.json(updatedMina);
      } catch (error) {
        console.error("Error updating mina nombre:", error);
        res.status(500).json({ error: "Failed to update mina nombre" });
      }
    },
  );

  app.put(
    "/api/compradores/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const compradorId = parseInt(req.params.id);
        if (isNaN(compradorId)) {
          return res.status(400).json({ error: "Invalid comprador ID" });
        }

        const { nombre } = req.body;
        if (!nombre || !nombre.trim()) {
          return res.status(400).json({ error: "Nombre is required" });
        }

        const updatedComprador = await storage.updateCompradorNombre(
          compradorId,
          nombre.trim(),
          userId,
        );

        if (!updatedComprador) {
          return res
            .status(404)
            .json({ error: "Comprador not found or access denied" });
        }

        try {
          const useKey = `action.TRANSACCIONES.comprador.${compradorId}.use`;
          await ensurePermission({
            key: useKey,
            descripcion: `Usar comprador: ${nombre.trim()}`,
            categoria: "action",
          });
          await updatePermissionDescription(useKey, `Usar comprador: ${nombre.trim()}`);
          const viewKey = `module.COMPRADORES.comprador.${compradorId}.view`;
          await ensurePermission({
            key: viewKey,
            descripcion: `Ver comprador: ${nombre.trim()}`,
            categoria: "entity",
          });
          await updatePermissionDescription(viewKey, `Ver comprador: ${nombre.trim()}`);
        } catch (permError) {
          console.warn("⚠️  No se pudo actualizar permiso use de comprador:", permError);
        }

        res.json(updatedComprador);
      } catch (error) {
        console.error("Error updating comprador nombre:", error);
        res.status(500).json({ error: "Failed to update comprador nombre" });
      }
    },
  );

  app.put(
    "/api/volqueteros/:id/nombre",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const volqueteroId = parseInt(req.params.id);
        if (isNaN(volqueteroId)) {
          return res.status(400).json({ error: "Invalid volquetero ID" });
        }

        const { nombre } = req.body;
        if (!nombre || !nombre.trim()) {
          return res.status(400).json({ error: "Nombre is required" });
        }

        console.log(
          `🔧 PUT VOLQUETERO NOMBRE CON SINCRONIZACIÓN INTELIGENTE: ID ${volqueteroId}, nuevo nombre: "${nombre.trim()}"`,
        );

        // LÓGICA COMPLETA CON SINCRONIZACIÓN: Solo manejar volqueteros reales (no IDs artificiales)
        // Los IDs artificiales se manejan en el endpoint GET, no aquí
        if (volqueteroId >= 1000) {
          console.log(
            `❌ ID artificial ${volqueteroId} - No se puede editar volquetero artificial`,
          );
          return res.status(400).json({
            error:
              "No se puede editar volqueteros artificiales. Debe crear el volquetero primero.",
          });
        }

        const updatedVolquetero = await storage.updateVolqueteroNombre(
          volqueteroId,
          nombre.trim(),
          userId,
        );

        if (!updatedVolquetero) {
          return res
            .status(404)
            .json({ error: "Volquetero not found or access denied" });
        }

        console.log(
          `✅ VOLQUETERO NOMBRE ACTUALIZADO CON SINCRONIZACIÓN: ID ${updatedVolquetero.id} -> "${updatedVolquetero.nombre}"`,
        );
        try {
          const useKey = `action.TRANSACCIONES.volquetero.${volqueteroId}.use`;
          await ensurePermission({
            key: useKey,
            descripcion: `Usar volquetero: ${nombre.trim()}`,
            categoria: "action",
          });
          await updatePermissionDescription(useKey, `Usar volquetero: ${nombre.trim()}`);
          const viewKey = `module.VOLQUETEROS.volquetero.${volqueteroId}.view`;
          await ensurePermission({
            key: viewKey,
            descripcion: `Ver volquetero: ${nombre.trim()}`,
            categoria: "entity",
          });
          await updatePermissionDescription(viewKey, `Ver volquetero: ${nombre.trim()}`);
        } catch (permError) {
          console.warn("⚠️  No se pudo actualizar permiso use de volquetero:", permError);
        }
        res.json(updatedVolquetero);
      } catch (error) {
        console.error(
          "❌ ERROR en PUT volquetero nombre con sincronización:",
          error,
        );
        res.status(500).json({ error: "Failed to update volquetero nombre" });
      }
    },
  );

  // Viajes routes
  app.get("/api/viajes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Soporte para paginación opcional (mantiene compatibilidad hacia atrás)
      const pageParam = req.query.page;
      const limitParam = req.query.limit;
      
      // Si se proporcionan parámetros de paginación, usar método paginado
      if (pageParam || limitParam) {
        const page = pageParam ? parseInt(pageParam as string, 10) : 1;
        const limit = limitParam ? parseInt(limitParam as string, 10) : 100;
        
        debugLog(`=== GET /api/viajes - Paginado (page: ${page}, limit: ${limit}) ===`);
        
        const result = await storage.getViajesPaginated(userId, page, limit);
        res.json(result);
      } else {
        // Modo sin paginación (compatibilidad hacia atrás)
        const viajes = await storage.getViajes(userId);
        console.log(
          `=== GET /api/viajes - Found ${viajes.length} viajes with IDs:`,
          viajes.slice(0, 10).map((v) => v.id), // Solo mostrar primeros 10 IDs para no saturar logs
        );
        res.json(viajes);
      }
    } catch (error: any) {
      console.error("Error fetching viajes:", error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
            error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
            error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
            error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
          console.warn("⚠️  Base de datos no disponible, retornando array vacío");
          // Retornar estructura compatible (array vacío o objeto con paginación)
          if (req.query.page || req.query.limit) {
            res.json({
              data: [],
              pagination: {
                page: 1,
                limit: 100,
                total: 0,
                totalPages: 0,
                hasMore: false,
              },
            });
          } else {
            res.json([]);
          }
        } else {
          res.status(500).json({ error: "Failed to fetch viajes" });
        }
    }
  });

  app.get(
    "/api/viajes/pendientes",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const userPermissions = await getUserPermissions(userId);
        const canViewPendings =
          userPermissions.includes("action.VIAJES.descargue.view") ||
          userPermissions.includes("action.VIAJES.descargue.use") ||
          userPermissions.includes("action.VIAJES.edit") ||
          userPermissions.includes("action.VIAJES.edit.use");
        if (!canViewPendings) {
          return res.status(403).json({
            error: "No tienes permiso para ver viajes pendientes",
            requiredPermission: "action.VIAJES.descargue.view",
          });
        }
        debugLog(`=== GET /api/viajes/pendientes - userId: ${userId}`);
        const viajes = await storage.getViajesPendientes(userId);
        debugLog(`=== Found ${viajes.length} pending viajes`);
        res.json(viajes);
      } catch (error) {
        console.error("Error fetching pending viajes:", error);
        res.status(500).json({ error: "Failed to fetch pending viajes" });
      }
    },
  );

  // Get viajes by mina
  app.get("/api/viajes/mina/:minaId", async (req, res) => {
    try {
      const minaId = parseInt(req.params.minaId);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
      }

      const viajes = await storage.getViajesByMina(minaId);
      res.json(viajes);
    } catch (error: any) {
      console.error("Error fetching viajes by mina:", error);
      res.status(500).json({ error: "Failed to fetch viajes for mina" });
    }
  });

  // Specific route for viajes by mina
  app.get("/api/viajes/mina/:minaId", async (req, res) => {
    try {
      const minaId = parseInt(req.params.minaId);
      debugLog("API: Fetching viajes for mina:", minaId);
      const viajes = await storage.getViajesByMina(minaId);
      debugLog("API: Found viajes:", viajes.length);
      res.json(viajes);
    } catch (error) {
      console.error("API: Error fetching viajes for mina:", error);
      res.status(500).json({ error: "Failed to fetch viajes for mina" });
    }
  });

  // Bulk delete viajes - using specific endpoint name to avoid route conflicts
  app.delete("/api/viajes-bulk-delete", async (req, res) => {
    try {
      const { viajeIds } = req.body;
      debugLog("=== DELETE /api/viajes/bulk - Request body:", req.body);

      if (!Array.isArray(viajeIds) || viajeIds.length === 0) {
        return res
          .status(400)
          .json({ error: "viajeIds must be a non-empty array" });
      }

      let deletedCount = 0;
      const errors: { id: string; error: string }[] = [];

      for (const viajeId of viajeIds) {
        try {
          await storage.deleteViaje(viajeId);
          deletedCount++;
          debugLog(`=== Deleted viaje: ${viajeId}`);
        } catch (error) {
          console.error(`=== Error deleting viaje ${viajeId}:`, error);
          errors.push({ id: viajeId, error: String(error) });
        }
      }

      console.log(
        `=== Bulk delete completed: ${deletedCount} deleted, ${errors.length} errors`,
      );
      res.json({
        success: true,
        deletedCount,
        totalRequested: viajeIds.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("=== DELETE /api/viajes/bulk - Error:", error);
      res.status(500).json({ error: "Error during bulk delete operation" });
    }
  });

  // Delete individual viaje (must be after bulk delete route)
  app.delete("/api/viajes/:id", async (req, res) => {
    try {
      const viajeId = req.params.id;
      debugLog("=== DELETE /api/viajes/:id - Deleting viaje:", viajeId);

      await storage.deleteViaje(viajeId);

      debugLog("=== DELETE /api/viajes/:id - Success");
      res.json({ success: true, message: "Viaje deleted successfully" });
    } catch (error) {
      console.error("=== DELETE /api/viajes/:id - Error:", error);
      res.status(500).json({ error: "Error deleting viaje" });
    }
  });

  // Mostrar todos los viajes ocultos (debe ir antes de la ruta genérica :id)
  app.patch("/api/viajes/show-all-hidden", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";

      const updatedCount = await storage.showAllHiddenViajes(userId);

      res.json({
        success: true,
        message: `${updatedCount} viajes mostrados correctamente`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error showing all hidden viajes:", error);
      res.status(500).json({ error: "Error al mostrar los viajes" });
    }
  });

  app.patch(
    "/api/viajes/:id",
    requireAuth,
    async (req, res) => {
      try {
        const viajeId = req.params.id;
        const userId = req.user!.id;
        const userPermissions = await getUserPermissions(userId);

        const isDescargueUpdate = Boolean(
          req.body.fechaDescargue ||
            req.body.peso ||
            req.body.ventaTon ||
            req.body.fleteTon ||
            req.body.otrosGastosFlete ||
            req.body.quienPagaFlete ||
            req.body.totalVenta ||
            req.body.totalCompra ||
            req.body.totalFlete ||
            req.body.valorConsignar ||
            req.body.ganancia ||
            req.body.vut ||
            req.body.cut ||
            req.body.fut ||
            req.body.compradorId ||
            req.body.recibo
        );

        const canEditViaje =
          userPermissions.includes("action.VIAJES.edit.use") ||
          userPermissions.includes("action.VIAJES.edit");
        const canDescargue =
          userPermissions.includes("action.VIAJES.descargue.use") ||
          canEditViaje;

        if (isDescargueUpdate && !canDescargue) {
          return res.status(403).json({
            error: "No tienes permiso para registrar descargues",
            requiredPermission: "action.VIAJES.descargue.use",
          });
        }
        if (!isDescargueUpdate && !canEditViaje) {
          return res.status(403).json({
            error: "No tienes permiso para editar viajes",
            requiredPermission: "action.VIAJES.edit.use",
          });
        }

        // Check if viaje exists first
        const existingViaje = await storage.getViaje(viajeId);
        if (!existingViaje) {
          debugLog(`=== PATCH /api/viajes/:id - Viaje ${viajeId} not found`);
          return res.status(404).json({
            error: "Failed to update viaje",
            details: `Viaje ${viajeId} not found. This may be an imported trip that was lost after server restart.`,
          });
        }

        // Auto-crear volquetero si el conductor cambió y no existe
        if (req.body.conductor && req.body.conductor !== existingViaje.conductor) {
          try {
            await storage.findOrCreateVolqueteroByNombre(
              req.body.conductor,
              req.body.placa || existingViaje.placa || "Sin placa",
              userId
            );
          } catch (error) {
            console.error("Error al buscar/crear volquetero:", error);
            // No fallar la edición del viaje si hay error con el volquetero
          }
        }

        // Convert the frontend data to match storage expectations
        const processedData = {
          fechaCargue: req.body.fechaCargue,
          fechaDescargue: req.body.fechaDescargue,
          conductor: req.body.conductor,
          placa: req.body.placa,
          tipoCarro: req.body.tipoCarro,
          minaId: req.body.minaId ? Number(req.body.minaId) : undefined,
          compradorId: req.body.compradorId
            ? Number(req.body.compradorId)
            : undefined,
          volquetero: req.body.volquetero,
          peso: req.body.peso ? String(req.body.peso) : undefined,
          precioCompraTon: req.body.precioCompraTon
            ? String(req.body.precioCompraTon)
            : undefined,
          ventaTon: req.body.ventaTon ? String(req.body.ventaTon) : undefined,
          fleteTon: req.body.fleteTon ? String(req.body.fleteTon) : undefined,
          otrosGastosFlete: req.body.otrosGastosFlete
            ? String(req.body.otrosGastosFlete)
            : "0",
          quienPagaFlete: req.body.quienPagaFlete || "comprador",
          estado: req.body.estado,
          totalVenta: req.body.totalVenta
            ? String(req.body.totalVenta)
            : undefined,
          totalCompra: req.body.totalCompra
            ? String(req.body.totalCompra)
            : undefined,
          totalFlete: req.body.totalFlete
            ? String(req.body.totalFlete)
            : undefined,
          valorConsignar: req.body.valorConsignar
            ? String(req.body.valorConsignar)
            : undefined,
          ganancia: req.body.ganancia ? String(req.body.ganancia) : undefined,
          vut: req.body.vut ? String(req.body.vut) : undefined,
          cut: req.body.cut ? String(req.body.cut) : undefined,
          fut: req.body.fut ? String(req.body.fut) : undefined,
          recibo:
            req.body.recibo !== undefined ? String(req.body.recibo) : undefined,
          observaciones:
            req.body.observaciones !== undefined
              ? String(req.body.observaciones)
              : undefined,
          oculta: req.body.oculta, // Agregar soporte para campo oculta
        };

        const viaje = await storage.updateViaje(viajeId, processedData);

        debugLog("=== PATCH /api/viajes/:id - Success:", viaje);
        res.json(viaje);
      } catch (error: any) {
        console.error("=== PATCH /api/viajes/:id - Error:", error);
        res.status(500).json({
          error: "Failed to update viaje",
          details: error.message,
        });
      }
    },
  );

  // Bulk import endpoint for faster Excel processing
  app.post("/api/viajes/bulk-import", async (req, res) => {
    try {
      debugLog("=== BULK IMPORT STARTED ===");
      const { viajes, replaceExisting = false } = req.body;

      if (!Array.isArray(viajes) || viajes.length === 0) {
        return res.status(400).json({ error: "No viajes data provided" });
      }

      debugLog(`Processing ${viajes.length} viajes in bulk mode`);
      console.log(
        `=== VIAJES IDs RECEIVED ===`,
        viajes.map((v: any) => v.id),
      );

      const results = {
        success: 0,
        errors: [] as string[],
        created: [] as string[],
        skipped: [] as string[],
      };

      // Pre-load all entities to avoid repeated queries
      const [allMinas, allCompradores, allVolqueteros] = await Promise.all([
        storage.getMinas(),
        storage.getCompradores(),
        storage.getVolqueteros(),
      ]);

      // Create maps for faster lookups
      const minasByName = new Map(
        allMinas.map((m) => [m.nombre.toLowerCase(), m]),
      );
      const compradoresByName = new Map(
        allCompradores.map((c) => [c.nombre.toLowerCase(), c]),
      );
      const volqueterosByName = new Map(
        allVolqueteros.map((v) => [v.nombre.toLowerCase(), v]),
      );

      // Process in batches of 50 for better performance
      const BATCH_SIZE = 50;
      for (let i = 0; i < viajes.length; i += BATCH_SIZE) {
        const batch = viajes.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(viajes.length / BATCH_SIZE)}`,
        );

        await Promise.all(
          batch.map(async (viajeData, batchIndex) => {
            const globalIndex = i + batchIndex;
            try {
              // Check if viaje exists and handle accordingly
              if (replaceExisting === false) {
                const existing = await storage.getViaje(viajeData.id);
                if (existing) {
                  debugLog(`⏭️ SKIPPING existing viaje: ${viajeData.id}`);
                  results.skipped.push(viajeData.id);
                  results.errors.push(
                    `Fila ${globalIndex + 1}: Viaje ${viajeData.id} ya existe`,
                  );
                  return;
                }
              }

              // Parse and validate data using Excel-specific schema
              debugLog(`=== PROCESSING VIAJE ${globalIndex + 1} ===`);
              debugLog("Raw data:", JSON.stringify(viajeData, null, 2));

              const parsedData = excelImportViajeSchema.parse(viajeData);
              debugLog("Parsed data:", JSON.stringify(parsedData, null, 2));
              let minaId = parsedData.minaId;
              let compradorId = parsedData.compradorId;

              // Handle mina creation/lookup
              if ((parsedData as any).minaNombre) {
                const minaNombre = (parsedData as any).minaNombre;
                let mina = minasByName.get(minaNombre.toLowerCase());

                if (!mina) {
                  mina = await storage.createMina({ nombre: minaNombre });
                  minasByName.set(minaNombre.toLowerCase(), mina);
                }

                minaId = mina.id;
                delete (parsedData as any).minaNombre;
                (parsedData as any).minaId = minaId;
              }

              // Handle comprador creation/lookup
              if ((parsedData as any).compradorNombre) {
                const compradorNombre = (parsedData as any).compradorNombre;
                let comprador = compradoresByName.get(
                  compradorNombre.toLowerCase(),
                );

                if (!comprador) {
                  comprador = await storage.createComprador({
                    nombre: compradorNombre,
                  });
                  compradoresByName.set(
                    compradorNombre.toLowerCase(),
                    comprador,
                  );
                }

                compradorId = comprador.id;
                delete (parsedData as any).compradorNombre;
                (parsedData as any).compradorId = compradorId;
              }

              // Handle volquetero creation - usar findOrCreateVolqueteroByNombre para evitar duplicados
              if (parsedData.conductor) {
                const conductorName = parsedData.conductor.toLowerCase();
                if (!volqueterosByName.has(conductorName)) {
                  // Usar findOrCreateVolqueteroByNombre para evitar race conditions y duplicados
                  const newVolquetero = await storage.findOrCreateVolqueteroByNombre(
                    parsedData.conductor,
                    parsedData.placa || "Vehículo por definir",
                    undefined // userId no disponible en bulk import
                  );
                  volqueterosByName.set(conductorName, newVolquetero);
                }
              }

              // Create viaje
              let viaje;
              if (replaceExisting && (await storage.getViaje(viajeData.id))) {
                // Delete existing and create new
                await storage.deleteViaje(viajeData.id);
              }

              // Calculate financial fields automatically using the available data
              const peso = parseFloat(parsedData.peso);
              const vut = parseFloat(parsedData.vut);
              const cut = parseFloat(parsedData.cut);
              const fut = parseFloat(parsedData.fut);
              const otrosGastos = parseFloat(parsedData.otrosGastos || "0");

              // Calculate totals
              const totalVenta = peso * vut;
              const totalCompra = peso * cut;
              const totalFlete = peso * fut;

              // Calculate ganancia (profit)
              const ganancia =
                totalVenta - totalCompra - totalFlete - otrosGastos;

              // Calculate valor a consignar based on who pays freight
              const quienPaga = parsedData.quienPagaFlete || "comprador";
              let valorConsignar: number;
              if (
                quienPaga === "Tú" ||
                quienPaga === "tu" ||
                quienPaga === "RodMar"
              ) {
                valorConsignar = totalVenta;
              } else {
                valorConsignar = totalVenta - totalFlete;
              }

              // Add calculated fields to parsedData with undefined validation
              (parsedData as any).totalVenta = isNaN(totalVenta)
                ? "0"
                : totalVenta.toString();
              (parsedData as any).totalCompra = isNaN(totalCompra)
                ? "0"
                : totalCompra.toString();
              (parsedData as any).totalFlete = isNaN(totalFlete)
                ? "0"
                : totalFlete.toString();
              (parsedData as any).ganancia = isNaN(ganancia)
                ? "0"
                : ganancia.toString();
              (parsedData as any).valorConsignar = isNaN(valorConsignar)
                ? "0"
                : valorConsignar.toString();

              // CRITICAL: Fix "undefined" values BEFORE any calculations
              Object.keys(parsedData).forEach((key) => {
                if (
                  parsedData[key] === "undefined" ||
                  parsedData[key] === undefined ||
                  parsedData[key] === null
                ) {
                  // Special handling for date fields
                  if (key === "fechaDescargue") {
                    console.log(
                      `🔧 FIXING DATE ${key}: "${parsedData[key]}" → null`,
                    );
                    parsedData[key] = null;
                  } else if (key.includes("fecha")) {
                    console.log(
                      `🔧 FIXING DATE ${key}: "${parsedData[key]}" → new Date()`,
                    );
                    parsedData[key] = new Date();
                  } else {
                    debugLog(`🔧 FIXING ${key}: "${parsedData[key]}" → "0"`);
                    parsedData[key] = "0";
                  }
                }
              });

              // Validate ALL numeric fields to prevent "undefined" strings
              const numericFields = [
                "peso",
                "cut",
                "vut",
                "fut",
                "otrosGastos",
                "precioCompraTon",
                "ventaTon",
                "fleteTon",
                "totalVenta",
                "totalCompra",
                "totalFlete",
                "ganancia",
                "valorConsignar",
              ];

              numericFields.forEach((field) => {
                const value = (parsedData as any)[field];
                if (
                  value === undefined ||
                  value === null ||
                  value === "undefined" ||
                  value === "" ||
                  isNaN(parseFloat(value))
                ) {
                  console.log(
                    `🔧 NUMERIC FIXING field ${field}: "${value}" → "0"`,
                  );
                  (parsedData as any)[field] = "0";
                }
              });

              // DEBUG: Log ALL data before creating viaje for problematic ones
              const potentiallyProblematic = ["G12", "G13", "G14", "G15"];
              if (potentiallyProblematic.includes(viajeData.id)) {
                debugLog(`🚨 DEBUGGING PROBLEMATIC VIAJE ${viajeData.id}:`, {
                  peso: parsedData.peso,
                  cut: parsedData.cut,
                  vut: parsedData.vut,
                  fut: parsedData.fut,
                  otrosGastos: parsedData.otrosGastos,
                  precioCompraTon: parsedData.precioCompraTon,
                  ventaTon: parsedData.ventaTon,
                  fleteTon: parsedData.fleteTon,
                  allData: parsedData,
                });
              }

              viaje = await storage.createViajeWithCustomId(
                parsedData,
                viajeData.id,
              );

              // No longer create automatic transactions during Excel import

              results.success++;
              results.created.push(viaje.id);
            } catch (error: any) {
              console.error(`❌ ERROR processing viaje ${globalIndex + 1}:`, {
                id: viajeData?.id,
                conductor: viajeData?.conductor,
                placa: viajeData?.placa,
                error: error.message,
                errorCode: error.code,
                errorDetail: error.detail,
              });
              console.error(
                `❌ FAILED VIAJE ID: ${viajeData?.id} (Fila ${globalIndex + 1})`,
              );
              results.errors.push(
                `Fila ${globalIndex + 1} (ID: ${viajeData?.id || "unknown"}): ${error.message}`,
              );
            }
          }),
        );
      }

      debugLog(`=== BULK IMPORT COMPLETED ===`);
      debugLog(`✅ Success: ${results.success}`);
      debugLog(`❌ Errors: ${results.errors.length}`);
      debugLog(`⏭️ Skipped: ${results.skipped.length}`);
      console.log(
        `📊 Total processed: ${results.success + results.errors.length + results.skipped.length}`,
      );

      if (results.skipped.length > 0) {
        debugLog(`🔍 Skipped viajes:`, results.skipped);
      }

      // Add total count for modal display
      results.total =
        results.success + results.errors.length + results.skipped.length;

      res.json(results);
    } catch (error: any) {
      console.error("=== BULK IMPORT ERROR ===", error);
      res
        .status(500)
        .json({ error: "Failed to import viajes", details: error.message });
    }
  });

  app.post("/api/viajes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userPermissions = await getUserPermissions(userId);
      const canCreateViaje =
        userPermissions.includes("action.VIAJES.cargue.use") ||
        userPermissions.includes("action.VIAJES.create");
      if (!canCreateViaje) {
        return res.status(403).json({
          error: "No tienes permiso para registrar cargues",
          requiredPermission: "action.VIAJES.cargue.use",
        });
      }
      debugLog("Received viaje data:", req.body);

      // If this request includes a fileHash, register it to prevent future duplicates
      if (req.body.fileHash) {
        storage.addFileHash(req.body.fileHash);
        console.log(
          "=== Registered file hash for duplicate prevention:",
          req.body.fileHash,
        );
        // Remove fileHash from the data as it's not part of the viaje schema
        delete req.body.fileHash;
      }

      const data = insertViajeSchema.parse(req.body);
      debugLog("Parsed viaje data:", data);

      // Auto-crear volquetero si el conductor no existe
      if (data.conductor) {
        try {
          await storage.findOrCreateVolqueteroByNombre(
            data.conductor,
            data.placa || "Sin placa",
            userId
          );
        } catch (error) {
          console.error("Error al buscar/crear volquetero:", error);
          // No fallar la creación del viaje si hay error con el volquetero
        }
      }

      // Auto-crear entidades basadas en nombres si vienen del Excel
      let minaId = data.minaId;
      let compradorId = data.compradorId;

      // Si viene nombre de mina desde Excel, buscar o crear la mina
      if ((data as any).minaNombre) {
        const minaNombre = (data as any).minaNombre;
        debugLog(`=== Processing mina by name: "${minaNombre}"`);

        // Normalizar nombre para búsqueda consistente
        const nombreNormalizado = minaNombre.trim().toLowerCase();

        const minas = await storage.getMinas();
        let mina = minas.find(
          (m) => m.nombre.toLowerCase().trim() === nombreNormalizado,
        );

        if (!mina) {
          // Verificar nuevamente justo antes de crear para evitar race conditions
          const minasUpdated = await storage.getMinas();
          mina = minasUpdated.find(
            (m) => m.nombre.toLowerCase().trim() === nombreNormalizado,
          );

          if (!mina) {
            debugLog(`=== Creating new mina: "${minaNombre}"`);
            mina = await storage.createMina({
              nombre: minaNombre.trim(), // Eliminar espacios extras
            });
          } else {
            console.log(
              `=== Found existing mina after re-check: "${mina.nombre}" with ID ${mina.id}`,
            );
          }
        } else {
          console.log(
            `=== Found existing mina: "${mina.nombre}" with ID ${mina.id}`,
          );
        }

        minaId = mina.id;
        // Remove the temporary field and set the proper minaId
        delete (data as any).minaNombre;
        (data as any).minaId = minaId;
      }

      // Si viene nombre de comprador desde Excel, buscar o crear el comprador
      if ((data as any).compradorNombre) {
        const compradorNombre = (data as any).compradorNombre;
        debugLog(`=== Processing comprador by name: "${compradorNombre}"`);

        // Normalizar nombre para búsqueda consistente
        const nombreNormalizado = compradorNombre.trim().toLowerCase();

        const compradores = await storage.getCompradores();
        let comprador = compradores.find(
          (c) => c.nombre.toLowerCase().trim() === nombreNormalizado,
        );

        if (!comprador) {
          // Verificar nuevamente justo antes de crear para evitar race conditions
          const compradoresUpdated = await storage.getCompradores();
          comprador = compradoresUpdated.find(
            (c) => c.nombre.toLowerCase().trim() === nombreNormalizado,
          );

          if (!comprador) {
            debugLog(`=== Creating new comprador: "${compradorNombre}"`);
            comprador = await storage.createComprador({
              nombre: compradorNombre.trim(), // Eliminar espacios extras
            });
          } else {
            console.log(
              `=== Found existing comprador after re-check: "${comprador.nombre}" with ID ${comprador.id}`,
            );
          }
        } else {
          console.log(
            `=== Found existing comprador: "${comprador.nombre}" with ID ${comprador.id}`,
          );
        }

        compradorId = comprador.id;
        // Remove the temporary field and set the proper compradorId
        delete (data as any).compradorNombre;
        (data as any).compradorId = compradorId;
      }

      // Auto-crear volquetero basado en conductor
      if (data.conductor) {
        const volqueteros = await storage.getVolqueteros();
        const existingVolquetero = volqueteros.find(
          (v) => v.nombre.toLowerCase() === data.conductor.toLowerCase(),
        );
        if (!existingVolquetero) {
          // Crear volquetero automáticamente
          await storage.createVolquetero({
            nombre: data.conductor,
            placa: data.placa || "Vehículo por definir",
          });
        }
      }

      console.log(
        `=== Final viaje data before creation: minaId=${(data as any).minaId}, compradorId=${(data as any).compradorId}`,
      );

      // Generar ID automáticamente si no viene desde Excel
      let viajeId = data.id;
      if (!viajeId) {
        // Generar nuevo ID consecutivo automáticamente
        viajeId = await ViajeIdGenerator.getNextAvailableId(userId);
        debugLog(`=== GENERATED NEW ID: ${viajeId} for new viaje`);
      } else {
        // Verificar conflictos si ID viene desde Excel
        const existingViaje = await storage.getViaje(data.id);
        if (existingViaje) {
          debugLog(`=== CONFLICT DETECTED: Viaje ${data.id} already exists`);
          return res.status(409).json({
            error: "Conflict detected",
            message: `Viaje with ID ${data.id} already exists`,
            conflictId: data.id,
          });
        }
      }

      const viaje = await storage.createViaje({ ...data, id: viajeId, userId });

      // No longer create automatic transactions when creating trips

      res.json(viaje);
    } catch (error) {
      console.error("Error creating viaje:", error);
      res
        .status(400)
        .json({
          error: "Invalid viaje data",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Debug endpoint for specific viaje
  app.get("/api/debug/viaje/:id", async (req, res) => {
    try {
      const viajeId = req.params.id;
      const viaje = await storage.getViaje(viajeId);

      debugLog("=== DEBUG VIAJE:", viajeId);
      debugLog("=== Raw viaje data:", JSON.stringify(viaje, null, 2));

      if (viaje) {
        console.log(
          "=== fechaCargue:",
          viaje.fechaCargue,
          "Type:",
          typeof viaje.fechaCargue,
        );
        console.log(
          "=== fechaDescargue:",
          viaje.fechaDescargue,
          "Type:",
          typeof viaje.fechaDescargue,
        );
      }

      res.json(viaje);
    } catch (error: any) {
      console.error("Error debugging viaje:", error);
      res.status(500).json({ error: "Failed to debug viaje" });
    }
  });

  // Debug endpoint para ID generator
  app.get(
    "/api/debug/next-id",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const nextId = await ViajeIdGenerator.getNextAvailableId(userId);
        const stats = await ViajeIdGenerator.getIdStats(userId);
        const missingIds = await ViajeIdGenerator.findMissingIds(userId);

        res.json({
          nextId,
          stats: Object.fromEntries(
            Object.entries(stats).filter(([_, data]) => data.used > 0),
          ),
          missingIds: missingIds.slice(0, 10), // Solo primeros 10
        });
      } catch (error: any) {
        console.error("Error getting next ID:", error);
        res.status(500).json({ error: "Failed to get next ID" });
      }
    },
  );

  // Clean duplicates endpoint
  app.post("/api/clean-duplicates", async (req, res) => {
    try {
      debugLog("=== MANUAL CLEANUP: Starting duplicate removal");
      storage.forcedCleanupDuplicates();
      res.json({ message: "Duplicates cleaned successfully" });
    } catch (error) {
      console.error("Error cleaning duplicates:", error);
      res.status(500).json({ error: "Failed to clean duplicates" });
    }
  });

  // Check for conflicts endpoint
  app.post("/api/check-conflicts", async (req, res) => {
    try {
      const { ids, fileHash } = req.body;

      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "IDs must be an array" });
      }

      debugLog("=== CONFLICT CHECK: Checking IDs:", ids);
      debugLog("=== CONFLICT CHECK: File hash:", fileHash);

      // Check for duplicate file hash first
      let isDuplicateFile = false;
      if (fileHash && storage.isFileHashRecent(fileHash)) {
        debugLog("=== CONFLICT CHECK: Duplicate file detected!");
        isDuplicateFile = true;
      }

      const existingViajes = await storage.getViajes();
      const existingIds = existingViajes.map((v) => v.id);
      const conflicts = ids.filter((id) => existingIds.includes(id));

      debugLog("=== CONFLICT CHECK: Existing IDs:", existingIds);
      debugLog("=== CONFLICT CHECK: Conflicts found:", conflicts);

      res.json({
        conflicts,
        isDuplicateFile,
      });
    } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({ error: "Failed to check conflicts" });
    }
  });

  // Transacciones routes
  app.get(
    "/api/transacciones",
    requireAuth,
    async (req, res) => {
      const routeStartTime = Date.now();
      try {
        const userId = req.user!.id;
        
        // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
        // (sin filtrar por userId) para mantener coherencia en tiempo real
        const userPermissions = await getUserPermissions(userId);
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
        const effectiveUserId = hasTransactionPermissions ? undefined : userId;
        
        const page = req.query.page ? parseInt(req.query.page as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

        // Logging condicional para reducir overhead (solo en debug)
        const DEBUG_TRANSACCIONES = process.env.DEBUG_TRANSACCIONES === 'true';
        if (DEBUG_TRANSACCIONES) {
          console.log('');
          console.log('═══════════════════════════════════════════════════════════');
          console.log(`⏱️  [PERF] GET /api/transacciones - Iniciando request...`);
          console.log(`   Usuario: ${userId}`);
          console.log(`   Permisos de transacciones: ${hasTransactionPermissions ? 'SÍ' : 'NO'}`);
          console.log(`   Filtrando por userId: ${effectiveUserId || 'NINGUNO (todas las transacciones)'}`);
          console.log(`   Paginación: ${page ? `page=${page}, limit=${limit}` : 'sin paginación'}`);
          console.log(`   Timestamp: ${new Date().toISOString()}`);
          console.log('═══════════════════════════════════════════════════════════');
        }
        
        // Leer parámetros de filtro
        const search = req.query.search as string || '';
        const fechaDesde = req.query.fechaDesde as string || '';
        const fechaHasta = req.query.fechaHasta as string || '';
        const valorFilterType = req.query.valorFilterType as string || '';
        const valorFilterValue = req.query.valorFilterValue as string || '';
        const valorFilterValueEnd = req.query.valorFilterValueEnd as string || '';
        const sortByValor = req.query.sortByValor as string || '';
        const sortByFecha = req.query.sortByFecha as string || 'desc';

        // Si hay parámetros de paginación, usar método con filtros
        if (page && limit) {
          if (DEBUG_TRANSACCIONES) {
            debugLog(`=== GET /api/transacciones - Paginado (page: ${page}, limit: ${limit}) ===`);
          }
          
          // Obtener todas las transacciones para aplicar filtros
          const allTransacciones = await storage.getTransacciones(effectiveUserId);
          
          // Filter out automatic trip transactions for compradores
          let filteredData = allTransacciones.filter((transaccion) => {
            if (
              transaccion.tipoSocio === "comprador" &&
              transaccion.concepto &&
              transaccion.concepto.startsWith("Viaje ")
            ) {
              return false;
            }
            return true;
          });

          // Aplicar filtro de búsqueda
          if (search.trim()) {
            const searchLower = search.toLowerCase();
            filteredData = filteredData.filter((t: any) => {
              const fechaString = String(t.fecha);
              const fechaDirecta = t.fecha instanceof Date 
                ? t.fecha.toISOString().split('T')[0]
                : fechaString.includes('T') 
                    ? fechaString.split('T')[0] 
                    : fechaString;
              
              return (
                t.socioNombre?.toLowerCase().includes(searchLower) ||
                t.concepto?.toLowerCase().includes(searchLower) ||
                t.voucher?.toLowerCase().includes(searchLower) ||
                t.comentario?.toLowerCase().includes(searchLower) ||
                fechaDirecta.includes(searchLower)
              );
            });
          }

          // Aplicar filtro de fecha
          if (fechaDesde || fechaHasta) {
            filteredData = filteredData.filter((t: any) => {
              const fechaString = String(t.fecha);
              const fechaDirecta = t.fecha instanceof Date 
                ? t.fecha.toISOString().split('T')[0]
                : fechaString.includes('T') 
                    ? fechaString.split('T')[0] 
                    : fechaString;
              
              if (fechaDesde && fechaHasta) {
                return fechaDirecta >= fechaDesde && fechaDirecta <= fechaHasta;
              } else if (fechaDesde) {
                return fechaDirecta >= fechaDesde;
              } else if (fechaHasta) {
                return fechaDirecta <= fechaHasta;
              }
              return true;
            });
          }

          // Aplicar filtro de valor
          if (valorFilterType && valorFilterType !== "todos" && valorFilterValue) {
            const filterValue = parseFloat(valorFilterValue);
            filteredData = filteredData.filter((t: any) => {
              const transactionValue = parseFloat(t.valor || '0');
              // Determinar valor de visualización (considerando lógica de colores)
              let displayValue = transactionValue;
              const isFromPartner = t.deQuienTipo === 'mina' || t.deQuienTipo === 'comprador' || t.deQuienTipo === 'volquetero';
              const isToRodMar = t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco';
              if (isFromPartner && isToRodMar) {
                displayValue = Math.abs(transactionValue); // Positivo
              } else if (t.deQuienTipo === 'rodmar' || t.deQuienTipo === 'banco') {
                displayValue = -Math.abs(transactionValue); // Negativo
              }

              switch (valorFilterType) {
                case "exactamente":
                  return Math.abs(displayValue) === Math.abs(filterValue);
                case "mayor":
                  return displayValue > filterValue;
                case "menor":
                  return displayValue < filterValue;
                case "entre":
                  const filterValueEnd = parseFloat(valorFilterValueEnd || "0");
                  return displayValue >= filterValue && displayValue <= filterValueEnd;
                default:
                  return true;
              }
            });
          }

          // Aplicar ordenamiento
          if (sortByValor && sortByValor !== "ninguno") {
            filteredData.sort((a: any, b: any) => {
              const aValue = parseFloat(a.valor || '0');
              const bValue = parseFloat(b.valor || '0');
              const aIsFromPartner = a.deQuienTipo === 'mina' || a.deQuienTipo === 'comprador' || a.deQuienTipo === 'volquetero';
              const aIsToRodMar = a.paraQuienTipo === 'rodmar' || a.paraQuienTipo === 'banco';
              const bIsFromPartner = b.deQuienTipo === 'mina' || b.deQuienTipo === 'comprador' || b.deQuienTipo === 'volquetero';
              const bIsToRodMar = b.paraQuienTipo === 'rodmar' || b.paraQuienTipo === 'banco';
              
              let aDisplayValue = aValue;
              let bDisplayValue = bValue;
              if (aIsFromPartner && aIsToRodMar) aDisplayValue = Math.abs(aValue);
              else if (a.deQuienTipo === 'rodmar' || a.deQuienTipo === 'banco') aDisplayValue = -Math.abs(aValue);
              if (bIsFromPartner && bIsToRodMar) bDisplayValue = Math.abs(bValue);
              else if (b.deQuienTipo === 'rodmar' || b.deQuienTipo === 'banco') bDisplayValue = -Math.abs(bValue);

              if (sortByValor === "desc") {
                return bDisplayValue - aDisplayValue;
              } else {
                return aDisplayValue - bDisplayValue;
              }
            });
          }

          if (sortByFecha && sortByFecha !== "ninguno") {
            filteredData.sort((a: any, b: any) => {
              const aDate = new Date(a.fecha);
              const bDate = new Date(b.fecha);
              if (sortByFecha === "desc") {
                return bDate.getTime() - aDate.getTime();
              } else {
                return aDate.getTime() - bDate.getTime();
              }
            });
          } else {
            // Ordenamiento por defecto: fecha descendente
            filteredData.sort((a: any, b: any) => {
              const aDate = new Date(a.fecha);
              const bDate = new Date(b.fecha);
              return bDate.getTime() - aDate.getTime();
            });
          }

          // Aplicar paginación sobre resultados filtrados
          const total = filteredData.length;
          const validPage = Math.max(1, Math.floor(page));
          const validLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
          const offset = (validPage - 1) * validLimit;
          const paginatedData = filteredData.slice(offset, offset + validLimit);
          const totalPages = Math.ceil(total / validLimit);

          const totalRouteTime = Date.now() - routeStartTime;
          if (DEBUG_TRANSACCIONES) {
            debugLog(`⏱️  [PERF] ⚡ TIEMPO TOTAL RUTA /api/transacciones: ${totalRouteTime}ms`);
          }

          res.json({
            data: paginatedData,
            pagination: {
              page: validPage,
              limit: validLimit,
              total,
              totalPages,
              hasMore: validPage < totalPages,
            }
          });
        } else {
          // Sin paginación - mantener compatibilidad hacia atrás
          const allTransacciones = await storage.getTransacciones(effectiveUserId);

          // Filter out automatic trip transactions for compradores
          const filterStart = Date.now();
          const filteredTransacciones = allTransacciones.filter((transaccion) => {
            if (
              transaccion.tipoSocio === "comprador" &&
              transaccion.concepto &&
              transaccion.concepto.startsWith("Viaje ")
            ) {
              return false;
            }
            return true;
          });
          const filterTime = Date.now() - filterStart;

          const totalRouteTime = Date.now() - routeStartTime;
          console.log(
            `=== GET /api/transacciones - Returning ${filteredTransacciones.length} transactions ===`,
          );
          console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL RUTA /api/transacciones: ${totalRouteTime}ms (Filtrado: ${filterTime}ms)`);

          res.json(filteredTransacciones);
        }
      } catch (error: any) {
        console.error("Error fetching transacciones:", error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' || error.code === 'DB_CONNECTION_ERROR' ||
            error.code === 'XX000' || error.code === 'NO_DATABASE_URL' || 
            error.message?.includes('DATABASE_URL') || error.message?.includes('getaddrinfo') || 
            error.message?.includes('connect') || error.message?.includes('Tenant or user not found')) {
          console.warn("⚠️  Base de datos no disponible, retornando array vacío");
          res.json(page && limit ? { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0, hasMore: false } } : []);
        } else {
          res.status(500).json({ error: "Failed to fetch transacciones" });
        }
      }
    },
  );

  // Endpoint específico para cargar voucher de transacción (carga lazy)
  app.get(
    "/api/transacciones/:id/voucher",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const idParam = req.params.id;
        
        // Si el ID es un string que empieza con "viaje-", es una transacción de viaje
        // Las transacciones de viaje no tienen vouchers en la tabla de transacciones
        if (typeof idParam === 'string' && idParam.startsWith('viaje-')) {
          return res.json({ voucher: null });
        }
        
        const transaccionId = parseInt(idParam);
        
        // Validar que el ID sea un número válido
        if (isNaN(transaccionId)) {
          return res.status(400).json({ error: "Invalid transaction ID" });
        }

        // Si el usuario tiene permisos de transacciones, puede ver vouchers de TODAS las transacciones
        // (sin filtrar por userId) para mantener coherencia con lo que puede ver
        const userPermissions = await getUserPermissions(userId);
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        // Si tiene permisos de transacciones, no filtrar por userId (ver vouchers de todas las transacciones)
        const effectiveUserId = hasTransactionPermissions ? undefined : userId;

        const voucher = await storage.getTransaccionVoucher(
          transaccionId,
          effectiveUserId,
        );

        res.json({ voucher });
      } catch (error) {
        console.error("Error fetching transaction voucher:", error);
        res.status(500).json({ error: "Failed to fetch voucher" });
      }
    },
  );

  // Get transacciones by socio
  app.get(
    "/api/transacciones/socio/:tipoSocio/:socioId",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";

        const { tipoSocio, socioId } = req.params;
        const { includeHidden } = req.query;

        if (!tipoSocio || !socioId) {
          return res
            .status(400)
            .json({ error: "Missing tipoSocio or socioId parameters" });
        }

        // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
        // (sin filtrar por userId) para mantener coherencia en tiempo real
        const userPermissions = await getUserPermissions(userId);
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
        const effectiveUserId = hasTransactionPermissions ? undefined : userId;

        // Determinar el módulo correcto según el tipo de socio
        let modulo: 'general' | 'comprador' | 'mina' | 'volquetero' = 'general';
        if (tipoSocio === 'mina') {
          modulo = 'mina';
        } else if (tipoSocio === 'comprador') {
          modulo = 'comprador';
        } else if (tipoSocio === 'volquetero') {
          modulo = 'volquetero';
        }

        // Usar getTransaccionesForModule con el módulo correcto en lugar de getTransaccionesBySocio
        debugLog(`🔍 [DEBUG] getTransaccionesForModule - tipoSocio: ${tipoSocio}, socioId: ${socioId}, modulo: ${modulo}, includeHidden: ${includeHidden === "true"}, effectiveUserId: ${effectiveUserId || 'ALL'}`);
        const transacciones = await storage.getTransaccionesForModule(
          tipoSocio as string,
          parseInt(socioId as string),
          effectiveUserId,
          includeHidden === "true",
          modulo,
        );
        debugLog(`✅ [DEBUG] getTransaccionesForModule - Retornando ${transacciones.length} transacciones`);
        res.json(transacciones);
      } catch (error: any) {
        console.error("❌ [ERROR] Error fetching transacciones by socio:", error);
        console.error("❌ [ERROR] Error details:", error.message, error.stack);
        console.error("❌ [ERROR] Error code:", error.code);
        res.status(500).json({ error: "Failed to fetch transacciones", details: error.message });
      }
    },
  );

  // Endpoint específico para obtener transacciones de compradores con filtrado por módulo
  app.get(
    "/api/transacciones/comprador/:compradorId",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";

        // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
        // (sin filtrar por userId) para mantener coherencia en tiempo real
        const userPermissions = await getUserPermissions(userId);
        const hasTransactionPermissions = 
          userPermissions.includes("action.TRANSACCIONES.create") ||
          userPermissions.includes("action.TRANSACCIONES.completePending") ||
          userPermissions.includes("action.TRANSACCIONES.edit") ||
          userPermissions.includes("action.TRANSACCIONES.delete");
        
        // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
        const effectiveUserId = hasTransactionPermissions ? undefined : userId;

        const { compradorId } = req.params;
        const { includeHidden } = req.query;

        if (!compradorId) {
          return res
            .status(400)
            .json({ error: "Missing compradorId parameter" });
        }

        const transacciones = await storage.getTransaccionesForModule(
          "comprador",
          parseInt(compradorId as string),
          effectiveUserId,
          includeHidden === "true",
          "comprador",
        );
        res.json(transacciones);
      } catch (error: any) {
        console.error("Error fetching transacciones for comprador:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch transacciones for comprador" });
      }
    },
  );

  app.post("/api/transacciones", requireAuth, requirePermission("action.TRANSACCIONES.create"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";

      console.log("Received new transaction data:", req.body);

      // Parse using new schema
      const data = insertTransaccionSchema.parse(req.body);
      debugLog("Parsed transaction data:", data);

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const deQuienCheck = await checkUsePermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: data.deQuienTipo,
        id: data.deQuienId,
      });
      if (!deQuienCheck.allowed) {
        return res.status(deQuienCheck.status || 403).json({
          error: deQuienCheck.message || "No tienes permiso para usar esta entidad",
          requiredPermission: deQuienCheck.requiredPermission,
        });
      }

      const paraQuienCheck = await checkUsePermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: data.paraQuienTipo,
        id: data.paraQuienId,
      });
      if (!paraQuienCheck.allowed) {
        return res.status(paraQuienCheck.status || 403).json({
          error: paraQuienCheck.message || "No tienes permiso para usar esta entidad",
          requiredPermission: paraQuienCheck.requiredPermission,
        });
      }

      // Create backwards compatibility data for storage
      // We'll determine tipoSocio and socioId based on the new "para quién" field
      // This determines who receives the transaction impact
      let tipoSocio: string;
      let socioId: number | string;

      switch (data.paraQuienTipo) {
        case "mina":
          tipoSocio = "mina";
          socioId = parseInt(data.paraQuienId);
          break;
        case "comprador":
          tipoSocio = "comprador";
          socioId = parseInt(data.paraQuienId);
          break;
        case "volquetero":
          tipoSocio = "volquetero";
          socioId = parseInt(data.paraQuienId);
          break;
        case "tercero":
          tipoSocio = "tercero";
          socioId = parseInt(data.paraQuienId);
          break;
        case "rodmar":
          // For RodMar, we'll use a special handling - but map to mina for now
          tipoSocio = "mina"; // Temporary mapping
          socioId = 1; // Use a default mina ID
          break;
        case "banco":
          // For Banco, we'll use a special handling - but map to mina for now
          tipoSocio = "mina"; // Temporary mapping
          socioId = 1; // Use a default mina ID
          break;
        case "lcdm":
          // For LCDM, we'll use a special handling - but map to mina for now
          tipoSocio = "mina"; // Temporary mapping
          socioId = 1; // Use a default mina ID
          break;
        case "postobon":
          // For Postobón, we'll use a special handling - but map to mina for now
          tipoSocio = "mina"; // Temporary mapping
          socioId = 1; // Use a default mina ID
          break;
        default:
          throw new Error("Invalid paraQuienTipo");
      }

      // Create final data with both new and legacy fields
      const finalData = {
        // New fields
        deQuienTipo: data.deQuienTipo,
        deQuienId: data.deQuienId,
        paraQuienTipo: data.paraQuienTipo,
        paraQuienId: data.paraQuienId,
        postobonCuenta: data.postobonCuenta || undefined,
        // Legacy fields for compatibility
        tipoSocio,
        socioId,
        // Common fields
        concepto: data.concepto,
        valor: data.valor,
        fecha: data.fecha,
        formaPago: data.formaPago,
        voucher: data.voucher || undefined,
        comentario: data.comentario || undefined,
        // User isolation
        userId,
      };

      // Create the transaction
      const transaccion = await storage.createTransaccion(finalData);

      debugLog(`✅ Transaction created successfully:`, transaccion);
      console.log(
        `📊 Automatic balance recalculation triggered by storage.createTransaccion()`,
      );

      // Determinar entidades afectadas
      const affectedEntityTypes = new Set<string>();
      if (data.deQuienTipo) affectedEntityTypes.add(data.deQuienTipo);
      if (data.paraQuienTipo) affectedEntityTypes.add(data.paraQuienTipo);
      
      // Determinar cuentas afectadas
      const affectedAccounts: string[] = [];
      if (data.deQuienTipo === 'rodmar' && data.deQuienId) {
        affectedAccounts.push(data.deQuienId);
      }
      if (data.paraQuienTipo === 'rodmar' && data.paraQuienId) {
        affectedAccounts.push(data.paraQuienId);
      }
      if (data.deQuienTipo === 'lcdm' || data.paraQuienTipo === 'lcdm') {
        affectedEntityTypes.add('lcdm');
      }
      if (data.deQuienTipo === 'postobon' || data.paraQuienTipo === 'postobon') {
        affectedEntityTypes.add('postobon');
      }

      // Emitir evento WebSocket
      emitTransactionUpdate({
        type: "created",
        transactionId: transaccion.id,
        affectedEntityTypes,
        affectedAccounts,
      });

      res.json(transaccion);
    } catch (error) {
      console.error("Error creating transaccion:", error);
      res
        .status(400)
        .json({
          error: "Invalid transaccion data",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Crear transacción pendiente (solicitud)
  app.post("/api/transacciones/solicitar", requireAuth, requirePermission("action.TRANSACCIONES.solicitar"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = req.body;

      console.log("📝 Creando solicitud de transacción pendiente:", data);

      // Validar campos requeridos para solicitud
      if (!data.paraQuienTipo || !data.paraQuienId || !data.valor) {
        return res.status(400).json({
          error: "Campos requeridos faltantes",
          details: "Se requiere: paraQuienTipo, paraQuienId, valor",
        });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const paraQuienCheck = await checkUsePermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: data.paraQuienTipo,
        id: data.paraQuienId,
      });
      if (!paraQuienCheck.allowed) {
        return res.status(paraQuienCheck.status || 403).json({
          error: paraQuienCheck.message || "No tienes permiso para usar esta entidad",
          requiredPermission: paraQuienCheck.requiredPermission,
        });
      }

      // Mapear tipoSocio y socioId para compatibilidad (similar a crear transacción normal)
      let tipoSocio = data.paraQuienTipo;
      let socioId: number;

      switch (data.paraQuienTipo) {
        case "mina":
          socioId = parseInt(data.paraQuienId);
          break;
        case "comprador":
          socioId = parseInt(data.paraQuienId);
          break;
        case "volquetero":
          // Para volqueteros, primero intentar buscar por ID, luego por nombre
          const volqueteros = await storage.getVolqueteros();
          let volquetero = null;
          
          // Intentar buscar por ID primero (si es un número)
          const paraQuienIdNum = parseInt(data.paraQuienId);
          if (!isNaN(paraQuienIdNum)) {
            volquetero = volqueteros.find((v) => v.id === paraQuienIdNum);
          }
          
          // Si no se encontró por ID, buscar por nombre
          if (!volquetero) {
            volquetero = volqueteros.find(
              (v) => v.nombre.toLowerCase() === data.paraQuienId.toLowerCase()
            );
          }
          
          if (!volquetero) {
            return res.status(400).json({
              error: "Volquetero no encontrado",
              details: `No se encontró volquetero con ID o nombre: ${data.paraQuienId}`,
            });
          }
          socioId = volquetero.id;
          break;
        case "tercero":
          socioId = parseInt(data.paraQuienId);
          break;
        default:
          tipoSocio = "mina";
          socioId = 1;
      }

      // Obtener nombre del destino (necesario para concepto y notificación)
      let nombreDestino = "Desconocido";
      const tipoCapitalizado = data.paraQuienTipo.charAt(0).toUpperCase() + data.paraQuienTipo.slice(1);
      
      try {
        switch (data.paraQuienTipo) {
          case "mina":
            const mina = await storage.getMinaById(socioId, userId);
            nombreDestino = mina?.nombre || data.paraQuienId;
            break;
          case "comprador":
            const comprador = await storage.getCompradorById(socioId, userId);
            nombreDestino = comprador?.nombre || data.paraQuienId;
            break;
          case "volquetero":
            nombreDestino = data.paraQuienId; // Ya es el nombre
            break;
          case "tercero":
            const tercero = await storage.getTerceroById(parseInt(data.paraQuienId));
            nombreDestino = tercero?.nombre || data.paraQuienId;
            break;
          case "rodmar":
            const rodmarOptions: Record<string, string> = {
              "bemovil": "Bemovil",
              "corresponsal": "Corresponsal",
              "efectivo": "Efectivo",
              "cuentas-german": "Cuentas German",
              "cuentas-jhon": "Cuentas Jhon",
              "otras": "Otras",
            };
            nombreDestino = rodmarOptions[data.paraQuienId] || data.paraQuienId;
            break;
          case "banco":
            nombreDestino = "Banco";
            break;
          case "lcdm":
            nombreDestino = "La Casa del Motero";
            break;
          case "postobon":
            nombreDestino = "Postobón";
            break;
          default:
            nombreDestino = data.paraQuienId;
        }
      } catch (error) {
        console.error("Error obteniendo nombre de destino:", error);
      }

      // Generar concepto descriptivo
      let conceptoGenerado = data.concepto;
      if (!conceptoGenerado) {
        conceptoGenerado = `Solicitud de pago a ${tipoCapitalizado} (${nombreDestino})`;
      }

      // Convertir fecha de string YYYY-MM-DD a objeto Date
      let fechaDate: Date;
      if (data.fecha) {
        // Colombia-first: interpretar YYYY-MM-DD como fecha Colombia (no UTC)
        fechaDate = parseColombiaDate(String(data.fecha));
        // Validar que la fecha es válida
        if (isNaN(fechaDate.getTime())) {
          fechaDate = new Date();
        }
      } else {
        fechaDate = new Date();
      }

      // Crear datos finales para la solicitud
      const finalData = {
        // Nuevos campos
        deQuienTipo: null, // Origen no definido aún
        deQuienId: null,
        paraQuienTipo: data.paraQuienTipo,
        paraQuienId: data.paraQuienId,
        // Legacy fields para compatibilidad
        tipoSocio,
        socioId,
        // Campos comunes
        concepto: conceptoGenerado,
        valor: data.valor,
        fecha: fechaDate,
        formaPago: "pendiente", // Valor temporal
        voucher: undefined,
        comentario: data.comentario || undefined,
        detalle_solicitud: data.detalle_solicitud || undefined,
        // User isolation
        userId,
      };

      // Crear la transacción pendiente
      const transaccion = await storage.createTransaccionPendiente(finalData);

      debugLog(`✅ Solicitud de transacción creada exitosamente:`, transaccion);

      // Emitir evento Socket.io para invalidar caché en otros clientes
      const affectedEntityTypes = new Set<string>();
      // Importante: esta operación afecta el módulo de pendientes y el módulo general de transacciones
      affectedEntityTypes.add("pending-transactions");
      if (data.paraQuienTipo) affectedEntityTypes.add(data.paraQuienTipo);
      emitTransactionUpdate({
        type: "created",
        transactionId: transaccion.id,
        affectedEntityTypes,
        affectedAccounts: [],
      });

      // Enviar notificación push (no bloquear la respuesta si falla)
      try {
        const { notifyPendingTransaction } = await import('./push-notifications');
        const result = await notifyPendingTransaction(userId, {
          id: transaccion.id,
          paraQuienTipo: data.paraQuienTipo,
          paraQuienNombre: nombreDestino,
          valor: data.valor,
          codigoSolicitud: transaccion.codigo_solicitud || undefined
        });
        console.log(`📱 Notificación push enviada: ${result.sent} exitosas, ${result.failed} fallidas`);
      } catch (pushError) {
        console.error('⚠️  Error al enviar notificación push (no crítico):', pushError);
      }

      res.json(transaccion);
    } catch (error) {
      console.error("Error creating solicitud:", error);
      res
        .status(400)
        .json({
          error: "Invalid solicitud data",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Push subscriptions endpoints
  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({
          error: "Invalid subscription data",
          details: "Se requiere: subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth"
        });
      }

      const savedSubscription = await storage.savePushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      });

      debugLog(`✅ Suscripción push registrada para usuario ${userId}`);
      res.json({ success: true, subscription: savedSubscription });
    } catch (error) {
      console.error("Error registering push subscription:", error);
      res.status(500).json({
        error: "Failed to register push subscription",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/push/unsubscribe", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          error: "Invalid request",
          details: "Se requiere: endpoint"
        });
      }

      const deleted = await storage.deletePushSubscription(userId, endpoint);
      
      if (deleted) {
        debugLog(`✅ Suscripción push eliminada para usuario ${userId}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Subscription not found" });
      }
    } catch (error) {
      console.error("Error unregistering push subscription:", error);
      res.status(500).json({
        error: "Failed to unregister push subscription",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/push/vapid-public-key", requireAuth, async (req, res) => {
    try {
      const { getVapidPublicKey } = await import('./push-notifications');
      const publicKey = getVapidPublicKey();
      
      if (!publicKey) {
        return res.status(503).json({
          error: "Push notifications not configured",
          details: "VAPID keys no están configuradas en el servidor"
        });
      }

      res.json({ publicKey });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({
        error: "Failed to get VAPID public key",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Obtener todas las transacciones pendientes
  app.get("/api/transacciones/pendientes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Si el usuario tiene permisos para ver o completar transacciones pendientes,
      // puede ver TODAS las transacciones pendientes (no solo las suyas)
      const userPermissions = await getUserPermissions(userId);
      const hasPendingPermissions = 
        userPermissions.includes("action.TRANSACCIONES.viewPending") ||
        userPermissions.includes("action.TRANSACCIONES.completePending");
      
      // Si tiene permisos, no filtrar por userId (ver todas)
      const effectiveUserId = hasPendingPermissions ? undefined : userId;
      
      const pendientes = await storage.getTransaccionesPendientes(effectiveUserId);
      res.json(pendientes);
    } catch (error) {
      console.error("Error getting pendientes:", error);
      res
        .status(500)
        .json({
          error: "Error al obtener transacciones pendientes",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Contar transacciones pendientes
  app.get("/api/transacciones/pendientes/count", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Si el usuario tiene permisos para ver o completar transacciones pendientes,
      // puede ver TODAS las transacciones pendientes (no solo las suyas)
      const userPermissions = await getUserPermissions(userId);
      const hasPendingPermissions = 
        userPermissions.includes("action.TRANSACCIONES.viewPending") ||
        userPermissions.includes("action.TRANSACCIONES.completePending");
      
      // Si tiene permisos, no filtrar por userId (contar todas)
      const effectiveUserId = hasPendingPermissions ? undefined : userId;
      
      const count = await storage.countTransaccionesPendientes(effectiveUserId);
      res.json({ count });
    } catch (error) {
      console.error("Error counting pendientes:", error);
      res
        .status(500)
        .json({
          error: "Error al contar transacciones pendientes",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Completar transacción pendiente
  app.put("/api/transacciones/:id/completar", requireAuth, requirePermission("action.TRANSACCIONES.completePending"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const data = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transaction ID" });
      }

      // Validar campos requeridos
      if (!data.deQuienTipo || !data.deQuienId || !data.formaPago) {
        return res.status(400).json({
          error: "Campos requeridos faltantes",
          details: "Se requiere: deQuienTipo, deQuienId, formaPago",
        });
      }

      // Obtener transacción original para obtener datos de notificación
      const originalTransaction = await storage.getTransaccion(id);

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const deQuienCheck = await checkUsePermission({
        userPermissions,
        deniedPermissions,
        permissionExistsCache,
        tipo: data.deQuienTipo,
        id: data.deQuienId,
      });
      if (!deQuienCheck.allowed) {
        return res.status(deQuienCheck.status || 403).json({
          error: deQuienCheck.message || "No tienes permiso para usar esta entidad",
          requiredPermission: deQuienCheck.requiredPermission,
        });
      }

      if (originalTransaction?.paraQuienTipo && originalTransaction?.paraQuienId) {
        const paraQuienCheck = await checkUsePermission({
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          tipo: originalTransaction.paraQuienTipo,
          id: originalTransaction.paraQuienId,
        });
        if (!paraQuienCheck.allowed) {
          return res.status(paraQuienCheck.status || 403).json({
            error: paraQuienCheck.message || "No tienes permiso para usar esta entidad",
            requiredPermission: paraQuienCheck.requiredPermission,
          });
        }
      }
      
      // Completar la transacción
      const transaccion = await storage.completarTransaccionPendiente(id, {
        deQuienTipo: data.deQuienTipo,
        deQuienId: data.deQuienId,
        formaPago: data.formaPago,
        fecha: data.fecha || undefined,
        voucher: data.voucher || undefined,
        userId,
      });

      if (!transaccion) {
        return res.status(404).json({
          error: "Transacción no encontrada o no está pendiente",
        });
      }

      debugLog(`✅ Transacción ${id} completada exitosamente`);

      // Emitir evento WebSocket para invalidar caché en otros clientes (crítico multi-usuario)
      // Debe invalidar:
      // - /api/transacciones (módulo general, donde pendientes también se muestran)
      // - /api/transacciones/pendientes y /count (porque sale de pendientes al completarse)
      // - listados/balances de entidades afectadas (mina/comprador/volquetero/rodmar/cuentas)
      try {
        const affectedEntityTypes = new Set<string>();
        affectedEntityTypes.add("pending-transactions");

        // Entidades afectadas: usar original (pendiente) y la transacción ya completada
        if (originalTransaction?.deQuienTipo) affectedEntityTypes.add(originalTransaction.deQuienTipo);
        if (originalTransaction?.paraQuienTipo) affectedEntityTypes.add(originalTransaction.paraQuienTipo);
        if (transaccion?.deQuienTipo) affectedEntityTypes.add(transaccion.deQuienTipo);
        if (transaccion?.paraQuienTipo) affectedEntityTypes.add(transaccion.paraQuienTipo);

        // Cuentas RodMar afectadas
        const affectedAccounts: string[] = [];
        if (originalTransaction?.deQuienTipo === "rodmar" && originalTransaction?.deQuienId) {
          affectedAccounts.push(originalTransaction.deQuienId);
        }
        if (originalTransaction?.paraQuienTipo === "rodmar" && originalTransaction?.paraQuienId) {
          affectedAccounts.push(originalTransaction.paraQuienId);
        }
        if (transaccion?.deQuienTipo === "rodmar" && transaccion?.deQuienId) {
          affectedAccounts.push(transaccion.deQuienId);
        }
        if (transaccion?.paraQuienTipo === "rodmar" && transaccion?.paraQuienId) {
          affectedAccounts.push(transaccion.paraQuienId);
        }

        // LCDM / Postobón (para invalidaciones de tabs y balances)
        if (
          originalTransaction?.deQuienTipo === "lcdm" ||
          originalTransaction?.paraQuienTipo === "lcdm" ||
          transaccion?.deQuienTipo === "lcdm" ||
          transaccion?.paraQuienTipo === "lcdm"
        ) {
          affectedEntityTypes.add("lcdm");
        }
        if (
          originalTransaction?.deQuienTipo === "postobon" ||
          originalTransaction?.paraQuienTipo === "postobon" ||
          transaccion?.deQuienTipo === "postobon" ||
          transaccion?.paraQuienTipo === "postobon"
        ) {
          affectedEntityTypes.add("postobon");
        }

        emitTransactionUpdate({
          type: "updated",
          transactionId: id,
          affectedEntityTypes,
          affectedAccounts,
        });
      } catch (wsError) {
        console.error("⚠️ Error emitiendo evento WebSocket al completar pendiente (no crítico):", wsError);
      }

      // Enviar notificación de completado
      if (originalTransaction?.estado === 'pendiente') {
        try {
          // Obtener nombre del destino para la notificación
          let nombreDestino = "Desconocido";
          if (originalTransaction.paraQuienTipo && originalTransaction.paraQuienId) {
            try {
              switch (originalTransaction.paraQuienTipo) {
                case "mina":
                  const mina = await storage.getMinaById(parseInt(originalTransaction.paraQuienId), userId);
                  nombreDestino = mina?.nombre || originalTransaction.paraQuienId;
                  break;
                case "comprador":
                  const comprador = await storage.getCompradorById(parseInt(originalTransaction.paraQuienId), userId);
                  nombreDestino = comprador?.nombre || originalTransaction.paraQuienId;
                  break;
                case "volquetero":
                  const volqueteros = await storage.getVolqueteros();
                  const volqueteroIdNum = parseInt(originalTransaction.paraQuienId);
                  let volquetero = null;
                  if (!isNaN(volqueteroIdNum)) {
                    volquetero = volqueteros.find((v) => v.id === volqueteroIdNum);
                  }
                  if (!volquetero) {
                    volquetero = volqueteros.find(
                      (v) => v.nombre.toLowerCase() === originalTransaction.paraQuienId.toLowerCase()
                    );
                  }
                  nombreDestino = volquetero?.nombre || originalTransaction.paraQuienId;
                  break;
                case "rodmar":
                  const rodmarOptions: Record<string, string> = {
                    "bemovil": "Bemovil",
                    "corresponsal": "Corresponsal",
                    "efectivo": "Efectivo",
                    "cuentas-german": "Cuentas German",
                    "cuentas-jhon": "Cuentas Jhon",
                    "otras": "Otras",
                  };
                  nombreDestino = rodmarOptions[originalTransaction.paraQuienId] || originalTransaction.paraQuienId;
                  break;
                case "banco":
                  nombreDestino = "Banco";
                  break;
                case "lcdm":
                  nombreDestino = "La Casa del Motero";
                  break;
                case "postobon":
                  nombreDestino = "Postobón";
                  break;
                default:
                  nombreDestino = originalTransaction.paraQuienId;
              }
            } catch (error) {
              console.error("Error obteniendo nombre de destino para notificación:", error);
            }
          }

          const { notifyPendingTransactionCompleted } = await import('./push-notifications');
          const result = await notifyPendingTransactionCompleted(userId, {
            id: transaccion.id,
            paraQuienTipo: originalTransaction.paraQuienTipo || '',
            paraQuienNombre: nombreDestino,
            valor: originalTransaction.valor || '0',
            codigoSolicitud: originalTransaction.codigo_solicitud || undefined
          });
          console.log(`📱 Notificación push de completado enviada: ${result.sent} exitosas, ${result.failed} fallidas`);
        } catch (pushError) {
          console.error('⚠️  Error al enviar notificación push de completado (no crítico):', pushError);
        }
      }

      res.json(transaccion);
    } catch (error) {
      console.error("Error completing transaccion:", error);
      res
        .status(400)
        .json({
          error: "Error al completar transacción",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Mostrar todas las transacciones ocultas - DEBE IR ANTES del endpoint genérico /:id
  app.patch("/api/transacciones/show-all-hidden", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";

      const updatedCount = await storage.showAllHiddenTransacciones(userId);

      res.json({
        success: true,
        message: `${updatedCount} transacciones mostradas correctamente`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error showing all hidden transactions:", error);
      res
        .status(500)
        .json({ error: "Error al mostrar las transacciones ocultas" });
    }
  });

  // Mostrar todas las transacciones ocultas para un comprador específico
  app.post(
    "/api/transacciones/socio/comprador/:id/show-all",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";
        const compradorId = parseInt(req.params.id);

        const updatedCount =
          await storage.showAllHiddenTransaccionesForComprador(
            compradorId,
            userId,
          );

        res.json({
          success: true,
          message: `${updatedCount} transacciones de comprador mostradas correctamente`,
          updatedCount,
        });
      } catch (error) {
        console.error(
          "Error showing hidden transactions for comprador:",
          error,
        );
        res
          .status(500)
          .json({
            error: "Error al mostrar las transacciones ocultas del comprador",
          });
      }
    },
  );

  // Mostrar todos los viajes ocultos para un comprador específico
  app.post("/api/viajes/comprador/:id/show-all", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const compradorId = parseInt(req.params.id);

      const updatedCount = await storage.showAllHiddenViajesForComprador(
        compradorId,
        userId,
      );

      res.json({
        success: true,
        message: `${updatedCount} viajes de comprador mostrados correctamente`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error showing hidden viajes for comprador:", error);
      res
        .status(500)
        .json({ error: "Error al mostrar los viajes ocultos del comprador" });
    }
  });

  // Endpoint paginado para transacciones de LCDM (DEBE IR ANTES de /api/transacciones/:id)
  app.get("/api/transacciones/lcdm", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      
      // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
      // (sin filtrar por userId) para mantener coherencia en tiempo real
      const userPermissions = await getUserPermissions(userId);
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
      const effectiveUserId = hasTransactionPermissions ? undefined : userId;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      const includeHidden = req.query.includeHidden === 'true';
      
      // OPTIMIZACIÓN: Usar método optimizado con queries SQL directas
      if (includeHidden) {
        // Para includeHidden, usar método antiguo por compatibilidad
        const allTransaccionesIncludingHidden = await storage.getTransaccionesIncludingHidden(effectiveUserId);
        const lcdmTransactions = allTransaccionesIncludingHidden.filter((t: any) => 
          t.deQuienTipo === 'lcdm' || t.paraQuienTipo === 'lcdm'
        );
        return res.json(lcdmTransactions);
      }
      
      // Usar método optimizado con queries SQL
      const result = await storage.getTransaccionesForLCDM(effectiveUserId, {
        page,
        limit,
        search,
        fechaDesde,
        fechaHasta,
        includeHidden: false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[LCDM] Error fetching LCDM transactions:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[LCDM] Error details:", errorMessage);
      console.error("[LCDM] Error stack:", errorStack);
      
      // Si es un error de validación, devolver 400, sino 500
      const statusCode = errorMessage.includes('validation') || errorMessage.includes('invalid') ? 400 : 500;
      res.status(statusCode).json({ 
        error: "Error al obtener transacciones de LCDM",
        details: errorMessage 
      });
    }
  });

  // Endpoint paginado para transacciones de Banco (DEBE IR ANTES de /api/transacciones/:id)
  app.get("/api/transacciones/banco", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      
      // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
      // (sin filtrar por userId) para mantener coherencia en tiempo real
      const userPermissions = await getUserPermissions(userId);
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
      const effectiveUserId = hasTransactionPermissions ? undefined : userId;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      const includeHidden = req.query.includeHidden === 'true';
      
      // OPTIMIZACIÓN: Usar método optimizado con queries SQL directas
      if (includeHidden) {
        // Para includeHidden, usar método antiguo por compatibilidad
        const allTransaccionesIncludingHidden = await storage.getTransaccionesIncludingHidden(effectiveUserId);
        const bancoTransactions = allTransaccionesIncludingHidden.filter((t: any) => 
          t.deQuienTipo === 'banco' || t.paraQuienTipo === 'banco'
        );
        return res.json(bancoTransactions);
      }
      
      // Usar método optimizado con queries SQL
      const result = await storage.getTransaccionesForBanco(effectiveUserId, {
        page,
        limit,
        search,
        fechaDesde,
        fechaHasta,
        includeHidden: false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[Banco] Error fetching Banco transactions:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[Banco] Error details:", errorMessage);
      console.error("[Banco] Error stack:", errorStack);
      
      // Si es un error de validación, devolver 400, sino 500
      const statusCode = errorMessage.includes('validation') || errorMessage.includes('invalid') ? 400 : 500;
      res.status(statusCode).json({ 
        error: "Error al obtener transacciones de Banco",
        details: errorMessage 
      });
    }
  });

  // Endpoint paginado para transacciones de Postobón (DEBE IR ANTES de /api/transacciones/:id)
  app.get("/api/transacciones/postobon", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      
      // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
      // (sin filtrar por userId) para mantener coherencia en tiempo real
      const userPermissions = await getUserPermissions(userId);
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Si tiene permisos de transacciones, no filtrar por userId (ver todas)
      const effectiveUserId = hasTransactionPermissions ? undefined : userId;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filterType = req.query.filterType as string || 'todas'; // todas, santa-rosa, cimitarra
      
      // Logging condicional para reducir overhead en desarrollo
      if (process.env.DEBUG_RODMAR === 'true') {
        console.log(`[Postobón] Request recibido - userId: ${userId}, permisos de transacciones: ${hasTransactionPermissions ? 'SÍ' : 'NO'}, effectiveUserId: ${effectiveUserId || 'ALL'}, page: ${page}, limit: ${limit}, filterType: ${filterType}`);
      }
      
      // Leer parámetros de filtro
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      
      // Verificar si se deben incluir transacciones ocultas (para compatibilidad con frontend)
      const includeHidden = req.query.includeHidden === 'true';
      
      // OPTIMIZACIÓN: Usar método optimizado con queries SQL directas
      if (includeHidden) {
        // Para includeHidden, usar método antiguo por compatibilidad
        const allTransaccionesIncludingHidden = await storage.getTransaccionesIncludingHidden(userId);
        let postobonTransactions = allTransaccionesIncludingHidden.filter((t: any) => 
          t.deQuienTipo === 'postobon' || t.paraQuienTipo === 'postobon'
        );
        
        // Filtrar por cuenta específica si se especifica
        if (filterType === 'santa-rosa') {
          postobonTransactions = postobonTransactions.filter((t: any) => 
            t.postobonCuenta === 'santa-rosa'
          );
        } else if (filterType === 'cimitarra') {
          postobonTransactions = postobonTransactions.filter((t: any) => 
            t.postobonCuenta === 'cimitarra'
          );
        }
        
        return res.json(postobonTransactions);
      }
      
      // Usar método optimizado con queries SQL
      const result = await storage.getTransaccionesForPostobon(effectiveUserId, {
        page,
        limit,
        search,
        fechaDesde,
        fechaHasta,
        filterType: filterType as 'todas' | 'santa-rosa' | 'cimitarra',
        includeHidden: false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[Postobón] Error fetching Postobón transactions:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[Postobón] Error details:", errorMessage);
      console.error("[Postobón] Error stack:", errorStack);
      
      // Si es un error de validación, devolver 400, sino 500
      const statusCode = errorMessage.includes('validation') || errorMessage.includes('invalid') ? 400 : 500;
      res.status(statusCode).json({ 
        error: "Error al obtener transacciones de Postobón",
        details: errorMessage 
      });
    }
  });

  // GET single transaction by ID (DEBE IR DESPUÉS de rutas específicas como /lcdm y /postobon)
  app.get("/api/transacciones/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const transaction = await storage.getTransaccionById(id, userId);

      if (!transaction) {
        return res.status(404).json({ error: "Transacción no encontrada" });
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error getting transaction by ID:", error);
      res.status(500).json({ error: "Error al obtener la transacción" });
    }
  });

  // IMPORTANTE: Las rutas específicas DEBEN estar ANTES de la ruta genérica /api/transacciones/:id
  // para que Express las evalúe primero. De lo contrario, /api/transacciones/:id interceptará
  // peticiones como /api/transacciones/:id/hide
  
  // Endpoint de prueba para verificar que las rutas se registran
  app.get("/api/test-routes", (req, res) => {
    res.json({
      message: "Rutas registradas correctamente",
      timestamp: new Date().toISOString(),
      routes: [
        "PATCH /api/transacciones/hide/:id (Router)",
        "PATCH /api/transacciones/:id/hide (Directa)",
        "PATCH /api/transacciones/:id (Genérica)"
      ]
    });
  });

  // ESTRATEGIA: Usar Router específico para rutas de hide para evitar conflictos
  const hideRouter = Router();
  
  // Ruta principal de hide - múltiples variantes para asegurar que funcione
  hideRouter.patch("/:id", async (req, res) => {
    try {
      debugLog("✅ [HIDE-ROUTER] ===== RUTA /api/transacciones/hide/:id ALCANZADA =====");
      debugLog("✅ [HIDE-ROUTER] Method:", req.method);
      debugLog("✅ [HIDE-ROUTER] Path:", req.path);
      debugLog("✅ [HIDE-ROUTER] Original URL:", req.originalUrl);
      debugLog("✅ [HIDE-ROUTER] Params:", req.params);
      
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      if (isNaN(transactionId)) {
        console.error("❌ [HIDE-ROUTER] ID inválido:", req.params.id);
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      debugLog("✅ [HIDE-ROUTER] Ocultando transacción:", transactionId, "User:", userId);
      const success = await storage.hideTransaccion(transactionId, userId);
      debugLog("✅ [HIDE-ROUTER] Resultado:", success);

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada correctamente",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("❌ [HIDE-ROUTER] Error:", error);
      res.status(500).json({ error: "Error al ocultar la transacción" });
    }
  });
  
  // Registrar router con prefijo
  app.use("/api/transacciones/hide", hideRouter);
  
  // Mantener ruta antigua por compatibilidad - DEBE estar ANTES de /api/transacciones/:id
  app.patch("/api/transacciones/:id/hide", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      debugLog("✅ [HIDE-OLD] ===== RUTA /api/transacciones/:id/hide ALCANZADA =====");
      debugLog("✅ [HIDE-OLD] Method:", req.method);
      debugLog("✅ [HIDE-OLD] Path:", req.path);
      debugLog("✅ [HIDE-OLD] Original URL:", req.originalUrl);
      debugLog("✅ [HIDE-OLD] Params:", req.params);
      debugLog("✅ [HIDE-OLD] Query:", req.query);
      
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      debugLog("✅ [HIDE-OLD] Transaction ID parsed:", transactionId, "User ID:", userId);

      if (isNaN(transactionId)) {
        console.error("❌ [HIDE-OLD] ID inválido:", req.params.id);
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      debugLog("✅ [HIDE-OLD] Ocultando transacción:", transactionId);
      const success = await storage.hideTransaccion(transactionId, userId);
      debugLog("✅ [HIDE-OLD] Resultado:", success);

      if (success) {
        debugLog("✅ [HIDE-OLD] Transacción ocultada exitosamente");
        res.json({
          success: true,
          message: "Transacción ocultada correctamente",
        });
      } else {
        console.warn("⚠️ [HIDE-OLD] Transacción no encontrada:", transactionId);
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("❌ [HIDE-OLD] Error hiding transaction:", error);
      console.error("❌ [HIDE-OLD] Error stack:", error instanceof Error ? error.stack : String(error));
      res.status(500).json({ error: "Error al ocultar la transacción" });
    }
  });

  // Endpoints específicos por módulo para ocultar transacciones
  app.patch("/api/transacciones/:id/hide-comprador", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      if (isNaN(transactionId)) {
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      const success = await storage.hideTransaccionEnComprador(
        transactionId,
        userId,
      );

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada en módulo compradores",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("Error hiding transaction in comprador:", error);
      res
        .status(500)
        .json({ error: "Error al ocultar la transacción en compradores" });
    }
  });

  app.patch("/api/transacciones/:id/hide-mina", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      if (isNaN(transactionId)) {
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      const success = await storage.hideTransaccionEnMina(
        transactionId,
        userId,
      );

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada en módulo minas",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("Error hiding transaction in mina:", error);
      res
        .status(500)
        .json({ error: "Error al ocultar la transacción en minas" });
    }
  });

  app.patch("/api/transacciones/:id/hide-volquetero", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      if (isNaN(transactionId)) {
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      const success = await storage.hideTransaccionEnVolquetero(
        transactionId,
        userId,
      );

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada en módulo volqueteros",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("Error hiding transaction in volquetero:", error);
      res
        .status(500)
        .json({ error: "Error al ocultar la transacción en volqueteros" });
    }
  });

  app.patch("/api/transacciones/:id/hide-general", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      if (isNaN(transactionId)) {
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      const success = await storage.hideTransaccionEnGeneral(
        transactionId,
        userId,
      );

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada en general",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("Error hiding transaction in general:", error);
      res
        .status(500)
        .json({ error: "Error al ocultar la transacción en general" });
    }
  });

  // RUTA GENÉRICA - DEBE IR DESPUÉS de todas las rutas específicas
  app.patch("/api/transacciones/:id", requireAuth, requirePermission("action.TRANSACCIONES.edit"), async (req, res) => {
    try {
      // Verificar si la petición es para /hide (no debería llegar aquí si las rutas específicas están bien)
      if (req.originalUrl.includes('/hide')) {
        console.error("❌ [PATCH :id] ERROR: Petición /hide llegó a ruta genérica!");
        console.error("❌ [PATCH :id] Original URL:", req.originalUrl);
        console.error("❌ [PATCH :id] Path:", req.path);
        console.error("❌ [PATCH :id] Params:", req.params);
        return res.status(404).json({ error: "Ruta no encontrada. Use /api/transacciones/hide/:id" });
      }

      const userId = req.user?.id || "main_user";

      // Si el usuario tiene permisos de transacciones, puede actualizar TODAS las transacciones
      // (sin filtrar por userId) para mantener coherencia en tiempo real
      const userPermissions = await getUserPermissions(userId);
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Si tiene permisos de transacciones, no filtrar por userId (actualizar cualquier transacción)
      const effectiveUserId = hasTransactionPermissions ? undefined : userId;

      const id = parseInt(req.params.id);

      debugLog("=== PATCH /api/transacciones/:id - Request body:", req.body);
      debugLog("=== PATCH /api/transacciones/:id - Permisos de transacciones:", hasTransactionPermissions ? 'SÍ' : 'NO');
      debugLog("=== PATCH /api/transacciones/:id - effectiveUserId:", effectiveUserId || 'NINGUNO (todas las transacciones)');

      // Obtener transacción original PRIMERO para comparar fechas y preservar horaInterna
      const originalTransaction = await storage.getTransaccion(id);
      
      if (!originalTransaction) {
        console.error(`❌ [PATCH :id] Transacción ${id} no encontrada`);
        return res.status(404).json({ 
          error: "Transacción no encontrada o no tienes permiso para actualizarla" 
        });
      }

      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );
      const permissionExistsCache = new Map<string, boolean>();

      const targetDeQuienTipo = req.body.deQuienTipo ?? originalTransaction.deQuienTipo;
      const targetDeQuienId = req.body.deQuienId ?? originalTransaction.deQuienId;
      const targetParaQuienTipo = req.body.paraQuienTipo ?? originalTransaction.paraQuienTipo;
      const targetParaQuienId = req.body.paraQuienId ?? originalTransaction.paraQuienId;

      if (targetDeQuienTipo && targetDeQuienId) {
        const deQuienCheck = await checkUsePermission({
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          tipo: targetDeQuienTipo,
          id: targetDeQuienId,
        });
        if (!deQuienCheck.allowed) {
          return res.status(deQuienCheck.status || 403).json({
            error: deQuienCheck.message || "No tienes permiso para usar esta entidad",
            requiredPermission: deQuienCheck.requiredPermission,
          });
        }
      }

      if (targetParaQuienTipo && targetParaQuienId) {
        const paraQuienCheck = await checkUsePermission({
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          tipo: targetParaQuienTipo,
          id: targetParaQuienId,
        });
        if (!paraQuienCheck.allowed) {
          return res.status(paraQuienCheck.status || 403).json({
            error: paraQuienCheck.message || "No tienes permiso para usar esta entidad",
            requiredPermission: paraQuienCheck.requiredPermission,
          });
        }
      }

      // Comparar fechas ANTES de construir updateData (solo día, mes y año, sin hora)
      const fechaOriginal = originalTransaction.fecha;
      const nuevaFecha = req.body.fecha ? new Date(req.body.fecha) : undefined;
      
      // Comparar fechas normalizando a la misma zona horaria (UTC)
      let fechaCambio = false;
      if (nuevaFecha) {
        const fechaOriginalUTC = new Date(Date.UTC(
          fechaOriginal.getFullYear(),
          fechaOriginal.getMonth(),
          fechaOriginal.getDate()
        ));
        const nuevaFechaUTC = new Date(Date.UTC(
          nuevaFecha.getFullYear(),
          nuevaFecha.getMonth(),
          nuevaFecha.getDate()
        ));
        fechaCambio = fechaOriginalUTC.getTime() !== nuevaFechaUTC.getTime();
      }

      // Handle both old and new schema formats
      const updateData: any = {
        concepto: req.body.concepto,
        valor: req.body.valor,
        // Solo actualizar fecha si realmente cambió
        fecha: fechaCambio && nuevaFecha ? nuevaFecha : undefined,
        formaPago: req.body.formaPago,
        voucher: req.body.voucher,
        comentario: req.body.comentario,
        // Nota: El campo oculta ya no existe - el ocultamiento ahora es local en el frontend
        // Campos para transacciones pendientes
        detalle_solicitud: req.body.detalle_solicitud,
        estado: req.body.estado,
        codigo_solicitud: req.body.codigo_solicitud,
        tiene_voucher: req.body.tiene_voucher,
      };

      // Map new schema to old schema if present
      if (
        req.body.paraQuienTipo &&
        req.body.paraQuienId
      ) {
        // Actualizar campos de destino (para transacciones pendientes, deQuien puede ser null)
        if (req.body.deQuienTipo !== undefined) {
          updateData.deQuienTipo = req.body.deQuienTipo;
        }
        if (req.body.deQuienId !== undefined) {
          updateData.deQuienId = req.body.deQuienId;
        }
        updateData.paraQuienTipo = req.body.paraQuienTipo;
        updateData.paraQuienId = req.body.paraQuienId;
      } else if (req.body.tipoSocio && req.body.socioId) {
        // Legacy format
        updateData.tipoSocio = req.body.tipoSocio;
        updateData.socioId = req.body.socioId;
      }

      // Si la fecha NO cambió, preservar horaInterna original para mantener el orden
      if (!fechaCambio && originalTransaction.horaInterna) {
        updateData.horaInterna = originalTransaction.horaInterna;
        debugLog("=== PATCH /api/transacciones/:id - Preservando horaInterna original:", originalTransaction.horaInterna);
        debugLog("=== PATCH /api/transacciones/:id - Fecha NO cambió, manteniendo orden original");
      } else if (fechaCambio) {
        debugLog("=== PATCH /api/transacciones/:id - Fecha cambió, horaInterna se actualizará automáticamente");
      }

      console.log(
        "=== PATCH /api/transacciones/:id - Update data:",
        updateData,
      );

      const transaccion = await storage.updateTransaccion(
        id,
        updateData,
        effectiveUserId,
      );

      // Validar que la transacción se encontró y actualizó correctamente
      if (!transaccion) {
        console.error(`❌ [PATCH :id] Transacción ${id} no encontrada o no se pudo actualizar`);
        return res.status(404).json({ 
          error: "Transacción no encontrada o no tienes permiso para actualizarla" 
        });
      }

      console.log(
        "=== PATCH /api/transacciones/:id - Updated transaction:",
        transaccion,
      );

      // Enviar notificación si se editó una solicitud pendiente
      if (originalTransaction?.estado === 'pendiente' && transaccion?.estado === 'pendiente') {
        try {
          // Obtener nombre del destino para la notificación
          let nombreDestino = "Desconocido";
          if (transaccion.paraQuienTipo && transaccion.paraQuienId) {
            try {
              switch (transaccion.paraQuienTipo) {
                case "mina":
                  const mina = await storage.getMinaById(parseInt(transaccion.paraQuienId), userId);
                  nombreDestino = mina?.nombre || transaccion.paraQuienId;
                  break;
                case "comprador":
                  const comprador = await storage.getCompradorById(parseInt(transaccion.paraQuienId), userId);
                  nombreDestino = comprador?.nombre || transaccion.paraQuienId;
                  break;
                case "volquetero":
                  const volqueteros = await storage.getVolqueteros();
                  const volqueteroIdNum = parseInt(transaccion.paraQuienId);
                  let volquetero = null;
                  if (!isNaN(volqueteroIdNum)) {
                    volquetero = volqueteros.find((v) => v.id === volqueteroIdNum);
                  }
                  if (!volquetero) {
                    volquetero = volqueteros.find(
                      (v) => v.nombre.toLowerCase() === transaccion.paraQuienId.toLowerCase()
                    );
                  }
                  nombreDestino = volquetero?.nombre || transaccion.paraQuienId;
                  break;
                case "rodmar":
                  const rodmarOptions: Record<string, string> = {
                    "bemovil": "Bemovil",
                    "corresponsal": "Corresponsal",
                    "efectivo": "Efectivo",
                    "cuentas-german": "Cuentas German",
                    "cuentas-jhon": "Cuentas Jhon",
                    "otras": "Otras",
                  };
                  nombreDestino = rodmarOptions[transaccion.paraQuienId] || transaccion.paraQuienId;
                  break;
                case "banco":
                  nombreDestino = "Banco";
                  break;
                case "lcdm":
                  nombreDestino = "La Casa del Motero";
                  break;
                case "postobon":
                  nombreDestino = "Postobón";
                  break;
                default:
                  nombreDestino = transaccion.paraQuienId;
              }
            } catch (error) {
              console.error("Error obteniendo nombre de destino para notificación:", error);
            }
          }

          const { notifyPendingTransactionEdited } = await import('./push-notifications');
          const result = await notifyPendingTransactionEdited(userId, {
            id: transaccion.id,
            paraQuienTipo: transaccion.paraQuienTipo || '',
            paraQuienNombre: nombreDestino,
            valor: transaccion.valor || '0',
            codigoSolicitud: transaccion.codigo_solicitud || undefined
          });
          console.log(`📱 Notificación push de edición enviada: ${result.sent} exitosas, ${result.failed} fallidas`);
        } catch (pushError) {
          console.error('⚠️  Error al enviar notificación push de edición (no crítico):', pushError);
        }
      }

      // Determinar entidades afectadas (original + actualizada)
      const affectedEntityTypes = new Set<string>();
      if (originalTransaction?.deQuienTipo) affectedEntityTypes.add(originalTransaction.deQuienTipo);
      if (originalTransaction?.paraQuienTipo) affectedEntityTypes.add(originalTransaction.paraQuienTipo);
      if (transaccion?.deQuienTipo) affectedEntityTypes.add(transaccion.deQuienTipo);
      if (transaccion?.paraQuienTipo) affectedEntityTypes.add(transaccion.paraQuienTipo);
      
      // Determinar cuentas afectadas
      const affectedAccounts: string[] = [];
      if (originalTransaction?.deQuienTipo === 'rodmar' && originalTransaction?.deQuienId) {
        affectedAccounts.push(originalTransaction.deQuienId);
      }
      if (originalTransaction?.paraQuienTipo === 'rodmar' && originalTransaction?.paraQuienId) {
        affectedAccounts.push(originalTransaction.paraQuienId);
      }
      if (transaccion?.deQuienTipo === 'rodmar' && transaccion?.deQuienId) {
        affectedAccounts.push(transaccion.deQuienId);
      }
      if (transaccion?.paraQuienTipo === 'rodmar' && transaccion?.paraQuienId) {
        affectedAccounts.push(transaccion.paraQuienId);
      }
      if (originalTransaction?.deQuienTipo === 'lcdm' || originalTransaction?.paraQuienTipo === 'lcdm' ||
          transaccion?.deQuienTipo === 'lcdm' || transaccion?.paraQuienTipo === 'lcdm') {
        affectedEntityTypes.add('lcdm');
      }
      if (originalTransaction?.deQuienTipo === 'postobon' || originalTransaction?.paraQuienTipo === 'postobon' ||
          transaccion?.deQuienTipo === 'postobon' || transaccion?.paraQuienTipo === 'postobon') {
        affectedEntityTypes.add('postobon');
      }

      // Emitir evento WebSocket
      emitTransactionUpdate({
        type: "updated",
        transactionId: id,
        affectedEntityTypes,
        affectedAccounts,
      });

      res.json(transaccion);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  // Bulk delete transactions - MUST BE BEFORE SINGLE DELETE
  app.delete("/api/transacciones/bulk-delete", requireAuth, requirePermission("action.TRANSACCIONES.delete"), async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.id || "main_user";

      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "No se proporcionaron IDs de transacciones" });
      }

      let deletedCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          const transactionId = parseInt(id);
          if (!isNaN(transactionId)) {
            await storage.deleteTransaccion(transactionId, userId);
            deletedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `${deletedCount} transacciones eliminadas correctamente`,
        deletedCount,
        errorCount,
      });
    } catch (error) {
      console.error("Error in bulk delete:", error);
      res.status(500).json({ error: "Error al eliminar las transacciones" });
    }
  });

  // Delete single transaction - MUST BE AFTER BULK DELETE
  app.delete("/api/transacciones/:id", requireAuth, requirePermission("action.TRANSACCIONES.delete"), async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.id || "main_user";

      debugLog("=== INDIVIDUAL DELETE ENDPOINT CALLED ===");
      console.log("Request params:", req.params);
      console.log("Transaction ID raw:", req.params.id);
      console.log("User ID:", userId);

      const transactionId = parseInt(req.params.id);
      console.log("Transaction ID parsed:", transactionId);

      if (isNaN(transactionId)) {
        console.log("ERROR: Invalid transaction ID");
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      console.log("Attempting to delete transaction with ID:", transactionId);
      
      // Obtener transacción antes de eliminar para determinar entidades afectadas
      const transactionToDelete = await storage.getTransaccion(transactionId);
      
      await storage.deleteTransaccion(transactionId, userId);
      console.log("Transaction deleted successfully");
      
      // Determinar entidades afectadas
      const affectedEntityTypes = new Set<string>();
      if (transactionToDelete?.deQuienTipo) affectedEntityTypes.add(transactionToDelete.deQuienTipo);
      if (transactionToDelete?.paraQuienTipo) affectedEntityTypes.add(transactionToDelete.paraQuienTipo);
      
      // Determinar cuentas afectadas
      const affectedAccounts: string[] = [];
      if (transactionToDelete?.deQuienTipo === 'rodmar' && transactionToDelete?.deQuienId) {
        affectedAccounts.push(transactionToDelete.deQuienId);
      }
      if (transactionToDelete?.paraQuienTipo === 'rodmar' && transactionToDelete?.paraQuienId) {
        affectedAccounts.push(transactionToDelete.paraQuienId);
      }
      if (transactionToDelete?.deQuienTipo === 'lcdm' || transactionToDelete?.paraQuienTipo === 'lcdm') {
        affectedEntityTypes.add('lcdm');
      }
      if (transactionToDelete?.deQuienTipo === 'postobon' || transactionToDelete?.paraQuienTipo === 'postobon') {
        affectedEntityTypes.add('postobon');
      }

      // Emitir evento WebSocket
      emitTransactionUpdate({
        type: "deleted",
        transactionId,
        affectedEntityTypes,
        affectedAccounts,
      });
      
      res.json({
        success: true,
        message: "Transacción eliminada correctamente",
      });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Error al eliminar la transacción" });
    }
  });

  // Ocultar transacciones en lote
  app.patch("/api/transacciones/bulk-hide", requireAuth, requirePermission("action.TRANSACCIONES.hide"), async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "No se proporcionaron IDs de transacciones" });
      }

      let updatedCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          const transactionId = parseInt(id);
          if (!isNaN(transactionId)) {
            await storage.hideTransaccion(transactionId, userId);
            updatedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `${updatedCount} transacciones ocultadas correctamente`,
        updatedCount,
        errorCount,
      });
    } catch (error) {
      console.error("Error in bulk hide:", error);
      res.status(500).json({ error: "Error al ocultar las transacciones" });
    }
  });

  // Mostrar transacciones en lote
  app.patch("/api/transacciones/bulk-show", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "No se proporcionaron IDs de transacciones" });
      }

      let updatedCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          const transactionId = parseInt(id);
          if (!isNaN(transactionId)) {
            await storage.showTransaccion(transactionId, userId);
            updatedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `${updatedCount} transacciones mostradas correctamente`,
        updatedCount,
        errorCount,
      });
    } catch (error) {
      console.error("Error in bulk show:", error);
      res.status(500).json({ error: "Error al mostrar las transacciones" });
    }
  });

  // Ocultar viaje individual (afecta transacciones de minas y volqueteros)
  app.patch("/api/viajes/:id/hide", async (req, res) => {
    try {
      debugLog("✅ [HIDE-VIAJE] ===== RUTA /api/viajes/:id/hide ALCANZADA =====");
      debugLog("✅ [HIDE-VIAJE] Method:", req.method);
      debugLog("✅ [HIDE-VIAJE] Path:", req.path);
      debugLog("✅ [HIDE-VIAJE] Original URL:", req.originalUrl);
      debugLog("✅ [HIDE-VIAJE] Params:", req.params);
      
      const userId = req.user?.id || "main_user";
      const viajeId = req.params.id;

      if (!viajeId) {
        console.error("❌ [HIDE-VIAJE] ID de viaje inválido:", req.params.id);
        return res.status(400).json({ error: "ID de viaje inválido" });
      }

      debugLog("✅ [HIDE-VIAJE] Ocultando viaje:", viajeId, "User:", userId);
      const success = await storage.hideViaje(viajeId, userId);
      debugLog("✅ [HIDE-VIAJE] Resultado:", success);

      if (success) {
        debugLog("✅ [HIDE-VIAJE] Viaje ocultado exitosamente");
        res.json({ success: true, message: "Viaje ocultado correctamente" });
      } else {
        console.warn("⚠️ [HIDE-VIAJE] Viaje no encontrado:", viajeId);
        res.status(404).json({ error: "Viaje no encontrado" });
      }
    } catch (error) {
      console.error("❌ [HIDE-VIAJE] Error hiding viaje:", error);
      console.error("❌ [HIDE-VIAJE] Error stack:", error instanceof Error ? error.stack : String(error));
      res.status(500).json({ error: "Error al ocultar el viaje" });
    }
  });

  // Stats and financial summary
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/financial-summary", async (req, res) => {
    try {
      const summary = await storage.getFinancialSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  });

  // Transacciones de una cuenta específica de RodMar
  app.get("/api/transacciones/cuenta/:cuentaNombre", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Obtener permisos del usuario
      const userPermissions = await getUserPermissions(req.user.id);
      
      // Si el usuario tiene permisos de transacciones, puede ver TODAS las transacciones
      // (sin filtrar por userId) para mantener coherencia en tiempo real
      const hasTransactionPermissions = 
        userPermissions.includes("action.TRANSACCIONES.create") ||
        userPermissions.includes("action.TRANSACCIONES.completePending") ||
        userPermissions.includes("action.TRANSACCIONES.edit") ||
        userPermissions.includes("action.TRANSACCIONES.delete");
      
      // Obtener overrides del usuario para verificar denegaciones específicas
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, req.user.id));
      
      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey)
      );

      // Función para verificar si el usuario tiene permiso para ver una cuenta específica
      // Ahora soporta tanto códigos nuevos como nombres antiguos (compatibilidad)
      const tienePermisoCuenta = (codigoCuenta: string, nombreCuenta?: string): boolean => {
        const permisoPorCodigo = `module.RODMAR.account.${codigoCuenta}.view`;
        
        // PRIMERO: Verificar si tiene un override "deny" por código
        if (deniedPermissions.has(permisoPorCodigo)) {
          return false;
        }
        
        // SEGUNDO: Verificar permiso por código (nuevo sistema)
        if (userPermissions.includes(permisoPorCodigo)) {
          return true;
        }
        
        // TERCERO: Verificar permiso por nombre (compatibilidad con cuentas antiguas)
        if (nombreCuenta) {
          const permisoPorNombre = `module.RODMAR.account.${nombreCuenta}.view`;
          if (deniedPermissions.has(permisoPorNombre)) {
            return false;
          }
          if (userPermissions.includes(permisoPorNombre)) {
            return true;
          }
        }
        
        return false;
      };

      const { cuentaNombre } = req.params;
      
      // Detectar si el parámetro es un ID numérico o un nombre/slug
      const cuentaIdParam = parseInt(cuentaNombre);
      const esIdNumerico = !isNaN(cuentaIdParam);
      
      let cuentaEncontrada: any = null;
      let codigoCuenta = '';
      let nombreCuenta = '';
      
      if (esIdNumerico) {
        // Si es un ID numérico, buscar la cuenta en la BD
        const [cuenta] = await db
          .select()
          .from(rodmarCuentas)
          .where(eq(rodmarCuentas.id, cuentaIdParam))
          .limit(1);
        
        if (!cuenta) {
          return res.status(404).json({ error: "Cuenta no encontrada" });
        }
        
        cuentaEncontrada = cuenta;
        codigoCuenta = cuenta.codigo;
        nombreCuenta = cuenta.nombre;
      } else {
        // Si es un nombre/slug, buscar en la BD primero (para nuevas cuentas)
        // Convertir slug a nombre (para búsqueda)
        const cuentaNameFromSlug = (slug: string): string => {
          const map: Record<string, string> = {
            'bemovil': 'Bemovil',
            'corresponsal': 'Corresponsal',
            'efectivo': 'Efectivo',
            'cuentas-german': 'Cuentas German',
            'cuentas-jhon': 'Cuentas Jhon',
            'otros': 'Otros'
          };
          return map[slug.toLowerCase()] || slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        const nombreBuscar = cuentaNameFromSlug(cuentaNombre);
        
        // Buscar por nombre o código
        const cuentas = await db.select().from(rodmarCuentas);
        cuentaEncontrada = cuentas.find(c => 
          c.nombre.toLowerCase() === nombreBuscar.toLowerCase() || 
          c.codigo.toLowerCase() === cuentaNombre.toLowerCase()
        );
        
        if (cuentaEncontrada) {
          codigoCuenta = cuentaEncontrada.codigo;
          nombreCuenta = cuentaEncontrada.nombre;
        } else {
          // Fallback: usar el nombre del slug para compatibilidad con cuentas hardcodeadas antiguas
          codigoCuenta = nombreBuscar.toUpperCase().replace(/\s+/g, '_');
          nombreCuenta = nombreBuscar;
        }
      }

      // Verificar permisos usando código (y nombre para compatibilidad)
      if (!tienePermisoCuenta(codigoCuenta, nombreCuenta)) {
        return res.status(403).json({
          error: "No tienes permiso para ver esta cuenta",
          requiredPermission: `module.RODMAR.account.${codigoCuenta}.view`,
        });
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Mapear código/nombre a IDs de referencia para filtrar transacciones
      const referenciasPosibles: string[] = [];
      
      if (cuentaEncontrada) {
        // Usar ID numérico, código y slug legacy
        referenciasPosibles.push(cuentaEncontrada.id.toString());
        referenciasPosibles.push(cuentaEncontrada.codigo);
        
        // Agregar slug legacy si existe
        const codigoToSlug: Record<string, string> = {
          'BEMOVIL': 'bemovil',
          'CORRESPONSAL': 'corresponsal',
          'EFECTIVO': 'efectivo',
          'CUENTAS_GERMAN': 'cuentas-german',
          'CUENTAS_JHON': 'cuentas-jhon',
          'OTROS': 'otros',
        };
        const slugLegacy = codigoToSlug[cuentaEncontrada.codigo];
        if (slugLegacy) {
          referenciasPosibles.push(slugLegacy);
        }
      } else {
        // Fallback: usar el nombre convertido
        const cuentaNameToId = (nombre: string): string => {
          const map: Record<string, string> = {
            'Bemovil': 'bemovil',
            'bemovil': 'bemovil',
            'Corresponsal': 'corresponsal',
            'corresponsal': 'corresponsal',
            'Efectivo': 'efectivo',
            'efectivo': 'efectivo',
            'Cuentas German': 'cuentas-german',
            'cuentas-german': 'cuentas-german',
            'Cuentas Jhon': 'cuentas-jhon',
            'cuentas-jhon': 'cuentas-jhon',
            'Otros': 'otros',
            'otros': 'otros'
          };
          return map[nombre] || nombre.toLowerCase().replace(/\s+/g, '-');
        };
        referenciasPosibles.push(cuentaNameToId(cuentaNombre));
      }

      const cuentaId = referenciasPosibles[0] || cuentaNombre;
      
      // Leer parámetros de filtro
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      
      // Verificar si se deben incluir transacciones ocultas
      const includeHidden = req.query.includeHidden === 'true';
      
      // Nota: El ocultamiento de transacciones ahora se maneja localmente en el frontend
      // (ver useHiddenTransactions hook). Siempre obtenemos todas las transacciones.
      const allTransacciones = await storage.getTransacciones();

      // Filtrar transacciones que involucren esta cuenta específica
      // Usar todas las referencias posibles (ID, código, slug legacy) para encontrar transacciones
      let transaccionesCuenta = allTransacciones.filter((t: any) => {
        const deQuienIdLower = t.deQuienId?.toLowerCase() || '';
        const paraQuienIdLower = t.paraQuienId?.toLowerCase() || '';
        const referenciasLower = referenciasPosibles.map(r => r.toLowerCase());
        
        // Si la transacción viene de RodMar (deQuienTipo === 'rodmar') y tiene esta cuenta específica
        // O si va hacia RodMar (paraQuienTipo === 'rodmar') y tiene esta cuenta específica
        const esDeQuien = t.deQuienTipo === "rodmar" && 
          deQuienIdLower && 
          referenciasLower.includes(deQuienIdLower);
        
        const esParaQuien = t.paraQuienTipo === "rodmar" && 
          paraQuienIdLower && 
          referenciasLower.includes(paraQuienIdLower);
        
        return esDeQuien || esParaQuien;
      });

      // Aplicar filtro de búsqueda
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        transaccionesCuenta = transaccionesCuenta.filter((t: any) => {
          const fechaString = String(t.fecha);
          const fechaDirecta = t.fecha instanceof Date 
            ? t.fecha.toISOString().split('T')[0]
            : fechaString.includes('T') 
                ? fechaString.split('T')[0] 
                : fechaString;
          
          return (
            t.concepto?.toLowerCase().includes(searchLower) ||
            t.valor?.toString().includes(searchLower) ||
            t.comentario?.toLowerCase().includes(searchLower) ||
            t.observaciones?.toLowerCase().includes(searchLower) ||
            fechaDirecta.includes(searchLower)
          );
        });
      }

      // Aplicar filtro de fecha
      if (fechaDesde || fechaHasta) {
        transaccionesCuenta = transaccionesCuenta.filter((t: any) => {
          const fechaString = String(t.fecha);
          const fechaDirecta = t.fecha instanceof Date 
            ? t.fecha.toISOString().split('T')[0]
            : fechaString.includes('T') 
                ? fechaString.split('T')[0] 
                : fechaString;
          
          if (fechaDesde && fechaHasta) {
            return fechaDirecta >= fechaDesde && fechaDirecta <= fechaHasta;
          } else if (fechaDesde) {
            return fechaDirecta >= fechaDesde;
          } else if (fechaHasta) {
            return fechaDirecta <= fechaHasta;
          }
          return true;
        });
      }

      // Ordenar por fecha descendente
      transaccionesCuenta.sort(
        (a: any, b: any) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );

      // Si includeHidden=true, devolver todas las transacciones sin paginación (array directo)
      if (includeHidden) {
        return res.json(transaccionesCuenta);
      }

      // Aplicar paginación
      const total = transaccionesCuenta.length;
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const offset = (validPage - 1) * validLimit;
      const paginatedData = transaccionesCuenta.slice(offset, offset + validLimit);
      const totalPages = Math.ceil(total / validLimit);

      res.json({
        data: paginatedData,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages,
          hasMore: validPage < totalPages,
        },
      });
    } catch (error) {
      console.error("Error fetching account transactions:", error);
      res
        .status(500)
        .json({ error: "Error al obtener transacciones de la cuenta" });
    }
  });


  // ========== ENDPOINTS PARA CUENTAS RODMAR ==========

  // GET cuentas RodMar permitidas para el usuario (para UI)
  // NOTA: module.RODMAR.accounts.view habilita la pestaña, pero NO da acceso a cuentas.
  // El acceso real se controla por module.RODMAR.account.{CODIGO}.view (y compatibilidad legacy por nombre).
  app.get("/api/rodmar-cuentas", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const userPermissions = await getUserPermissions(req.user.id);
      const isUseMode = req.query.mode === "use";

      if (!isUseMode && !userPermissions.includes("module.RODMAR.accounts.view")) {
        return res.status(403).json({
          error: "No tienes permiso para ver esta sección",
          requiredPermission: "module.RODMAR.accounts.view",
        });
      }

      // Overrides del usuario para denegar cuentas específicas
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, req.user.id));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const todasLasCuentas = await db
        .select()
        .from(rodmarCuentas)
        .orderBy(rodmarCuentas.nombre);

      let cuentasPermitidas = todasLasCuentas;

      if (isUseMode) {
        const permissionExistsCache = new Map<string, boolean>();
        cuentasPermitidas = await filterEntitiesByUsePermission({
          entities: todasLasCuentas,
          userPermissions,
          deniedPermissions,
          permissionExistsCache,
          getPermissionKey: (cuenta) => `action.TRANSACCIONES.rodmar.account.${cuenta.codigo}.use`,
        });
      } else {
        cuentasPermitidas = todasLasCuentas.filter((cuenta) => {
          const permisoPorCodigo = `module.RODMAR.account.${cuenta.codigo}.view`;

          // deny explícito (override de usuario) siempre gana
          if (deniedPermissions.has(permisoPorCodigo)) {
            return false;
          }

          // permiso nuevo por código
          if (userPermissions.includes(permisoPorCodigo)) {
            return true;
          }

          // compatibilidad legacy por nombre
          const permisoPorNombre = `module.RODMAR.account.${cuenta.nombre}.view`;
          if (deniedPermissions.has(permisoPorNombre)) {
            return false;
          }
          if (userPermissions.includes(permisoPorNombre)) {
            return true;
          }

          // mapeo legacy nombre->codigo (fallback)
          const codigoMapeado = nombreToCodigoMap[cuenta.nombre];
          if (codigoMapeado && cuenta.codigo === codigoMapeado) {
            const permisoMapeado = `module.RODMAR.account.${cuenta.nombre}.view`;
            if (deniedPermissions.has(permisoMapeado)) {
              return false;
            }
            if (userPermissions.includes(permisoMapeado)) {
              return true;
            }
          }

          return false;
        });
      }

      res.json(cuentasPermitidas);
    } catch (error: any) {
      console.error("Error fetching RodMar cuentas:", error);
      res.status(500).json({ error: "Failed to fetch RodMar cuentas" });
    }
  });

  // GET todas las cuentas RodMar (administración)
  app.get("/api/rodmar-cuentas/all", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const todasLasCuentas = await db.select().from(rodmarCuentas).orderBy(rodmarCuentas.nombre);
      res.json(todasLasCuentas);
    } catch (error: any) {
      console.error("Error fetching RodMar cuentas (admin):", error);
      res.status(500).json({ error: "Failed to fetch RodMar cuentas" });
    }
  });

  // POST crear nueva cuenta RodMar
  app.post("/api/rodmar-cuentas", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      console.log(`[RODMAR-CREATE] Request body:`, req.body);
      const userId = req.user!.id;
      console.log(`[RODMAR-CREATE] User ID:`, userId);
      const data = insertRodmarCuentaSchema.parse(req.body);
      console.log(`[RODMAR-CREATE] Validated data:`, data);

      // Auto-generar código desde el nombre
      const codigoAutoGenerado = normalizeNombreToCodigo(data.nombre);

      // Validar que el código no exista
      const existing = await db
        .select()
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.codigo, codigoAutoGenerado))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: `Ya existe una cuenta con el código generado: ${codigoAutoGenerado}` });
      }

      // Crear la cuenta con el código auto-generado
      const [nuevaCuenta] = await db
        .insert(rodmarCuentas)
        .values({
          nombre: data.nombre,
          codigo: codigoAutoGenerado,
          userId,
        })
        .returning();

      // Crear el permiso automáticamente
      await createRodMarAccountPermission(nuevaCuenta.codigo, nuevaCuenta.nombre);
      await assignPermissionToAdminRole(`module.RODMAR.account.${nuevaCuenta.codigo}.view`);

      try {
        const useKey = `action.TRANSACCIONES.rodmar.account.${nuevaCuenta.codigo}.use`;
        const permissionId = await ensurePermission({
          key: useKey,
          descripcion: `Usar cuenta RodMar: ${nuevaCuenta.nombre}`,
          categoria: "action",
        });
        if (permissionId) {
          await assignPermissionToAdminRole(useKey);
          await assignAllowOverride(permissionId, userId);
        }
      } catch (permError) {
        console.warn("⚠️  No se pudo crear permiso use para cuenta RodMar:", permError);
      }

      res.status(201).json(nuevaCuenta);
    } catch (error: any) {
      console.error("Error creating RodMar cuenta:", error);
      if (error.name === 'ZodError') {
        console.error("ZodError details:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ 
          error: "Invalid data", 
          details: error.message,
          zodErrors: error.errors 
        });
      } else if (error.message?.includes('No se pudo generar')) {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Full error:", error);
        res.status(500).json({ error: "Failed to create RodMar cuenta", details: error.message });
      }
    }
  });

  // PATCH actualizar nombre de cuenta RodMar (actualiza código y migra transacciones)
  app.patch("/api/rodmar-cuentas/:id/nombre", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const cuentaId = parseInt(req.params.id);
      if (isNaN(cuentaId)) {
        return res.status(400).json({ error: "Invalid cuenta ID" });
      }

      const data = updateRodmarCuentaNombreSchema.parse(req.body);

      // Obtener la cuenta actual
      const [cuentaActual] = await db
        .select()
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.id, cuentaId))
        .limit(1);

      if (!cuentaActual) {
        return res.status(404).json({ error: "Cuenta not found" });
      }

      // Generar nuevo código desde el nuevo nombre
      const nuevoCodigo = normalizeNombreToCodigo(data.nombre);
      const codigoAnterior = cuentaActual.codigo;
      const idString = cuentaId.toString();

      // Mapeo de código antiguo a slug legacy (para compatibilidad)
      const codigoToSlug: Record<string, string> = {
        'BEMOVIL': 'bemovil',
        'CORRESPONSAL': 'corresponsal',
        'EFECTIVO': 'efectivo',
        'CUENTAS_GERMAN': 'cuentas-german',
        'CUENTAS_JHON': 'cuentas-jhon',
        'OTROS': 'otros',
      };
      const slugLegacy = codigoToSlug[codigoAnterior] || codigoAnterior.toLowerCase();

      // Si el código cambió, migrar transacciones y permisos
      if (nuevoCodigo !== codigoAnterior) {
        // Verificar que el nuevo código no esté en uso
        const codigoEnUso = await db
          .select()
          .from(rodmarCuentas)
          .where(
            and(
              eq(rodmarCuentas.codigo, nuevoCodigo),
              sql`${rodmarCuentas.id} != ${cuentaId}`
            )
          )
          .limit(1);

        if (codigoEnUso.length > 0) {
          return res.status(400).json({ error: `El código generado "${nuevoCodigo}" ya está en uso por otra cuenta` });
        }

        // Migrar dentro de una transacción
        await db.transaction(async (tx) => {
          // 1. Actualizar el nombre y código de la cuenta
          await tx
            .update(rodmarCuentas)
            .set({
              nombre: data.nombre,
              codigo: nuevoCodigo,
              updatedAt: new Date(),
            })
            .where(eq(rodmarCuentas.id, cuentaId));

          // 2. Migrar transacciones: actualizar referencias antiguas al nuevo código
          // Buscar todas las transacciones que referencian esta cuenta en cualquier formato
          const referenciasAntiguas = [codigoAnterior, slugLegacy, idString];
          
          // Obtener el nombre anterior y nuevo para actualizar el concepto
          const nombreAnterior = cuentaActual.nombre;
          const nombreNuevo = data.nombre;

          // OPTIMIZACIÓN: Migrar transacciones con bulk updates en lugar de uno por uno
          // Actualizar deQuienId donde aplica (bulk update)
          const condicionesDeQuien = referenciasAntiguas.map(ref => 
            sql`LOWER(CAST(${transacciones.deQuienId} AS TEXT)) = LOWER(${ref})`
          );
          
          if (condicionesDeQuien.length > 0) {
            await tx
              .update(transacciones)
              .set({ deQuienId: nuevoCodigo })
              .where(
                and(
                  eq(transacciones.deQuienTipo, 'rodmar'),
                  or(...condicionesDeQuien)
                )
              );
          }

          // Actualizar paraQuienId donde aplica (bulk update)
          const condicionesParaQuien = referenciasAntiguas.map(ref => 
            sql`LOWER(CAST(${transacciones.paraQuienId} AS TEXT)) = LOWER(${ref})`
          );
          
          if (condicionesParaQuien.length > 0) {
            await tx
              .update(transacciones)
              .set({ paraQuienId: nuevoCodigo })
              .where(
                and(
                  eq(transacciones.paraQuienTipo, 'rodmar'),
                  or(...condicionesParaQuien)
                )
              );
          }

          // Actualizar concepto donde contiene el nombre anterior (bulk update con REPLACE SQL)
          // Solo actualizar si el concepto realmente contiene el nombre anterior
          if (nombreAnterior && nombreNuevo && nombreAnterior !== nombreNuevo) {
            await tx
              .update(transacciones)
              .set({
                concepto: sql`REPLACE(${transacciones.concepto}, ${nombreAnterior}, ${nombreNuevo})`
              })
              .where(
                and(
                  sql`${transacciones.concepto} IS NOT NULL`,
                  sql`LOWER(CAST(${transacciones.concepto} AS TEXT)) LIKE ${'%' + nombreAnterior.toLowerCase() + '%'}`
                )
              );
          }

          // 3. Migrar permiso: crear nuevo permiso con el nuevo código
          const permisoAnteriorKey = `module.RODMAR.account.${codigoAnterior}.view`;
          const permisoLegacyNombreAnteriorKey = `module.RODMAR.account.${nombreAnterior}.view`;
          const permisoNuevoKey = `module.RODMAR.account.${nuevoCodigo}.view`;

          // Asegurar que el permiso nuevo exista (o reutilizarlo si ya existe)
          let nuevoPermisoId: number | null = null;
          const [permisoNuevoExistente] = await tx
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.key, permisoNuevoKey))
            .limit(1);

          if (permisoNuevoExistente) {
            nuevoPermisoId = permisoNuevoExistente.id;
            await tx
              .update(permissions)
              .set({ descripcion: `Ver cuenta RodMar: ${data.nombre}` })
              .where(eq(permissions.id, nuevoPermisoId));
          } else {
            const [nuevoPermiso] = await tx
              .insert(permissions)
              .values({
                key: permisoNuevoKey,
                descripcion: `Ver cuenta RodMar: ${data.nombre}`,
                categoria: "account",
              })
              .returning({ id: permissions.id });
            nuevoPermisoId = nuevoPermiso?.id ?? null;
          }

          if (!nuevoPermisoId) {
            throw new Error("No se pudo crear/obtener el permiso nuevo para la cuenta RodMar");
          }

          // Migrar asignaciones (roles + overrides) desde un permiso viejo hacia el permiso nuevo y eliminar el viejo
          const migratePermissionKey = async (oldKey: string) => {
            if (!oldKey || oldKey === permisoNuevoKey) return;

            const [oldPerm] = await tx
              .select({ id: permissions.id, key: permissions.key })
              .from(permissions)
              .where(eq(permissions.key, oldKey))
              .limit(1);

            if (!oldPerm) return;

            // Migrar asignaciones de roles
            const asignacionesRoles = await tx
              .select({
                roleId: rolePermissions.roleId,
              })
              .from(rolePermissions)
              .where(eq(rolePermissions.permissionId, oldPerm.id));

            for (const a of asignacionesRoles) {
              try {
                await tx.insert(rolePermissions).values({
                roleId: a.roleId,
                  permissionId: nuevoPermisoId!,
                });
              } catch (error: any) {
                if (error?.code !== "23505") throw error;
              }
            }

            // Migrar overrides por usuario (allow/deny) si existen
            const overrides = await tx
              .select({
                userId: userPermissionsOverride.userId,
                overrideType: userPermissionsOverride.overrideType,
              })
              .from(userPermissionsOverride)
              .where(eq(userPermissionsOverride.permissionId, oldPerm.id));

            for (const o of overrides) {
                try {
                await tx.insert(userPermissionsOverride).values({
                  userId: o.userId,
                  permissionId: nuevoPermisoId!,
                  overrideType: o.overrideType,
                });
                } catch (error: any) {
                if (error?.code !== "23505") throw error;
              }
            }

            // Limpiar relaciones y eliminar permiso viejo (para que no queden duplicados)
            await tx.delete(rolePermissions).where(eq(rolePermissions.permissionId, oldPerm.id));
            await tx.delete(userPermissionsOverride).where(eq(userPermissionsOverride.permissionId, oldPerm.id));
            await tx.delete(permissions).where(eq(permissions.id, oldPerm.id));

            debugLog(`✅ Permiso migrado y eliminado: ${oldPerm.key} → ${permisoNuevoKey}`);
          };

          // Migrar tanto el permiso por código anterior como cualquier permiso legacy por nombre anterior (si existía)
          await migratePermissionKey(permisoAnteriorKey);
          await migratePermissionKey(permisoLegacyNombreAnteriorKey);

          // 4. Migrar permiso USE por código
          const permisoUseAnteriorKey = `action.TRANSACCIONES.rodmar.account.${codigoAnterior}.use`;
          const permisoUseNuevoKey = `action.TRANSACCIONES.rodmar.account.${nuevoCodigo}.use`;

          let nuevoPermisoUseId: number | null = null;
          const [permisoUseNuevoExistente] = await tx
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.key, permisoUseNuevoKey))
            .limit(1);

          if (permisoUseNuevoExistente) {
            nuevoPermisoUseId = permisoUseNuevoExistente.id;
            await tx
              .update(permissions)
              .set({ descripcion: `Usar cuenta RodMar: ${data.nombre}` })
              .where(eq(permissions.id, nuevoPermisoUseId));
          } else {
            const [nuevoPermisoUse] = await tx
              .insert(permissions)
              .values({
                key: permisoUseNuevoKey,
                descripcion: `Usar cuenta RodMar: ${data.nombre}`,
                categoria: "action",
              })
              .returning({ id: permissions.id });
            nuevoPermisoUseId = nuevoPermisoUse?.id ?? null;
          }

          if (!nuevoPermisoUseId) {
            throw new Error("No se pudo crear/obtener el permiso use nuevo para la cuenta RodMar");
          }

          const migrateUsePermissionKey = async (oldKey: string) => {
            if (!oldKey || oldKey === permisoUseNuevoKey) return;

            const [oldPerm] = await tx
              .select({ id: permissions.id, key: permissions.key })
              .from(permissions)
              .where(eq(permissions.key, oldKey))
              .limit(1);

            if (!oldPerm) return;

            const asignacionesRoles = await tx
              .select({ roleId: rolePermissions.roleId })
              .from(rolePermissions)
              .where(eq(rolePermissions.permissionId, oldPerm.id));

            for (const a of asignacionesRoles) {
              try {
                await tx.insert(rolePermissions).values({
                  roleId: a.roleId,
                  permissionId: nuevoPermisoUseId!,
                });
              } catch (error: any) {
                if (error?.code !== "23505") throw error;
              }
            }

            const overrides = await tx
              .select({
                userId: userPermissionsOverride.userId,
                overrideType: userPermissionsOverride.overrideType,
              })
              .from(userPermissionsOverride)
              .where(eq(userPermissionsOverride.permissionId, oldPerm.id));

            for (const o of overrides) {
              try {
                await tx.insert(userPermissionsOverride).values({
                  userId: o.userId,
                  permissionId: nuevoPermisoUseId!,
                  overrideType: o.overrideType,
                });
              } catch (error: any) {
                if (error?.code !== "23505") throw error;
              }
            }

            await tx.delete(rolePermissions).where(eq(rolePermissions.permissionId, oldPerm.id));
            await tx.delete(userPermissionsOverride).where(eq(userPermissionsOverride.permissionId, oldPerm.id));
            await tx.delete(permissions).where(eq(permissions.id, oldPerm.id));
          };

          await migrateUsePermissionKey(permisoUseAnteriorKey);
        });

        debugLog(`✅ Cuenta migrada: ${codigoAnterior} → ${nuevoCodigo}`);

        // Asegurar que ADMIN tenga acceso a la cuenta (en caso de escenarios raros sin permiso previo)
        // (fuera de la transacción: usa helpers que consultan db global)
        await assignPermissionToAdminRole(`module.RODMAR.account.${nuevoCodigo}.view`);
        await assignPermissionToAdminRole(`action.TRANSACCIONES.rodmar.account.${nuevoCodigo}.use`);
      } else {
        // Si el código no cambió, actualizar nombre y descripción del permiso
        // y absorber (migrar + eliminar) cualquier permiso legacy por NOMBRE anterior si existiera.
        const nombreAnterior = cuentaActual.nombre;
        const permisoKey = `module.RODMAR.account.${codigoAnterior}.view`;
        const permisoLegacyNombreAnteriorKey = `module.RODMAR.account.${nombreAnterior}.view`;

        await db.transaction(async (tx) => {
          await tx
          .update(rodmarCuentas)
          .set({
            nombre: data.nombre,
            updatedAt: new Date(),
          })
          .where(eq(rodmarCuentas.id, cuentaId));

          // Asegurar descripción actualizada en el permiso por código
          await tx
          .update(permissions)
          .set({ descripcion: `Ver cuenta RodMar: ${data.nombre}` })
          .where(eq(permissions.key, permisoKey));

          // Asegurar descripción actualizada en el permiso use por código
          const permisoUseKey = `action.TRANSACCIONES.rodmar.account.${codigoAnterior}.use`;
          await tx
            .update(permissions)
            .set({ descripcion: `Usar cuenta RodMar: ${data.nombre}` })
            .where(eq(permissions.key, permisoUseKey));

          // Buscar ID del permiso por código
          const [permCodigo] = await tx
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.key, permisoKey))
            .limit(1);

          if (permCodigo) {
            // Si existe permiso legacy por nombre anterior, migrar asignaciones/overrides y eliminarlo
            const [permLegacy] = await tx
              .select({ id: permissions.id, key: permissions.key })
              .from(permissions)
              .where(eq(permissions.key, permisoLegacyNombreAnteriorKey))
              .limit(1);

            if (permLegacy && permLegacy.key !== permisoKey) {
              const asignacionesRoles = await tx
                .select({ roleId: rolePermissions.roleId })
                .from(rolePermissions)
                .where(eq(rolePermissions.permissionId, permLegacy.id));

              for (const a of asignacionesRoles) {
                try {
                  await tx.insert(rolePermissions).values({
                    roleId: a.roleId,
                    permissionId: permCodigo.id,
                  });
                } catch (error: any) {
                  if (error?.code !== "23505") throw error;
                }
              }

              const overrides = await tx
                .select({
                  userId: userPermissionsOverride.userId,
                  overrideType: userPermissionsOverride.overrideType,
                })
                .from(userPermissionsOverride)
                .where(eq(userPermissionsOverride.permissionId, permLegacy.id));

              for (const o of overrides) {
                try {
                  await tx.insert(userPermissionsOverride).values({
                    userId: o.userId,
                    permissionId: permCodigo.id,
                    overrideType: o.overrideType,
                  });
                } catch (error: any) {
                  if (error?.code !== "23505") throw error;
                }
              }

              await tx.delete(rolePermissions).where(eq(rolePermissions.permissionId, permLegacy.id));
              await tx.delete(userPermissionsOverride).where(eq(userPermissionsOverride.permissionId, permLegacy.id));
              await tx.delete(permissions).where(eq(permissions.id, permLegacy.id));

              debugLog(`✅ Permiso legacy por nombre absorbido y eliminado: ${permisoLegacyNombreAnteriorKey} → ${permisoKey}`);
            }
          }
        });
      }

      // Obtener la cuenta actualizada
      const [updated] = await db
        .select()
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.id, cuentaId))
        .limit(1);

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating RodMar cuenta nombre:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid data", details: error.message });
      } else if (error.message?.includes('No se pudo generar')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update RodMar cuenta" });
      }
    }
  });

  // DELETE eliminar cuenta RodMar (solo si no tiene transacciones)
  app.delete("/api/rodmar-cuentas/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const cuentaId = parseInt(req.params.id);
      if (isNaN(cuentaId)) {
        return res.status(400).json({ error: "Invalid cuenta ID" });
      }

      // Verificar que la cuenta existe
      const cuenta = await db
        .select()
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.id, cuentaId))
        .limit(1);

      if (cuenta.length === 0) {
        return res.status(404).json({ error: "Cuenta not found" });
      }

      // Verificar si tiene transacciones asociadas
      const transacciones = await storage.getTransacciones();
      const cuentaString = cuentaId.toString();
      const codigoToSlug: Record<string, string> = {
        'BEMOVIL': 'bemovil',
        'CORRESPONSAL': 'corresponsal',
        'EFECTIVO': 'efectivo',
        'CUENTAS_GERMAN': 'cuentas-german',
        'CUENTAS_JHON': 'cuentas-jhon',
        'OTROS': 'otros',
      };
      const slugLegacy = codigoToSlug[cuenta[0].codigo] || cuenta[0].codigo.toLowerCase();

      const tieneTransacciones = transacciones.some((t: any) => {
        return (
          (t.deQuienTipo === "rodmar" && (t.deQuienId === cuentaString || t.deQuienId === slugLegacy)) ||
          (t.paraQuienTipo === "rodmar" && (t.paraQuienId === cuentaString || t.paraQuienId === slugLegacy))
        );
      });

      if (tieneTransacciones) {
        return res.status(400).json({
          error: "No se puede eliminar esta cuenta porque tiene transacciones asociadas",
        });
      }

      // Eliminar permisos y asignaciones de roles antes de eliminar la cuenta
      const permisoKey = `module.RODMAR.account.${cuenta[0].codigo}.view`;
      const permisoUseKey = `action.TRANSACCIONES.rodmar.account.${cuenta[0].codigo}.use`;
      try {
        await deletePermissionByKey(permisoKey);
        await deletePermissionByKey(permisoUseKey);
        debugLog(`✅ Permisos eliminados: ${permisoKey}, ${permisoUseKey}`);
      } catch (permError) {
        console.warn("⚠️  No se pudieron eliminar permisos de cuenta RodMar:", permError);
      }

      // Eliminar la cuenta
      await db.delete(rodmarCuentas).where(eq(rodmarCuentas.id, cuentaId));

      res.json({ success: true, message: "Cuenta eliminada exitosamente" });
    } catch (error: any) {
      console.error("Error deleting RodMar cuenta:", error);
      res.status(500).json({ error: "Failed to delete RodMar cuenta" });
    }
  });

  // Balances de cuentas RodMar (LEE DE BD)
  app.get("/api/rodmar-accounts", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Obtener permisos del usuario
      const userPermissions = await getUserPermissions(req.user.id);
      
      // Logs solo en modo debug (reducir overhead en producción)
      if (process.env.DEBUG_RODMAR === 'true') {
        console.log(`[RODMAR-ACCOUNTS] Usuario: ${req.user.id}`);
        console.log(`[RODMAR-ACCOUNTS] Permisos del usuario (${userPermissions.length}):`, userPermissions.filter(p => p.includes('RODMAR')));
      }

      const transacciones = await storage.getTransacciones();

      // Obtener overrides del usuario para verificar denegaciones específicas
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, req.user.id));
      
      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey)
      );
      
      // Obtener TODAS las cuentas de la BD
      const todasLasCuentas = await db.select().from(rodmarCuentas);

      // Filtrar cuentas según permisos del usuario (usando código, no nombre)
      // module.RODMAR.accounts.view SOLO habilita la pestaña; el acceso real es por
      // module.RODMAR.account.{CODIGO}.view (y compatibilidad legacy por nombre).
      const cuentasRodMar = todasLasCuentas.filter((cuenta) => {
        const permisoCuenta = `module.RODMAR.account.${cuenta.codigo}.view`;
        
        // Verificar si tiene un override "deny"
        if (deniedPermissions.has(permisoCuenta)) {
          if (process.env.DEBUG_RODMAR === 'true') {
            console.log(`[RODMAR-ACCOUNTS] Cuenta "${cuenta.nombre}" (${cuenta.codigo}): DENEGADA por override`);
          }
          return false;
        }
        
        // Verificar si tiene el permiso específico con el código nuevo
        if (userPermissions.includes(permisoCuenta)) {
          if (process.env.DEBUG_RODMAR === 'true') {
            console.log(`[RODMAR-ACCOUNTS] Cuenta "${cuenta.nombre}" (${cuenta.codigo}): PERMITIDA (permiso específico por código)`);
          }
          return true;
        }
        
        // Verificar permisos antiguos (por nombre) - mapeo de compatibilidad
        const permisoAntiguoPorNombre = `module.RODMAR.account.${cuenta.nombre}.view`;
        if (userPermissions.includes(permisoAntiguoPorNombre)) {
          if (process.env.DEBUG_RODMAR === 'true') {
            console.log(`[RODMAR-ACCOUNTS] Cuenta "${cuenta.nombre}" (${cuenta.codigo}): PERMITIDA (permiso antiguo por nombre - mapeado)`);
          }
          return true;
        }
        
        // Verificar mapeo de nombres antiguos a códigos
        const codigoMapeado = nombreToCodigoMap[cuenta.nombre];
        if (codigoMapeado && cuenta.codigo === codigoMapeado) {
          const permisoMapeado = `module.RODMAR.account.${cuenta.nombre}.view`;
          if (userPermissions.includes(permisoMapeado)) {
            if (process.env.DEBUG_RODMAR === 'true') {
              console.log(`[RODMAR-ACCOUNTS] Cuenta "${cuenta.nombre}" (${cuenta.codigo}): PERMITIDA (permiso mapeado)`);
            }
            return true;
          }
        }
        
        if (process.env.DEBUG_RODMAR === 'true') {
          console.log(`[RODMAR-ACCOUNTS] Cuenta "${cuenta.nombre}" (${cuenta.codigo}): DENEGADA (sin permiso)`);
        }
        return false;
      });
      
      // Logs solo en modo debug
      if (process.env.DEBUG_RODMAR === 'true') {
        console.log(`[RODMAR-ACCOUNTS] Total cuentas: ${todasLasCuentas.length}, Cuentas permitidas: ${cuentasRodMar.length}`);
        console.log(`[RODMAR-ACCOUNTS] Cuentas permitidas:`, cuentasRodMar.map(c => c.nombre));
      }

      // Calcular balance de cada cuenta permitida
      // NOTA: Las transacciones existentes pueden usar slugs ("bemovil"), IDs numéricos ("1"), o códigos nuevos ("BEMOVIL")
      // Necesitamos soportar todos los formatos durante la migración
      const balancesCuentas = cuentasRodMar.map((cuenta) => {
        let ingresos = 0;
        let egresos = 0;

        // Mapeo de código a slug legacy (para compatibilidad con transacciones antiguas)
        const codigoToSlug: Record<string, string> = {
          'BEMOVIL': 'bemovil',
          'CORRESPONSAL': 'corresponsal',
          'EFECTIVO': 'efectivo',
          'CUENTAS_GERMAN': 'cuentas-german',
          'CUENTAS_JHON': 'cuentas-jhon',
          'OTROS': 'otros',
        };
        const slugLegacy = codigoToSlug[cuenta.codigo];
        const idString = cuenta.id.toString();
        
        // Array de valores posibles que pueden referenciar esta cuenta
        const referenciasPosibles = [
          idString,              // ID numérico: "1", "2", etc.
          cuenta.codigo,         // Código nuevo: "BEMOVIL", "LUZ", etc.
        ];
        
        // Agregar slug legacy solo si existe (para cuentas antiguas)
        if (slugLegacy) {
          referenciasPosibles.push(slugLegacy);
        }

        // Filtrar transacciones que afectan esta cuenta específica
        transacciones.forEach((transaccion: any) => {
          const valor = parseFloat(transaccion.valor || "0");

          // Verificar si la transacción sale de RodMar desde esta cuenta específica (EGRESO)
          // Debe verificar solo deQuienId, no usar || paraQuienId
          if (transaccion.deQuienTipo === "rodmar" && transaccion.deQuienId) {
            if (referenciasPosibles.includes(transaccion.deQuienId)) {
              egresos += valor;
            }
          }

          // Verificar si la transacción llega a RodMar a esta cuenta específica (INGRESO)
          // Debe verificar solo paraQuienId, no usar || deQuienId
          if (transaccion.paraQuienTipo === "rodmar" && transaccion.paraQuienId) {
            if (referenciasPosibles.includes(transaccion.paraQuienId)) {
              ingresos += valor;
            }
          }
        });

        return {
          id: cuenta.id,
          cuenta: cuenta.nombre,
          codigo: cuenta.codigo,
          ingresos,
          egresos,
          balance: ingresos - egresos,
        };
      });

      res.json(balancesCuentas);
    } catch (error) {
      console.error("Error calculating RodMar account balances:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch RodMar account balances" });
    }
  });

  // Serve test conflict file for download
  app.get("/api/download/test-conflict", (req, res) => {
    const csvContent = `FechaCargue,FechaDescargue,Conductor,TipoCarro,Placa,MinaNombre,CompradorNombre,Peso,PrecioCompraTon,VentaTon,FleteTon,OtrosGastoFletes,ID
2024-10-15,2024-10-16,Test Driver,Sencillo,TEST123,Mina El Dorado,Cemex S.A.,20,150000,300000,120000,0,TRP001`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="simple-conflict-test.csv"',
    );
    res.send(csvContent);
  });

  // Endpoint para servir imágenes de recibos
  app.get("/recibo/:tripId", async (req, res) => {
    try {
      const { tripId } = req.params;
      console.log(
        `=== GET /recibo/${tripId} - Solicitando imagen de recibo ===`,
      );

      const viaje = await storage.getViaje(tripId);
      if (!viaje || !viaje.recibo) {
        debugLog(`❌ Viaje ${tripId} no encontrado o sin recibo`);
        return res.status(404).json({ error: "Recibo no encontrado" });
      }

      // Normalizar: algunos recibos se guardan como "|IMAGE:<data:image/...>"
      const reciboRaw = typeof viaje.recibo === "string" ? viaje.recibo : String(viaje.recibo);
      const recibo = reciboRaw.startsWith("|IMAGE:") ? reciboRaw.substring("|IMAGE:".length) : reciboRaw;

      // Verificar si el recibo es una imagen base64
      if (!recibo.startsWith("data:image/")) {
        debugLog(`❌ Recibo de ${tripId} no es una imagen válida`);
        return res.status(400).json({ error: "Formato de imagen no válido" });
      }

      // Extraer el tipo de imagen y los datos base64
      const matches = recibo.match(
        /^data:image\/([a-zA-Z]+);base64,(.+)$/,
      );
      if (!matches) {
        debugLog(`❌ Formato base64 inválido para ${tripId}`);
        return res.status(400).json({ error: "Formato base64 no válido" });
      }

      const imageType = matches[1];
      const imageData = matches[2];
      const imageBuffer = Buffer.from(imageData, "base64");

      console.log(
        `✅ Sirviendo imagen ${imageType} para viaje ${tripId}, tamaño: ${imageBuffer.length} bytes`,
      );

      // Configurar headers apropiados
      res.set({
        "Content-Type": `image/${imageType}`,
        "Content-Length": imageBuffer.length,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="recibo_${tripId}.${imageType}"`,
      });

      res.send(imageBuffer);
    } catch (error) {
      console.error("❌ Error sirviendo imagen de recibo:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // GET individual viaje (must be at the end after all specific routes)
  app.get("/api/viajes/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const viaje = await storage.getViaje(id);
      if (!viaje) {
        return res.status(404).json({ error: "Viaje not found" });
      }
      res.json(viaje);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viaje" });
    }
  });

  // Investment routes
  app.get("/api/inversiones", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const inversiones = await storage.getInversiones(userId);
      res.json(inversiones);
    } catch (error) {
      console.error("Error fetching inversiones:", error);
      res.status(500).json({ error: "Failed to fetch inversiones" });
    }
  });

  app.get(
    "/api/inversiones/destino/:destino/:detalle",
    requireAuth,
    async (req, res) => {
      try {
        const { destino, detalle } = req.params;
        const userId = req.user?.id;
        const inversiones = await storage.getInversionesByDestino(
          destino,
          detalle,
          userId,
        );
        res.json(inversiones);
      } catch (error) {
        console.error("Error fetching inversiones by destino:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch inversiones by destino" });
      }
    },
  );

  // Endpoint para obtener inversiones de una cuenta específica de RodMar
  app.get(
    "/api/inversiones/cuenta/:cuentaId",
    requireAuth,
    async (req, res) => {
      try {
        const { cuentaId } = req.params;
        const userId = req.user?.id;
        const inversiones = await storage.getInversiones(userId);

        // Filtrar inversiones que involucren esta cuenta específica
        const inversionesCuenta = inversiones.filter((inversion: any) => {
          // Si la inversión tiene origen en RodMar con esta cuenta específica
          const isOrigenCuenta =
            inversion.origen === "rodmar" &&
            inversion.origenDetalle === cuentaId;
          // Si la inversión tiene destino en RodMar con esta cuenta específica
          const isDestinoCuenta =
            inversion.destino === "rodmar" &&
            inversion.destinoDetalle === cuentaId;
          // Si la cuenta es una cuenta específica de Postobón/LCDM
          const isOrigenDirecto = inversion.origen === cuentaId;
          const isDestinoDirecto = inversion.destino === cuentaId;

          return (
            isOrigenCuenta ||
            isDestinoCuenta ||
            isOrigenDirecto ||
            isDestinoDirecto
          );
        });

        // Ordenar por fecha descendente
        inversionesCuenta.sort(
          (a: any, b: any) =>
            new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        );

        res.json(inversionesCuenta);
      } catch (error) {
        console.error("Error fetching inversiones for account:", error);
        res
          .status(500)
          .json({ error: "Error al obtener inversiones de la cuenta" });
      }
    },
  );

  app.post("/api/inversiones", requireAuth, async (req, res) => {
    try {
      const validatedData = insertInversionSchema.parse(req.body);
      const userId = req.user?.id;
      const inversion = await storage.createInversion({
        ...validatedData,
        userId,
      });
      res.status(201).json(inversion);
    } catch (error) {
      console.error("Error creating inversion:", error);
      res.status(400).json({ error: "Failed to create inversion" });
    }
  });

  app.patch(
    "/api/inversiones/:id",
    requireAuth,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const userId = req.user?.id;

        const updatedInversion = await storage.updateInversion(
          id,
          updates,
          userId,
        );

        if (!updatedInversion) {
          return res.status(404).json({ error: "Inversion not found" });
        }

        res.json(updatedInversion);
      } catch (error) {
        console.error("Error updating inversion:", error);
        res.status(500).json({ error: "Failed to update inversion" });
      }
    },
  );

  app.delete(
    "/api/inversiones/:id",
    requireAuth,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user?.id;

        const success = await storage.deleteInversion(id, userId);

        if (!success) {
          return res.status(404).json({ error: "Inversion not found" });
        }

        res.json({ message: "Inversion deleted successfully" });
      } catch (error) {
        console.error("Error deleting inversion:", error);
        res.status(500).json({ error: "Failed to delete inversion" });
      }
    },
  );

  // ===== ENDPOINTS ESPECÍFICOS PARA DESOCULTAMIENTO AUTOMÁTICO DE MINAS =====

  // Endpoint para mostrar todas las transacciones ocultas de una mina específica
  app.post(
    "/api/transacciones/socio/mina/:minaId/show-all",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";
        const minaId = parseInt(req.params.minaId);

        if (isNaN(minaId)) {
          return res.status(400).json({ error: "ID de mina inválido" });
        }

        // Mostrar todas las transacciones ocultas específicamente de esta mina
        const updatedCount = await storage.showAllHiddenTransaccionesForMina(
          minaId,
          userId,
        );

        console.log(
          `🔄 Mostrando ${updatedCount} transacciones ocultas de mina ${minaId}`,
        );

        res.json({
          success: true,
          message: `${updatedCount} transacciones restauradas para la mina`,
          updatedCount,
        });
      } catch (error) {
        console.error("Error showing hidden transactions for mina:", error);
        res
          .status(500)
          .json({ error: "Error al mostrar transacciones ocultas de la mina" });
      }
    },
  );

  // Endpoint para mostrar todos los viajes ocultos de una mina específica
  app.post("/api/viajes/mina/:minaId/show-all", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const minaId = parseInt(req.params.minaId);

      if (isNaN(minaId)) {
        return res.status(400).json({ error: "ID de mina inválido" });
      }

      // Mostrar todos los viajes ocultos específicamente de esta mina
      const updatedCount = await storage.showAllHiddenViajesForMina(
        minaId,
        userId,
      );

      console.log(
        `🔄 Mostrando ${updatedCount} viajes ocultos de mina ${minaId}`,
      );

      res.json({
        success: true,
        message: `${updatedCount} viajes restaurados para la mina`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error showing hidden viajes for mina:", error);
      res
        .status(500)
        .json({ error: "Error al mostrar viajes ocultos de la mina" });
    }
  });

  // Endpoint para mostrar todas las transacciones ocultas de un volquetero específico
  app.post(
    "/api/transacciones/socio/volquetero/:volqueteroId/show-all",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";
        const volqueteroId = parseInt(req.params.volqueteroId);

        if (isNaN(volqueteroId)) {
          return res.status(400).json({ error: "ID de volquetero inválido" });
        }

        // Mostrar todas las transacciones ocultas específicamente de este volquetero
        const updatedCount = await storage.showAllHiddenTransaccionesForVolquetero(
          volqueteroId,
          userId,
        );

        console.log(
          `🔄 Mostrando ${updatedCount} transacciones ocultas de volquetero ${volqueteroId}`,
        );

        res.json({
          success: true,
          message: `${updatedCount} transacciones restauradas para el volquetero`,
          updatedCount,
        });
      } catch (error) {
        console.error("Error showing hidden transactions for volquetero:", error);
        res
          .status(500)
          .json({ error: "Error al mostrar transacciones ocultas del volquetero" });
      }
    },
  );

  // Endpoint para mostrar todos los viajes ocultos de un volquetero específico
  app.post("/api/viajes/volquetero/:volqueteroNombre/show-all", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const volqueteroNombre = decodeURIComponent(req.params.volqueteroNombre);

      if (!volqueteroNombre) {
        return res.status(400).json({ error: "Nombre de volquetero inválido" });
      }

      // Mostrar todos los viajes ocultos específicamente de este volquetero
      const updatedCount = await storage.showAllHiddenViajesForVolquetero(
        volqueteroNombre,
        userId,
      );

      console.log(
        `🔄 Mostrando ${updatedCount} viajes ocultos de volquetero ${volqueteroNombre}`,
      );

      res.json({
        success: true,
        message: `${updatedCount} viajes restaurados para el volquetero`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error showing hidden viajes for volquetero:", error);
      res
        .status(500)
        .json({ error: "Error al mostrar viajes ocultos del volquetero" });
    }
  });

  // ===== ENDPOINTS DE VALIDACIÓN Y MANTENIMIENTO DE BALANCES =====

  // Obtener minas con balance desactualizado
  app.get("/api/maintenance/stale-balances", async (req, res) => {
    try {
      const staleMinasList = await storage.getMinasWithStaleBalance();
      res.json({
        count: staleMinasList.length,
        minas: staleMinasList.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          balanceCalculado: m.balanceCalculado,
          ultimoRecalculo: m.ultimoRecalculo,
        })),
      });
    } catch (error) {
      console.error("Error fetching stale balances:", error);
      res
        .status(500)
        .json({ error: "Error al obtener balances desactualizados" });
    }
  });

  // Recalcular balance de una mina específica
  app.post("/api/maintenance/recalculate-balance/:minaId", async (req, res) => {
    try {
      const minaId = parseInt(req.params.minaId);

      if (isNaN(minaId)) {
        return res.status(400).json({ error: "ID de mina inválido" });
      }

      await storage.calculateAndUpdateMinaBalance(minaId);

      res.json({
        success: true,
        message: `Balance recalculado para mina ${minaId}`,
        minaId,
      });
    } catch (error) {
      console.error(
        `Error recalculando balance para mina ${req.params.minaId}:`,
        error,
      );
      res.status(500).json({ error: "Error al recalcular balance de la mina" });
    }
  });

  // Validar si balance pre-calculado coincide con cálculo manual
  app.get("/api/maintenance/validate-balance/:minaId", async (req, res) => {
    try {
      const minaId = parseInt(req.params.minaId);

      if (isNaN(minaId)) {
        return res.status(400).json({ error: "ID de mina inválido" });
      }

      const validation = await storage.validateMinaBalance(minaId);

      res.json({
        minaId,
        valid: validation.valid,
        difference: validation.difference,
        balancePrecalculado: validation.precalculado,
        balanceManual: validation.manual,
        status: validation.valid
          ? "✅ Balance correcto"
          : "⚠️ Balance discrepante",
      });
    } catch (error) {
      console.error(
        `Error validando balance para mina ${req.params.minaId}:`,
        error,
      );
      res.status(500).json({ error: "Error al validar balance de la mina" });
    }
  });

  // Recalcular todos los balances del sistema
  app.post("/api/maintenance/recalculate-all-balances", async (req, res) => {
    try {
      console.log("🔄 Iniciando recálculo masivo de balances...");
      const startTime = Date.now();

      await storage.recalculateAllBalances();

      const endTime = Date.now();
      const duration = endTime - startTime;

      debugLog(`✅ Recálculo masivo completado en ${duration}ms`);

      res.json({
        success: true,
        message: "Todos los balances han sido recalculados correctamente",
        duration: `${duration}ms`,
      });
    } catch (error) {
      console.error("Error en recálculo masivo:", error);
      res.status(500).json({ error: "Error al recalcular todos los balances" });
    }
  });

  // Marcar balance como desactualizado (para testing)
  app.post("/api/maintenance/mark-stale/:minaId", async (req, res) => {
    try {
      const minaId = parseInt(req.params.minaId);

      if (isNaN(minaId)) {
        return res.status(400).json({ error: "ID de mina inválido" });
      }

      await storage.markMinaBalanceStale(minaId);

      res.json({
        success: true,
        message: `Balance marcado como desactualizado para mina ${minaId}`,
        minaId,
      });
    } catch (error) {
      console.error(
        `Error marcando balance como stale para mina ${req.params.minaId}:`,
        error,
      );
      res
        .status(500)
        .json({ error: "Error al marcar balance como desactualizado" });
    }
  });

  // ===== ENDPOINTS DE FUSIÓN DE ENTIDADES =====

  // Fusionar volqueteros
  app.post(
    "/api/volqueteros/merge",
    requireAuth,
    async (req, res) => {
      try {
        const { origenId, destinoId } = fusionSchema.parse(req.body);
        const userId = req.user!.id;

        if (origenId === destinoId) {
          return res
            .status(400)
            .json({ error: "No se puede fusionar una entidad consigo misma" });
        }

        const result = await storage.mergeVolqueteros(
          origenId,
          destinoId,
          userId,
        );

        console.log(
          `🔄 Fusión de volqueteros: ${origenId} → ${destinoId} completada`,
        );
        res.json({
          success: true,
          message: `Volqueteros fusionados exitosamente`,
          fusionId: result.fusionId,
          transaccionesTransferidas: result.transaccionesTransferidas,
          viajesTransferidos: result.viajesTransferidos,
        });
      } catch (error) {
        console.error("Error merging volqueteros:", error);
        res.status(500).json({ error: "Error al fusionar volqueteros" });
      }
    },
  );

  // Fusionar minas
  app.post(
    "/api/minas/merge",
    requireAuth,
    async (req, res) => {
      try {
        const { origenId, destinoId } = fusionSchema.parse(req.body);
        const userId = req.user!.id;

        if (origenId === destinoId) {
          return res
            .status(400)
            .json({ error: "No se puede fusionar una entidad consigo misma" });
        }

        const result = await storage.mergeMinas(origenId, destinoId, userId);

        console.log(
          `🔄 Fusión de minas: ${origenId} → ${destinoId} completada`,
        );
        res.json({
          success: true,
          message: `Minas fusionadas exitosamente`,
          fusionId: result.fusionId,
          transaccionesTransferidas: result.transaccionesTransferidas,
          viajesTransferidos: result.viajesTransferidos,
        });
      } catch (error) {
        console.error("Error merging minas:", error);
        res.status(500).json({ error: "Error al fusionar minas" });
      }
    },
  );

  // Fusionar compradores
  app.post(
    "/api/compradores/merge",
    requireAuth,
    async (req, res) => {
      try {
        console.log("🔄 INICIO - Fusión de compradores solicitada");
        console.log("📝 Request body:", req.body);

        const { origenId, destinoId } = fusionSchema.parse(req.body);
        const userId = req.user!.id;

        console.log(
          `📊 Parámetros de fusión: origen=${origenId}, destino=${destinoId}, userId=${userId}`,
        );

        if (origenId === destinoId) {
          console.log("❌ Error: Intentando fusionar entidad consigo misma");
          return res
            .status(400)
            .json({ error: "No se puede fusionar una entidad consigo misma" });
        }

        console.log("🏗️ Iniciando proceso de fusión en storage...");
        const result = await storage.mergeCompradores(
          origenId,
          destinoId,
          userId,
        );

        console.log(
          `✅ Fusión de compradores completada: ${origenId} → ${destinoId}`,
        );
        console.log("📊 Resultado:", result);

        res.json({
          success: true,
          message: `Compradores fusionados exitosamente`,
          fusionId: result.fusionId,
          transaccionesTransferidas: result.transaccionesTransferidas,
          viajesTransferidos: result.viajesTransferidos,
        });
      } catch (error) {
        console.error("💥 ERROR DETALLADO merging compradores:", error);
        console.error("📱 Tipo de error:", typeof error);
        console.error(
          "📱 Stack trace:",
          error instanceof Error ? error.stack : "No stack available",
        );
        console.error(
          "📱 Message:",
          error instanceof Error ? error.message : String(error),
        );
        res
          .status(500)
          .json({
            error: `Error al fusionar compradores: ${error instanceof Error ? error.message : String(error)}`,
          });
      }
    },
  );

  // Obtener historial de fusiones
  app.get(
    "/api/fusion-history",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const historial = await storage.getFusionHistory(userId);

        res.json(historial);
      } catch (error) {
        console.error("Error fetching fusion history:", error);
        res
          .status(500)
          .json({ error: "Error al obtener historial de fusiones" });
      }
    },
  );

  // Revertir fusión
  app.post(
    "/api/fusion/revert",
    requireAuth,
    async (req, res) => {
      try {
        const { fusionId } = revertFusionSchema.parse(req.body);
        const userId = req.user!.id;

        const result = await storage.revertFusion(fusionId, userId);

        console.log(`🔄 Reversión de fusión ID ${fusionId} completada`);
        res.json({
          success: true,
          message: `Fusión revertida exitosamente`,
          entidadRestaurada: result.entidadRestaurada,
          transaccionesRestauradas: result.transaccionesRestauradas,
          viajesRestaurados: result.viajesRestaurados,
        });
      } catch (error) {
        console.error("Error reverting fusion:", error);
        res.status(500).json({ error: "Error al revertir fusión" });
      }
    },
  );

  // ============================================
  // ADMIN ENDPOINTS - Gestión de Roles y Permisos
  // ============================================

  // Listar todos los roles con sus permisos
  app.get("/api/admin/roles", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const allRoles = await db.select().from(roles).orderBy(roles.nombre);
      
      // Para cada rol, obtener sus permisos
      const rolesWithPermissions = await Promise.all(
        allRoles.map(async (role) => {
          const rolePerms = await db
            .select({
              permissionId: permissions.id,
              permissionKey: permissions.key,
              descripcion: permissions.descripcion,
              categoria: permissions.categoria,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, role.id));

          return {
            ...role,
            permissions: rolePerms,
          };
        })
      );

      res.json(rolesWithPermissions);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Error al obtener roles" });
    }
  });

  // Diagnóstico: terceros visibles para un usuario específico
  app.get("/api/admin/terceros/visible", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const shouldLog = req.query.log === "1" || req.query.log === "true";

      if (!userId) {
        return res.status(400).json({ error: "userId es requerido" });
      }

      const [user] = await db
        .select({ id: users.id, roleId: users.roleId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const userPermissions = await getUserPermissions(userId);
      const userOverrides = await db
        .select({
          permissionKey: permissions.key,
          overrideType: userPermissionsOverride.overrideType,
        })
        .from(userPermissionsOverride)
        .innerJoin(permissions, eq(userPermissionsOverride.permissionId, permissions.id))
        .where(eq(userPermissionsOverride.userId, userId));

      const deniedPermissions = new Set(
        userOverrides.filter((o) => o.overrideType === "deny").map((o) => o.permissionKey),
      );

      const terceros = await storage.getTerceros();
      const visible: Array<{ id: number; nombre: string; permisoKey: string; reason: string }> = [];
      const denied: Array<{ id: number; nombre: string; permisoKey: string; reason: string }> = [];

      terceros.forEach((tercero) => {
        const permisoKey = getTerceroPermissionKey(tercero.id);
        const isDenied = deniedPermissions.has(permisoKey);
        const isAllowed = userPermissions.includes(permisoKey);

        if (!isDenied && isAllowed) {
          visible.push({
            id: tercero.id,
            nombre: tercero.nombre,
            permisoKey,
            reason: "allow",
          });
        } else {
          denied.push({
            id: tercero.id,
            nombre: tercero.nombre,
            permisoKey,
            reason: isDenied ? "deny" : "missing",
          });
        }
      });

      const result = {
        userId,
        total: terceros.length,
        visibleCount: visible.length,
        deniedCount: denied.length,
        visible,
        denied,
      };

      if (shouldLog) {
        console.log("🔎 Diagnóstico terceros visibles:", result);
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching terceros visibles:", error);
      res.status(500).json({ error: "Error al obtener terceros visibles" });
    }
  });

  // Crear nuevo rol
  app.post("/api/admin/roles", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const { nombre, descripcion, permissionIds } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: "El nombre del rol es requerido" });
      }

      // Crear el rol
      const [newRole] = await db
        .insert(roles)
        .values({
          nombre: nombre.toUpperCase(),
          descripcion: descripcion || null,
        })
        .returning();

      // Asignar permisos si se proporcionaron
      if (Array.isArray(permissionIds) && permissionIds.length > 0) {
        const rolePerms = permissionIds.map((permissionId: number) => ({
          roleId: newRole.id,
          permissionId,
        }));

        await db.insert(rolePermissions).values(rolePerms);
      }

      res.json(newRole);
    } catch (error: any) {
      console.error("Error creating role:", error);
      if (error.code === "23505") {
        // Unique violation
        res.status(400).json({ error: "Ya existe un rol con ese nombre" });
      } else {
        res.status(500).json({ error: "Error al crear rol" });
      }
    }
  });

  // Actualizar rol y sus permisos
  app.put("/api/admin/roles/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const { nombre, descripcion, permissionIds } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: "El nombre del rol es requerido" });
      }

      // 1. Obtener el rol actual
      const [currentRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      if (!currentRole) {
        return res.status(404).json({ error: "Rol no encontrado" });
      }

      // 2. Normalizar el nombre (mayúsculas y trim)
      const normalizedNombre = nombre.toUpperCase().trim();
      const normalizedCurrentNombre = (currentRole.nombre || "").toUpperCase().trim();

      // 3. Construir objeto de actualización condicionalmente
      const updateData: { nombre?: string; descripcion: string | null; updatedAt: Date } = {
        descripcion: descripcion || null,
        updatedAt: new Date(),
      };

      // 4. Solo actualizar el nombre si realmente cambió (comparando ambos normalizados)
      if (normalizedNombre !== normalizedCurrentNombre) {
        // Verificar que no exista otro rol con ese nombre
        const [existingRole] = await db
          .select()
          .from(roles)
          .where(eq(roles.nombre, normalizedNombre))
          .limit(1);

        if (existingRole && existingRole.id !== roleId) {
          return res.status(400).json({ error: "Ya existe un rol con ese nombre" });
        }

        updateData.nombre = normalizedNombre;
      }

      // 5. Actualizar el rol (solo con los campos que cambiaron)
      const [updatedRole] = await db
        .update(roles)
        .set(updateData)
        .where(eq(roles.id, roleId))
        .returning();

      // 6. Actualizar permisos: calcular diferencias y actualizar solo lo necesario (en una transacción)
      await db.transaction(async (tx) => {
        // Obtener permisos actuales del rol
        const currentPerms = await tx
          .select({ permissionId: rolePermissions.permissionId })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));

        const currentPermissionIds = new Set(currentPerms.map(p => p.permissionId));

        // Procesar permissionIds del request
        const newPermissionIds = Array.isArray(permissionIds) 
          ? Array.from(new Set(permissionIds.filter((id: any) => typeof id === 'number' && !isNaN(id))))
          : [];
        const newPermissionIdsSet = new Set(newPermissionIds);

        // Encontrar permisos a eliminar (están en current pero no en new)
        const toDelete = Array.from(currentPermissionIds).filter(id => !newPermissionIdsSet.has(id));
        
        // Encontrar permisos a insertar (están en new pero no en current)
        const toInsert = newPermissionIds.filter(id => !currentPermissionIds.has(id));

        // Eliminar permisos que ya no están en la nueva lista
        if (toDelete.length > 0) {
          await tx
            .delete(rolePermissions)
            .where(
              and(
                eq(rolePermissions.roleId, roleId),
                inArray(rolePermissions.permissionId, toDelete)
              )
            );
        }

        // Insertar nuevos permisos (verificando que no existan antes)
        if (toInsert.length > 0) {
          // Verificar que los permisos realmente no existan (por si acaso)
          const existingCheck = await tx
            .select({ permissionId: rolePermissions.permissionId })
            .from(rolePermissions)
            .where(
              and(
                eq(rolePermissions.roleId, roleId),
                inArray(rolePermissions.permissionId, toInsert)
              )
            );
          
          const existingPermissionIds = new Set(existingCheck.map(p => p.permissionId));
          const actuallyToInsert = toInsert.filter(id => !existingPermissionIds.has(id));

          if (actuallyToInsert.length > 0) {
            // Insertar uno por uno para evitar problemas con la secuencia
            for (const permissionId of actuallyToInsert) {
              try {
                await tx.insert(rolePermissions).values({
                  roleId: roleId,
                  permissionId,
                });
              } catch (insertError: any) {
                // Si hay un error de clave primaria duplicada, ignorarlo
                // (puede pasar si hay condiciones de carrera)
                if (insertError.code !== '23505' || !insertError.constraint_name?.includes('pkey')) {
                  throw insertError;
                }
                console.warn(`⚠️  Permiso ${permissionId} ya existe para rol ${roleId}, omitiendo inserción`);
              }
            }
          }
        }
      });

      res.json(updatedRole);
    } catch (error: any) {
      console.error("Error updating role:", error);
      console.error("Error details:", {
        code: error.code,
        constraint: error.constraint,
        message: error.message,
        detail: error.detail,
      });
      if (error.code === "23505") {
        // Verificar si es un error de nombre duplicado o de permisos
        if (error.constraint === "roles_nombre_unique" || error.constraint?.includes("nombre")) {
          res.status(400).json({ error: "Ya existe un rol con ese nombre" });
        } else {
          // Podría ser un error de permisos duplicados
          res.status(400).json({ error: error.message || "Error al actualizar rol: violación de restricción única" });
        }
      } else {
        res.status(500).json({ error: "Error al actualizar rol" });
      }
    }
  });

  // Eliminar rol
  app.delete("/api/admin/roles/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);

      // Verificar si hay usuarios con este rol
      const usersWithRole = await db
        .select()
        .from(users)
        .where(eq(users.roleId, roleId))
        .limit(1);

      if (usersWithRole.length > 0) {
        return res.status(400).json({
          error: "No se puede eliminar el rol porque hay usuarios asignados",
        });
      }

      // Eliminar el rol (los permisos se eliminan en cascade)
      await db.delete(roles).where(eq(roles.id, roleId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ error: "Error al eliminar rol" });
    }
  });

  // Listar todos los usuarios con sus roles
  app.get("/api/admin/users", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          phone: users.phone,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          roleId: users.roleId,
          roleNombre: roles.nombre,
          roleDescripcion: roles.descripcion,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .orderBy(users.phone, users.email);

      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  // Crear nuevo usuario (solo ADMIN)
  app.post("/api/admin/users", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const { phone, password, firstName, lastName, roleId } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ error: "Celular y contraseña son requeridos" });
      }

      // Verificar que el celular no esté en uso
      const existingUser = await findUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ error: "El celular ya está registrado" });
      }

      // Hashear contraseña
      const passwordHash = await hashPassword(password);

      // Generar ID único
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Crear usuario (guardar contraseña en texto plano y hash)
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          phone,
          passwordHash,
          passwordPlain: password, // Guardar en texto plano para que admins puedan verla
          firstName: firstName || null,
          lastName: lastName || null,
          roleId: roleId ? parseInt(roleId) : null,
        })
        .returning();

      res.status(201).json({
        id: newUser.id,
        phone: newUser.phone,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        roleId: newUser.roleId,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  // Actualizar usuario (rol, overrides, password opcional)
  app.put("/api/admin/users/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const userId = req.params.id;
      const { roleId, overrides, password, phone, firstName, lastName } = req.body;

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Actualizar rol del usuario
      if (roleId !== undefined) {
        updateData.roleId = roleId ? parseInt(roleId) : null;
      }

      // Actualizar contraseña si se proporciona
      if (password) {
        updateData.passwordHash = await hashPassword(password);
        updateData.passwordPlain = password; // Guardar también en texto plano
      }

      // Actualizar phone si se proporciona
      if (phone) {
        // Verificar que el celular no esté en uso por otro usuario
        const existingUser = await findUserByPhone(phone);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: "El celular ya está registrado por otro usuario" });
        }
        updateData.phone = phone;
      }

      // Actualizar nombre si se proporciona
      if (firstName !== undefined) {
        updateData.firstName = firstName || null;
      }

      if (lastName !== undefined) {
        updateData.lastName = lastName || null;
      }

      // Actualizar usuario
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      // Actualizar overrides: eliminar todos y crear los nuevos
      await db.delete(userPermissionsOverride).where(eq(userPermissionsOverride.userId, userId));

      if (Array.isArray(overrides) && overrides.length > 0) {
        const overrideValues = overrides.map((override: { permissionId: number; overrideType: string }) => ({
          userId,
          permissionId: override.permissionId,
          overrideType: override.overrideType, // "allow" o "deny"
        }));

        await db.insert(userPermissionsOverride).values(overrideValues);
      }

      // Invalidar caché de permisos del usuario
      invalidateUserPermissionsCache(userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  // Endpoint para agregar permisos faltantes manualmente
  app.post("/api/admin/permissions/add-missing", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const { addMissingPermissions } = await import('./add-missing-permissions');
      await addMissingPermissions();
      res.json({ success: true, message: "Permisos faltantes agregados correctamente" });
    } catch (error: any) {
      console.error("Error agregando permisos faltantes:", error);
      res.status(500).json({ error: "Error al agregar permisos faltantes" });
    }
  });

  // Listar todos los permisos del sistema
  app.get("/api/admin/permissions", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const allPermissions = await db
        .select()
        .from(permissions)
        .orderBy(permissions.categoria, permissions.key);

      // Agrupar por categoría
      const grouped = allPermissions.reduce((acc, perm) => {
        const categoria = perm.categoria || "other";
        if (!acc[categoria]) {
          acc[categoria] = [];
        }
        acc[categoria].push(perm);
        return acc;
      }, {} as Record<string, typeof allPermissions>);

      res.json({
        all: allPermissions,
        grouped,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: "Error al obtener permisos" });
    }
  });

  // Ver permisos efectivos de un usuario
  app.get("/api/admin/users/:id/permissions", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const userId = req.params.id;
      const effectivePermissions = await getUserPermissions(userId);
      res.json({ permissions: effectivePermissions });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Error al obtener permisos del usuario" });
    }
  });

  // Ver contraseña de un usuario (solo ADMIN, con logging)
  app.get("/api/admin/users/:id/password", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Obtener usuario
      const [user] = await db
        .select({
          id: users.id,
          phone: users.phone,
          firstName: users.firstName,
          lastName: users.lastName,
          passwordPlain: users.passwordPlain,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Logging: Registrar que un admin vio la contraseña
      const timestamp = new Date().toISOString();
      const userInfo = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.phone || user.id;
      
      console.log(`[${timestamp}] 🔐 Admin [${adminId}] vio la contraseña del usuario [${userId}] (${userInfo})`);

      // Retornar contraseña (puede ser null si el usuario fue creado antes de implementar esto)
      res.json({ 
        password: user.passwordPlain || null,
        message: user.passwordPlain 
          ? "Contraseña recuperada" 
          : "Este usuario no tiene contraseña almacenada en texto plano (fue creado antes de implementar esta funcionalidad)"
      });
    } catch (error) {
      console.error("Error fetching user password:", error);
      res.status(500).json({ error: "Error al obtener contraseña del usuario" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
