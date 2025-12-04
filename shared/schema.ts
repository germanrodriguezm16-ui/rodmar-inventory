import { pgTable, text, serial, integer, decimal, timestamp, boolean, varchar, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Minas (Mines)
export const minas = pgTable("minas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  saldo: decimal("saldo", { precision: 15, scale: 2 }).default("0"),
  balanceCalculado: decimal("balance_calculado", { precision: 15, scale: 2 }).default("0"),
  balanceDesactualizado: boolean("balance_desactualizado").default(false).notNull(),
  ultimoRecalculo: timestamp("ultimo_recalculo").defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compradores (Buyers)
export const compradores = pgTable("compradores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  saldo: decimal("saldo", { precision: 15, scale: 2 }).default("0"),
  balanceCalculado: decimal("balance_calculado", { precision: 15, scale: 2 }).default("0"),
  balanceDesactualizado: boolean("balance_desactualizado").default(false).notNull(),
  ultimoRecalculo: timestamp("ultimo_recalculo").defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Volqueteros (Truckers)
export const volqueteros = pgTable("volqueteros", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  placa: text("placa").notNull(),
  saldo: decimal("saldo", { precision: 15, scale: 2 }).default("0"),
  balanceCalculado: decimal("balance_calculado", { precision: 15, scale: 2 }).default("0"),
  balanceDesactualizado: boolean("balance_desactualizado").default(false).notNull(),
  ultimoRecalculo: timestamp("ultimo_recalculo").defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Viajes (Trips)
export const viajes = pgTable("viajes", {
  id: text("id").primaryKey(), // TRP001, TRP002, etc.
  fechaCargue: timestamp("fecha_cargue").notNull(),
  fechaDescargue: timestamp("fecha_descargue"),
  conductor: text("conductor").notNull(),
  tipoCarro: text("tipo_carro").notNull(),
  placa: text("placa").notNull(),
  minaId: integer("mina_id").references(() => minas.id),
  compradorId: integer("comprador_id").references(() => compradores.id),
  peso: decimal("peso", { precision: 8, scale: 2 }),
  precioCompraTon: decimal("precio_compra_ton", { precision: 10, scale: 2 }).notNull(),
  ventaTon: decimal("venta_ton", { precision: 10, scale: 2 }),
  fleteTon: decimal("flete_ton", { precision: 10, scale: 2 }),
  otrosGastosFlete: decimal("otros_gastos_flete", { precision: 10, scale: 2 }),
  quienPagaFlete: text("quien_paga_flete"),
  vut: decimal("vut", { precision: 10, scale: 2 }),
  cut: decimal("cut", { precision: 10, scale: 2 }),
  fut: decimal("fut", { precision: 10, scale: 2 }),
  totalVenta: decimal("total_venta", { precision: 15, scale: 2 }),
  totalCompra: decimal("total_compra", { precision: 15, scale: 2 }),
  totalFlete: decimal("total_flete", { precision: 15, scale: 2 }),
  valorConsignar: decimal("valor_consignar", { precision: 15, scale: 2 }),
  ganancia: decimal("ganancia", { precision: 15, scale: 2 }),
  recibo: text("recibo"),
  observaciones: text("observaciones"),
  estado: text("estado").notNull().default("pendiente"), // pendiente, completado
  oculta: boolean("oculta").default(false).notNull(), // Campo para ocultar viajes en transacciones de minas
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transacciones
export const transacciones = pgTable("transacciones", {
  id: serial("id").primaryKey(),
  // Nuevo sistema: De quién y Para quién (opcionales por ahora para migración)
  deQuienTipo: text("de_quien_tipo"), // rodmar, comprador, volquetero, mina, banco, lcdm, postobon
  deQuienId: text("de_quien_id"), // ID o nombre específico
  paraQuienTipo: text("para_quien_tipo"), // rodmar, comprador, volquetero, mina, banco, lcdm, postobon
  paraQuienId: text("para_quien_id"), // ID o nombre específico
  // Campo para especificar cuenta de Postobón
  postobonCuenta: text("postobon_cuenta"), // 'santa-rosa', 'cimitarra', 'otras' (solo cuando tipo es 'postobon')
  concepto: text("concepto").notNull(),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  fecha: timestamp("fecha").notNull(),
  horaInterna: timestamp("hora_interna").defaultNow().notNull(), // Hora automática para ordenamiento
  formaPago: text("forma_pago").notNull(),
  voucher: text("voucher"),
  comentario: text("comentario"),
  tipoTransaccion: text("tipo_transaccion").default("manual"), // manual, inversion
  oculta: boolean("oculta").default(false).notNull(), // Campo para ocultar transacciones (mantener compatibilidad)
  // Nuevos campos específicos por módulo
  ocultaEnComprador: boolean("oculta_en_comprador").default(false).notNull(),
  ocultaEnMina: boolean("oculta_en_mina").default(false).notNull(),
  ocultaEnVolquetero: boolean("oculta_en_volquetero").default(false).notNull(),
  ocultaEnGeneral: boolean("oculta_en_general").default(false).notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  // Campos compatibilidad (mantener existentes)
  tipoSocio: text("tipo_socio"), // Mantenemos para compatibilidad
  socioId: integer("socio_id"), // Mantenemos para compatibilidad
});

// Inversiones - Sistema separado para inversiones en cuentas Postobón
export const inversiones = pgTable("inversiones", {
  id: serial("id").primaryKey(),
  concepto: text("concepto").notNull(),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  fecha: timestamp("fecha").notNull(),
  origen: text("origen").notNull(), // rodmar-cuenta, banco, postobon-cuenta, lcdm, otras
  origenDetalle: text("origen_detalle"), // Para especificar subcuenta específica
  destino: text("destino").notNull(), // mismo formato que origen
  destinoDetalle: text("destino_detalle"), // Para especificar subcuenta específica
  observaciones: text("observaciones"), // Observaciones adicionales
  voucher: text("voucher"), // Campo para adjuntar voucher or comprobante
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fusion Backups - Para respaldo de fusiones y reversión inteligente
export const fusionBackups = pgTable("fusion_backups", {
  id: serial("id").primaryKey(),
  tipoEntidad: varchar("tipo_entidad", { length: 20 }).notNull(), // 'volquetero', 'mina', 'comprador'
  origenId: integer("origen_id").notNull(),
  destinoId: integer("destino_id").notNull(),
  origenNombre: varchar("origen_nombre", { length: 255 }).notNull(),
  destinoNombre: varchar("destino_nombre", { length: 255 }).notNull(),
  datosOriginales: jsonb("datos_originales").notNull(), // Backup completo de datos antes de fusión
  transaccionesAfectadas: jsonb("transacciones_afectadas").notNull(), // IDs y conceptos originales
  viajesAfectados: jsonb("viajes_afectados").notNull(), // IDs de viajes afectados
  fechaFusion: timestamp("fecha_fusion").defaultNow(),
  revertida: boolean("revertida").default(false),
  fechaReversion: timestamp("fecha_reversion"),
  userId: varchar("user_id").references(() => users.id),
});

// Insert schemas
export const insertMinaSchema = createInsertSchema(minas).omit({
  id: true,
  saldo: true,
  createdAt: true,
});

export const insertCompradorSchema = createInsertSchema(compradores).omit({
  id: true,
  saldo: true,
  createdAt: true,
});

export const insertVolqueteroSchema = createInsertSchema(volqueteros).omit({
  id: true,
  saldo: true,
  createdAt: true,
});

export const insertViajeSchema = z.object({
  id: z.string().optional(), // Para preservar ID del Excel
  fechaCargue: z.string().transform((val) => new Date(val)),
  fechaDescargue: z.string().optional().nullable().transform((val) => 
    val ? new Date(val) : null
  ),
  conductor: z.string(),
  tipoCarro: z.string(),
  placa: z.string(),
  minaId: z.number().nullable().optional(),
  compradorId: z.number().nullable().optional(),
  // Temporary fields for Excel import
  minaNombre: z.string().optional(),
  compradorNombre: z.string().optional(),
  peso: z.string().nullable().optional(),
  precioCompraTon: z.string(),
  ventaTon: z.string().nullable().optional(),
  fleteTon: z.string().nullable().optional(),
  otrosGastosFlete: z.string().nullable().optional(),
  quienPagaFlete: z.string().nullable().optional(),
  vut: z.string().nullable().optional(),
  cut: z.string().nullable().optional(),
  fut: z.string().nullable().optional(),
  totalVenta: z.string().nullable().optional(),
  totalCompra: z.string().nullable().optional(),
  totalFlete: z.string().nullable().optional(),
  valorConsignar: z.string().nullable().optional(),
  ganancia: z.string().nullable().optional(),
  recibo: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  estado: z.string().default("pendiente"),
});

// Schema universal para importación Excel que maneja múltiples formatos
// Acepta tanto formato nuevo (FechaCargue, MinaId, etc.) como formato anterior (fechaCargue, minaId, etc.)
export const excelImportViajeSchema = z.object({
  // IDs - múltiples formatos posibles
  ID: z.string().optional(),
  id: z.string().optional(),
  
  // Fechas - múltiples formatos posibles
  FechaCargue: z.union([z.string(), z.number()]).optional(),
  fechaCargue: z.union([z.string(), z.number()]).optional(),
  FechaDescargue: z.union([z.string(), z.number()]).optional().nullable(),
  fechaDescargue: z.union([z.string(), z.number()]).optional().nullable(),
  
  // Información del conductor y vehículo
  Conductor: z.string().optional(),
  conductor: z.string().optional(),
  TipoCarro: z.string().optional(),
  tipoCarro: z.string().optional(),
  Placa: z.string().optional(),
  placa: z.string().optional(),
  
  // IDs de mina y comprador
  MinaId: z.union([z.string(), z.number()]).optional(),
  minaId: z.union([z.string(), z.number()]).optional(),
  CompradorId: z.union([z.string(), z.number()]).optional(),
  compradorId: z.union([z.string(), z.number()]).optional(),
  
  // Nombres alternativos para buscar entidades
  minaNombre: z.string().optional(),
  compradorNombre: z.string().optional(),
  
  // Peso
  Peso: z.union([z.string(), z.number()]).optional(),
  peso: z.union([z.string(), z.number()]).optional(),
  
  // Precios unitarios
  CUT: z.union([z.string(), z.number()]).optional(),
  cut: z.union([z.string(), z.number()]).optional(),
  precioCompraTon: z.union([z.string(), z.number()]).optional(),
  VUT: z.union([z.string(), z.number()]).optional(),
  vut: z.union([z.string(), z.number()]).optional(),
  ventaTon: z.union([z.string(), z.number()]).optional(),
  FUT: z.union([z.string(), z.number()]).optional(),
  fut: z.union([z.string(), z.number()]).optional(),
  fleteTon: z.union([z.string(), z.number()]).optional(),
  
  // Otros gastos
  "Otros Gasto Fletes": z.union([z.string(), z.number()]).optional(),
  otrosGastos: z.union([z.string(), z.number()]).optional(),
  otrosGastosFlete: z.union([z.string(), z.number()]).optional(),
  
  // Campos opcionales adicionales
  volquetero: z.string().optional(),
  quienPagaFlete: z.string().optional(),
  estado: z.string().optional(),
}).transform((data) => {
  // Función para convertir fechas
  const convertDate = (val: any) => {
    if (!val) return null;
    try {
      if (typeof val === 'number') {
        const excelEpoch = new Date(1900, 0, 1);
        const days = val - 2;
        return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      }
      return new Date(val);
    } catch (error) {
      return new Date(); // Fecha actual como fallback
    }
  };

  // Función para obtener el primer valor válido
  const getFirst = (...values: any[]) => values.find(v => v !== undefined && v !== null && v !== "");
  
  return {
    // Mapear campos Excel a campos internos del sistema con fallbacks
    id: getFirst(data.ID, data.id),
    fechaCargue: convertDate(getFirst(data.FechaCargue, data.fechaCargue)),
    fechaDescargue: convertDate(getFirst(data.FechaDescargue, data.fechaDescargue)),
    conductor: getFirst(data.Conductor, data.conductor) || "Conductor",
    tipoCarro: getFirst(data.TipoCarro, data.tipoCarro) || "Volqueta",
    placa: getFirst(data.Placa, data.placa) || "ABC123",
    minaId: Number(getFirst(data.MinaId, data.minaId)) || 1,
    compradorId: Number(getFirst(data.CompradorId, data.compradorId)) || 1,
    peso: String(getFirst(data.Peso, data.peso)) || "20",
    cut: String(getFirst(data.CUT, data.cut, data.precioCompraTon)) || "50000",
    vut: String(getFirst(data.VUT, data.vut, data.ventaTon)) || "150000",
    fut: String(getFirst(data.FUT, data.fut, data.fleteTon)) || "95000",
    otrosGastos: String(getFirst(data["Otros Gasto Fletes"], data.otrosGastos, data.otrosGastosFlete)) || "0",
    estado: "completado",
    quienPagaFlete: data.quienPagaFlete || "comprador",
    volquetero: getFirst(data.volquetero, data.Conductor, data.conductor) || "Conductor",
    // Campos para compatibilidad
    ventaTon: String(getFirst(data.VUT, data.vut, data.ventaTon)) || "150000",
    precioCompraTon: String(getFirst(data.CUT, data.cut, data.precioCompraTon)) || "50000",
    fleteTon: String(getFirst(data.FUT, data.fut, data.fleteTon)) || "95000",
    // Campos adicionales para búsqueda de entidades
    minaNombre: data.minaNombre,
    compradorNombre: data.compradorNombre,
    // Campos calculados que se generarán automáticamente en el servidor
    totalVenta: undefined,
    totalCompra: undefined,
    totalFlete: undefined,
    valorConsignar: undefined,
    ganancia: undefined,
    recibo: undefined,
    observaciones: undefined
  };
});

export const updateViajeSchema = z.object({
  fechaCargue: z.string().optional(),
  fechaDescargue: z.string().optional(),
  conductor: z.string().optional(),
  placa: z.string().optional(),
  minaId: z.number().optional(),
  compradorId: z.number().optional(),
  volquetero: z.string().optional(),
  peso: z.string().optional(),
  precioCompraTon: z.string().optional(),
  ventaTon: z.string().optional(),
  fleteTon: z.string().optional(),
  otrosGastosFlete: z.string().optional(),
  quienPagaFlete: z.string().optional(),
  totalVenta: z.string().optional(),
  totalCompra: z.string().optional(),
  totalFlete: z.string().optional(),
  valorConsignar: z.string().optional(),
  ganancia: z.string().optional(),
  recibo: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.string().optional(),
}).partial();

export const insertInversionSchema = createInsertSchema(inversiones).omit({
  id: true,
  createdAt: true,
}).extend({
  fecha: z.string().transform((val) => new Date(val)),
});

export const insertTransaccionSchema = z.object({
  deQuienTipo: z.enum(["rodmar", "comprador", "volquetero", "mina", "banco", "lcdm", "postobon"]),
  deQuienId: z.string().min(1), // Puede ser ID numérico como string o nombre específico
  paraQuienTipo: z.enum(["rodmar", "comprador", "volquetero", "mina", "banco", "lcdm", "postobon"]),
  paraQuienId: z.string().min(1), // Puede ser ID numérico como string o nombre específico
  postobonCuenta: z.enum(["santa-rosa", "cimitarra", "otras"]).optional(), // Solo para transacciones con Postobón
  concepto: z.string().min(1),
  valor: z.string().min(1),
  fecha: z.string().transform((val) => new Date(val)),
  formaPago: z.string().min(1),
  voucher: z.string().optional(),
  comentario: z.string().optional(),
});

// Update schemas para editar nombres
export const updateMinaNombreSchema = z.object({
  nombre: z.string().min(1, "El nombre no puede estar vacío").trim(),
});

export const updateCompradorNombreSchema = z.object({
  nombre: z.string().min(1, "El nombre no puede estar vacío").trim(),
});

export const updateVolqueteroNombreSchema = z.object({
  nombre: z.string().min(1, "El nombre no puede estar vacío").trim(),
});

// Fusion schemas
export const fusionSchema = z.object({
  origenId: z.number().min(1, "ID origen requerido"),
  destinoId: z.number().min(1, "ID destino requerido"),
});

export const revertFusionSchema = z.object({
  fusionId: z.number().min(1, "ID de fusión requerido"),
});

// User types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Types
export type Mina = typeof minas.$inferSelect;
export type InsertMina = z.infer<typeof insertMinaSchema>;

export type Comprador = typeof compradores.$inferSelect;
export type InsertComprador = z.infer<typeof insertCompradorSchema>;

export type Volquetero = typeof volqueteros.$inferSelect;
export type InsertVolquetero = z.infer<typeof insertVolqueteroSchema>;
export type VolqueteroWithViajes = Volquetero & { viajesCount: number };

export type VolqueteroConPlacas = {
  id: number;
  nombre: string;
  placas: Array<{
    placa: string;
    tipoCarro: string;
    viajesCount: number;
  }>;
  viajesCount: number;
  saldo: string;
};

export type Viaje = typeof viajes.$inferSelect;
export type InsertViaje = z.infer<typeof insertViajeSchema>;
export type UpdateViaje = z.infer<typeof updateViajeSchema>;

export type Transaccion = typeof transacciones.$inferSelect;
export type InsertTransaccion = z.infer<typeof insertTransaccionSchema>;

export type Inversion = typeof inversiones.$inferSelect;
export type InsertInversion = z.infer<typeof insertInversionSchema>;

export type UpdateMinaNombre = z.infer<typeof updateMinaNombreSchema>;
export type UpdateCompradorNombre = z.infer<typeof updateCompradorNombreSchema>;
export type UpdateVolqueteroNombre = z.infer<typeof updateVolqueteroNombreSchema>;

export type FusionBackup = typeof fusionBackups.$inferSelect;
export type FusionRequest = z.infer<typeof fusionSchema>;
export type RevertFusionRequest = z.infer<typeof revertFusionSchema>;

// Extended types for joined data
export type ViajeWithDetails = Viaje & {
  mina?: Mina;
  comprador?: Comprador;
};

export type TransaccionWithSocio = Transaccion & {
  socioNombre: string;
  hasVoucher?: boolean;
};
