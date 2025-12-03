import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./middleware/auth";
import { emitTransactionUpdate } from "./socket";
import {
  insertMinaSchema,
  insertCompradorSchema,
  insertVolqueteroSchema,
  insertViajeSchema,
  excelImportViajeSchema,
  updateViajeSchema,
  insertTransaccionSchema,
  insertInversionSchema,
  updateMinaNombreSchema,
  updateCompradorNombreSchema,
  updateVolqueteroNombreSchema,
  fusionSchema,
  revertFusionSchema,
} from "@shared/schema";
import { ViajeIdGenerator } from "./id-generator";

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

  // Middleware de debug para rutas de transacciones
  app.use((req, res, next) => {
    if (req.path.includes('/transacciones') && req.method === 'PATCH') {
      console.log(`🔍 [ROUTE DEBUG] ${req.method} ${req.path}`);
      console.log(`🔍 [ROUTE DEBUG] Original URL: ${req.originalUrl}`);
      console.log(`🔍 [ROUTE DEBUG] Params:`, req.params);
    }
    next();
  });

  // Auth routes
  app.get("/api/login", async (req, res) => {
    try {
      // En desarrollo o si REQUIRE_AUTH no está configurado, crear/obtener usuario principal
      if (process.env.NODE_ENV === "development" || !process.env.REQUIRE_AUTH) {
        const mainUser = await storage.upsertUser({
          id: "main_user",
          email: "usuario@rodmar.com",
          firstName: "Usuario",
          lastName: "Principal",
        });

        // Establecer sesión
        if (req.session) {
          (req.session as any).user = {
            id: mainUser.id,
            email: mainUser.email,
            firstName: mainUser.firstName,
            lastName: mainUser.lastName,
          };
        }
      }
      
      // Redirigir a la página principal
      res.redirect("/");
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Minas routes - ahora devuelve balance calculado para mejor rendimiento
  app.get("/api/minas", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const minas = await storage.getMinas(userId);
      res.json(minas);
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
        console.log(
          "🔄 Iniciando recálculo manual de balances desde endpoint...",
        );
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
      const balances = await storage.getVolqueterosBalances(userId);
      res.json(balances);
    } catch (error: any) {
      console.error("Error fetching volqueteros balances:", error.message);
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

  app.get("/api/minas/:id", async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      if (isNaN(minaId)) {
        return res.status(400).json({ error: "Invalid mina ID" });
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

  app.post("/api/minas", async (req, res) => {
    try {
      const data = insertMinaSchema.parse(req.body);
      const mina = await storage.createMina(data);
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

  app.get("/api/minas/:id/viajes", async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
      const viajes = await storage.getViajesByMina(minaId);
      res.json(viajes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viajes for mina" });
    }
  });

  app.get("/api/minas/:id/transacciones", async (req, res) => {
    try {
      const minaId = parseInt(req.params.id);
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
        const userId = req.user!.id;
        const minaId = parseInt(req.params.id);

        console.log(
          `=== DELETE MINA REQUEST - ID: ${minaId}, User: ${userId} ===`,
        );

        // Check if mina has viajes
        const viajes = await storage.getViajesByMina(minaId, userId);
        console.log(`=== Found ${viajes.length} viajes for mina ${minaId} ===`);
        if (viajes.length > 0) {
          return res.status(400).json({
            error: "No se puede eliminar la mina porque tiene viajes asociados",
          });
        }

        // Check if mina has transacciones
        const transacciones = await storage.getTransaccionesBySocio(
          "mina",
          minaId,
          userId,
        );
        console.log(
          `=== Found ${transacciones.length} transacciones for mina ${minaId} ===`,
        );
        if (transacciones.length > 0) {
          return res.status(400).json({
            error:
              "No se puede eliminar la mina porque tiene transacciones asociadas",
          });
        }

        const deleteResult = await storage.deleteMina(minaId, userId);
        console.log(
          `=== Delete result for mina ${minaId}: ${deleteResult} ===`,
        );

        if (deleteResult) {
          res.json({ message: "Mina eliminada exitosamente" });
        } else {
          res
            .status(404)
            .json({ error: "Mina no encontrada o no pertenece al usuario" });
        }
      } catch (error) {
        console.error("=== Error deleting mina:", error);
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
        const compradores = await storage.getCompradores(userId);
        res.json(compradores);
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

  app.get("/api/compradores/:id", async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
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

  app.post("/api/compradores", async (req, res) => {
    try {
      const data = insertCompradorSchema.parse(req.body);
      const comprador = await storage.createComprador(data);
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

  app.get("/api/compradores/:id/viajes", async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
      const viajes = await storage.getViajesByComprador(compradorId);
      res.json(viajes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viajes for comprador" });
    }
  });

  // Get viajes by comprador (alternative route)
  app.get("/api/viajes/comprador/:compradorId", async (req, res) => {
    try {
      const compradorId = parseInt(req.params.compradorId);
      if (isNaN(compradorId)) {
        return res.status(400).json({ error: "Invalid comprador ID" });
      }

      const viajes = await storage.getViajesByComprador(compradorId);

      // Debug específico para comprador 97
      if (compradorId === 97) {
        console.log("🔍 DEBUG COMPRADOR 97 - Total viajes:", viajes.length);
        const g24 = viajes.find((v) => v.id === "G24");
        if (g24) {
          console.log("🔍 DEBUG G24:", {
            id: g24.id,
            valorConsignar: g24.valorConsignar,
            totalVenta: g24.totalVenta,
            totalFlete: g24.totalFlete,
            quienPagaFlete: g24.quienPagaFlete,
          });
        } else {
          console.log("🔍 DEBUG: G24 not found for comprador 97");
        }
      }

      res.json(viajes);
    } catch (error: any) {
      console.error("Error fetching viajes by comprador:", error);
      res.status(500).json({ error: "Failed to fetch viajes for comprador" });
    }
  });

  app.get("/api/compradores/:id/transacciones", async (req, res) => {
    try {
      const compradorId = parseInt(req.params.id);
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
        const viajes = await storage.getViajes(userId);

        // Obtener volqueteros reales de la tabla para usar IDs correctos
        const volqueterosReales = await storage.getVolqueteros();
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

        viajes.forEach((viaje) => {
          if (viaje.conductor) {
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

        console.log("=== VOLQUETEROS ENDPOINT DEBUG ===");
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

        res.json(volqueterosConPlacas);
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

  app.post("/api/volqueteros", async (req, res) => {
    try {
      const data = insertVolqueteroSchema.parse(req.body);
      const volquetero = await storage.createVolquetero(data);
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

  app.get("/api/volqueteros/:id/transacciones", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const volqueteroId = parseInt(req.params.id);
      const transacciones = await storage.getTransaccionesBySocio(
        "volquetero",
        volqueteroId,
        userId,
      );
      res.json(transacciones);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch transacciones for volquetero" });
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
        
        console.log(`=== GET /api/viajes - Paginado (page: ${page}, limit: ${limit}) ===`);
        
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
        console.log(`=== GET /api/viajes/pendientes - userId: ${userId}`);
        const viajes = await storage.getViajesPendientes(userId);
        console.log(`=== Found ${viajes.length} pending viajes`);
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
      console.log("API: Fetching viajes for mina:", minaId);
      const viajes = await storage.getViajesByMina(minaId);
      console.log("API: Found viajes:", viajes.length);
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
      console.log("=== DELETE /api/viajes/bulk - Request body:", req.body);

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
          console.log(`=== Deleted viaje: ${viajeId}`);
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
      console.log("=== DELETE /api/viajes/:id - Deleting viaje:", viajeId);

      await storage.deleteViaje(viajeId);

      console.log("=== DELETE /api/viajes/:id - Success");
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

        // Check if viaje exists first
        const existingViaje = await storage.getViaje(viajeId);
        if (!existingViaje) {
          console.log(`=== PATCH /api/viajes/:id - Viaje ${viajeId} not found`);
          return res.status(404).json({
            error: "Failed to update viaje",
            details: `Viaje ${viajeId} not found. This may be an imported trip that was lost after server restart.`,
          });
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

        console.log("=== PATCH /api/viajes/:id - Success:", viaje);
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
      console.log("=== BULK IMPORT STARTED ===");
      const { viajes, replaceExisting = false } = req.body;

      if (!Array.isArray(viajes) || viajes.length === 0) {
        return res.status(400).json({ error: "No viajes data provided" });
      }

      console.log(`Processing ${viajes.length} viajes in bulk mode`);
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
                  console.log(`⏭️ SKIPPING existing viaje: ${viajeData.id}`);
                  results.skipped.push(viajeData.id);
                  results.errors.push(
                    `Fila ${globalIndex + 1}: Viaje ${viajeData.id} ya existe`,
                  );
                  return;
                }
              }

              // Parse and validate data using Excel-specific schema
              console.log(`=== PROCESSING VIAJE ${globalIndex + 1} ===`);
              console.log("Raw data:", JSON.stringify(viajeData, null, 2));

              const parsedData = excelImportViajeSchema.parse(viajeData);
              console.log("Parsed data:", JSON.stringify(parsedData, null, 2));
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

              // Handle volquetero creation
              if (parsedData.conductor) {
                const conductorName = parsedData.conductor.toLowerCase();
                if (!volqueterosByName.has(conductorName)) {
                  const newVolquetero = await storage.createVolquetero({
                    nombre: parsedData.conductor,
                    placa: parsedData.placa || "Vehículo por definir",
                  });
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
                    console.log(`🔧 FIXING ${key}: "${parsedData[key]}" → "0"`);
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
                console.log(`🚨 DEBUGGING PROBLEMATIC VIAJE ${viajeData.id}:`, {
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

      console.log(`=== BULK IMPORT COMPLETED ===`);
      console.log(`✅ Success: ${results.success}`);
      console.log(`❌ Errors: ${results.errors.length}`);
      console.log(`⏭️ Skipped: ${results.skipped.length}`);
      console.log(
        `📊 Total processed: ${results.success + results.errors.length + results.skipped.length}`,
      );

      if (results.skipped.length > 0) {
        console.log(`🔍 Skipped viajes:`, results.skipped);
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
      console.log("Received viaje data:", req.body);

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
      console.log("Parsed viaje data:", data);

      // Auto-crear entidades basadas en nombres si vienen del Excel
      let minaId = data.minaId;
      let compradorId = data.compradorId;

      // Si viene nombre de mina desde Excel, buscar o crear la mina
      if ((data as any).minaNombre) {
        const minaNombre = (data as any).minaNombre;
        console.log(`=== Processing mina by name: "${minaNombre}"`);

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
            console.log(`=== Creating new mina: "${minaNombre}"`);
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
        console.log(`=== Processing comprador by name: "${compradorNombre}"`);

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
            console.log(`=== Creating new comprador: "${compradorNombre}"`);
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
        console.log(`=== GENERATED NEW ID: ${viajeId} for new viaje`);
      } else {
        // Verificar conflictos si ID viene desde Excel
        const existingViaje = await storage.getViaje(data.id);
        if (existingViaje) {
          console.log(`=== CONFLICT DETECTED: Viaje ${data.id} already exists`);
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

      console.log("=== DEBUG VIAJE:", viajeId);
      console.log("=== Raw viaje data:", JSON.stringify(viaje, null, 2));

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
      console.log("=== MANUAL CLEANUP: Starting duplicate removal");
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

      console.log("=== CONFLICT CHECK: Checking IDs:", ids);
      console.log("=== CONFLICT CHECK: File hash:", fileHash);

      // Check for duplicate file hash first
      let isDuplicateFile = false;
      if (fileHash && storage.isFileHashRecent(fileHash)) {
        console.log("=== CONFLICT CHECK: Duplicate file detected!");
        isDuplicateFile = true;
      }

      const existingViajes = await storage.getViajes();
      const existingIds = existingViajes.map((v) => v.id);
      const conflicts = ids.filter((id) => existingIds.includes(id));

      console.log("=== CONFLICT CHECK: Existing IDs:", existingIds);
      console.log("=== CONFLICT CHECK: Conflicts found:", conflicts);

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
        const page = req.query.page ? parseInt(req.query.page as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`⏱️  [PERF] GET /api/transacciones - Iniciando request...`);
        console.log(`   Usuario: ${userId}`);
        console.log(`   Paginación: ${page ? `page=${page}, limit=${limit}` : 'sin paginación'}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        console.log('═══════════════════════════════════════════════════════════');
        
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
          console.log(`=== GET /api/transacciones - Paginado (page: ${page}, limit: ${limit}) ===`);
          
          // Obtener todas las transacciones para aplicar filtros
          const allTransacciones = await storage.getTransacciones(userId);
          
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
          console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL RUTA /api/transacciones: ${totalRouteTime}ms`);

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
          const allTransacciones = await storage.getTransacciones(userId);

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

        const voucher = await storage.getTransaccionVoucher(
          transaccionId,
          userId,
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

        const transacciones = await storage.getTransaccionesBySocio(
          tipoSocio as string,
          parseInt(socioId as string),
          userId,
          includeHidden === "true",
        );
        res.json(transacciones);
      } catch (error: any) {
        console.error("Error fetching transacciones by socio:", error);
        res.status(500).json({ error: "Failed to fetch transacciones" });
      }
    },
  );

  // Endpoint específico para obtener transacciones de compradores con filtrado por módulo
  app.get(
    "/api/transacciones/comprador/:compradorId",
    async (req, res) => {
      try {
        const userId = req.user?.id || "main_user";

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
          userId,
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

  app.post("/api/transacciones", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";

      console.log("Received new transaction data:", req.body);

      // Parse using new schema
      const data = insertTransaccionSchema.parse(req.body);
      console.log("Parsed transaction data:", data);

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

      console.log(`✅ Transaction created successfully:`, transaccion);
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      console.log(`[LCDM] Request recibido - userId: ${userId}, page: ${page}, limit: ${limit}`);
      
      // Leer parámetros de filtro
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      
      console.log(`[LCDM] Obteniendo transacciones para userId: ${userId}`);
      const allTransacciones = await storage.getTransacciones(userId);
      console.log(`[LCDM] Total transacciones obtenidas: ${allTransacciones.length}`);
      
      // Filtrar transacciones de LCDM (origen o destino)
      let lcdmTransactions = allTransacciones.filter((t: any) => 
        t.deQuienTipo === 'lcdm' || t.paraQuienTipo === 'lcdm'
      );
      console.log(`[LCDM] Transacciones filtradas por LCDM: ${lcdmTransactions.length}`);

      // Aplicar filtro de búsqueda
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        lcdmTransactions = lcdmTransactions.filter((t: any) => {
          const fechaString = String(t.fecha);
          const fechaDirecta = t.fecha instanceof Date 
            ? t.fecha.toISOString().split('T')[0]
            : fechaString.includes('T') 
                ? fechaString.split('T')[0] 
                : fechaString;
          
          return (
            t.concepto?.toLowerCase().includes(searchLower) ||
            t.comentario?.toLowerCase().includes(searchLower) ||
            t.valor?.toString().includes(searchLower) ||
            fechaDirecta.includes(searchLower)
          );
        });
      }

      // Aplicar filtro de fecha
      if (fechaDesde || fechaHasta) {
        lcdmTransactions = lcdmTransactions.filter((t: any) => {
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
      lcdmTransactions.sort(
        (a: any, b: any) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );

      // Aplicar paginación
      const total = lcdmTransactions.length;
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const offset = (validPage - 1) * validLimit;
      const paginatedData = lcdmTransactions.slice(offset, offset + validLimit);
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

  // Endpoint paginado para transacciones de Postobón (DEBE IR ANTES de /api/transacciones/:id)
  app.get("/api/transacciones/postobon", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filterType = req.query.filterType as string || 'todas'; // todas, santa-rosa, cimitarra
      
      console.log(`[Postobón] Request recibido - userId: ${userId}, page: ${page}, limit: ${limit}, filterType: ${filterType}`);
      
      // Leer parámetros de filtro
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      
      console.log(`[Postobón] Obteniendo transacciones para userId: ${userId}`);
      const allTransacciones = await storage.getTransacciones(userId);
      console.log(`[Postobón] Total transacciones obtenidas: ${allTransacciones.length}`);
      
      // Filtrar transacciones de Postobón (origen o destino)
      let postobonTransactions = allTransacciones.filter((t: any) => 
        t.deQuienTipo === 'postobon' || t.paraQuienTipo === 'postobon'
      );
      console.log(`[Postobón] Transacciones filtradas por Postobón: ${postobonTransactions.length}`);

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

      // Aplicar filtro de búsqueda
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        postobonTransactions = postobonTransactions.filter((t: any) => {
          const fechaString = String(t.fecha);
          const fechaDirecta = t.fecha instanceof Date 
            ? t.fecha.toISOString().split('T')[0]
            : fechaString.includes('T') 
                ? fechaString.split('T')[0] 
                : fechaString;
          
          return (
            t.concepto?.toLowerCase().includes(searchLower) ||
            t.comentario?.toLowerCase().includes(searchLower) ||
            t.valor?.toString().includes(searchLower) ||
            fechaDirecta.includes(searchLower)
          );
        });
      }

      // Aplicar filtro de fecha
      if (fechaDesde || fechaHasta) {
        postobonTransactions = postobonTransactions.filter((t: any) => {
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
      postobonTransactions.sort(
        (a: any, b: any) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );

      // Aplicar paginación
      const total = postobonTransactions.length;
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
      const offset = (validPage - 1) * validLimit;
      const paginatedData = postobonTransactions.slice(offset, offset + validLimit);
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
  
  // Rutas específicas de ocultar/mostrar - TODAS DEBEN ESTAR ANTES DE LA RUTA GENÉRICA
  // Ocultar transacción individual
  // ESTRATEGIA ALTERNATIVA: Usar ruta sin parámetro en el path para evitar conflictos
  app.patch("/api/transacciones/hide/:id", requireAuth, async (req, res) => {
    try {
      console.log("🔍 [HIDE] Ruta /api/transacciones/hide/:id llamada");
      console.log("🔍 [HIDE] Params:", req.params);
      console.log("🔍 [HIDE] Method:", req.method);
      console.log("🔍 [HIDE] Path:", req.path);
      console.log("🔍 [HIDE] Original URL:", req.originalUrl);
      
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      console.log("🔍 [HIDE] Transaction ID:", transactionId, "User ID:", userId);

      if (isNaN(transactionId)) {
        console.error("❌ [HIDE] ID inválido:", req.params.id);
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      const success = await storage.hideTransaccion(transactionId, userId);

      console.log("🔍 [HIDE] Resultado:", success);

      if (success) {
        res.json({
          success: true,
          message: "Transacción ocultada correctamente",
        });
      } else {
        res.status(404).json({ error: "Transacción no encontrada" });
      }
    } catch (error) {
      console.error("❌ [HIDE] Error hiding transaction:", error);
      res.status(500).json({ error: "Error al ocultar la transacción" });
    }
  });

  // Mantener ruta antigua por compatibilidad - Implementación directa
  // IMPORTANTE: Esta ruta DEBE estar ANTES de /api/transacciones/:id
  // Express evalúa rutas en orden, así que las específicas van primero
  app.patch("/api/transacciones/:id/hide", async (req, res) => {
    try {
      console.log("✅ [HIDE-OLD] ===== RUTA /api/transacciones/:id/hide ALCANZADA =====");
      console.log("✅ [HIDE-OLD] Method:", req.method);
      console.log("✅ [HIDE-OLD] Path:", req.path);
      console.log("✅ [HIDE-OLD] Original URL:", req.originalUrl);
      console.log("✅ [HIDE-OLD] Params:", req.params);
      console.log("✅ [HIDE-OLD] Query:", req.query);
      console.log("✅ [HIDE-OLD] User:", req.user);
      
      const userId = req.user?.id || "main_user";
      const transactionId = parseInt(req.params.id);

      console.log("✅ [HIDE-OLD] Transaction ID parsed:", transactionId, "User ID:", userId);

      if (isNaN(transactionId)) {
        console.error("❌ [HIDE-OLD] ID inválido:", req.params.id);
        return res.status(400).json({ error: "ID de transacción inválido" });
      }

      console.log("✅ [HIDE-OLD] Ocultando transacción:", transactionId);
      const success = await storage.hideTransaccion(transactionId, userId);
      console.log("✅ [HIDE-OLD] Resultado:", success);

      if (success) {
        console.log("✅ [HIDE-OLD] Transacción ocultada exitosamente");
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
  app.patch("/api/transacciones/:id/hide-comprador", requireAuth, async (req, res) => {
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

  app.patch("/api/transacciones/:id/hide-mina", requireAuth, async (req, res) => {
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

  app.patch("/api/transacciones/:id/hide-volquetero", requireAuth, async (req, res) => {
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

  app.patch("/api/transacciones/:id/hide-general", requireAuth, async (req, res) => {
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
  app.patch("/api/transacciones/:id", async (req, res) => {
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

      const id = parseInt(req.params.id);

      console.log("=== PATCH /api/transacciones/:id - Request body:", req.body);

      // Handle both old and new schema formats
      const updateData: any = {
        concepto: req.body.concepto,
        valor: req.body.valor,
        fecha: req.body.fecha ? new Date(req.body.fecha) : undefined,
        formaPago: req.body.formaPago,
        voucher: req.body.voucher,
        comentario: req.body.comentario,
        oculta: req.body.oculta, // Agregar soporte para campo oculta
      };

      // Map new schema to old schema if present
      if (
        req.body.deQuienTipo &&
        req.body.deQuienId &&
        req.body.paraQuienTipo &&
        req.body.paraQuienId
      ) {
        // For now, use the "paraQuien" (destination) as the main transaction target
        updateData.deQuienTipo = req.body.deQuienTipo;
        updateData.deQuienId = req.body.deQuienId;
        updateData.paraQuienTipo = req.body.paraQuienTipo;
        updateData.paraQuienId = req.body.paraQuienId;
      } else if (req.body.tipoSocio && req.body.socioId) {
        // Legacy format
        updateData.tipoSocio = req.body.tipoSocio;
        updateData.socioId = req.body.socioId;
      }

      console.log(
        "=== PATCH /api/transacciones/:id - Update data:",
        updateData,
      );

      // Obtener transacción original para comparar
      const originalTransaction = await storage.getTransaccion(id);

      const transaccion = await storage.updateTransaccion(
        id,
        updateData,
        userId,
      );

      console.log(
        "=== PATCH /api/transacciones/:id - Updated transaction:",
        transaccion,
      );

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
  app.delete("/api/transacciones/bulk-delete", async (req, res) => {
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
  app.delete("/api/transacciones/:id", async (req, res) => {
    try {
      const userId = req.user?.sub || req.user?.id || "main_user";

      console.log("=== INDIVIDUAL DELETE ENDPOINT CALLED ===");
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
  app.patch("/api/transacciones/bulk-hide", async (req, res) => {
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

  // Ocultar viaje individual (solo afecta transacciones de minas)
  app.patch("/api/viajes/:id/hide", async (req, res) => {
    try {
      const userId = req.user?.id || "main_user";
      const viajeId = req.params.id;

      if (!viajeId) {
        return res.status(400).json({ error: "ID de viaje inválido" });
      }

      const success = await storage.hideViaje(viajeId, userId);

      if (success) {
        res.json({ success: true, message: "Viaje ocultado correctamente" });
      } else {
        res.status(404).json({ error: "Viaje no encontrado" });
      }
    } catch (error) {
      console.error("Error hiding viaje:", error);
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
  app.get("/api/transacciones/cuenta/:cuentaNombre", async (req, res) => {
    try {
      const { cuentaNombre } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Función helper para mapear nombre de cuenta a ID
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

      const cuentaId = cuentaNameToId(cuentaNombre);
      
      // Leer parámetros de filtro
      const search = req.query.search as string || '';
      const fechaDesde = req.query.fechaDesde as string || '';
      const fechaHasta = req.query.fechaHasta as string || '';
      
      // Obtener todas las transacciones (necesitamos filtrar primero para contar)
      const allTransacciones = await storage.getTransacciones();

      // Filtrar transacciones que involucren esta cuenta específica
      let transaccionesCuenta = allTransacciones.filter((t: any) => {
        // Si la transacción viene de RodMar (deQuienTipo === 'rodmar') y tiene esta cuenta específica
        // O si va hacia RodMar (paraQuienTipo === 'rodmar') y tiene esta cuenta específica
        return (
          (t.deQuienTipo === "rodmar" &&
            t.deQuienId &&
            t.deQuienId.toLowerCase() === cuentaId.toLowerCase()) ||
          (t.paraQuienTipo === "rodmar" &&
            t.paraQuienId &&
            t.paraQuienId.toLowerCase() === cuentaId.toLowerCase())
        );
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


  // Balances de cuentas RodMar
  app.get("/api/rodmar-accounts", async (req, res) => {
    try {
      const transacciones = await storage.getTransacciones();

      // Función para mapear nombre de cuenta a ID (igual que en frontend)
      const cuentaNameToId = (nombre: string): string => {
        return nombre.toLowerCase().replace(/\s+/g, "-");
      };

      // Mapeo de cuentas de RodMar con sus identificadores (usando mismo mapeo que frontend)
      const cuentasRodMar = [
        { nombre: "Bemovil", id: cuentaNameToId("Bemovil") },
        { nombre: "Corresponsal", id: cuentaNameToId("Corresponsal") },
        { nombre: "Efectivo", id: cuentaNameToId("Efectivo") },
        { nombre: "Cuentas German", id: cuentaNameToId("Cuentas German") },
        { nombre: "Cuentas Jhon", id: cuentaNameToId("Cuentas Jhon") },
        { nombre: "Otros", id: cuentaNameToId("Otros") },
      ];

      // Calcular balance de cada cuenta
      const balancesCuentas = cuentasRodMar.map((cuenta) => {
        let ingresos = 0;
        let egresos = 0;

        // Filtrar transacciones que afectan esta cuenta específica
        transacciones.forEach((transaccion: any) => {
          const valor = parseFloat(transaccion.valor || "0");

          // Si la transacción sale de RodMar desde esta cuenta específica, es un egreso
          if (
            transaccion.deQuienTipo === "rodmar" &&
            transaccion.deQuienId === cuenta.id
          ) {
            egresos += valor;
          }

          // Si la transacción llega a RodMar a esta cuenta específica, es un ingreso
          if (
            transaccion.paraQuienTipo === "rodmar" &&
            transaccion.paraQuienId === cuenta.id
          ) {
            ingresos += valor;
          }
        });

        return {
          cuenta: cuenta.nombre,
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
        console.log(`❌ Viaje ${tripId} no encontrado o sin recibo`);
        return res.status(404).json({ error: "Recibo no encontrado" });
      }

      // Verificar si el recibo es una imagen base64
      if (!viaje.recibo.startsWith("data:image/")) {
        console.log(`❌ Recibo de ${tripId} no es una imagen válida`);
        return res.status(400).json({ error: "Formato de imagen no válido" });
      }

      // Extraer el tipo de imagen y los datos base64
      const matches = viaje.recibo.match(
        /^data:image\/([a-zA-Z]+);base64,(.+)$/,
      );
      if (!matches) {
        console.log(`❌ Formato base64 inválido para ${tripId}`);
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

      console.log(`✅ Recálculo masivo completado en ${duration}ms`);

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

  const httpServer = createServer(app);
  return httpServer;
}
