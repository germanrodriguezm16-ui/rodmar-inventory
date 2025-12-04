import { 
  type User, type UpsertUser,
  type Mina, type InsertMina,
  type Comprador, type InsertComprador,
  type Volquetero, type InsertVolquetero,
  type Viaje, type InsertViaje, type UpdateViaje, type ViajeWithDetails,
  type Transaccion, type InsertTransaccion, type TransaccionWithSocio,
  type Inversion, type InsertInversion,
  type VolqueteroConPlacas
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(userData: UpsertUser): Promise<User>;

  // Minas
  getMinas(userId?: string): Promise<Mina[]>;
  getMinasResumen(userId?: string): Promise<any[]>; // Optimizado: devuelve datos pre-calculados
  getMinaById(id: number, userId?: string): Promise<Mina | undefined>;
  createMina(mina: InsertMina & { userId?: string }): Promise<Mina>;
  updateMina(id: number, updates: Partial<InsertMina>, userId?: string): Promise<Mina | undefined>;
  updateMinaNombre(id: number, nombre: string, userId?: string): Promise<Mina | undefined>;
  deleteMina(id: number, userId?: string): Promise<boolean>;

  // Compradores
  getCompradores(userId?: string): Promise<Comprador[]>;
  getCompradorById(id: number, userId?: string): Promise<Comprador | undefined>;
  createComprador(comprador: InsertComprador & { userId?: string }): Promise<Comprador>;
  updateComprador(id: number, updates: Partial<InsertComprador>, userId?: string): Promise<Comprador | undefined>;
  updateCompradorNombre(id: number, nombre: string, userId?: string): Promise<Comprador | undefined>;
  deleteComprador(id: number, userId?: string): Promise<boolean>;

  // Volqueteros
  getVolqueteros(userId?: string): Promise<Volquetero[]>;
  getVolqueteroById(id: number, userId?: string): Promise<Volquetero | undefined>;
  createVolquetero(volquetero: InsertVolquetero & { userId?: string }): Promise<Volquetero>;
  updateVolquetero(id: number, updates: Partial<InsertVolquetero>, userId?: string): Promise<Volquetero | undefined>;
  updateVolqueteroNombre(id: number, nombre: string, userId?: string): Promise<Volquetero | undefined>;
  deleteVolquetero(id: number, userId?: string): Promise<boolean>;

  // Viajes
  getViajes(userId?: string): Promise<ViajeWithDetails[]>;
  getViajesPendientes(userId?: string): Promise<ViajeWithDetails[]>;
  getViajeById(id: string, userId?: string): Promise<ViajeWithDetails | undefined>;
  createViaje(viaje: InsertViaje & { userId?: string }): Promise<Viaje>;
  createViajeWithCustomId(viaje: InsertViaje & { userId?: string }, customId: string): Promise<Viaje>;
  updateViaje(id: string, updates: UpdateViaje, userId?: string): Promise<Viaje | undefined>;
  deleteViaje(id: string, userId?: string): Promise<boolean>;
  getViajesByMina(minaId: number, userId?: string): Promise<ViajeWithDetails[]>;
  getViajesByComprador(compradorId: number, userId?: string): Promise<ViajeWithDetails[]>;
  getViajesByVolquetero(conductor: string, userId?: string): Promise<ViajeWithDetails[]>;

  // Transacciones
  getTransacciones(userId?: string): Promise<TransaccionWithSocio[]>;
  getTransaccionesIncludingHidden(userId?: string): Promise<TransaccionWithSocio[]>;
  getTransaccionesPaginated(userId?: string, page?: number, limit?: number): Promise<{
    data: TransaccionWithSocio[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>;
  getTransaccionById(id: number, userId?: string): Promise<Transaccion | undefined>;
  createTransaccion(transaccion: InsertTransaccion & { userId?: string }): Promise<Transaccion>;
  updateTransaccion(id: number, updates: Partial<InsertTransaccion>, userId?: string): Promise<Transaccion | undefined>;
  deleteTransaccion(id: number, userId?: string): Promise<boolean>;
  getTransaccionesBySocio(tipoSocio: string, socioId: number, userId?: string, includeHidden?: boolean): Promise<TransaccionWithSocio[]>;
  getTransaccionesForModule(tipoSocio: string, socioId: number, userId?: string, includeHidden?: boolean, modulo?: 'general' | 'comprador' | 'mina' | 'volquetero'): Promise<TransaccionWithSocio[]>;
  hideTransaccion(id: number, userId?: string): Promise<boolean>;
  showAllHiddenTransacciones(userId?: string): Promise<number>;
  
  // Funciones específicas por módulo
  hideTransaccionEnComprador(id: number, userId?: string): Promise<boolean>;
  hideTransaccionEnMina(id: number, userId?: string): Promise<boolean>;
  hideTransaccionEnVolquetero(id: number, userId?: string): Promise<boolean>;
  hideTransaccionEnGeneral(id: number, userId?: string): Promise<boolean>;
  
  // Viajes ocultos (solo afecta transacciones de minas)
  hideViaje(id: string, userId?: string): Promise<boolean>;
  showViaje(id: string, userId?: string): Promise<boolean>;
  showAllHiddenViajes(userId?: string): Promise<number>;
  
  // Métodos específicos para mostrar elementos ocultos de compradores
  showAllHiddenTransaccionesForComprador(compradorId: number, userId?: string): Promise<number>;
  showAllHiddenViajesForComprador(compradorId: number, userId?: string): Promise<number>;
  
  // Métodos específicos para mostrar elementos ocultos de minas
  showAllHiddenTransaccionesForMina(minaId: number, userId?: string): Promise<number>;
  showAllHiddenViajesForMina(minaId: number, userId?: string): Promise<number>;
  
  // Métodos específicos para mostrar elementos ocultos de volqueteros
  showAllHiddenTransaccionesForVolquetero(volqueteroId: number, userId?: string): Promise<number>;
  showAllHiddenViajesForVolquetero(volqueteroNombre: string, userId?: string): Promise<number>;

  // Inversiones
  getInversiones(userId?: string): Promise<Inversion[]>;
  getInversionesByDestino(destino: string, destinoDetalle: string, userId?: string): Promise<Inversion[]>;
  getInversionesBySubpestana(subpestana: string, userId?: string): Promise<Inversion[]>;
  createInversion(inversion: InsertInversion & { userId?: string }): Promise<Inversion>;
  updateInversion(id: number, updates: Partial<InsertInversion>, userId?: string): Promise<Inversion | undefined>;
  deleteInversion(id: number, userId?: string): Promise<boolean>;

  // Application specific
  getVolqueterosWithPlacas(userId?: string): Promise<VolqueteroConPlacas[]>;
  bulkImportViajes(viajesData: any[], userId?: string): Promise<Viaje[]>;
  cleanDuplicates(): Promise<void>;

  // Balance calculado - performance optimization
  recalculateAllBalances(): Promise<void>;

  // Balance agregados - optimización para evitar cargar todos los viajes
  getMinasBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>>;
  getCompradoresBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>>;
  getVolqueterosBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>>;

  // Fusion methods
  mergeVolqueteros(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }>;
  mergeMinas(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }>;
  mergeCompradores(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }>;
  getFusionHistory(userId?: string): Promise<any[]>;
  revertFusion(fusionId: number, userId?: string): Promise<{ entidadRestaurada: string; transaccionesRestauradas: number; viajesRestaurados: number; }>;

  // Compatibility methods (for backward compatibility)
  getMina(id: number): Promise<Mina | undefined>;
  getComprador(id: number): Promise<Comprador | undefined>;
  getViaje(id: string): Promise<ViajeWithDetails | undefined>;
  getTransaccion(id: number): Promise<Transaccion | undefined>;
}

// Import DatabaseStorage implementation
import { DatabaseStorage } from "./db-storage";

// Export storage instance using database
export const storage = new DatabaseStorage();

// Legacy class for compatibility (not used)
export class MemStorage implements IStorage {
  private minas: Map<number, Mina> = new Map();
  private compradores: Map<number, Comprador> = new Map();
  private volqueteros: Map<number, Volquetero> = new Map();
  private viajes: Map<string, Viaje> = new Map();
  private transacciones: Map<number, Transaccion> = new Map();
  
  // Track recent imports to prevent immediate duplicates
  private recentImports: Set<string> = new Set();
  private importTimeout: Map<string, NodeJS.Timeout> = new Map();
  
  // Track file hashes to prevent duplicate file imports
  private recentFileHashes: Set<string> = new Set();
  private fileHashTimeout: Map<string, NodeJS.Timeout> = new Map();
  
  private minaIdCounter = 1;
  private compradorIdCounter = 1;
  private volqueteroIdCounter = 1;
  private viajeIdCounter = 1;
  private transaccionIdCounter = 1;

  constructor() {
    // Initialize with minimal clean data only
    this.initializeCleanDefaults();
    console.log("=== STORAGE: Initialized with clean defaults only");
  }

  private initializeCleanDefaults() {
    console.log("=== STORAGE: Starting clean initialization");
    
    // Reset all counters
    this.minaIdCounter = 1;
    this.compradorIdCounter = 1;
    this.volqueteroIdCounter = 1;
    this.viajeIdCounter = 1;
    this.transaccionIdCounter = 1;
    
    // Create basic entities synchronously
    const mina1: Mina = {
      id: 1,
      nombre: "Mina El Dorado",
      saldo: "315000",
      createdAt: new Date()
    };
    const mina2: Mina = {
      id: 2,
      nombre: "Mina San Pedro", 
      saldo: "0",
      createdAt: new Date()
    };
    this.minas.set(1, mina1);
    this.minas.set(2, mina2);
    this.minaIdCounter = 3;
    
    const comprador1: Comprador = {
      id: 1,
      nombre: "Cemex S.A.",
      saldo: "0",
      createdAt: new Date()
    };
    const comprador2: Comprador = {
      id: 2,
      nombre: "Constructora ABC",
      saldo: "0", 
      createdAt: new Date()
    };
    this.compradores.set(1, comprador1);
    this.compradores.set(2, comprador2);
    this.compradorIdCounter = 3;

    // Create clean sample trip
    const cleanViaje: Viaje = {
      id: "TRP001",
      fechaCargue: new Date("2025-06-25T05:00:00.000Z"),
      fechaDescargue: new Date("2025-06-25T15:00:00.000Z"),
      conductor: "Jonathan Rodríguez",
      tipoCarro: "volqueta",
      placa: "XXL254",
      minaId: 1,
      compradorId: 1,
      peso: 21,
      precioCompraTon: "150000",
      ventaTon: "285000",
      fleteTon: "125000",
      otrosGastosFlete: "0",
      quienPagaFlete: "comprador",
      vut: 285000,
      cut: 150000,
      fut: 125000,
      totalVenta: 5985000,
      totalCompra: 3150000,
      totalFlete: 2625000,
      valorConsignar: 3360000,
      ganancia: 420000,
      recibo: "REC-001",
      estado: "completado",
      createdAt: new Date(),
    };
    this.viajes.set("TRP001", cleanViaje);
    this.viajeIdCounter = 2;

    // Create corresponding transaction
    const cleanTransaction: Transaccion = {
      id: 1,
      tipoSocio: "mina",
      socioId: 1,
      concepto: "Viaje TRP001",
      valor: "3150000",
      fecha: new Date(),
      formaPago: "Efectivo",
      voucher: null,
      comentario: "Compra de material - 21 toneladas",
      createdAt: new Date()
    };
    this.transacciones.set(1, cleanTransaction);
    this.transaccionIdCounter = 2;
    
    console.log("=== STORAGE: Clean initialization completed - TRP001 only");
  }

  private trackFileHash(hash: string): void {
    this.recentFileHashes.add(hash);
    
    // Clear any existing timeout for this hash
    if (this.fileHashTimeout.has(hash)) {
      clearTimeout(this.fileHashTimeout.get(hash)!);
    }
    
    // Set timeout to remove hash after 5 minutes (300 seconds)
    const timeout = setTimeout(() => {
      this.recentFileHashes.delete(hash);
      this.fileHashTimeout.delete(hash);
    }, 300000);
    
    this.fileHashTimeout.set(hash, timeout);
  }

  public isFileHashRecent(hash: string): boolean {
    return this.recentFileHashes.has(hash);
  }

  public addFileHash(hash: string): void {
    this.trackFileHash(hash);
  }

  private generateViajeId(): string {
    return `TRP${this.viajeIdCounter.toString().padStart(3, '0')}`;
  }

  // Minas
  async getMinas(): Promise<Mina[]> {
    return Array.from(this.minas.values());
  }

  async getMina(id: number): Promise<Mina | undefined> {
    return this.minas.get(id);
  }

  async createMina(insertMina: InsertMina, customId?: number): Promise<Mina> {
    const id = customId || this.minaIdCounter++;
    if (customId && customId >= this.minaIdCounter) {
      this.minaIdCounter = customId + 1;
    }
    
    // Verificar si ya existe una mina con este ID
    if (this.minas.has(id)) {
      console.log(`=== Mina with ID ${id} already exists, skipping creation`);
      return this.minas.get(id)!;
    }
    
    const mina: Mina = {
      id,
      ...insertMina,
      saldo: "0",
      createdAt: new Date(),
    };
    this.minas.set(id, mina);
    console.log(`=== Created mina: ${mina.nombre} with ID ${id}`);
    return mina;
  }

  async updateMinaSaldo(id: number, saldo: string): Promise<void> {
    const mina = this.minas.get(id);
    if (mina) {
      mina.saldo = saldo;
      this.minas.set(id, mina);
    }
  }

  // Compradores
  async getCompradores(): Promise<Comprador[]> {
    return Array.from(this.compradores.values());
  }

  async getComprador(id: number): Promise<Comprador | undefined> {
    return this.compradores.get(id);
  }

  async createComprador(insertComprador: InsertComprador, customId?: number): Promise<Comprador> {
    const id = customId || this.compradorIdCounter++;
    if (customId && customId >= this.compradorIdCounter) {
      this.compradorIdCounter = customId + 1;
    }
    
    // Verificar si ya existe un comprador con este ID
    if (this.compradores.has(id)) {
      console.log(`=== Comprador with ID ${id} already exists, skipping creation`);
      return this.compradores.get(id)!;
    }
    
    const comprador: Comprador = {
      id,
      ...insertComprador,
      saldo: "0",
      createdAt: new Date(),
    };
    this.compradores.set(id, comprador);
    console.log(`=== Created comprador: ${comprador.nombre} with ID ${id}`);
    return comprador;
  }

  async updateCompradorSaldo(id: number, saldo: string): Promise<void> {
    const comprador = this.compradores.get(id);
    if (comprador) {
      comprador.saldo = saldo;
      this.compradores.set(id, comprador);
    }
  }

  // Volqueteros
  async getVolqueteros(): Promise<Volquetero[]> {
    return Array.from(this.volqueteros.values());
  }

  async getVolquetero(id: number): Promise<Volquetero | undefined> {
    return this.volqueteros.get(id);
  }

  async createVolquetero(insertVolquetero: InsertVolquetero): Promise<Volquetero> {
    const id = this.volqueteroIdCounter++;
    const volquetero: Volquetero = {
      id,
      ...insertVolquetero,
      saldo: "0",
      createdAt: new Date(),
    };
    this.volqueteros.set(id, volquetero);
    console.log(`=== Auto-created volquetero: ${volquetero.nombre} with ID ${id}`);
    return volquetero;
  }

  async updateVolqueteroSaldo(id: number, saldo: string): Promise<void> {
    const volquetero = this.volqueteros.get(id);
    if (volquetero) {
      volquetero.saldo = saldo;
      this.volqueteros.set(id, volquetero);
    }
  }

  // Viajes
  // Clean up corrupted storage data
  public removeDuplicateViajes(): void {
    console.log("=== CLEANUP: Starting duplicate removal");
    console.log(`=== CLEANUP: Before - Total viajes: ${this.viajes.size}`);
    
    // Convert to array and use forEach to avoid iteration issues
    const allViajes = Array.from(this.viajes.entries());
    const seenIds = new Set<string>();
    const uniqueViajes = new Map<string, Viaje>();
    
    // Count duplicates first
    const duplicateCount = new Map<string, number>();
    allViajes.forEach(([id, viaje]) => {
      duplicateCount.set(id, (duplicateCount.get(id) || 0) + 1);
    });
    
    // Log duplicate counts
    duplicateCount.forEach((count, id) => {
      if (count > 1) {
        console.log(`=== CLEANUP: Found ${count} instances of ID "${id}"`);
      }
    });
    
    // Keep only first occurrence of each ID
    allViajes.forEach(([id, viaje]) => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueViajes.set(id, viaje);
        console.log(`=== CLEANUP: Keeping viaje with ID: ${id}`);
      } else {
        console.log(`=== CLEANUP: Removing duplicate viaje with ID: ${id}`);
      }
    });
    
    // Clear and rebuild the Map
    this.viajes.clear();
    uniqueViajes.forEach((viaje, id) => {
      this.viajes.set(id, viaje);
    });
    
    console.log(`=== CLEANUP: After - ${this.viajes.size} unique viajes remaining`);
    
    // Verify cleanup
    const finalIds = Array.from(this.viajes.keys());
    console.log(`=== CLEANUP: Final IDs:`, finalIds);
  }

  public forcedCleanupDuplicates(): void {
    console.log("=== FORCED CLEANUP: Removing all duplicates immediately");
    const originalSize = this.viajes.size;
    
    // Clear the map completely and rebuild with unique entries
    const allViajes = Array.from(this.viajes.values());
    const uniqueViajesMap = new Map<string, Viaje>();
    
    allViajes.forEach(viaje => {
      if (!uniqueViajesMap.has(viaje.id)) {
        uniqueViajesMap.set(viaje.id, viaje);
        console.log(`=== FORCED CLEANUP: Added unique viaje ${viaje.id}`);
      } else {
        console.log(`=== FORCED CLEANUP: Skipped duplicate viaje ${viaje.id}`);
      }
    });
    
    // Replace the entire map
    this.viajes.clear();
    uniqueViajesMap.forEach((viaje, id) => {
      this.viajes.set(id, viaje);
    });
    
    console.log(`=== FORCED CLEANUP: Complete. Before: ${originalSize}, After: ${this.viajes.size}`);
  }

  private cleanupCorruptedData(): void {
    const validIds = new Set<string>();
    const duplicateIds = new Set<string>();
    
    // Check for duplicate IDs and corrupted entries
    for (const [id, viaje] of this.viajes) {
      if (validIds.has(id) || !viaje.id || !viaje.conductor) {
        duplicateIds.add(id);
        console.log(`=== Found corrupted/duplicate viaje: ${id}`);
      } else {
        validIds.add(id);
      }
    }
    
    // Remove corrupted entries
    duplicateIds.forEach(id => {
      this.viajes.delete(id);
      console.log(`=== Removed corrupted viaje: ${id}`);
    });
    
    // No longer clear imported trips - allow all valid IDs
  }

  async getViajes(): Promise<ViajeWithDetails[]> {
    // Clean up corrupted data before returning
    this.cleanupCorruptedData();
    
    return Array.from(this.viajes.values()).map(viaje => ({
      ...viaje,
      mina: viaje.minaId ? this.minas.get(viaje.minaId) : undefined,
      comprador: viaje.compradorId ? this.compradores.get(viaje.compradorId) : undefined,
    })).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getViaje(id: string): Promise<ViajeWithDetails | undefined> {
    const viaje = this.viajes.get(id);
    if (!viaje) return undefined;
    
    return {
      ...viaje,
      mina: viaje.minaId ? this.minas.get(viaje.minaId) : undefined,
      comprador: viaje.compradorId ? this.compradores.get(viaje.compradorId) : undefined,
    };
  }

  async getViajesPendientes(): Promise<ViajeWithDetails[]> {
    return Array.from(this.viajes.values())
      .filter(viaje => viaje.estado === "pendiente")
      .map(viaje => ({
        ...viaje,
        mina: viaje.minaId ? this.minas.get(viaje.minaId) : undefined,
        comprador: viaje.compradorId ? this.compradores.get(viaje.compradorId) : undefined,
      }));
  }

  async createViaje(insertViaje: InsertViaje): Promise<Viaje> {
    const id = this.generateViajeId();
    this.viajeIdCounter++;
    
    const viaje: Viaje = {
      id,
      ...insertViaje,
      minaId: insertViaje.minaId || null,
      compradorId: insertViaje.compradorId || null,
      peso: insertViaje.peso || null,
      ventaTon: insertViaje.ventaTon || null,
      fleteTon: insertViaje.fleteTon || null,
      vut: insertViaje.vut || null,
      cut: insertViaje.cut || null,
      fut: insertViaje.fut || null,
      fechaDescargue: insertViaje.fechaDescargue || null,
      totalVenta: insertViaje.totalVenta || null,
      totalCompra: insertViaje.totalCompra || null,
      totalFlete: insertViaje.totalFlete || null,
      valorConsignar: insertViaje.valorConsignar || null,
      ganancia: insertViaje.ganancia || null,
      recibo: insertViaje.recibo || null,
      estado: insertViaje.estado || "pendiente",
      otrosGastosFlete: insertViaje.otrosGastosFlete || "0",
      quienPagaFlete: insertViaje.quienPagaFlete || "comprador",
      createdAt: new Date(),
    };
    this.viajes.set(id, viaje);
    return viaje;
  }

  async createViajeWithCustomId(insertViaje: InsertViaje, customId: string): Promise<Viaje> {
    const viaje: Viaje = {
      id: customId,
      ...insertViaje,
      minaId: insertViaje.minaId || null,
      compradorId: insertViaje.compradorId || null,
      peso: insertViaje.peso || null,
      ventaTon: insertViaje.ventaTon || null,
      fleteTon: insertViaje.fleteTon || null,
      vut: insertViaje.vut || null,
      cut: insertViaje.cut || null,
      fut: insertViaje.fut || null,
      fechaDescargue: insertViaje.fechaDescargue || null,
      totalVenta: insertViaje.totalVenta || null,
      totalCompra: insertViaje.totalCompra || null,
      totalFlete: insertViaje.totalFlete || null,
      valorConsignar: insertViaje.valorConsignar || null,
      ganancia: insertViaje.ganancia || null,
      recibo: insertViaje.recibo || null,
      estado: insertViaje.estado || "pendiente",
      otrosGastosFlete: insertViaje.otrosGastosFlete || "0",
      quienPagaFlete: insertViaje.quienPagaFlete || "comprador", // Default for Excel imports
      createdAt: new Date(),
    };
    this.viajes.set(customId, viaje);
    return viaje;
  }

  async updateViaje(id: string, updateViaje: UpdateViaje): Promise<Viaje> {
    // Clean up corrupted data before attempting update
    this.cleanupCorruptedData();
    
    const viaje = this.viajes.get(id);
    if (!viaje) {
      console.log(`=== Viaje ${id} not found. Available viajes:`, Array.from(this.viajes.keys()));
      throw new Error(`Viaje ${id} not found. This may be an imported trip that was lost after server restart.`);
    }
    
    // Preserve original data when updating, only override what's explicitly provided
    const updatedViaje = { 
      ...viaje, 
      ...updateViaje,
      // Ensure critical fields are preserved
      fechaCargue: updateViaje.fechaCargue || viaje.fechaCargue,
      conductor: updateViaje.conductor || viaje.conductor,
      placa: updateViaje.placa || viaje.placa,
      minaId: updateViaje.minaId !== undefined ? updateViaje.minaId : viaje.minaId,
      estado: updateViaje.estado || viaje.estado, // Preserve existing estado
      fechaDescargue: updateViaje.fechaDescargue || viaje.fechaDescargue, // Preserve fechaDescargue
      // Ensure Excel imported trips have default values for missing fields
      otrosGastosFlete: updateViaje.otrosGastosFlete || viaje.otrosGastosFlete || "0",
      quienPagaFlete: updateViaje.quienPagaFlete || viaje.quienPagaFlete || "El comprador",
    };
    
    // Recalculate all financial values if we have the necessary data OR if only quienPagaFlete changed
    const hasCompleteData = updatedViaje.peso && updatedViaje.ventaTon && updatedViaje.fleteTon;
    const hasOriginalData = viaje.peso && viaje.ventaTon && viaje.fleteTon;
    const quienPagaFleteChanged = updateViaje.quienPagaFlete !== undefined;
    
    const shouldRecalculate = hasCompleteData || (quienPagaFleteChanged && hasOriginalData);
    
    if (shouldRecalculate) {
      // Use values from updated viaje or fall back to original viaje values
      const peso = parseFloat(updatedViaje.peso || viaje.peso || "0");
      const ventaTon = parseFloat(updatedViaje.ventaTon || viaje.ventaTon || "0");
      const fleteTon = parseFloat(updatedViaje.fleteTon || viaje.fleteTon || "0");
      const otrosGastosFlete = parseFloat(updatedViaje.otrosGastosFlete || viaje.otrosGastosFlete || "0");
      
      // Use existing precioCompraTon if not provided in update
      const precioCompraTon = updatedViaje.precioCompraTon 
        ? parseFloat(updatedViaje.precioCompraTon) 
        : (viaje.precioCompraTon ? parseFloat(viaje.precioCompraTon) : 0);
      
      // Recalculate all derived values
      updatedViaje.vut = ventaTon.toString();
      updatedViaje.cut = precioCompraTon.toString(); // CUT should equal precioCompraTon
      updatedViaje.fut = fleteTon.toString();
      updatedViaje.totalVenta = (peso * ventaTon).toString();
      updatedViaje.totalCompra = (peso * precioCompraTon).toString();
      const totalFleteBase = peso * fleteTon;
      updatedViaje.totalFlete = (totalFleteBase + otrosGastosFlete).toString();
      
      // Calculate valor a consignar based on who pays freight
      const quienPaga = updatedViaje.quienPagaFlete || viaje.quienPagaFlete || "El comprador";
      const totalVentaNum = peso * ventaTon;
      const totalFleteNum = totalFleteBase + otrosGastosFlete;
      
      if (quienPaga === "Tú" || quienPaga === "tu" || quienPaga === "RodMar") {
        updatedViaje.valorConsignar = totalVentaNum.toString(); // Full sale amount
      } else {
        updatedViaje.valorConsignar = (totalVentaNum - totalFleteNum).toString(); // Sale minus freight
      }
      
      updatedViaje.ganancia = (totalVentaNum - (peso * precioCompraTon) - totalFleteNum).toString();
      
      // Mark as completed when we have all descargue data (only if not already set)
      if (updatedViaje.fechaDescargue && updatedViaje.compradorId && !updatedViaje.estado) {
        updatedViaje.estado = "completado";
      }
      
      // Ensure precioCompraTon is preserved
      if (!updatedViaje.precioCompraTon && viaje.precioCompraTon) {
        updatedViaje.precioCompraTon = viaje.precioCompraTon;
      }
      
      console.log(`=== Recalculated values: peso=${peso}, precioCompraTon=${precioCompraTon}, cut=${updatedViaje.cut}, totalCompra=${updatedViaje.totalCompra}, otrosGastosFlete=${otrosGastosFlete}, totalFlete=${updatedViaje.totalFlete}, ganancia=${updatedViaje.ganancia}, estado=${updatedViaje.estado}`);
    }
    
    this.viajes.set(id, updatedViaje);
    
    // No longer create or update automatic transactions for trips
    
    return updatedViaje;
  }

  async deleteViaje(id: string): Promise<void> {
    const viaje = this.viajes.get(id);
    if (!viaje) throw new Error("Viaje not found");

    console.log(`=== Deleting viaje ${id}`);
    
    // No longer delete related transactions automatically - only delete the trip
    this.viajes.delete(id);
    console.log(`=== Deleted viaje ${id}`);
  }

  async getViajesByMina(minaId: number): Promise<ViajeWithDetails[]> {
    return Array.from(this.viajes.values())
      .filter(viaje => viaje.minaId === minaId)
      .map(viaje => ({
        ...viaje,
        mina: viaje.minaId ? this.minas.get(viaje.minaId) : undefined,
        comprador: viaje.compradorId ? this.compradores.get(viaje.compradorId) : undefined,
      }));
  }

  async getViajesByComprador(compradorId: number): Promise<ViajeWithDetails[]> {
    return Array.from(this.viajes.values())
      .filter(viaje => viaje.compradorId === compradorId)
      .map(viaje => ({
        ...viaje,
        mina: viaje.minaId ? this.minas.get(viaje.minaId) : undefined,
        comprador: viaje.compradorId ? this.compradores.get(viaje.compradorId) : undefined,
      }));
  }

  // Transacciones
  async getTransacciones(): Promise<TransaccionWithSocio[]> {
    return Array.from(this.transacciones.values()).map(transaccion => {
      let socioNombre = "";
      
      if (transaccion.tipoSocio === "mina") {
        const mina = this.minas.get(transaccion.socioId);
        socioNombre = mina?.nombre || "";
      } else if (transaccion.tipoSocio === "comprador") {
        const comprador = this.compradores.get(transaccion.socioId);
        socioNombre = comprador?.nombre || "";
      } else if (transaccion.tipoSocio === "volquetero") {
        const volquetero = this.volqueteros.get(transaccion.socioId);
        socioNombre = volquetero?.nombre || "";
      }
      
      return {
        ...transaccion,
        socioNombre,
      };
    }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  async getTransaccion(id: number): Promise<Transaccion | undefined> {
    return this.transacciones.get(id);
  }

  async createTransaccion(insertTransaccion: InsertTransaccion): Promise<Transaccion> {
    const id = this.transaccionIdCounter++;
    const transaccion: Transaccion = {
      id,
      ...insertTransaccion,
      voucher: insertTransaccion.voucher || null,
      comentario: insertTransaccion.comentario || null,
      createdAt: new Date(),
    };
    this.transacciones.set(id, transaccion);
    return transaccion;
  }

  async updateTransaccion(id: number, updateData: Partial<InsertTransaccion>): Promise<Transaccion> {
    const transaccion = this.transacciones.get(id);
    if (!transaccion) throw new Error("Transaccion not found");
    
    const updatedTransaccion = { ...transaccion, ...updateData };
    this.transacciones.set(id, updatedTransaccion);
    
    // Recalculate balances for affected partners
    await this.recalculateBalances();
    
    return updatedTransaccion;
  }

  async deleteTransaccion(id: number): Promise<void> {
    const transaccion = this.transacciones.get(id);
    if (!transaccion) {
      throw new Error("Transaccion not found");
    }

    this.transacciones.delete(id);
    
    // Recalculate balances for all partners after deletion
    await this.recalculateBalances();
  }

  private async recalculateBalances(): Promise<void> {
    // Reset all balances to 0
    for (const mina of this.minas.values()) {
      mina.saldo = "0";
    }
    for (const comprador of this.compradores.values()) {
      comprador.saldo = "0";
    }
    for (const volquetero of this.volqueteros.values()) {
      volquetero.saldo = "0";
    }

    // Recalculate from all remaining transactions
    for (const transaccion of this.transacciones.values()) {
      const valor = parseFloat(transaccion.valor);
      
      if (transaccion.tipoSocio === "mina") {
        const mina = this.minas.get(transaccion.socioId);
        if (mina) {
          const currentBalance = parseFloat(mina.saldo);
          if (transaccion.concepto === "Pago" || transaccion.concepto === "Adelanto") {
            mina.saldo = (currentBalance - valor).toString();
          } else if (transaccion.concepto === "Saldo a favor" || transaccion.concepto === "Viaje") {
            mina.saldo = (currentBalance + valor).toString();
          }
        }
      } else if (transaccion.tipoSocio === "comprador") {
        const comprador = this.compradores.get(transaccion.socioId);
        if (comprador) {
          const currentBalance = parseFloat(comprador.saldo);
          if (transaccion.concepto === "Abono") {
            comprador.saldo = (currentBalance + valor).toString();
          } else if (transaccion.concepto === "Préstamo") {
            comprador.saldo = (currentBalance - valor).toString();
          }
        }
      } else if (transaccion.tipoSocio === "volquetero") {
        const volquetero = this.volqueteros.get(transaccion.socioId);
        if (volquetero) {
          const currentBalance = parseFloat(volquetero.saldo);
          if (transaccion.concepto === "Pago" || transaccion.concepto === "Préstamo") {
            volquetero.saldo = (currentBalance - valor).toString();
          } else if (transaccion.concepto === "Saldo a favor") {
            volquetero.saldo = (currentBalance + valor).toString();
          }
        }
      }
    }

    // Also include viajes in balance calculations
    for (const viaje of this.viajes.values()) {
      if (viaje.estado === "completado" && viaje.totalCompra && viaje.minaId) {
        const mina = this.minas.get(viaje.minaId);
        if (mina) {
          const currentBalance = parseFloat(mina.saldo);
          const viajeValue = parseFloat(viaje.totalCompra);
          mina.saldo = (currentBalance + viajeValue).toString();
        }
      }
    }
  }

  async getTransaccionesBySocio(tipoSocio: string, socioId: number, userId?: string): Promise<TransaccionWithSocio[]> {

    
    const transacciones = Array.from(this.transacciones.values())
      .filter(t => t.tipoSocio === tipoSocio && t.socioId === socioId)
      .sort((a, b) => {
        // Ordenamiento por fecha descendente (más reciente primero)
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        
        // Si las fechas son iguales, usar horaInterna como criterio secundario
        if (fechaA.getTime() === fechaB.getTime()) {
          if (a.horaInterna && b.horaInterna) {
            return new Date(b.horaInterna).getTime() - new Date(a.horaInterna).getTime();
          }
        }
        
        return fechaB.getTime() - fechaA.getTime();
      });

    // For minas and volqueteros, also include viajes as transactions
    let viajeTransactions: TransaccionWithSocio[] = [];
    
    if (tipoSocio === "mina") {
      const viajes = Array.from(this.viajes.values())
        .filter(v => v.minaId === socioId && v.estado === "completado");

      viajeTransactions = viajes.map((viaje, index) => {
        // Generate a safe unique ID for artificial transactions
        const baseId = viaje.id.replace(/[^0-9]/g, ''); // Extract only numbers
        const numericId = baseId ? parseInt(baseId) : index + 1;
        const artificialId = numericId + 100000; // Use a higher range to avoid conflicts
        
        return {
          id: artificialId,
          tipoSocio: "mina" as const,
          socioId: socioId,
          concepto: `Viaje ${viaje.id}`,
          valor: viaje.totalCompra || "0",
          fecha: viaje.fechaDescargue || viaje.fechaCargue,
          formaPago: "viaje",
          voucher: null,
          comentario: `Compra de material - ${viaje.peso || 0} toneladas`,
          createdAt: viaje.createdAt,
          socioNombre: this.minas.get(socioId)?.nombre || `Mina ${socioId}`,
          isArtificial: true // Add flag to identify artificial transactions
        };
      });
    } else if (tipoSocio === "volquetero") {
      // Para volqueteros, incluir viajes donde el conductor coincida con el nombre del volquetero
      // Solo incluir viajes donde RodMar paga el flete (no cuando el comprador paga)
      const volqueteroNombre = this.volqueteros.get(socioId)?.nombre;

      
      if (volqueteroNombre) {
        const todosLosViajes = Array.from(this.viajes.values())
          .filter(v => v.conductor === volqueteroNombre);
        const viajesCompletados = todosLosViajes.filter(v => v.estado === "completado");
        const viajes = viajesCompletados.filter(v => v.quienPagaFlete !== "comprador" && v.quienPagaFlete !== "El comprador");



        viajeTransactions = viajes.map((viaje, index) => {
          // Generate a safe unique ID for artificial transactions  
          const baseId = viaje.id.replace(/[^0-9]/g, ''); // Extract only numbers
          const numericId = baseId ? parseInt(baseId) : index + 1;
          const artificialId = numericId + 200000; // Use different range for volqueteros
          
          return {
            id: artificialId,
            tipoSocio: "volquetero" as const,
            socioId: socioId,
            concepto: `Viaje ${viaje.id}`,
            valor: viaje.totalFlete || "0",
            fecha: viaje.fechaDescargue || viaje.fechaCargue,
            formaPago: "viaje",
            voucher: null,
            comentario: `Flete - ${viaje.peso || 0} toneladas`,
            createdAt: viaje.createdAt,
            socioNombre: volqueteroNombre,
            isArtificial: true // Add flag to identify artificial transactions
          };
        });
      }
    }

    const regularTransactions = transacciones.map(transaccion => {
      let socioNombre = "";
      
      if (transaccion.tipoSocio === "mina") {
        const mina = this.minas.get(transaccion.socioId);
        socioNombre = mina?.nombre || `Mina ${transaccion.socioId}`;
      } else if (transaccion.tipoSocio === "comprador") {
        const comprador = this.compradores.get(transaccion.socioId);
        socioNombre = comprador?.nombre || `Comprador ${transaccion.socioId}`;
      } else if (transaccion.tipoSocio === "volquetero") {
        const volquetero = this.volqueteros.get(transaccion.socioId);
        socioNombre = volquetero?.nombre || `Volquetero ${transaccion.socioId}`;
      }

      return {
        ...transaccion,
        socioNombre
      };
    });

    // Combine and sort all transactions by date (más reciente primero)
    const allTransactions = [...regularTransactions, ...viajeTransactions];

    
    return allTransactions.sort((a, b) => {
      // Función auxiliar para extraer fecha como string YYYY-MM-DD
      const extractDateString = (fecha: any) => {
        if (!fecha) return '1970-01-01';
        
        if (typeof fecha === 'string' && fecha.includes('T')) {
          // Formato ISO string - extraer directamente
          return fecha.split('T')[0];
        } else if (fecha instanceof Date) {
          // Objeto Date - convertir a ISO y extraer
          return fecha.toISOString().split('T')[0];
        } else if (typeof fecha === 'string') {
          // String de fecha simple - asumir ya está en formato correcto
          return fecha;
        }
        
        // Fallback - intentar crear Date y extraer
        try {
          return new Date(fecha).toISOString().split('T')[0];
        } catch {
          return '1970-01-01';
        }
      };
      
      const fechaStringA = extractDateString(a.fecha);  
      const fechaStringB = extractDateString(b.fecha);
      
      // Criterio primario: comparar por día (más reciente primero)
      if (fechaStringA !== fechaStringB) {
        return fechaStringB.localeCompare(fechaStringA);
      }
      
      // CRITERIO SECUNDARIO MEJORADO: Si son del mismo día, priorizar por precisión temporal
      // 1. Transacciones con horaInterna (más precisas) van primero  
      if (a.horaInterna && b.horaInterna) {
        return new Date(b.horaInterna).getTime() - new Date(a.horaInterna).getTime();
      }
      
      // 2. Transacciones con horaInterna tienen prioridad sobre las artificiales
      if (a.horaInterna && !b.horaInterna) {
        return -1; // a va primero
      }
      if (!a.horaInterna && b.horaInterna) {
        return 1; // b va primero
      }
      
      // 3. Para transacciones artificiales (viajes), usar createdAt como timestamp de referencia
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      return 0;
    });
  }

  async getStats(): Promise<{
    totalViajes: number;
    totalTransacciones: number;
    totalMinas: number;
    totalCompradores: number;
    totalVolqueteros: number;
  }> {
    return {
      totalViajes: this.viajes.size,
      totalTransacciones: this.transacciones.size,
      totalMinas: this.minas.size,
      totalCompradores: this.compradores.size,
      totalVolqueteros: this.volqueteros.size,
    };
  }

  async getFinancialSummary(): Promise<{
    totalVentas: string;
    totalCompras: string;
    totalFletes: string;
    gananciaNeta: string;
  }> {
    const viajes = Array.from(this.viajes.values()).filter(v => v.estado === "completado");
    
    let totalVentas = 0;
    let totalCompras = 0;
    let totalFletes = 0;
    
    viajes.forEach(viaje => {
      if (viaje.totalVenta) totalVentas += parseFloat(viaje.totalVenta);
      if (viaje.totalCompra) totalCompras += parseFloat(viaje.totalCompra);
      if (viaje.totalFlete) totalFletes += parseFloat(viaje.totalFlete);
    });
    
    const gananciaNeta = totalVentas - totalCompras - totalFletes;
    
    return {
      totalVentas: totalVentas.toString(),
      totalCompras: totalCompras.toString(),
      totalFletes: totalFletes.toString(),
      gananciaNeta: gananciaNeta.toString(),
    };
  }

  // Métodos de ocultamiento para compatibilidad (no implementados en MemStorage)
  async hideTransaccion(id: number, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async showAllHiddenTransacciones(userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  // Funciones específicas por módulo (no implementadas en MemStorage)
  async hideTransaccionEnComprador(id: number, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async hideTransaccionEnMina(id: number, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async hideTransaccionEnVolquetero(id: number, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async hideTransaccionEnGeneral(id: number, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async getTransaccionesForModule(tipoSocio: string, socioId: number, userId?: string, includeHidden?: boolean, modulo?: 'general' | 'comprador' | 'mina' | 'volquetero'): Promise<TransaccionWithSocio[]> {
    // Delegamos a la función principal para MemStorage
    return this.getTransaccionesBySocio(tipoSocio, socioId, userId, includeHidden);
  }

  async hideViaje(id: string, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async showViaje(id: string, userId?: string): Promise<boolean> {
    return false; // Not implemented in memory storage
  }

  async showAllHiddenViajes(userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  async showAllHiddenTransaccionesForComprador(compradorId: number, userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  async showAllHiddenViajesForComprador(compradorId: number, userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  // Métodos específicos para mostrar elementos ocultos de minas (no implementados en MemStorage)
  async showAllHiddenTransaccionesForMina(minaId: number, userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  async showAllHiddenViajesForMina(minaId: number, userId?: string): Promise<number> {
    return 0; // Not implemented in memory storage
  }

  // Métodos para editar nombres (implementación básica en MemStorage)
  async updateMinaNombre(id: number, nombre: string, userId?: string): Promise<Mina | undefined> {
    const mina = this.minas.get(id);
    if (!mina) return undefined;
    
    const updatedMina = { ...mina, nombre };
    this.minas.set(id, updatedMina);
    return updatedMina;
  }

  async updateCompradorNombre(id: number, nombre: string, userId?: string): Promise<Comprador | undefined> {
    const comprador = this.compradores.get(id);
    if (!comprador) return undefined;
    
    const updatedComprador = { ...comprador, nombre };
    this.compradores.set(id, updatedComprador);
    return updatedComprador;
  }

  async updateVolqueteroNombre(id: number, nombre: string, userId?: string): Promise<Volquetero | undefined> {
    const volquetero = this.volqueteros.get(id);
    if (!volquetero) return undefined;
    
    const updatedVolquetero = { ...volquetero, nombre };
    this.volqueteros.set(id, updatedVolquetero);
    return updatedVolquetero;
  }
}


