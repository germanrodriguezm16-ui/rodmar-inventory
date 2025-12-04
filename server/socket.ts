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

// Nueva función para emitir eventos específicos de actualización de transacciones
export function emitTransactionSpecificUpdates(data: {
  transactionId: number;
  origenTipo: string;
  origenId: string | number;
  destinoTipo: string;
  destinoId: string | number;
  nuevoBalanceOrigen?: string;
  nuevoBalanceDestino?: string;
}) {
  if (!io) {
    console.warn("⚠️ Socket.io no está inicializado");
    return;
  }

  const { transactionId, origenTipo, origenId, destinoTipo, destinoId, nuevoBalanceOrigen, nuevoBalanceDestino } = data;

  // Emitir eventos para ambos socios
  // Transacciones actualizadas
  io.emit(`transaccionActualizada:${origenTipo}:${origenId}`, {
    transactionId,
    socioTipo: origenTipo,
    socioId: origenId,
    timestamp: new Date().toISOString(),
  });

  io.emit(`transaccionActualizada:${destinoTipo}:${destinoId}`, {
    transactionId,
    socioTipo: destinoTipo,
    socioId: destinoId,
    timestamp: new Date().toISOString(),
  });

  // Balances actualizados (solo para minas, compradores, volqueteros)
  if (['mina', 'comprador', 'volquetero'].includes(origenTipo) && nuevoBalanceOrigen) {
    io.emit(`balanceActualizado:${origenTipo}:${origenId}`, {
      socioTipo: origenTipo,
      socioId: origenId,
      nuevoBalanceReal: nuevoBalanceOrigen,
      timestamp: new Date().toISOString(),
    });

    io.emit(`balanceGlobalActualizado:${origenTipo}`, {
      tipo: origenTipo,
      timestamp: new Date().toISOString(),
    });

    io.emit(`tarjetaActualizada:${origenTipo}:${origenId}`, {
      socioId: origenId,
      socioTipo: origenTipo,
      nuevoBalanceReal: nuevoBalanceOrigen,
      timestamp: new Date().toISOString(),
    });
  }

  if (['mina', 'comprador', 'volquetero'].includes(destinoTipo) && nuevoBalanceDestino) {
    io.emit(`balanceActualizado:${destinoTipo}:${destinoId}`, {
      socioTipo: destinoTipo,
      socioId: destinoId,
      nuevoBalanceReal: nuevoBalanceDestino,
      timestamp: new Date().toISOString(),
    });

    io.emit(`balanceGlobalActualizado:${destinoTipo}`, {
      tipo: destinoTipo,
      timestamp: new Date().toISOString(),
    });

    io.emit(`tarjetaActualizada:${destinoTipo}:${destinoId}`, {
      socioId: destinoId,
      socioTipo: destinoTipo,
      nuevoBalanceReal: nuevoBalanceDestino,
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`📡 Eventos emitidos para transacción ${transactionId}:`, {
    origen: `${origenTipo}:${origenId}`,
    destino: `${destinoTipo}:${destinoId}`,
  });
}


