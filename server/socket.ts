import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import type { DefaultEventsMap } from "socket.io/dist/typed-events";

let io: SocketServer | null = null;

export function initializeSocket(httpServer: HttpServer): SocketServer {
  if (io) {
    return io;
  }

  // Configurar CORS para Socket.io
  const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? false : "*");
  
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });

    // Manejar errores de conexión
    socket.on("error", (error) => {
      console.error(`❌ Error de Socket.io:`, error);
    });
  });

  console.log("✅ Socket.io inicializado");
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

export function emitTransactionUpdate(data: {
  type: "created" | "updated" | "deleted";
  transactionId: number | string;
  affectedEntityTypes: Set<string>;
  affectedAccounts?: string[];
}) {
  if (!io) {
    console.warn("⚠️ Socket.io no está inicializado");
    return;
  }

  const affectedAccounts = data.affectedAccounts || [];
  const affectedEntityTypes = Array.from(data.affectedEntityTypes);

  io.emit("transaction-updated", {
    type: data.type,
    transactionId: data.transactionId,
    affectedEntityTypes,
    affectedAccounts,
    timestamp: new Date().toISOString(),
  });

  console.log(`📡 Evento emitido: transaction-updated`, {
    type: data.type,
    transactionId: data.transactionId,
    affectedEntityTypes,
    affectedAccounts,
  });
}


