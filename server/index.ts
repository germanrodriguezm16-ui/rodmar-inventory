import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import { setupSession } from "./middleware/session";
import { initializeDatabase } from "./init-db";
import { addPasswordPlainColumn } from "./add-password-plain-column";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSocket } from "./socket";

const app = express();

// LOGGING DE TODAS LAS PETICIONES - PRIMERO, antes de cualquier otro middleware
// Esto nos permite ver si las peticiones están llegando al servidor
app.use((req, res, next) => {
  console.log(`🌐 [REQUEST] ${req.method} ${req.path} desde origin: ${req.headers.origin || 'sin origin'}`);
  console.log(`🌐 [REQUEST] Host: ${req.headers.host}`);
  console.log(`🌐 [REQUEST] X-Forwarded-Host: ${req.headers['x-forwarded-host']}`);
  console.log(`🌐 [REQUEST] X-Forwarded-Proto: ${req.headers['x-forwarded-proto']}`);
  console.log(`🌐 [REQUEST] User-Agent: ${req.headers['user-agent']}`);
  next();
});

// CORS DEBE SER EL PRIMER MIDDLEWARE - Antes de cualquier otra cosa
// Enable CORS PRIMERO - La librería cors maneja automáticamente las peticiones OPTIONS
// Permitir todos los orígenes (necesario para Vercel -> Railway)
app.use(cors({ 
  origin: (origin, callback) => {
    // Permitir cualquier origen
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "Expires",
    "Pragma",
    "If-Modified-Since",
    "If-None-Match"
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  preflightContinue: false,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 horas
}));

// Handler adicional para OPTIONS usando app.options (por si cors() no lo captura)
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  console.log("🔵 [CORS] app.options(*) llamado desde:", origin);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Expires, Pragma, If-Modified-Since, If-None-Match");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  console.log("✅ [CORS] app.options(*) response enviada");
  res.status(200).end();
});

// Middleware adicional para capturar OPTIONS antes de cualquier otro procesamiento
app.use((req, res, next) => {
  // Si es una petición OPTIONS (preflight), responder inmediatamente
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    console.log("🔵 [CORS] OPTIONS request recibida desde:", origin);
    console.log("🔵 [CORS] Path:", req.path);
    console.log("🔵 [CORS] Headers:", JSON.stringify(req.headers, null, 2));
    
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Expires, Pragma, If-Modified-Since, If-None-Match");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    
    console.log("✅ [CORS] OPTIONS response enviada desde middleware");
    return res.status(200).end();
  }
  next();
});

// Middleware adicional para asegurar headers CORS en todas las respuestas
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Expires, Pragma, If-Modified-Since, If-None-Match");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  next();
});

// Increase payload limit to handle base64 images (50MB limit)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Setup session middleware
setupSession(app);

// PWA static files middleware
app.get("/manifest.json", (req, res) => {
  const manifestPath = path.resolve("manifest.json");
  if (fs.existsSync(manifestPath)) {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(manifestPath);
  } else {
    res.status(404).send("Manifest not found");
  }
});

// Serve service worker with no cache
app.get("/sw.js", (req, res) => {
  const swPath = path.resolve("sw.js");
  if (fs.existsSync(swPath)) {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Service Worker not found");
  }
});

// Serve PWA icons with correct content-type
app.get("*.png", (req, res, next) => {
  const iconPath = path.resolve(req.path.substring(1));
  if (fs.existsSync(iconPath)) {
    res.setHeader("Content-Type", "image/png");
    if (req.path.includes("rodmar-")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    res.sendFile(iconPath);
  } else {
    next();
  }
});

// Middleware para logging de requests
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('🚀 [SERVER] Iniciando servidor RodMar Inventory...');
  
  // Inicializar base de datos en segundo plano (no bloquea el arranque del servidor)
  // Esto permite que el servidor arranque incluso si hay problemas con la BD
  (async () => {
    try {
      console.log('🔧 [INDEX] Iniciando inicialización de BD en segundo plano...');
      await initializeDatabase();
      console.log('✅ [INDEX] initializeDatabase() completado');
      
      try {
        await addPasswordPlainColumn();
        console.log('✅ [INDEX] addPasswordPlainColumn() completado');
      } catch (migrationError: any) {
        if (migrationError.message?.includes('ya existe') || migrationError.message?.includes('already exists')) {
          console.log('ℹ️  Columna password_plain ya existe, omitiendo migración');
        } else {
          console.error('⚠️  Error ejecutando migración de password_plain (continuando):', migrationError.message);
        }
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
        console.error('⚠️  No se pudo conectar a PostgreSQL');
        console.error('💡 Asegúrate de que PostgreSQL esté corriendo o configura DATABASE_URL en .env');
        console.error('🔄 El servidor continuará pero algunas funcionalidades no estarán disponibles');
      } else {
        console.error('❌ Error inicializando base de datos (continuando):', error.message);
      }
    }
  })();
  
  // Health check endpoints
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/ping", (req, res) => {
    res.status(200).send("pong");
  });

  app.get("/api/status", (req, res) => {
    const port = process.env.PORT || 5000;
    res.status(200).json({ 
      app: "RodMar Inventory",
      version: "2.0.0",
      status: "running",
      port: port,
      env: process.env.NODE_ENV || "development",
    });
  });
  
  console.log('✅ [INIT] Endpoints de health check configurados');
  console.log('🔧 [INIT] Creando servidor HTTP...');
  // Create HTTP server BEFORE registering routes
  const server = createServer(app);
  console.log('✅ [INIT] Servidor HTTP creado');
  
  // Register all API routes (this should NOT create a new server)
  console.log('🔧 [INDEX] Llamando a registerRoutes...');
  try {
    await registerRoutes(app);
    console.log('✅ [INDEX] registerRoutes completado');
  } catch (error: any) {
    console.error('❌ [INDEX] Error en registerRoutes:', error);
    throw error;
  }
  
  // Initialize Socket.io
  initializeSocket(server);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    if (status === 500) {
      console.error("Server error:", err);
    }
  });

  // Setup Vite in development, serve static in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start server
  const port = process.env.PORT || 5000;
  console.log(`🔧 [SERVER] Preparando para iniciar servidor en puerto ${port}...`);
  console.log(`🔧 [SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 [SERVER] PORT: ${port}`);
  
  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 [SERVER] RodMar Inventory v2.0.0 serving on http://0.0.0.0:${port}`);
    console.log(`🔗 [SERVER] Health check: http://0.0.0.0:${port}/health`);
    console.log(`📊 [SERVER] API status: http://0.0.0.0:${port}/api/status`);
    console.log(`✅ [SERVER] Servidor HTTP escuchando correctamente`);
    
    if (!process.env.DATABASE_URL) {
      console.log(`⚠️  [SERVER] ADVERTENCIA: DATABASE_URL no configurada`);
      console.log(`💡 [SERVER] Configura DATABASE_URL en .env para usar la base de datos`);
    }
  });
  
  server.on('error', (error: any) => {
    console.error(`❌ [SERVER] Error al iniciar servidor:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ [SERVER] Puerto ${port} ya está en uso`);
    }
  });
  
  server.on('listening', () => {
    const address = server.address();
    console.log(`✅ [SERVER] Servidor escuchando en:`, address);
  });
  
  // Manejar errores no capturados
  process.on('unhandledRejection', (error: any) => {
    if (error.code === 'ECONNREFUSED' && error.address?.includes('5432')) {
      log(`⚠️  PostgreSQL no está disponible en ${error.address}:${error.port}`);
      log(`💡 Instala PostgreSQL o configura una base de datos remota`);
      log(`💡 Puedes usar Neon (gratis): https://neon.tech`);
    } else {
      console.error('Unhandled rejection:', error);
    }
  });
})();
