import {
  users,
  minas,
  compradores,
  volqueteros,
  viajes,
  transacciones,
  inversiones,
  fusionBackups,
  type User,
  type UpsertUser,
  type Mina,
  type InsertMina,
  type Comprador,
  type InsertComprador,
  type Volquetero,
  type InsertVolquetero,
  type Viaje,
  type InsertViaje,
  type UpdateViaje,
  type Transaccion,
  type InsertTransaccion,
  type TransaccionWithSocio,
  type Inversion,
  type InsertInversion,
  type ViajeWithDetails,
  type VolqueteroConPlacas,
  type FusionBackup
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, isNull, inArray } from "drizzle-orm";
import type { IStorage } from "./storage";

// Helper para capturar errores de conexión y propagarlos correctamente
async function wrapDbOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Si es un error de conexión o autenticación de Supabase, marcarlo con el código apropiado
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.code === 'XX000' ||
        error.message?.includes('getaddrinfo') || error.message?.includes('connect') || 
        error.message?.includes('Connection') || error.message?.includes('Tenant or user not found')) {
      const dbError = new Error(error.message || 'Error de conexión a la base de datos');
      (dbError as any).code = error.code === 'XX000' ? 'DB_CONNECTION_ERROR' : (error.code || 'DB_CONNECTION_ERROR');
      throw dbError;
    }
    throw error;
  }
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Minas operations
  async getMinas(userId?: string): Promise<Mina[]> {
    return wrapDbOperation(async () => {
      const query = db.select().from(minas).orderBy(desc(minas.createdAt));
      
      if (userId) {
        return await query.where(eq(minas.userId, userId));
      }
      
      // Fallback para compatibilidad: mostrar todas las minas si no hay userId
      return await query;
    });
  }

  async getMinasResumen(userId?: string): Promise<any[]> {
    // Endpoint mínimo para probar - evitando query complejas que fallan
    try {
      console.log('=== getMinasResumen - Getting minas without complex queries ===');
      
      // Obtener minas usando el método que ya funciona
      const minasData = await this.getMinas(userId);
      
      console.log(`=== getMinasResumen - Processing ${minasData.length} minas ===`);

      // Agregar datos simples para cada mina sin queries complejas
      const resumen = minasData.map((mina) => {
        return {
          ...mina,
          cantidadViajes: 0, // Simplificado - se calculará en frontend
          cantidadTransacciones: 0, // Simplificado - se calculará en frontend
          canDelete: false, // Simplificado - se calculará en frontend
          balanceCalculado: 0, // Simplificado - se calculará en frontend
        };
      });

      console.log(`=== getMinasResumen - Successfully processed ${resumen.length} minas ===`);
      return resumen;
    } catch (error) {
      console.error('=== Error in getMinasResumen:', error);
      throw error;
    }
  }

  async getMinaById(id: number, userId?: string): Promise<Mina | undefined> {
    const conditions = [eq(minas.id, id)];
    if (userId) {
      conditions.push(eq(minas.userId, userId));
    }
    
    const [mina] = await db.select().from(minas).where(and(...conditions));
    return mina;
  }

  async createMina(mina: InsertMina & { userId?: string }): Promise<Mina> {
    return wrapDbOperation(async () => {
      const [newMina] = await db.insert(minas).values({
        ...mina,
        userId: mina.userId || 'main_user', // Default al usuario principal
      }).returning();
      return newMina;
    });
  }

  async updateMina(id: number, updates: Partial<InsertMina>, userId?: string): Promise<Mina | undefined> {
    const conditions = [eq(minas.id, id)];
    if (userId) {
      conditions.push(eq(minas.userId, userId));
    }

    const [updatedMina] = await db
      .update(minas)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updatedMina;
  }

  async deleteMina(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(minas.id, id)];
    if (userId) {
      conditions.push(eq(minas.userId, userId));
    }

    const result = await db.delete(minas).where(and(...conditions));
    return result.rowCount > 0;
  }

  async updateMinaNombre(id: number, nombre: string, userId?: string): Promise<Mina | undefined> {
    const conditions = [eq(minas.id, id)];
    if (userId) {
      conditions.push(eq(minas.userId, userId));
    }

    const [updatedMina] = await db
      .update(minas)
      .set({ nombre })
      .where(and(...conditions))
      .returning();
    return updatedMina;
  }

  // Compradores operations
  async getCompradores(userId?: string): Promise<Comprador[]> {
    return wrapDbOperation(async () => {
      const query = db.select().from(compradores).orderBy(desc(compradores.createdAt));
      
      if (userId) {
        return await query.where(eq(compradores.userId, userId));
      }
      
      return await query;
    });
  }

  async getCompradorById(id: number, userId?: string): Promise<Comprador | undefined> {
    const conditions = [eq(compradores.id, id)];
    if (userId) {
      conditions.push(eq(compradores.userId, userId));
    }
    
    const [comprador] = await db.select().from(compradores).where(and(...conditions));
    return comprador;
  }

  async createComprador(comprador: InsertComprador & { userId?: string }): Promise<Comprador> {
    const [newComprador] = await db.insert(compradores).values({
      ...comprador,
      userId: comprador.userId || 'main_user',
    }).returning();
    return newComprador;
  }

  async updateComprador(id: number, updates: Partial<InsertComprador>, userId?: string): Promise<Comprador | undefined> {
    const conditions = [eq(compradores.id, id)];
    if (userId) {
      conditions.push(eq(compradores.userId, userId));
    }

    const [updatedComprador] = await db
      .update(compradores)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updatedComprador;
  }

  async deleteComprador(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(compradores.id, id)];
    if (userId) {
      conditions.push(eq(compradores.userId, userId));
    }

    const result = await db.delete(compradores).where(and(...conditions));
    return result.rowCount > 0;
  }

  async updateCompradorNombre(id: number, nombre: string, userId?: string): Promise<Comprador | undefined> {
    const conditions = [eq(compradores.id, id)];
    if (userId) {
      conditions.push(eq(compradores.userId, userId));
    }

    const [updatedComprador] = await db
      .update(compradores)
      .set({ nombre })
      .where(and(...conditions))
      .returning();
    return updatedComprador;
  }

  // Volqueteros operations
  async getVolqueteros(userId?: string): Promise<Volquetero[]> {
    return wrapDbOperation(async () => {
      const query = db.select().from(volqueteros).orderBy(desc(volqueteros.createdAt));
      
      if (userId) {
        return await query.where(eq(volqueteros.userId, userId));
      }
      
      return await query;
    });
  }

  async getVolqueteroById(id: number, userId?: string): Promise<Volquetero | undefined> {
    const conditions = [eq(volqueteros.id, id)];
    if (userId) {
      conditions.push(eq(volqueteros.userId, userId));
    }
    
    const [volquetero] = await db.select().from(volqueteros).where(and(...conditions));
    return volquetero;
  }

  async createVolquetero(volquetero: InsertVolquetero & { userId?: string }): Promise<Volquetero> {
    const [newVolquetero] = await db.insert(volqueteros).values({
      ...volquetero,
      userId: volquetero.userId || 'main_user',
    }).returning();
    return newVolquetero;
  }

  async updateVolquetero(id: number, updates: Partial<InsertVolquetero>, userId?: string): Promise<Volquetero | undefined> {
    const conditions = [eq(volqueteros.id, id)];
    if (userId) {
      conditions.push(eq(volqueteros.userId, userId));
    }

    const [updatedVolquetero] = await db
      .update(volqueteros)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updatedVolquetero;
  }

  async deleteVolquetero(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(volqueteros.id, id)];
    if (userId) {
      conditions.push(eq(volqueteros.userId, userId));
    }

    const result = await db.delete(volqueteros).where(and(...conditions));
    return result.rowCount > 0;
  }

  async updateVolqueteroNombre(id: number, nombre: string, userId?: string): Promise<Volquetero | undefined> {
    // Para compatibilidad con usuarios principales que manejan datos existentes,
    // no aplicamos restricción de userId en esta operación específica
    try {
      console.log(`🔧 DEBUG: Intentando actualizar volquetero ID ${id} con nombre "${nombre}"`);
      
      // 1. Obtener el nombre actual del volquetero
      const [currentVolquetero] = await db.select().from(volqueteros).where(eq(volqueteros.id, id));
      if (!currentVolquetero) {
        console.log(`❌ Volquetero ID ${id} no encontrado`);
        return undefined;
      }
      
      const nombreAnterior = currentVolquetero.nombre;
      console.log(`🔄 SINCRONIZACIÓN: "${nombreAnterior}" → "${nombre}"`);
      
      // 2. Actualizar el volquetero
      const [updatedVolquetero] = await db
        .update(volqueteros)
        .set({ nombre })
        .where(eq(volqueteros.id, id))
        .returning();
      
      console.log(`✅ VOLQUETERO NOMBRE ACTUALIZADO: ID ${id} → "${nombre}" ${updatedVolquetero ? '✓' : '✗'}`);
      
      // 3. SINCRONIZAR VIAJES: Buscar conductores que puedan estar relacionados con este volquetero
      if (updatedVolquetero && nombreAnterior !== nombre) {
        console.log(`🔄 SINCRONIZANDO VIAJES: Actualizando conductor "${nombreAnterior}" → "${nombre}"`);
        
        // Buscar variaciones del nombre que puedan existir en viajes
        const viajesCandidatos = await db
          .select({ conductor: viajes.conductor })
          .from(viajes)
          .groupBy(viajes.conductor);
        
        // Encontrar conductores que puedan corresponder a este volquetero
        const conductoresParaSincronizar = viajesCandidatos
          .map(v => v.conductor)
          .filter(conductor => {
            // Buscar coincidencias flexibles
            const base1 = nombreAnterior.toLowerCase().replace(/[^a-z]/g, '');
            const base2 = conductor.toLowerCase().replace(/[^a-z]/g, '');
            const baseNuevo = nombre.toLowerCase().replace(/[^a-z]/g, '');
            
            // Si el conductor coincide parcialmente con el nombre anterior o nuevo
            return base2.includes(base1.substring(0, Math.min(8, base1.length))) || 
                   base1.includes(base2.substring(0, Math.min(8, base2.length))) ||
                   base2.includes(baseNuevo.substring(0, Math.min(8, baseNuevo.length)));
          });
        
        console.log(`🔍 CONDUCTORES ENCONTRADOS PARA SINCRONIZAR:`, conductoresParaSincronizar);
        
        let totalViajesActualizados = 0;
        for (const conductor of conductoresParaSincronizar) {
          const viajesResult = await db
            .update(viajes)
            .set({ conductor: nombre })
            .where(eq(viajes.conductor, conductor))
            .returning({ id: viajes.id });
          
          totalViajesActualizados += viajesResult.length;
          if (viajesResult.length > 0) {
            console.log(`✅ VIAJES SINCRONIZADOS: "${conductor}" → "${nombre}" (${viajesResult.length} viajes)`);
          }
        }
        
        console.log(`✅ TOTAL VIAJES SINCRONIZADOS: ${totalViajesActualizados} viajes actualizados`);
        
        // 4. SINCRONIZAR TRANSACCIONES: Actualizar conceptos que contengan cualquiera de los nombres
        let totalTransaccionesActualizadas = 0;
        for (const conductor of [nombreAnterior, ...conductoresParaSincronizar]) {
          const transaccionesResult = await db
            .update(transacciones)
            .set({ concepto: sql`REPLACE(concepto, ${conductor}, ${nombre})` })
            .where(sql`concepto LIKE '%' || ${conductor} || '%'`)
            .returning({ id: transacciones.id });
          
          totalTransaccionesActualizadas += transaccionesResult.length;
          if (transaccionesResult.length > 0) {
            console.log(`✅ TRANSACCIONES SINCRONIZADAS: "${conductor}" → "${nombre}" (${transaccionesResult.length} transacciones)`);
          }
        }
        
        console.log(`✅ TOTAL TRANSACCIONES SINCRONIZADAS: ${totalTransaccionesActualizadas} transacciones actualizadas`);
      }
      
      return updatedVolquetero;
    } catch (error) {
      console.error(`❌ ERROR al actualizar volquetero ID ${id}:`, error);
      throw error;
    }
  }

  // Viajes operations
  async getViajes(userId?: string): Promise<ViajeWithDetails[]> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log('🔵 [PERF] getViajes() - INICIANDO');
      
      // OPTIMIZACIÓN: Solo seleccionar campos necesarios de minas y compradores para reducir payload
      // Esto reduce significativamente el tamaño de la respuesta (de ~14MB a ~2-3MB)
      const query = db
        .select({
          viaje: viajes,
          mina: {
            id: minas.id,
            nombre: minas.nombre,
            // Excluir otros campos innecesarios para reducir tamaño
          },
          comprador: {
            id: compradores.id,
            nombre: compradores.nombre,
            // Excluir otros campos innecesarios para reducir tamaño
          },
        })
        .from(viajes)
        .leftJoin(minas, eq(viajes.minaId, minas.id))
        .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
        .orderBy(desc(viajes.createdAt));

      const queryStart = Date.now();
      const results = userId 
        ? await query.where(eq(viajes.userId, userId))
        : await query;
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [PERF] Query de viajes: ${queryTime}ms (${results.length} registros)`);

      const mapStart = Date.now();
      const mapped = results.map(result => ({
        ...result.viaje,
        mina: result.mina ? { id: result.mina.id, nombre: result.mina.nombre } : undefined,
        comprador: result.comprador ? { id: result.comprador.id, nombre: result.comprador.nombre } : undefined,
      }));
      const mapTime = Date.now() - mapStart;
      const totalTime = Date.now() - startTime;
      console.log(`⏱️  [PERF] Mapeo de viajes: ${mapTime}ms`);
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getViajes: ${totalTime}ms (Query: ${queryTime}ms, Map: ${mapTime}ms)`);
      
      return mapped;
    });
  }

  // Método paginado para viajes (optimización de rendimiento)
  async getViajesPaginated(
    userId?: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    data: ViajeWithDetails[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log(`🔵 [PERF] getViajesPaginated() - INICIANDO (page: ${page}, limit: ${limit})`);
      
      // Validar parámetros
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.max(1, Math.min(1000, Math.floor(limit))); // Máximo 1000 por página
      const offset = (validPage - 1) * validLimit;

      // Query base con condiciones
      const baseQuery = db
        .select({
          viaje: viajes,
          mina: {
            id: minas.id,
            nombre: minas.nombre,
          },
          comprador: {
            id: compradores.id,
            nombre: compradores.nombre,
          },
        })
        .from(viajes)
        .leftJoin(minas, eq(viajes.minaId, minas.id))
        .leftJoin(compradores, eq(viajes.compradorId, compradores.id));

      // Aplicar filtro de userId si existe
      const conditions = userId ? [eq(viajes.userId, userId)] : [];

      // Contar total de viajes (para paginación)
      const countStart = Date.now();
      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(viajes);
      
      const countResult = userId
        ? await countQuery.where(eq(viajes.userId, userId))
        : await countQuery;
      
      const total = countResult[0]?.count || 0;
      const countTime = Date.now() - countStart;
      console.log(`⏱️  [PERF] Count de viajes: ${countTime}ms (total: ${total})`);

      // Query paginada
      const queryStart = Date.now();
      let query = baseQuery.orderBy(desc(viajes.createdAt));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const results = await query.limit(validLimit).offset(offset);
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [PERF] Query paginada de viajes: ${queryTime}ms (${results.length} registros)`);

      // Mapear resultados
      const mapStart = Date.now();
      const mapped = results.map(result => ({
        ...result.viaje,
        mina: result.mina ? { id: result.mina.id, nombre: result.mina.nombre } : undefined,
        comprador: result.comprador ? { id: result.comprador.id, nombre: result.comprador.nombre } : undefined,
      }));
      const mapTime = Date.now() - mapStart;

      const totalPages = Math.ceil(total / validLimit);
      const totalTime = Date.now() - startTime;
      
      console.log(`⏱️  [PERF] Mapeo de viajes: ${mapTime}ms`);
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getViajesPaginated: ${totalTime}ms (Count: ${countTime}ms, Query: ${queryTime}ms, Map: ${mapTime}ms)`);

      return {
        data: mapped,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages,
          hasMore: validPage < totalPages,
        },
      };
    });
  }

  async getViajesPendientes(userId?: string): Promise<ViajeWithDetails[]> {
    const conditions = [eq(viajes.estado, "pendiente")];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const results = await db
      .select({
        viaje: viajes,
        mina: minas,
        comprador: compradores,
      })
      .from(viajes)
      .leftJoin(minas, eq(viajes.minaId, minas.id))
      .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
      .where(and(...conditions))
      .orderBy(desc(viajes.createdAt));

    return results.map(result => ({
      ...result.viaje,
      mina: result.mina || undefined,
      comprador: result.comprador || undefined,
    }));
  }

  async getViajeById(id: string, userId?: string): Promise<ViajeWithDetails | undefined> {
    const conditions = [eq(viajes.id, id)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const [result] = await db
      .select({
        viaje: viajes,
        mina: minas,
        comprador: compradores,
      })
      .from(viajes)
      .leftJoin(minas, eq(viajes.minaId, minas.id))
      .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
      .where(and(...conditions));

    if (!result) return undefined;

    return {
      ...result.viaje,
      mina: result.mina || undefined,
      comprador: result.comprador || undefined,
    };
  }

  async createViaje(viaje: InsertViaje & { userId?: string }): Promise<Viaje> {
    const [newViaje] = await db.insert(viajes).values({
      ...viaje,
      userId: viaje.userId || 'main_user',
    } as any).returning();
    
    // Actualizar balances calculados después de crear el viaje
    await this.updateViajeRelatedBalances(newViaje);
    
    return newViaje;
  }

  async createViajeWithCustomId(viaje: InsertViaje & { userId?: string }, customId: string): Promise<Viaje> {
    const [newViaje] = await db.insert(viajes).values({
      ...viaje,
      id: customId,
      userId: viaje.userId || 'main_user',
    } as any).returning();
    
    // Actualizar balances calculados después de crear el viaje
    await this.updateViajeRelatedBalances(newViaje);
    
    return newViaje;
  }

  async updateViaje(id: string, updates: UpdateViaje, userId?: string): Promise<Viaje | undefined> {
    const conditions = [eq(viajes.id, id)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    // Convert string dates to Date objects for Drizzle ORM
    const processedUpdates: any = { ...updates };
    
    if (updates.fechaCargue) {
      processedUpdates.fechaCargue = new Date(updates.fechaCargue);
    }
    if (updates.fechaDescargue) {
      processedUpdates.fechaDescargue = new Date(updates.fechaDescargue);
    }
    
    // Convert compradorId from string to number if needed
    if (updates.compradorId) {
      processedUpdates.compradorId = typeof updates.compradorId === 'string' ? parseInt(updates.compradorId) : updates.compradorId;
    }

    const [updatedViaje] = await db
      .update(viajes)
      .set(processedUpdates)
      .where(and(...conditions))
      .returning();

    // Actualizar balances calculados después de actualizar el viaje
    if (updatedViaje) {
      await this.updateViajeRelatedBalances(updatedViaje);
    }

    return updatedViaje;
  }

  async deleteViaje(id: string, userId?: string): Promise<boolean> {
    const conditions = [eq(viajes.id, id)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    // Obtener el viaje antes de eliminarlo para recalcular balances
    const [viajeToDelete] = await db.select().from(viajes).where(and(...conditions));
    
    const result = await db.delete(viajes).where(and(...conditions));
    
    // Si se eliminó exitosamente, recalcular balances
    if (result.rowCount > 0 && viajeToDelete) {
      await this.updateViajeRelatedBalances(viajeToDelete);
    }
    
    return result.rowCount > 0;
  }

  // Transacciones operations
  async getTransacciones(userId?: string): Promise<TransaccionWithSocio[]> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log('');
      console.log('🔵 ===========================================================');
      console.log('🔵 [PERF] getTransacciones() - INICIANDO');
      console.log('🔵 ===========================================================');
      
      const conditions = [eq(transacciones.oculta, false)]; // Solo transacciones no ocultas
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

      const queryStart = Date.now();
      
      const results = await db
        .select({
          id: transacciones.id,
          deQuienTipo: transacciones.deQuienTipo,
          deQuienId: transacciones.deQuienId,
          paraQuienTipo: transacciones.paraQuienTipo,
          paraQuienId: transacciones.paraQuienId,
          postobonCuenta: transacciones.postobonCuenta,
          concepto: transacciones.concepto,
          valor: transacciones.valor,
          fecha: transacciones.fecha,
          horaInterna: transacciones.horaInterna,
          formaPago: transacciones.formaPago,
          // voucher: transacciones.voucher, // EXCLUIDO para optimización
          comentario: transacciones.comentario,
          tipoTransaccion: transacciones.tipoTransaccion,
          oculta: transacciones.oculta,
          ocultaEnComprador: transacciones.ocultaEnComprador,
          ocultaEnMina: transacciones.ocultaEnMina,
          ocultaEnVolquetero: transacciones.ocultaEnVolquetero,
          ocultaEnGeneral: transacciones.ocultaEnGeneral,
          userId: transacciones.userId,
          // Campos adicionales para compatibilidad
          tipoSocio: transacciones.deQuienTipo, // Alias para compatibilidad
          socioId: transacciones.deQuienId, // Alias para compatibilidad
          createdAt: transacciones.horaInterna, // Alias para compatibilidad
          hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END` // Indicador de voucher
        })
        .from(transacciones)
        .where(and(...conditions))
        .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna));

      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [PERF] Query de transacciones: ${queryTime}ms (${results.length} registros)`);

      // OPTIMIZACIÓN: Batch loading de nombres - cargar todos los nombres en 3 queries en lugar de N queries
      const batchStart = Date.now();
      console.log('🚀 Optimización: Cargando nombres en batch...');
      const [allMinas, allCompradores, allVolqueteros] = await Promise.all([
        db.select({ id: minas.id, nombre: minas.nombre }).from(minas),
        db.select({ id: compradores.id, nombre: compradores.nombre }).from(compradores),
        db.select({ id: volqueteros.id, nombre: volqueteros.nombre }).from(volqueteros),
      ]);

      const batchTime = Date.now() - batchStart;
      console.log(`⏱️  [PERF] Batch loading de nombres: ${batchTime}ms`);

      // Crear Maps para lookup O(1)
      const mapStart = Date.now();
      const minasMap = new Map<number, string>();
      const compradoresMap = new Map<number, string>();
      const volqueterosMap = new Map<number, string>();

      allMinas.forEach(m => minasMap.set(m.id, m.nombre));
      allCompradores.forEach(c => compradoresMap.set(c.id, c.nombre));
      allVolqueteros.forEach(v => volqueterosMap.set(v.id, v.nombre));

      const mapTime = Date.now() - mapStart;
      console.log(`✅ Nombres cargados: ${minasMap.size} minas, ${compradoresMap.size} compradores, ${volqueterosMap.size} volqueteros`);
      console.log(`⏱️  [PERF] Creación de Maps: ${mapTime}ms`);

      // Resolver nombres de socios y actualizar conceptos dinámicamente (usando Maps en lugar de queries)
      const processStart = Date.now();
      const resultsWithUpdatedData = results.map((t) => {
        let socioNombre = 'Desconocido';
        let conceptoActualizado = t.concepto;
        
        // Determinar el socio principal según el nuevo sistema
        if (t.paraQuienTipo && t.paraQuienId && ['mina', 'comprador', 'volquetero'].includes(t.paraQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.paraQuienTipo, parseInt(t.paraQuienId), minasMap, compradoresMap, volqueterosMap);
        } else if (t.deQuienTipo && t.deQuienId && ['mina', 'comprador', 'volquetero'].includes(t.deQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.deQuienTipo, parseInt(t.deQuienId), minasMap, compradoresMap, volqueterosMap);
        }

        // Actualizar concepto dinámicamente con nombres actuales (usando Maps)
        conceptoActualizado = this.updateConceptoWithCurrentNamesSync(t, minasMap, compradoresMap, volqueterosMap);
        
        return {
          ...t,
          socioNombre,
          concepto: conceptoActualizado,
          voucher: null, // Excluir voucher para optimización
        };
      });

      const processTime = Date.now() - processStart;
      const totalTime = Date.now() - startTime;
      console.log(`⏱️  [PERF] Procesamiento de ${results.length} transacciones: ${processTime}ms`);
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getTransacciones: ${totalTime}ms (Query: ${queryTime}ms, Batch: ${batchTime}ms, Maps: ${mapTime}ms, Process: ${processTime}ms)`);

      return resultsWithUpdatedData;
    });
  }

  // Método paginado para transacciones (optimización de rendimiento)
  async getTransaccionesPaginated(
    userId?: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    data: TransaccionWithSocio[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log(`🔵 [PERF] getTransaccionesPaginated() - INICIANDO (page: ${page}, limit: ${limit})`);
      
      // Validar parámetros
      const validPage = Math.max(1, Math.floor(page));
      const validLimit = Math.max(1, Math.min(1000, Math.floor(limit))); // Máximo 1000 por página
      const offset = (validPage - 1) * validLimit;

      // Preparar condiciones base
      const conditions = [eq(transacciones.oculta, false)]; // Solo transacciones no ocultas
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

      // Contar total de transacciones (para paginación)
      const countStart = Date.now();
      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(transacciones)
        .where(and(...conditions));
      
      const countResult = await countQuery;
      const total = countResult[0]?.count || 0;
      const countTime = Date.now() - countStart;
      console.log(`⏱️  [PERF] Count de transacciones: ${countTime}ms (total: ${total})`);

      // Query paginada
      const queryStart = Date.now();
      const results = await db
        .select({
          id: transacciones.id,
          deQuienTipo: transacciones.deQuienTipo,
          deQuienId: transacciones.deQuienId,
          paraQuienTipo: transacciones.paraQuienTipo,
          paraQuienId: transacciones.paraQuienId,
          postobonCuenta: transacciones.postobonCuenta,
          concepto: transacciones.concepto,
          valor: transacciones.valor,
          fecha: transacciones.fecha,
          horaInterna: transacciones.horaInterna,
          formaPago: transacciones.formaPago,
          comentario: transacciones.comentario,
          tipoTransaccion: transacciones.tipoTransaccion,
          oculta: transacciones.oculta,
          ocultaEnComprador: transacciones.ocultaEnComprador,
          ocultaEnMina: transacciones.ocultaEnMina,
          ocultaEnVolquetero: transacciones.ocultaEnVolquetero,
          ocultaEnGeneral: transacciones.ocultaEnGeneral,
          userId: transacciones.userId,
          // Campos adicionales para compatibilidad
          tipoSocio: transacciones.deQuienTipo, // Alias para compatibilidad
          socioId: transacciones.deQuienId, // Alias para compatibilidad
          createdAt: transacciones.horaInterna, // Alias para compatibilidad
          hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END` // Indicador de voucher
        })
        .from(transacciones)
        .where(and(...conditions))
        .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna))
        .limit(validLimit)
        .offset(offset);

      const queryTime = Date.now() - queryStart;
      console.log(`⏱️  [PERF] Query paginada de transacciones: ${queryTime}ms (${results.length} registros)`);

      // OPTIMIZACIÓN: Batch loading de nombres - cargar todos los nombres en 3 queries
      const batchStart = Date.now();
      const [allMinas, allCompradores, allVolqueteros] = await Promise.all([
        db.select({ id: minas.id, nombre: minas.nombre }).from(minas),
        db.select({ id: compradores.id, nombre: compradores.nombre }).from(compradores),
        db.select({ id: volqueteros.id, nombre: volqueteros.nombre }).from(volqueteros),
      ]);

      const batchTime = Date.now() - batchStart;
      console.log(`⏱️  [PERF] Batch loading de nombres: ${batchTime}ms`);

      // Crear Maps para lookup O(1)
      const mapStart = Date.now();
      const minasMap = new Map<number, string>();
      const compradoresMap = new Map<number, string>();
      const volqueterosMap = new Map<number, string>();

      allMinas.forEach(m => minasMap.set(m.id, m.nombre));
      allCompradores.forEach(c => compradoresMap.set(c.id, c.nombre));
      allVolqueteros.forEach(v => volqueterosMap.set(v.id, v.nombre));

      const mapTime = Date.now() - mapStart;
      console.log(`✅ Nombres cargados: ${minasMap.size} minas, ${compradoresMap.size} compradores, ${volqueterosMap.size} volqueteros`);
      console.log(`⏱️  [PERF] Creación de Maps: ${mapTime}ms`);

      // Resolver nombres de socios y actualizar conceptos dinámicamente
      const processStart = Date.now();
      const resultsWithUpdatedData = results.map((t) => {
        let socioNombre = 'Desconocido';
        let conceptoActualizado = t.concepto;
        
        // Determinar el socio principal según el nuevo sistema
        if (t.paraQuienTipo && t.paraQuienId && ['mina', 'comprador', 'volquetero'].includes(t.paraQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.paraQuienTipo, parseInt(t.paraQuienId), minasMap, compradoresMap, volqueterosMap);
        } else if (t.deQuienTipo && t.deQuienId && ['mina', 'comprador', 'volquetero'].includes(t.deQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.deQuienTipo, parseInt(t.deQuienId), minasMap, compradoresMap, volqueterosMap);
        }

        // Actualizar concepto dinámicamente con nombres actuales
        conceptoActualizado = this.updateConceptoWithCurrentNamesSync(t, minasMap, compradoresMap, volqueterosMap);
        
        return {
          ...t,
          socioNombre,
          concepto: conceptoActualizado,
          voucher: null, // Excluir voucher para optimización
        };
      });

      const processTime = Date.now() - processStart;
      const totalPages = Math.ceil(total / validLimit);
      const totalTime = Date.now() - startTime;
      
      console.log(`⏱️  [PERF] Procesamiento de ${results.length} transacciones: ${processTime}ms`);
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getTransaccionesPaginated: ${totalTime}ms (Count: ${countTime}ms, Query: ${queryTime}ms, Batch: ${batchTime}ms, Maps: ${mapTime}ms, Process: ${processTime}ms)`);

      return {
        data: resultsWithUpdatedData,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages,
          hasMore: validPage < totalPages,
        },
      };
    });
  }

  // Función específica para cargar voucher individual (carga lazy)
  async getTransaccionVoucher(id: number, userId?: string): Promise<string | null> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    const [result] = await db
      .select({ voucher: transacciones.voucher })
      .from(transacciones)
      .where(and(...conditions));

    return result?.voucher || null;
  }

  async getTransaccionById(id: number, userId?: string): Promise<Transaccion | undefined> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    const [transaccion] = await db.select().from(transacciones).where(and(...conditions));
    return transaccion;
  }

  async createTransaccion(transaccion: InsertTransaccion & { userId?: string }): Promise<Transaccion> {
    const [newTransaccion] = await db.insert(transacciones).values({
      ...transaccion,
      userId: transaccion.userId || 'main_user',
    } as any).returning();

    // Actualizar balances calculados después de crear la transacción
    await this.updateRelatedBalances(newTransaccion);

    return newTransaccion;
  }

  async updateTransaccion(id: number, updates: Partial<InsertTransaccion>, userId?: string): Promise<Transaccion | undefined> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    const [updatedTransaccion] = await db
      .update(transacciones)
      .set(updates as any)
      .where(and(...conditions))
      .returning();

    // Actualizar balances calculados después de actualizar la transacción
    if (updatedTransaccion) {
      await this.updateRelatedBalances(updatedTransaccion);
    }

    return updatedTransaccion;
  }

  async deleteTransaccion(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    // Obtener la transacción antes de eliminarla para recalcular balances
    const [transaccionToDelete] = await db.select().from(transacciones).where(and(...conditions));
    
    const result = await db.delete(transacciones).where(and(...conditions));
    
    // Si se eliminó exitosamente, recalcular balances
    if (result.rowCount > 0 && transaccionToDelete) {
      await this.updateRelatedBalances(transaccionToDelete);
    }
    
    return result.rowCount > 0;
  }

  async hideTransaccion(id: number, userId?: string): Promise<boolean> {
    // Solo buscar por ID, no filtrar por userId
    // Muchas transacciones pueden tener userId NULL o diferente
    const conditions = [eq(transacciones.id, id)];

    // Usar .returning() para obtener el resultado actualizado
    // Si devuelve un array con elementos, la actualización fue exitosa
    const result = await db
      .update(transacciones)
      .set({ oculta: true })
      .where(and(...conditions))
      .returning();
    
    console.log(`🔍 [hideTransaccion] ID: ${id}, result length: ${result.length}`);
    console.log(`🔍 [hideTransaccion] Result:`, JSON.stringify(result, null, 2));
    
    // Si el array tiene elementos, la actualización fue exitosa
    return result.length > 0;
  }

  // Nuevas funciones específicas por módulo
  async hideTransaccionEnComprador(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    // No filtrar por userId - las transacciones pueden tener userId NULL o diferente

    const result = await db
      .update(transacciones)
      .set({ ocultaEnComprador: true })
      .where(and(...conditions))
      .returning();
    return result.length > 0;
  }

  async hideTransaccionEnMina(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    // No filtrar por userId - las transacciones pueden tener userId NULL o diferente

    const result = await db
      .update(transacciones)
      .set({ ocultaEnMina: true })
      .where(and(...conditions))
      .returning();
    return result.length > 0;
  }

  async hideTransaccionEnVolquetero(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    // No filtrar por userId - las transacciones pueden tener userId NULL o diferente

    const result = await db
      .update(transacciones)
      .set({ ocultaEnVolquetero: true })
      .where(and(...conditions))
      .returning();
    return result.length > 0;
  }

  async hideTransaccionEnGeneral(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    // No filtrar por userId - las transacciones pueden tener userId NULL o diferente

    const result = await db
      .update(transacciones)
      .set({ ocultaEnGeneral: true })
      .where(and(...conditions))
      .returning();
    return result.length > 0;
  }

  async showTransaccion(id: number, userId?: string): Promise<boolean> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    const result = await db
      .update(transacciones)
      .set({ oculta: false })
      .where(and(...conditions));
    return result.rowCount > 0;
  }

  // Métodos específicos para la aplicación
  async getViajesByMina(minaId: number, userId?: string): Promise<ViajeWithDetails[]> {
    const conditions = [eq(viajes.minaId, minaId)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const results = await db
      .select({
        viaje: viajes,
        mina: minas,
        comprador: compradores,
      })
      .from(viajes)
      .leftJoin(minas, eq(viajes.minaId, minas.id))
      .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
      .where(and(...conditions))
      .orderBy(desc(viajes.createdAt));

    return results.map(result => ({
      ...result.viaje,
      mina: result.mina || undefined,
      comprador: result.comprador || undefined,
    }));
  }

  async getViajesByComprador(compradorId: number, userId?: string): Promise<ViajeWithDetails[]> {
    const conditions = [eq(viajes.compradorId, compradorId)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const results = await db
      .select({
        viaje: viajes,
        mina: minas,
        comprador: compradores,
      })
      .from(viajes)
      .leftJoin(minas, eq(viajes.minaId, minas.id))
      .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
      .where(and(...conditions))
      .orderBy(desc(viajes.fechaDescargue), desc(viajes.fechaCargue), desc(viajes.createdAt));

    return results.map(result => ({
      ...result.viaje,
      mina: result.mina || undefined,
      comprador: result.comprador || undefined,
    }));
  }

  async getViajesByVolquetero(conductor: string, userId?: string): Promise<ViajeWithDetails[]> {
    const conditions = [eq(viajes.conductor, conductor)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const results = await db
      .select({
        viaje: viajes,
        mina: minas,
        comprador: compradores,
      })
      .from(viajes)
      .leftJoin(minas, eq(viajes.minaId, minas.id))
      .leftJoin(compradores, eq(viajes.compradorId, compradores.id))
      .where(and(...conditions))
      .orderBy(desc(viajes.createdAt));

    return results.map(result => ({
      ...result.viaje,
      mina: result.mina || undefined,
      comprador: result.comprador || undefined,
    }));
  }

  async getVolqueterosWithPlacas(userId?: string): Promise<VolqueteroConPlacas[]> {
    // Obtener viajes agrupados por conductor
    const viajesQuery = db
      .select({
        conductor: viajes.conductor,
        placa: viajes.placa,
        tipoCarro: viajes.tipoCarro,
        count: sql<number>`count(*)::int`,
      })
      .from(viajes)
      .groupBy(viajes.conductor, viajes.placa, viajes.tipoCarro);

    const viajesResults = userId 
      ? await viajesQuery.where(eq(viajes.userId, userId))
      : await viajesQuery;

    // Agrupar por conductor
    const volqueterosMap = new Map<string, VolqueteroConPlacas>();

    for (const viaje of viajesResults) {
      if (!volqueterosMap.has(viaje.conductor)) {
        volqueterosMap.set(viaje.conductor, {
          id: 0, // Se asignará después
          nombre: viaje.conductor,
          placas: [],
          viajesCount: 0,
          saldo: "0.00",
        });
      }

      const volquetero = volqueterosMap.get(viaje.conductor)!;
      volquetero.placas.push({
        placa: viaje.placa,
        tipoCarro: viaje.tipoCarro,
        viajesCount: viaje.count,
      });
      volquetero.viajesCount += viaje.count;
    }

    return Array.from(volqueterosMap.values());
  }

  async getTransaccionesBySocio(tipoSocio: string, socioId: number, userId?: string, includeHidden: boolean = false): Promise<TransaccionWithSocio[]> {
    return this.getTransaccionesForModule(tipoSocio, socioId, userId, includeHidden, 'general');
  }

  // Nueva función que maneja el filtrado por módulo específico
  async getTransaccionesForModule(tipoSocio: string, socioId: number, userId?: string, includeHidden: boolean = false, modulo: 'general' | 'comprador' | 'mina' | 'volquetero' = 'general'): Promise<TransaccionWithSocio[]> {
    // Buscar transacciones que VIENEN DESDE el socio O que VAN HACIA el socio
    const conditionsFrom = [
      eq(transacciones.deQuienTipo, tipoSocio), 
      eq(transacciones.deQuienId, socioId.toString())
    ];
    const conditionsTo = [
      eq(transacciones.paraQuienTipo, tipoSocio), 
      eq(transacciones.paraQuienId, socioId.toString())
    ];
    
    // Solo agregar filtro de ocultas específico del módulo si no se incluyen las ocultas
    if (!includeHidden) {
      switch (modulo) {
        case 'comprador':
          conditionsFrom.push(eq(transacciones.ocultaEnComprador, false));
          conditionsTo.push(eq(transacciones.ocultaEnComprador, false));
          break;
        case 'mina':
          conditionsFrom.push(eq(transacciones.ocultaEnMina, false));
          conditionsTo.push(eq(transacciones.ocultaEnMina, false));
          break;
        case 'volquetero':
          conditionsFrom.push(eq(transacciones.ocultaEnVolquetero, false));
          conditionsTo.push(eq(transacciones.ocultaEnVolquetero, false));
          break;
        case 'general':
        default:
          conditionsFrom.push(eq(transacciones.ocultaEnGeneral, false));
          conditionsTo.push(eq(transacciones.ocultaEnGeneral, false));
          break;
      }
    }
    
    if (userId) {
      conditionsFrom.push(eq(transacciones.userId, userId));
      conditionsTo.push(eq(transacciones.userId, userId));
    }

    // Obtener transacciones que vienen DESDE el socio (sin vouchers para optimización)
    const resultsFrom = await db
      .select({
        id: transacciones.id,
        deQuienTipo: transacciones.deQuienTipo,
        deQuienId: transacciones.deQuienId,
        paraQuienTipo: transacciones.paraQuienTipo,
        paraQuienId: transacciones.paraQuienId,
        postobonCuenta: transacciones.postobonCuenta,
        concepto: transacciones.concepto,
        valor: transacciones.valor,
        fecha: transacciones.fecha,
        horaInterna: transacciones.horaInterna,
        formaPago: transacciones.formaPago,
        // voucher: transacciones.voucher, // EXCLUIDO para optimización
        comentario: transacciones.comentario,
        tipoTransaccion: transacciones.tipoTransaccion,
        oculta: transacciones.oculta,
        ocultaEnComprador: transacciones.ocultaEnComprador,
        ocultaEnMina: transacciones.ocultaEnMina,
        ocultaEnVolquetero: transacciones.ocultaEnVolquetero,
        ocultaEnGeneral: transacciones.ocultaEnGeneral,
        userId: transacciones.userId,
        // Campos adicionales para compatibilidad
        tipoSocio: transacciones.deQuienTipo,
        createdAt: transacciones.horaInterna,
        hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END`
      })
      .from(transacciones)
      .where(and(...conditionsFrom))
      .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna));

    // Obtener transacciones que van HACIA el socio (sin vouchers para optimización)
    const resultsTo = await db
      .select({
        id: transacciones.id,
        deQuienTipo: transacciones.deQuienTipo,
        deQuienId: transacciones.deQuienId,
        paraQuienTipo: transacciones.paraQuienTipo,
        paraQuienId: transacciones.paraQuienId,
        postobonCuenta: transacciones.postobonCuenta,
        concepto: transacciones.concepto,
        valor: transacciones.valor,
        fecha: transacciones.fecha,
        horaInterna: transacciones.horaInterna,
        formaPago: transacciones.formaPago,
        // voucher: transacciones.voucher, // EXCLUIDO para optimización
        comentario: transacciones.comentario,
        tipoTransaccion: transacciones.tipoTransaccion,
        oculta: transacciones.oculta,
        ocultaEnComprador: transacciones.ocultaEnComprador,
        ocultaEnMina: transacciones.ocultaEnMina,
        ocultaEnVolquetero: transacciones.ocultaEnVolquetero,
        ocultaEnGeneral: transacciones.ocultaEnGeneral,
        userId: transacciones.userId,
        // Campos adicionales para compatibilidad
        tipoSocio: transacciones.paraQuienTipo,
        createdAt: transacciones.horaInterna,
        hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END`
      })
      .from(transacciones)
      .where(and(...conditionsTo))
      .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna));

    // Combinar resultados y eliminar duplicados
    const allResults = [...resultsFrom, ...resultsTo];
    const uniqueResults = allResults.filter((transaction, index, self) => 
      index === self.findIndex(t => t.id === transaction.id)
    );

    // Ordenar por fecha de transacción (fecha editada por usuario)
    uniqueResults.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

    // OPTIMIZACIÓN: Batch loading de nombres - cargar todos los nombres en 3 queries en lugar de N queries
    const [allMinas, allCompradores, allVolqueteros] = await Promise.all([
      db.select({ id: minas.id, nombre: minas.nombre }).from(minas),
      db.select({ id: compradores.id, nombre: compradores.nombre }).from(compradores),
      db.select({ id: volqueteros.id, nombre: volqueteros.nombre }).from(volqueteros),
    ]);

    // Crear Maps para lookup O(1)
    const minasMap = new Map<number, string>();
    const compradoresMap = new Map<number, string>();
    const volqueterosMap = new Map<number, string>();

    allMinas.forEach(m => minasMap.set(m.id, m.nombre));
    allCompradores.forEach(c => compradoresMap.set(c.id, c.nombre));
    allVolqueteros.forEach(v => volqueterosMap.set(v.id, v.nombre));

    // Obtener el nombre del socio una vez (usando Map)
    const socioNombre = this.getSocioNombreFromMap(tipoSocio, socioId, minasMap, compradoresMap, volqueterosMap);
    
    // Aplicar actualización de conceptos y nombres de socios a cada transacción (usando Maps)
    const updatedResults = uniqueResults.map((t) => {
      // Actualizar concepto dinámicamente con nombres actuales (versión síncrona)
      const conceptoActualizado = this.updateConceptoWithCurrentNamesSync(t, minasMap, compradoresMap, volqueterosMap);
      
      return {
        ...t,
        socioId: socioId,
        socioNombre: socioNombre,
        concepto: conceptoActualizado,
        voucher: null, // Excluir voucher para optimización
      };
    });

    return updatedResults;
  }

  // Método auxiliar para obtener el nombre del socio (versión async - mantiene compatibilidad)
  private async getSocioNombre(tipoSocio: string, socioId: number): Promise<string> {
    try {
      switch (tipoSocio) {
        case 'mina':
          const [mina] = await db.select().from(minas).where(eq(minas.id, socioId));
          return mina?.nombre || `Mina ${socioId}`;
        case 'comprador':
          const [comprador] = await db.select().from(compradores).where(eq(compradores.id, socioId));
          return comprador?.nombre || `Comprador ${socioId}`;
        case 'volquetero':
          const [volquetero] = await db.select().from(volqueteros).where(eq(volqueteros.id, socioId));
          return volquetero?.nombre || `Volquetero ${socioId}`;
        default:
          return `Socio ${socioId}`;
      }
    } catch (error) {
      return `${tipoSocio} ${socioId}`;
    }
  }

  // Método optimizado para obtener nombre desde Maps (síncrono, O(1))
  private getSocioNombreFromMap(
    tipoSocio: string, 
    socioId: number, 
    minasMap: Map<number, string>,
    compradoresMap: Map<number, string>,
    volqueterosMap: Map<number, string>
  ): string {
    try {
      switch (tipoSocio) {
        case 'mina':
          return minasMap.get(socioId) || `Mina ${socioId}`;
        case 'comprador':
          return compradoresMap.get(socioId) || `Comprador ${socioId}`;
        case 'volquetero':
          return volqueterosMap.get(socioId) || `Volquetero ${socioId}`;
        default:
          return `Socio ${socioId}`;
      }
    } catch (error) {
      return `${tipoSocio} ${socioId}`;
    }
  }

  // Función para actualizar conceptos con nombres actuales (versión async - mantiene compatibilidad)
  private async updateConceptoWithCurrentNames(transaccion: any): Promise<string> {
    let conceptoActualizado = transaccion.concepto;

    // Optimización: Solo procesar si el concepto contiene patrones típicos de nombres embebidos
    if (!conceptoActualizado.includes('(') || !conceptoActualizado.includes(')')) {
      return conceptoActualizado;
    }

    try {
      // Actualizar nombre en deQuien (origen) - para casos como "Transferencia de Comprador (Jamer)"
      if (transaccion.deQuienTipo && transaccion.deQuienId && ['mina', 'comprador', 'volquetero'].includes(transaccion.deQuienTipo)) {
        const nombreActual = await this.getSocioNombre(transaccion.deQuienTipo, parseInt(transaccion.deQuienId));
        
        // Patrones para encontrar y reemplazar nombres de origen
        const patronesOrigen = {
          'mina': /(?:de|desde)\s+Mina\s*\(([^)]+)\)/i,
          'comprador': /(?:de|desde)\s+Comprador\s*\(([^)]+)\)/i,
          'volquetero': /(?:de|desde)\s+Volquetero\s*\(([^)]+)\)/i
        };
        
        if (patronesOrigen[transaccion.deQuienTipo as keyof typeof patronesOrigen]) {
          const patron = patronesOrigen[transaccion.deQuienTipo as keyof typeof patronesOrigen];
          const match = conceptoActualizado.match(patron);
          if (match && match[1] !== nombreActual) {
            conceptoActualizado = conceptoActualizado.replace(patron, `de ${transaccion.deQuienTipo === 'mina' ? 'Mina' : transaccion.deQuienTipo === 'comprador' ? 'Comprador' : 'Volquetero'} (${nombreActual})`);
          }
        }
      }

      // Actualizar nombre en paraQuien (destino) - más común
      if (transaccion.paraQuienTipo && transaccion.paraQuienId && ['mina', 'comprador', 'volquetero'].includes(transaccion.paraQuienTipo)) {
        const nombreActual = await this.getSocioNombre(transaccion.paraQuienTipo, parseInt(transaccion.paraQuienId));
        
        // Patrones para encontrar y reemplazar nombres de destino
        const patronesDestino = {
          'mina': /(?:a|hacia)\s+Mina\s*\(([^)]+)\)/i,
          'comprador': /(?:a|hacia)\s+Comprador\s*\(([^)]+)\)/i,
          'volquetero': /(?:a|hacia)\s+Volquetero\s*\(([^)]+)\)/i
        };
        
        if (patronesDestino[transaccion.paraQuienTipo as keyof typeof patronesDestino]) {
          const patron = patronesDestino[transaccion.paraQuienTipo as keyof typeof patronesDestino];
          const match = conceptoActualizado.match(patron);
          if (match && match[1] !== nombreActual) {
            conceptoActualizado = conceptoActualizado.replace(patron, `a ${transaccion.paraQuienTipo === 'mina' ? 'Mina' : transaccion.paraQuienTipo === 'comprador' ? 'Comprador' : 'Volquetero'} (${nombreActual})`);
          }
        }
      }

      return conceptoActualizado;
    } catch (error) {
      // Si hay error, devolver concepto original
      return transaccion.concepto;
    }
  }

  // Función optimizada para actualizar conceptos con nombres actuales (versión síncrona usando Maps)
  private updateConceptoWithCurrentNamesSync(
    transaccion: any,
    minasMap: Map<number, string>,
    compradoresMap: Map<number, string>,
    volqueterosMap: Map<number, string>
  ): string {
    let conceptoActualizado = transaccion.concepto;

    // OPTIMIZACIÓN: Solo procesar si el concepto contiene patrones típicos de nombres embebidos
    // Verificación rápida antes de ejecutar regex costosas
    if (!conceptoActualizado || !conceptoActualizado.includes('(') || !conceptoActualizado.includes(')')) {
      return conceptoActualizado;
    }

    // OPTIMIZACIÓN: Pre-compilar regex una vez (fuera del loop si fuera posible, pero aquí mantenemos compatibilidad)
    // Solo procesar si realmente hay tipos de socio que necesitan actualización
    const needsUpdate = (transaccion.deQuienTipo && ['mina', 'comprador', 'volquetero'].includes(transaccion.deQuienTipo)) ||
                       (transaccion.paraQuienTipo && ['mina', 'comprador', 'volquetero'].includes(transaccion.paraQuienTipo));
    
    if (!needsUpdate) {
      return conceptoActualizado;
    }

    try {
      // Actualizar nombre en deQuien (origen) - para casos como "Transferencia de Comprador (Jamer)"
      if (transaccion.deQuienTipo && transaccion.deQuienId && ['mina', 'comprador', 'volquetero'].includes(transaccion.deQuienTipo)) {
        const nombreActual = this.getSocioNombreFromMap(transaccion.deQuienTipo, parseInt(transaccion.deQuienId), minasMap, compradoresMap, volqueterosMap);
        
        // OPTIMIZACIÓN: Solo ejecutar regex si el concepto contiene el tipo de socio
        const tipoCapitalizado = transaccion.deQuienTipo === 'mina' ? 'Mina' : transaccion.deQuienTipo === 'comprador' ? 'Comprador' : 'Volquetero';
        if (conceptoActualizado.includes(tipoCapitalizado)) {
          // Patrones para encontrar y reemplazar nombres de origen (pre-compilados)
          const patronesOrigen: Record<string, RegExp> = {
            'mina': /(?:de|desde)\s+Mina\s*\(([^)]+)\)/i,
            'comprador': /(?:de|desde)\s+Comprador\s*\(([^)]+)\)/i,
            'volquetero': /(?:de|desde)\s+Volquetero\s*\(([^)]+)\)/i
          };
          
          const patron = patronesOrigen[transaccion.deQuienTipo];
          if (patron) {
            const match = conceptoActualizado.match(patron);
            if (match && match[1] !== nombreActual) {
              conceptoActualizado = conceptoActualizado.replace(patron, `de ${tipoCapitalizado} (${nombreActual})`);
            }
          }
        }
      }

      // Actualizar nombre en paraQuien (destino) - más común
      if (transaccion.paraQuienTipo && transaccion.paraQuienId && ['mina', 'comprador', 'volquetero'].includes(transaccion.paraQuienTipo)) {
        const nombreActual = this.getSocioNombreFromMap(transaccion.paraQuienTipo, parseInt(transaccion.paraQuienId), minasMap, compradoresMap, volqueterosMap);
        
        // OPTIMIZACIÓN: Solo ejecutar regex si el concepto contiene el tipo de socio
        const tipoCapitalizado = transaccion.paraQuienTipo === 'mina' ? 'Mina' : transaccion.paraQuienTipo === 'comprador' ? 'Comprador' : 'Volquetero';
        if (conceptoActualizado.includes(tipoCapitalizado)) {
          // Patrones para encontrar y reemplazar nombres de destino (pre-compilados)
          const patronesDestino: Record<string, RegExp> = {
            'mina': /(?:a|hacia)\s+Mina\s*\(([^)]+)\)/i,
            'comprador': /(?:a|hacia)\s+Comprador\s*\(([^)]+)\)/i,
            'volquetero': /(?:a|hacia)\s+Volquetero\s*\(([^)]+)\)/i
          };
          
          const patron = patronesDestino[transaccion.paraQuienTipo];
          if (patron) {
            const match = conceptoActualizado.match(patron);
            if (match && match[1] !== nombreActual) {
              conceptoActualizado = conceptoActualizado.replace(patron, `a ${tipoCapitalizado} (${nombreActual})`);
            }
          }
        }
      }

      return conceptoActualizado;
    } catch (error) {
      // Si hay error, devolver concepto original
      return transaccion.concepto;
    }
  }

  // Métodos de utilidad para verificar permisos
  async userCanAccessMina(minaId: number, userId: string): Promise<boolean> {
    const [mina] = await db.select().from(minas).where(and(eq(minas.id, minaId), eq(minas.userId, userId)));
    return !!mina;
  }

  async userCanAccessComprador(compradorId: number, userId: string): Promise<boolean> {
    const [comprador] = await db.select().from(compradores).where(and(eq(compradores.id, compradorId), eq(compradores.userId, userId)));
    return !!comprador;
  }

  async userCanAccessViaje(viajeId: string, userId: string): Promise<boolean> {
    const [viaje] = await db.select().from(viajes).where(and(eq(viajes.id, viajeId), eq(viajes.userId, userId)));
    return !!viaje;
  }

  async userCanAccessTransaccion(transaccionId: number, userId: string): Promise<boolean> {
    const [transaccion] = await db.select().from(transacciones).where(and(eq(transacciones.id, transaccionId), eq(transacciones.userId, userId)));
    return !!transaccion;
  }

  // Métodos de compatibilidad con la interfaz existente
  async bulkImportViajes(viajesData: any[], userId?: string): Promise<Viaje[]> {
    const viajesWithUserId = viajesData.map(viaje => ({
      ...viaje,
      userId: userId || 'main_user',
    }));

    const insertedViajes = await db.insert(viajes).values(viajesWithUserId as any).returning();
    return insertedViajes;
  }

  async cleanDuplicates(): Promise<void> {
    // Implementar limpieza de duplicados si es necesario
    // Por ahora, solo log
    console.log("DatabaseStorage: cleanDuplicates called");
  }

  // Métodos de compatibilidad (delegación a métodos principales)
  async getMina(id: number): Promise<Mina | undefined> {
    return this.getMinaById(id);
  }

  async getComprador(id: number): Promise<Comprador | undefined> {
    return this.getCompradorById(id);
  }

  async getViaje(id: string): Promise<ViajeWithDetails | undefined> {
    return this.getViajeById(id);
  }

  async getTransaccion(id: number): Promise<Transaccion | undefined> {
    return this.getTransaccionById(id);
  }

  async showAllHiddenTransacciones(userId?: string): Promise<number> {
    const conditions = [eq(transacciones.oculta, true)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    const result = await db
      .update(transacciones)
      .set({ oculta: false })
      .where(and(...conditions));
    return result.rowCount || 0;
  }

  async hideViaje(id: string, userId?: string): Promise<boolean> {
    const conditions = [eq(viajes.id, id)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const result = await db
      .update(viajes)
      .set({ oculta: true })
      .where(and(...conditions));
    return result.rowCount > 0;
  }

  async showViaje(id: string, userId?: string): Promise<boolean> {
    const conditions = [eq(viajes.id, id)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const result = await db
      .update(viajes)
      .set({ oculta: false })
      .where(and(...conditions));
    return result.rowCount > 0;
  }

  async showAllHiddenViajes(userId?: string): Promise<number> {
    const conditions = [eq(viajes.oculta, true)];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const result = await db
      .update(viajes)
      .set({ oculta: false })
      .where(and(...conditions));
    return result.rowCount || 0;
  }

  // Métodos específicos para mostrar elementos ocultos de compradores
  async showAllHiddenTransaccionesForComprador(compradorId: number, userId?: string): Promise<number> {
    // Condiciones para transacciones donde el comprador es origen (deQuien)
    const conditionsOrigen = [
      eq(transacciones.ocultaEnComprador, true),
      eq(transacciones.deQuienTipo, 'comprador'),
      eq(transacciones.deQuienId, compradorId.toString())
    ];
    if (userId) {
      conditionsOrigen.push(eq(transacciones.userId, userId));
    }

    // Condiciones para transacciones donde el comprador es destino (paraQuien)
    const conditionsDestino = [
      eq(transacciones.ocultaEnComprador, true),
      eq(transacciones.paraQuienTipo, 'comprador'),
      eq(transacciones.paraQuienId, compradorId.toString())
    ];
    if (userId) {
      conditionsDestino.push(eq(transacciones.userId, userId));
    }

    // Actualizar transacciones donde comprador es origen
    const resultOrigen = await db
      .update(transacciones)
      .set({ ocultaEnComprador: false })
      .where(and(...conditionsOrigen));

    // Actualizar transacciones donde comprador es destino
    const resultDestino = await db
      .update(transacciones)
      .set({ ocultaEnComprador: false })
      .where(and(...conditionsDestino));

    return (resultOrigen.rowCount || 0) + (resultDestino.rowCount || 0);
  }

  async showAllHiddenViajesForComprador(compradorId: number, userId?: string): Promise<number> {
    const conditions = [
      eq(viajes.oculta, true),
      eq(viajes.compradorId, compradorId)
    ];
    if (userId) {
      conditions.push(eq(viajes.userId, userId));
    }

    const result = await db
      .update(viajes)
      .set({ oculta: false })
      .where(and(...conditions));
    return result.rowCount || 0;
  }

  // Métodos para módulo RodMar
  async getStats(): Promise<{
    totalViajes: number;
    totalTransacciones: number;
    totalMinas: number;
    totalCompradores: number;
    totalVolqueteros: number;
  }> {
    try {
      const [viajesCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(viajes);
      
      const [transaccionesCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transacciones);
      
      const [minasCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(minas);
      
      const [compradoresCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(compradores);
      
      const [volqueterosCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(volqueteros);

      return {
        totalViajes: viajesCount.count,
        totalTransacciones: transaccionesCount.count,
        totalMinas: minasCount.count,
        totalCompradores: compradoresCount.count,
        totalVolqueteros: volqueterosCount.count,
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  async getFinancialSummary(): Promise<{
    totalVentas: string;
    totalCompras: string;
    totalFletes: string;
    gananciaNeta: string;
  }> {
    try {
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(eq(viajes.estado, "completado"));
      
      let totalVentas = 0;
      let totalCompras = 0;
      let totalFletes = 0;
      
      viajesCompletados.forEach(viaje => {
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
    } catch (error) {
      console.error('Error getting financial summary:', error);
      throw error;
    }
  }

  // Inversiones operations
  async getInversiones(userId?: string): Promise<Inversion[]> {
    try {
      const conditions = userId ? [eq(inversiones.userId, userId)] : [];
      
      const result = await db
        .select()
        .from(inversiones)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(inversiones.createdAt));

      return result;
    } catch (error) {
      console.error('Error getting inversiones:', error);
      throw error;
    }
  }

  async getInversionesByDestino(destino: string, destinoDetalle: string, userId?: string): Promise<Inversion[]> {
    try {
      const conditions = [
        eq(inversiones.destino, destino),
        eq(inversiones.destinoDetalle, destinoDetalle)
      ];
      
      if (userId) {
        conditions.push(eq(inversiones.userId, userId));
      }
      
      const result = await db
        .select()
        .from(inversiones)
        .where(and(...conditions))
        .orderBy(desc(inversiones.createdAt));

      return result;
    } catch (error) {
      console.error('Error getting inversiones by destino:', error);
      throw error;
    }
  }

  async getInversionesBySubpestana(subpestana: string, userId?: string): Promise<Inversion[]> {
    try {
      const conditions = [];
      
      // Mapear subpestaña a lo que necesitamos buscar
      if (subpestana === "santa-rosa" || subpestana === "cimitarra") {
        // Buscar inversiones donde el destino o origen incluya esta subpestaña
        conditions.push(
          or(
            and(eq(inversiones.destino, "postobon"), eq(inversiones.destinoDetalle, subpestana)),
            and(eq(inversiones.origen, "postobon"), eq(inversiones.origenDetalle, subpestana))
          )
        );
      }
      
      if (userId) {
        conditions.push(eq(inversiones.userId, userId));
      }

      const result = await db
        .select()
        .from(inversiones)
        .where(and(...conditions))
        .orderBy(desc(inversiones.createdAt));

      return result;
    } catch (error) {
      console.error('Error getting inversiones by subpestana:', error);
      throw error;
    }
  }

  async createInversion(inversionData: InsertInversion & { userId?: string }): Promise<Inversion> {
    try {
      const [result] = await db
        .insert(inversiones)
        .values(inversionData)
        .returning();

      return result;
    } catch (error) {
      console.error('Error creating inversion:', error);
      throw error;
    }
  }

  async updateInversion(id: number, updates: Partial<InsertInversion>, userId?: string): Promise<Inversion | undefined> {
    try {
      const conditions = [eq(inversiones.id, id)];
      if (userId) {
        conditions.push(eq(inversiones.userId, userId));
      }

      const [result] = await db
        .update(inversiones)
        .set(updates)
        .where(and(...conditions))
        .returning();

      return result;
    } catch (error) {
      console.error('Error updating inversion:', error);
      throw error;
    }
  }

  async deleteInversion(id: number, userId?: string): Promise<boolean> {
    try {
      const conditions = [eq(inversiones.id, id)];
      if (userId) {
        conditions.push(eq(inversiones.userId, userId));
      }

      const result = await db
        .delete(inversiones)
        .where(and(...conditions));

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting inversion:', error);
      throw error;
    }
  }

  // ===== MÉTODOS ESPECÍFICOS PARA DESOCULTAMIENTO AUTOMÁTICO DE MINAS =====

  async showAllHiddenTransaccionesForMina(minaId: number, userId?: string): Promise<number> {
    try {
      // Mostrar transacciones ocultas que estén relacionadas con esta mina específica
      const conditions = [
        eq(transacciones.oculta, true),
        or(
          // Transacciones donde la mina es el origen
          and(eq(transacciones.deQuienTipo, 'mina'), eq(transacciones.deQuienId, minaId.toString())),
          // Transacciones donde la mina es el destino  
          and(eq(transacciones.paraQuienTipo, 'mina'), eq(transacciones.paraQuienId, minaId.toString()))
        )
      ];
      
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

      const result = await db
        .update(transacciones)
        .set({ oculta: false })
        .where(and(...conditions));
        
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error showing hidden transacciones for mina:', error);
      throw error;
    }
  }

  async showAllHiddenViajesForMina(minaId: number, userId?: string): Promise<number> {
    try {
      // Mostrar viajes ocultos que pertenezcan a esta mina específica
      const conditions = [
        eq(viajes.oculta, true),
        eq(viajes.minaId, minaId)
      ];
      
      if (userId) {
        conditions.push(eq(viajes.userId, userId));
      }

      const result = await db
        .update(viajes)
        .set({ oculta: false })
        .where(and(...conditions));
        
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error showing hidden viajes for mina:', error);
      throw error;
    }
  }

  // ===== MÉTODOS PARA BALANCE CALCULADO =====

  // Actualizar balances después de transacción
  async updateRelatedBalances(transaccion: Transaccion): Promise<void> {
    console.log(`🔄 INICIANDO recálculo automático para transacción ID ${transaccion.id}`);
    console.log(`📊 Datos transacción: ${transaccion.deQuienTipo}(${transaccion.deQuienId}) → ${transaccion.paraQuienTipo}(${transaccion.paraQuienId})`);
    
    try {
      // Si la transacción involucra una mina como origen
      if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId) {
        const minaId = parseInt(transaccion.deQuienId);
        
        // Validaciones robustas
        if (isNaN(minaId) || minaId <= 0) {
          console.error(`❌ ID de mina inválido en deQuienId: "${transaccion.deQuienId}"`);
          return;
        }
        
        console.log(`🏔️ Procesando mina origen: ID ${minaId}`);
        
        try {
          await this.markMinaBalanceStale(minaId);
          console.log(`✅ Mina ${minaId} marcada como desactualizada`);
          
          await this.calculateAndUpdateMinaBalance(minaId);
          console.log(`✅ Balance de mina ${minaId} recalculado exitosamente`);
        } catch (minaError) {
          console.error(`❌ Error procesando mina origen ${minaId}:`, minaError);
          throw minaError;
        }
      }
      
      // Si la transacción involucra una mina como destino
      if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId) {
        const minaId = parseInt(transaccion.paraQuienId);
        
        // Validaciones robustas
        if (isNaN(minaId) || minaId <= 0) {
          console.error(`❌ ID de mina inválido en paraQuienId: "${transaccion.paraQuienId}"`);
          return;
        }
        
        console.log(`🏔️ Procesando mina destino: ID ${minaId}`);
        
        try {
          await this.markMinaBalanceStale(minaId);
          console.log(`✅ Mina ${minaId} marcada como desactualizada`);
          
          await this.calculateAndUpdateMinaBalance(minaId);
          console.log(`✅ Balance de mina ${minaId} recalculado exitosamente`);
        } catch (minaError) {
          console.error(`❌ Error procesando mina destino ${minaId}:`, minaError);
          throw minaError;
        }
      }

      // Si la transacción involucra un comprador como origen
      if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId) {
        const compradorId = parseInt(transaccion.deQuienId);
        
        if (isNaN(compradorId) || compradorId <= 0) {
          console.error(`❌ ID de comprador inválido en deQuienId: "${transaccion.deQuienId}"`);
          return;
        }
        
        console.log(`🏪 Procesando comprador origen: ID ${compradorId}`);
        await this.calculateAndUpdateCompradorBalance(compradorId);
        console.log(`✅ Balance de comprador ${compradorId} recalculado`);
      }
      
      // Si la transacción involucra un comprador como destino
      if (transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId) {
        const compradorId = parseInt(transaccion.paraQuienId);
        
        if (isNaN(compradorId) || compradorId <= 0) {
          console.error(`❌ ID de comprador inválido en paraQuienId: "${transaccion.paraQuienId}"`);
          return;
        }
        
        console.log(`🏪 Procesando comprador destino: ID ${compradorId}`);
        await this.calculateAndUpdateCompradorBalance(compradorId);
        console.log(`✅ Balance de comprador ${compradorId} recalculado`);
      }
      
      console.log(`🎉 COMPLETADO recálculo automático para transacción ID ${transaccion.id}`);
    } catch (error) {
      console.error(`💥 ERROR CRÍTICO en recálculo automático para transacción ID ${transaccion.id}:`, error);
      console.error(`📱 Stack trace completo:`, error instanceof Error ? error.stack : 'No stack available');
      throw error; // Re-throw para que el error sea visible en logs superiores
    }
  }

  // Actualizar balances después de viaje
  async updateViajeRelatedBalances(viaje: Viaje): Promise<void> {
    try {
      // Si el viaje involucra una mina
      if (viaje.minaId) {
        await this.markMinaBalanceStale(viaje.minaId);
        await this.calculateAndUpdateMinaBalance(viaje.minaId);
      }

      // Si el viaje involucra un comprador
      if (viaje.compradorId) {
        await this.calculateAndUpdateCompradorBalance(viaje.compradorId);
      }
    } catch (error) {
      console.error('Error updating viaje related balances:', error);
    }
  }

  // Calcular y actualizar balance de mina
  async calculateAndUpdateMinaBalance(minaId: number): Promise<void> {
    console.log(`🧮 INICIANDO cálculo de balance para mina ${minaId}`);
    
    try {
      // Validaciones previas robustas
      if (!minaId || isNaN(minaId) || minaId <= 0) {
        throw new Error(`ID de mina inválido para cálculo: ${minaId}`);
      }
      
      // Verificar que la mina existe antes de hacer cálculos
      const minaCheck = await db.select({ id: minas.id, nombre: minas.nombre }).from(minas).where(eq(minas.id, minaId)).limit(1);
      if (!minaCheck.length) {
        throw new Error(`Mina con ID ${minaId} no encontrada para cálculo de balance`);
      }
      
      console.log(`🏔️ Calculando balance para mina: ${minaCheck[0].nombre} (ID: ${minaId})`);

      // Obtener viajes completados de la mina
      console.log(`📊 Consultando viajes completados para mina ${minaId}...`);
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.minaId, minaId),
          eq(viajes.estado, 'completado'),
          eq(viajes.oculta, false)
        ));
      
      console.log(`📈 Encontrados ${viajesCompletados.length} viajes completados para mina ${minaId}`);

      // Obtener transacciones manuales (no de viajes) de la mina
      console.log(`💰 Consultando transacciones para mina ${minaId}...`);
      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(and(
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), eq(transacciones.deQuienId, minaId.toString())),
            and(eq(transacciones.paraQuienTipo, 'mina'), eq(transacciones.paraQuienId, minaId.toString()))
          ),
          eq(transacciones.oculta, false)
        ));

      console.log(`📋 Encontradas ${transaccionesManuales.length} transacciones totales para mina ${minaId}`);

      // Filtrar solo transacciones manuales (no automáticas de viajes)
      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );
      
      console.log(`🎯 Transacciones manuales filtradas: ${transaccionesManualesFiltered.length} (excluidas ${transaccionesManuales.length - transaccionesManualesFiltered.length} automáticas de viajes)`);

      // Calcular ingresos de viajes completados - usar totalCompra (lo que RodMar paga a la mina)
      console.log(`💵 Calculando ingresos de viajes...`);
      const ingresosViajes = viajesCompletados.reduce((sum, viaje) => {
        const totalCompra = parseFloat(viaje.totalCompra || '0');
        return sum + totalCompra;
      }, 0);
      
      console.log(`💰 Ingresos de viajes calculados: $${ingresosViajes.toLocaleString()}`);

      // Calcular transacciones netas (replicar lógica exacta del frontend)
      console.log(`🔄 Calculando transacciones netas...`);
      const transaccionesNetas = transaccionesManualesFiltered.reduce((sum, transaccion) => {
        const valor = parseFloat(transaccion.valor || '0');
        
        if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId.toString()) {
          // Transacciones desde ESTA mina = ingresos positivos (mina vende/recibe)
          console.log(`  💰 Ingreso desde mina hacia ${transaccion.paraQuienTipo}: +$${valor.toLocaleString()} (${transaccion.concepto})`);
          return sum + valor;
        } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId.toString()) {
          // Transacciones hacia ESTA mina = egresos negativos
          console.log(`  ➡️ Egreso hacia mina: -$${valor.toLocaleString()} (${transaccion.concepto})`);
          return sum - valor;
        } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
          // Transacciones hacia RodMar/Banco = ingresos positivos
          console.log(`  ⬅️ Ingreso desde mina hacia RodMar/Banco: +$${valor.toLocaleString()} (${transaccion.concepto})`);
          return sum + valor;
        }
        
        console.log(`  ⚠️ Transacción no procesada: ${transaccion.deQuienTipo}(${transaccion.deQuienId}) → ${transaccion.paraQuienTipo}(${transaccion.paraQuienId}) ($${valor.toLocaleString()})`);
        return sum;
      }, 0);
      
      console.log(`💸 Transacciones netas calculadas: $${transaccionesNetas.toLocaleString()}`);

      const balanceCalculado = ingresosViajes + transaccionesNetas;
      console.log(`🧮 BALANCE FINAL calculado para mina ${minaId}: $${balanceCalculado.toLocaleString()}`);
      console.log(`📊 Detalle: Ingresos viajes ($${ingresosViajes.toLocaleString()}) + Transacciones netas ($${transaccionesNetas.toLocaleString()}) = $${balanceCalculado.toLocaleString()}`);

      // Actualizar el balance calculado en la base de datos con timestamp
      console.log(`💾 Actualizando balance en base de datos...`);
      const updateResult = await db
        .update(minas)
        .set({ 
          balanceCalculado: balanceCalculado.toString(),
          balanceDesactualizado: false,
          ultimoRecalculo: new Date()
        })
        .where(eq(minas.id, minaId));

      console.log(`✅ BALANCE ACTUALIZADO EXITOSAMENTE para mina ${minaId} (${minaCheck[0].nombre}): $${balanceCalculado.toLocaleString()}`);
      console.log(`📊 Filas afectadas en actualización final: ${updateResult.rowCount || 'N/A'}`);
    } catch (error) {
      console.error(`💥 ERROR CRÍTICO calculando balance para mina ${minaId}:`, error);
      console.error(`📱 Tipo de error:`, typeof error);
      console.error(`📱 Stack trace completo:`, error instanceof Error ? error.stack : 'No stack available');
      throw error; // Re-throw para que sea visible en nivel superior
    }
  }

  // Función para marcar balance como desactualizado
  async markMinaBalanceStale(minaId: number): Promise<void> {
    console.log(`🔄 Iniciando marcado de balance stale para mina ${minaId}`);
    
    try {
      // Validación previa
      if (!minaId || isNaN(minaId) || minaId <= 0) {
        throw new Error(`ID de mina inválido: ${minaId}`);
      }
      
      // Verificar que la mina existe
      const mina = await db.select().from(minas).where(eq(minas.id, minaId)).limit(1);
      if (!mina.length) {
        throw new Error(`Mina con ID ${minaId} no encontrada en la base de datos`);
      }
      
      console.log(`🏔️ Mina encontrada: ${mina[0].nombre}, ejecutando actualización...`);
      
      const result = await db
        .update(minas)
        .set({ balanceDesactualizado: true })
        .where(eq(minas.id, minaId));
      
      console.log(`⚠️ Balance marcado como desactualizado para mina ${minaId} (${mina[0].nombre})`);
      console.log(`📊 Filas afectadas en actualización stale: ${result.rowCount || 'N/A'}`);
    } catch (error) {
      console.error(`❌ ERROR DETALLADO marcando balance como stale para mina ${minaId}:`, error);
      console.error(`📱 Tipo de error:`, typeof error);
      console.error(`📱 Stack trace:`, error instanceof Error ? error.stack : 'No stack available');
      throw error; // Re-throw para que el error sea manejado por el nivel superior
    }
  }

  // Función para obtener minas con balance desactualizado
  async getMinasWithStaleBalance(): Promise<Mina[]> {
    try {
      const staleMinasList = await db
        .select()
        .from(minas)
        .where(eq(minas.balanceDesactualizado, true));
      
      console.log(`🔍 Encontradas ${staleMinasList.length} minas con balance desactualizado`);
      return staleMinasList;
    } catch (error) {
      console.error("❌ Error obteniendo minas con balance stale:", error);
      return [];
    }
  }

  // Función para validar si balance pre-calculado coincide con cálculo manual
  async validateMinaBalance(minaId: number): Promise<{ valid: boolean; difference: number; precalculado: number; manual: number }> {
    try {
      // Obtener balance pre-calculado
      const [mina] = await db.select().from(minas).where(eq(minas.id, minaId));
      if (!mina) {
        throw new Error(`Mina ${minaId} no encontrada`);
      }
      
      const balancePrecalculado = parseFloat(mina.balanceCalculado || "0");
      
      // Calcular balance manual usando misma lógica que calculateAndUpdateMinaBalance
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.minaId, minaId),
          eq(viajes.estado, 'completado'),
          eq(viajes.oculta, false)
        ));

      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(and(
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), eq(transacciones.deQuienId, minaId.toString())),
            and(eq(transacciones.paraQuienTipo, 'mina'), eq(transacciones.paraQuienId, minaId.toString()))
          ),
          eq(transacciones.oculta, false)
        ));

      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );

      const ingresosViajes = viajesCompletados.reduce((sum, viaje) => {
        return sum + parseFloat(viaje.totalCompra || '0');
      }, 0);

      const transaccionesNetas = transaccionesManualesFiltered.reduce((sum, transaccion) => {
        const valor = parseFloat(transaccion.valor || '0');
        
        if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId.toString()) {
          // Transacciones desde ESTA mina = ingresos positivos (mina vende/recibe)
          return sum + valor;
        } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId.toString()) {
          // Transacciones hacia ESTA mina = egresos negativos
          return sum - valor;
        } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
          // Transacciones hacia RodMar/Banco = ingresos positivos
          return sum + valor;
        }
        return sum;
      }, 0);

      const balanceManual = ingresosViajes + transaccionesNetas;
      const difference = Math.abs(balancePrecalculado - balanceManual);
      const isValid = difference < 0.01; // Tolerancia de 1 centavo por redondeo
      
      console.log(`🔍 Validación mina ${minaId}: Pre-calculado: ${balancePrecalculado}, Manual: ${balanceManual}, Diferencia: ${difference}, Válido: ${isValid}`);
      
      return {
        valid: isValid,
        difference,
        precalculado: balancePrecalculado,
        manual: balanceManual
      };
    } catch (error) {
      console.error(`❌ Error validando balance para mina ${minaId}:`, error);
      throw error;
    }
  }

  // Calcular y actualizar balance de comprador
  async calculateAndUpdateCompradorBalance(compradorId: number): Promise<void> {
    try {
      // Obtener viajes completados del comprador
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.compradorId, compradorId),
          eq(viajes.estado, 'completado'),
          eq(viajes.oculta, false)
        ));

      // Obtener transacciones manuales del comprador
      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(and(
          or(
            and(eq(transacciones.deQuienTipo, 'comprador'), eq(transacciones.deQuienId, compradorId.toString())),
            and(eq(transacciones.paraQuienTipo, 'comprador'), eq(transacciones.paraQuienId, compradorId.toString()))
          ),
          eq(transacciones.oculta, false)
        ));

      // Filtrar solo transacciones manuales
      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );

      // Calcular deuda de viajes (valor a consignar negativo para comprador)
      const deudaViajes = viajesCompletados.reduce((sum, viaje) => {
        const valorConsignar = parseFloat(viaje.valorConsignar || '0');
        return sum - valorConsignar; // Negativo porque es deuda
      }, 0);

      // Calcular transacciones netas
      const transaccionesNetas = transaccionesManualesFiltered.reduce((sum, transaccion) => {
        const valor = parseFloat(transaccion.valor || '0');
        
        if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
          // Pago desde el comprador (reduce deuda)
          return sum + valor;
        } else if (transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId === compradorId.toString()) {
          // Préstamo hacia el comprador (aumenta deuda)
          return sum - valor;
        }
        
        return sum;
      }, 0);

      const balanceCalculado = deudaViajes + transaccionesNetas;

      // Actualizar el balance calculado en la base de datos
      await db
        .update(compradores)
        .set({ balanceCalculado: balanceCalculado.toString() })
        .where(eq(compradores.id, compradorId));

      console.log(`✅ Balance actualizado para comprador ${compradorId}: ${balanceCalculado}`);
    } catch (error) {
      console.error('Error calculating comprador balance:', error);
    }
  }

  // Recalcular todos los balances (útil para migración inicial)
  async recalculateAllBalances(): Promise<void> {
    try {
      console.log('🔄 Iniciando recálculo de todos los balances...');

      // Recalcular balances de minas
      const allMinas = await db.select().from(minas);
      for (const mina of allMinas) {
        await this.calculateAndUpdateMinaBalance(mina.id);
      }

      // Recalcular balances de compradores
      const allCompradores = await db.select().from(compradores);
      for (const comprador of allCompradores) {
        await this.calculateAndUpdateCompradorBalance(comprador.id);
      }

      console.log('✅ Recálculo de todos los balances completado');
    } catch (error) {
      console.error('Error recalculating all balances:', error);
      throw error;
    }
  }

  // ===== MÉTODOS DE FUSIÓN DE ENTIDADES =====

  async mergeVolqueteros(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }> {
    return await db.transaction(async (tx) => {
      // 1. Verificar que ambas entidades existen
      const [origen] = await tx.select().from(volqueteros).where(eq(volqueteros.id, origenId));
      const [destino] = await tx.select().from(volqueteros).where(eq(volqueteros.id, destinoId));

      if (!origen || !destino) {
        throw new Error("Una o ambas entidades no existen");
      }

      // 2. Obtener transacciones y viajes afectados ANTES de la fusión
      const transaccionesAfectadas = await tx.select()
        .from(transacciones)
        .where(
          or(
            and(eq(transacciones.deQuienTipo, 'volquetero'), eq(transacciones.deQuienId, origenId.toString())),
            and(eq(transacciones.paraQuienTipo, 'volquetero'), eq(transacciones.paraQuienId, origenId.toString()))
          )
        );

      const viajesAfectados = await tx.select()
        .from(viajes)
        .where(eq(viajes.volquetero, origen.nombre));

      // 3. Crear backup en fusion_backups
      const [backup] = await tx.insert(fusionBackups).values({
        tipoEntidad: 'volquetero',
        origenId,
        destinoId,
        origenNombre: origen.nombre,
        destinoNombre: destino.nombre,
        datosOriginales: {
          origen: origen,
          destino: destino,
          timestamp: new Date().toISOString()
        },
        transaccionesAfectadas: transaccionesAfectadas.map(t => ({
          id: t.id,
          conceptoOriginal: t.concepto
        })),
        viajesAfectados: viajesAfectados.map(v => ({
          id: v.id
        })),
        userId: userId || 'main_user'
      }).returning();

      // 4. Actualizar transacciones: cambiar referencias al origen por el destino
      let transaccionesTransferidas = 0;
      for (const transaccion of transaccionesAfectadas) {
        const nuevoConcepto = transaccion.concepto.replace(
          new RegExp(origen.nombre, 'gi'), 
          destino.nombre
        );
        
        await tx.update(transacciones)
          .set({
            deQuienId: transaccion.deQuienTipo === 'volquetero' && transaccion.deQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.deQuienId,
            paraQuienId: transaccion.paraQuienTipo === 'volquetero' && transaccion.paraQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.paraQuienId,
            concepto: nuevoConcepto
          })
          .where(eq(transacciones.id, transaccion.id));
        
        transaccionesTransferidas++;
      }

      // 5. Actualizar viajes: cambiar nombre del volquetero
      let viajesTransferidos = 0;
      for (const viaje of viajesAfectados) {
        await tx.update(viajes)
          .set({ volquetero: destino.nombre })
          .where(eq(viajes.id, viaje.id));
        
        viajesTransferidos++;
      }

      // 6. Eliminar entidad origen
      await tx.delete(volqueteros).where(eq(volqueteros.id, origenId));

      console.log(`🔄 Fusión completada: ${origen.nombre} → ${destino.nombre}`);
      console.log(`📊 Transferidas: ${transaccionesTransferidas} transacciones, ${viajesTransferidos} viajes`);

      return {
        fusionId: backup.id,
        transaccionesTransferidas,
        viajesTransferidos
      };
    });
  }

  async mergeMinas(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }> {
    return await db.transaction(async (tx) => {
      // 1. Verificar que ambas entidades existen
      const [origen] = await tx.select().from(minas).where(eq(minas.id, origenId));
      const [destino] = await tx.select().from(minas).where(eq(minas.id, destinoId));

      if (!origen || !destino) {
        throw new Error("Una o ambas entidades no existen");
      }

      // 2. Obtener transacciones y viajes afectados ANTES de la fusión
      const transaccionesAfectadas = await tx.select()
        .from(transacciones)
        .where(
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), eq(transacciones.deQuienId, origenId.toString())),
            and(eq(transacciones.paraQuienTipo, 'mina'), eq(transacciones.paraQuienId, origenId.toString()))
          )
        );

      const viajesAfectados = await tx.select()
        .from(viajes)
        .where(eq(viajes.minaId, origenId));

      // 3. Crear backup en fusion_backups
      const [backup] = await tx.insert(fusionBackups).values({
        tipoEntidad: 'mina',
        origenId,
        destinoId,
        origenNombre: origen.nombre,
        destinoNombre: destino.nombre,
        datosOriginales: {
          origen: origen,
          destino: destino,
          timestamp: new Date().toISOString()
        },
        transaccionesAfectadas: transaccionesAfectadas.map(t => ({
          id: t.id,
          conceptoOriginal: t.concepto
        })),
        viajesAfectados: viajesAfectados.map(v => ({
          id: v.id
        })),
        userId: userId || 'main_user'
      }).returning();

      // 4. Actualizar transacciones: cambiar referencias al origen por el destino
      let transaccionesTransferidas = 0;
      for (const transaccion of transaccionesAfectadas) {
        const nuevoConcepto = transaccion.concepto.replace(
          new RegExp(origen.nombre, 'gi'), 
          destino.nombre
        );
        
        await tx.update(transacciones)
          .set({
            deQuienId: transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.deQuienId,
            paraQuienId: transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.paraQuienId,
            concepto: nuevoConcepto
          })
          .where(eq(transacciones.id, transaccion.id));
        
        transaccionesTransferidas++;
      }

      // 5. Actualizar viajes: cambiar ID de mina
      let viajesTransferidos = 0;
      for (const viaje of viajesAfectados) {
        await tx.update(viajes)
          .set({ minaId: destinoId })
          .where(eq(viajes.id, viaje.id));
        
        viajesTransferidos++;
      }

      // 6. Eliminar entidad origen
      await tx.delete(minas).where(eq(minas.id, origenId));

      console.log(`🔄 Fusión completada: ${origen.nombre} → ${destino.nombre}`);
      console.log(`📊 Transferidas: ${transaccionesTransferidas} transacciones, ${viajesTransferidos} viajes`);

      return {
        fusionId: backup.id,
        transaccionesTransferidas,
        viajesTransferidos
      };
    });
  }

  async mergeCompradores(origenId: number, destinoId: number, userId?: string): Promise<{ fusionId: number; transaccionesTransferidas: number; viajesTransferidos: number; }> {
    console.log(`🔄 STORAGE - Iniciando mergeCompradores: ${origenId} → ${destinoId}`);
    
    try {
      console.log("📊 PASO 1 - Verificando que ambas entidades existen...");
      const [origen] = await db.select().from(compradores).where(eq(compradores.id, origenId));
      const [destino] = await db.select().from(compradores).where(eq(compradores.id, destinoId));

      console.log("📝 Origen encontrado:", origen ? `${origen.nombre} (ID: ${origen.id})` : "NO ENCONTRADO");
      console.log("📝 Destino encontrado:", destino ? `${destino.nombre} (ID: ${destino.id})` : "NO ENCONTRADO");

      if (!origen || !destino) {
        throw new Error("Una o ambas entidades no existen");
      }

      console.log("📊 PASO 2 - Obteniendo transacciones y viajes afectados...");
      const transaccionesAfectadas = await db.select()
        .from(transacciones)
        .where(
          or(
            and(eq(transacciones.deQuienTipo, 'comprador'), eq(transacciones.deQuienId, origenId.toString())),
            and(eq(transacciones.paraQuienTipo, 'comprador'), eq(transacciones.paraQuienId, origenId.toString()))
          )
        );

      const viajesAfectados = await db.select()
        .from(viajes)
        .where(eq(viajes.compradorId, origenId));
      
      console.log(`📈 Transacciones afectadas: ${transaccionesAfectadas.length}`);
      console.log(`🚛 Viajes afectados: ${viajesAfectados.length}`);

      console.log("📊 PASO 3 - Creando backup en fusion_backups...");
      const [backup] = await db.insert(fusionBackups).values({
        tipoEntidad: 'comprador',
        origenId,
        destinoId,
        origenNombre: origen.nombre,
        destinoNombre: destino.nombre,
        datosOriginales: {
          origen: origen,
          destino: destino,
          timestamp: new Date().toISOString()
        },
        transaccionesAfectadas: transaccionesAfectadas.map(t => ({
          id: t.id,
          conceptoOriginal: t.concepto
        })),
        viajesAfectados: viajesAfectados.map(v => ({
          id: v.id
        })),
        userId: userId || 'main_user'
      }).returning();
      
      console.log(`💾 Backup creado con ID: ${backup.id}`);

      console.log("📊 PASO 4 - Actualizando transacciones...");
      let transaccionesTransferidas = 0;
      for (const transaccion of transaccionesAfectadas) {
        console.log(`  🔄 Actualizando transacción ${transaccion.id}: "${transaccion.concepto}"`);
        
        const nuevoConcepto = transaccion.concepto.replace(
          new RegExp(origen.nombre, 'gi'), 
          destino.nombre
        );
        
        await db.update(transacciones)
          .set({
            deQuienId: transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.deQuienId,
            paraQuienId: transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId === origenId.toString() 
              ? destinoId.toString() 
              : transaccion.paraQuienId,
            concepto: nuevoConcepto
          })
          .where(eq(transacciones.id, transaccion.id));
        
        transaccionesTransferidas++;
        console.log(`  ✅ Transacción ${transaccion.id} actualizada → "${nuevoConcepto}"`);
      }
      console.log(`📈 Total transacciones transferidas: ${transaccionesTransferidas}`);

      console.log("📊 PASO 5 - Actualizando viajes...");
      let viajesTransferidos = 0;
      for (const viaje of viajesAfectados) {
        console.log(`  🚛 Actualizando viaje ${viaje.id}`);
        await db.update(viajes)
          .set({ compradorId: destinoId })
          .where(eq(viajes.id, viaje.id));
        
        viajesTransferidos++;
      }
      console.log(`🚛 Total viajes transferidos: ${viajesTransferidos}`);

      console.log("📊 PASO 6 - Eliminando entidad origen...");
      await db.delete(compradores).where(eq(compradores.id, origenId));
      console.log(`🗑️ Comprador origen eliminado: ${origen.nombre} (ID: ${origenId})`);

      console.log(`✅ FUSIÓN COMPLETADA: ${origen.nombre} → ${destino.nombre}`);
      console.log(`📊 Resumen: ${transaccionesTransferidas} transacciones, ${viajesTransferidos} viajes`);

      return {
        fusionId: backup.id,
        transaccionesTransferidas,
        viajesTransferidos
      };
    } catch (error) {
      console.error("💥 ERROR EN FUSIÓN DE COMPRADORES:", error);
      console.error("📱 Stack trace:", error instanceof Error ? error.stack : 'No stack available');
      throw error;
    }
  }

  async getFusionHistory(userId?: string): Promise<any[]> {
    const whereCondition = userId ? eq(fusionBackups.userId, userId) : undefined;
    
    const historial = await db.select()
      .from(fusionBackups)
      .where(whereCondition)
      .orderBy(desc(fusionBackups.fechaFusion));

    return historial.map(backup => ({
      id: backup.id,
      tipoEntidad: backup.tipoEntidad,
      origenNombre: backup.origenNombre,
      destinoNombre: backup.destinoNombre,
      fechaFusion: backup.fechaFusion,
      revertida: backup.revertida,
      fechaReversion: backup.fechaReversion,
      transaccionesAfectadas: Array.isArray(backup.transaccionesAfectadas) 
        ? backup.transaccionesAfectadas.length 
        : 0,
      viajesAfectados: Array.isArray(backup.viajesAfectados) 
        ? backup.viajesAfectados.length 
        : 0
    }));
  }

  async revertFusion(fusionId: number, userId?: string): Promise<{ entidadRestaurada: string; transaccionesRestauradas: number; viajesRestaurados: number; }> {
    console.log(`🔄 STORAGE - Iniciando revertFusion: ID ${fusionId}, Usuario: ${userId}`);
    
    try {
      // 1. Obtener el backup de fusión
      console.log("📊 PASO 1 - Obteniendo backup de fusión...");
      const [backup] = await db.select()
        .from(fusionBackups)
        .where(
          and(
            eq(fusionBackups.id, fusionId),
            userId ? eq(fusionBackups.userId, userId) : undefined
          )
        );

      if (!backup) {
        throw new Error("Backup de fusión no encontrado");
      }

      if (backup.revertida) {
        throw new Error("Esta fusión ya ha sido revertida");
      }

      console.log("📝 Backup encontrado:", backup.tipoEntidad, backup.origenNombre, "→", backup.destinoNombre);

      const datosOriginales = backup.datosOriginales as any;
      const transaccionesAfectadas = backup.transaccionesAfectadas as any[];
      const viajesAfectados = backup.viajesAfectados as any[];

      // 2. Restaurar la entidad origen
      console.log("📊 PASO 2 - Restaurando entidad origen...");
      let entidadRestaurada = '';
      if (backup.tipoEntidad === 'volquetero') {
        await db.insert(volqueteros).values({
          id: backup.origenId,
          nombre: datosOriginales.origen.nombre,
          placa: datosOriginales.origen.placa,
          userId: datosOriginales.origen.userId
        });
        entidadRestaurada = `Volquetero: ${datosOriginales.origen.nombre}`;
      } else if (backup.tipoEntidad === 'mina') {
        await db.insert(minas).values({
          id: backup.origenId,
          nombre: datosOriginales.origen.nombre,
          balanceCalculado: datosOriginales.origen.balanceCalculado,
          balanceDesactualizado: datosOriginales.origen.balanceDesactualizado,
          ultimoRecalculo: datosOriginales.origen.ultimoRecalculo,
          userId: datosOriginales.origen.userId
        });
        entidadRestaurada = `Mina: ${datosOriginales.origen.nombre}`;
      } else if (backup.tipoEntidad === 'comprador') {
        await db.insert(compradores).values({
          id: backup.origenId,
          nombre: datosOriginales.origen.nombre,
          balanceCalculado: datosOriginales.origen.balanceCalculado,
          userId: datosOriginales.origen.userId
        });
        entidadRestaurada = `Comprador: ${datosOriginales.origen.nombre}`;
      }
      
      console.log(`✅ Entidad restaurada: ${entidadRestaurada}`);

      // 3. Restaurar transacciones originales
      console.log("📊 PASO 3 - Restaurando transacciones...");
      let transaccionesRestauradas = 0;
      for (const transaccionInfo of transaccionesAfectadas) {
        console.log(`  🔄 Restaurando transacción ${transaccionInfo.id}...`);
        
        // Solo restaurar transacciones que aún existen
        const [transaccionExistente] = await db.select()
          .from(transacciones)
          .where(eq(transacciones.id, transaccionInfo.id));

        if (transaccionExistente) {
          const restaurarDeQuien = backup.tipoEntidad === 'volquetero' 
            ? (transaccionExistente.deQuienTipo === 'volquetero' && transaccionExistente.deQuienId === backup.destinoId.toString())
            : (transaccionExistente.deQuienTipo === backup.tipoEntidad && transaccionExistente.deQuienId === backup.destinoId.toString());
            
          const restaurarParaQuien = backup.tipoEntidad === 'volquetero'
            ? (transaccionExistente.paraQuienTipo === 'volquetero' && transaccionExistente.paraQuienId === backup.destinoId.toString())
            : (transaccionExistente.paraQuienTipo === backup.tipoEntidad && transaccionExistente.paraQuienId === backup.destinoId.toString());

          await db.update(transacciones)
            .set({
              deQuienId: restaurarDeQuien ? backup.origenId.toString() : transaccionExistente.deQuienId,
              paraQuienId: restaurarParaQuien ? backup.origenId.toString() : transaccionExistente.paraQuienId,
              concepto: transaccionInfo.conceptoOriginal
            })
            .where(eq(transacciones.id, transaccionInfo.id));
          
          transaccionesRestauradas++;
          console.log(`    ✅ Transacción ${transaccionInfo.id} restaurada`);
        } else {
          console.log(`    ⚠️ Transacción ${transaccionInfo.id} no encontrada, omitiendo`);
        }
      }
      console.log(`📈 Total transacciones restauradas: ${transaccionesRestauradas}`);

      // 4. Restaurar viajes originales
      console.log("📊 PASO 4 - Restaurando viajes...");
      let viajesRestaurados = 0;
      for (const viajeInfo of viajesAfectados) {
        console.log(`  🚛 Restaurando viaje ${viajeInfo.id}...`);
        
        const [viajeExistente] = await db.select()
          .from(viajes)
          .where(eq(viajes.id, viajeInfo.id));

        if (viajeExistente) {
          if (backup.tipoEntidad === 'volquetero') {
            await db.update(viajes)
              .set({ volquetero: datosOriginales.origen.nombre })
              .where(eq(viajes.id, viajeInfo.id));
          } else if (backup.tipoEntidad === 'mina') {
            await db.update(viajes)
              .set({ minaId: backup.origenId })
              .where(eq(viajes.id, viajeInfo.id));
          } else if (backup.tipoEntidad === 'comprador') {
            await db.update(viajes)
              .set({ compradorId: backup.origenId })
              .where(eq(viajes.id, viajeInfo.id));
          }
          
          viajesRestaurados++;
          console.log(`    ✅ Viaje ${viajeInfo.id} restaurado`);
        } else {
          console.log(`    ⚠️ Viaje ${viajeInfo.id} no encontrado, omitiendo`);
        }
      }
      console.log(`🚛 Total viajes restaurados: ${viajesRestaurados}`);

      // 5. Marcar fusión como revertida
      console.log("📊 PASO 5 - Marcando fusión como revertida...");
      await db.update(fusionBackups)
        .set({
          revertida: true,
          fechaReversion: new Date()
        })
        .where(eq(fusionBackups.id, fusionId));

      console.log(`✅ REVERSIÓN COMPLETADA: ${entidadRestaurada}`);
      console.log(`📊 Resumen: ${transaccionesRestauradas} transacciones, ${viajesRestaurados} viajes restaurados`);

      return {
        entidadRestaurada,
        transaccionesRestauradas,
        viajesRestaurados
      };
    } catch (error) {
      console.error("💥 ERROR EN REVERSIÓN DE FUSIÓN:", error);
      console.error("📱 Stack trace:", error instanceof Error ? error.stack : 'No stack available');
      throw error;
    }
  }

  // ===== MÉTODOS DE BALANCES AGREGADOS (OPTIMIZACIÓN) =====

  // Obtener balances y estadísticas de todas las minas sin cargar todos los viajes
  async getMinasBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log('🔵 [PERF] getMinasBalances() - INICIANDO (OPTIMIZADO)');

      // Obtener todas las minas con sus balances calculados
      const allMinas = await this.getMinas(userId);
      const balances: Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }> = {};

      // Calcular fecha del último mes
      const hoy = new Date();
      const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      
      // Convertir fechas a strings ISO para usar en SQL
      const inicioMesPasadoISO = inicioMesPasado.toISOString();
      const finMesPasadoISO = finMesPasado.toISOString();

      // Preparar condiciones base para queries
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
        eq(viajes.oculta, false),
        sql`${viajes.minaId} IS NOT NULL`
      ];
      if (userId) {
        viajesConditions.push(eq(viajes.userId, userId));
      }

      // QUERY 1: Estadísticas agregadas de viajes por mina (1 query para todas las minas)
      const viajesStatsStart = Date.now();
      const viajesStats = await db
        .select({
          minaId: viajes.minaId,
          viajesCount: sql<number>`COUNT(*)::int`,
          viajesUltimoMes: sql<number>`COUNT(CASE WHEN ${viajes.fechaDescargue} >= ${inicioMesPasadoISO}::timestamp AND ${viajes.fechaDescargue} <= ${finMesPasadoISO}::timestamp THEN 1 END)::int`,
          ingresosViajes: sql<number>`COALESCE(SUM(CAST(${viajes.totalCompra} AS NUMERIC)), 0)`
        })
        .from(viajes)
        .where(and(...viajesConditions))
        .groupBy(viajes.minaId);
      
      const viajesStatsTime = Date.now() - viajesStatsStart;
      console.log(`⏱️  [PERF] Query agregada de viajes: ${viajesStatsTime}ms (${viajesStats.length} minas)`);

      // Crear map de estadísticas de viajes por mina
      const viajesStatsMap = new Map<number, { viajesCount: number; viajesUltimoMes: number; ingresosViajes: number }>();
      viajesStats.forEach(stat => {
        if (stat.minaId) {
          viajesStatsMap.set(stat.minaId, {
            viajesCount: stat.viajesCount,
            viajesUltimoMes: stat.viajesUltimoMes,
            ingresosViajes: stat.ingresosViajes
          });
        }
      });

      // Identificar minas que necesitan cálculo dinámico de balance
      const minasNecesitanCalculo = allMinas.filter(m => !m.balanceCalculado || m.balanceDesactualizado);
      
      // QUERY 2: Transacciones agregadas solo para minas que necesitan cálculo (1 query para todas)
      let transaccionesStatsMap = new Map<number, number>();
      if (minasNecesitanCalculo.length > 0) {
        const transaccionesStart = Date.now();
        const minaIds = minasNecesitanCalculo.map(m => m.id.toString());
        
        // Construir condiciones OR para cada mina
        const transaccionesConditions = [
          eq(transacciones.oculta, false),
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), inArray(transacciones.deQuienId, minaIds)),
            and(eq(transacciones.paraQuienTipo, 'mina'), inArray(transacciones.paraQuienId, minaIds))
          )
        ];
        
        const transaccionesStats = await db
          .select({
            minaId: sql<string>`CASE 
              WHEN ${transacciones.deQuienTipo} = 'mina' THEN ${transacciones.deQuienId}
              WHEN ${transacciones.paraQuienTipo} = 'mina' THEN ${transacciones.paraQuienId}
            END`,
            transaccionesNetas: sql<number>`COALESCE(SUM(
              CASE 
                WHEN ${transacciones.deQuienTipo} = 'mina' AND LOWER(${transacciones.concepto}) NOT LIKE '%viaje%' THEN CAST(${transacciones.valor} AS NUMERIC)
                WHEN ${transacciones.paraQuienTipo} = 'mina' AND LOWER(${transacciones.concepto}) NOT LIKE '%viaje%' THEN -CAST(${transacciones.valor} AS NUMERIC)
                WHEN ${transacciones.paraQuienTipo} IN ('rodmar', 'banco') AND LOWER(${transacciones.concepto}) NOT LIKE '%viaje%' THEN CAST(${transacciones.valor} AS NUMERIC)
                ELSE 0
              END
            ), 0)`
          })
          .from(transacciones)
          .where(and(...transaccionesConditions))
          .groupBy(sql`CASE 
            WHEN ${transacciones.deQuienTipo} = 'mina' THEN ${transacciones.deQuienId}
            WHEN ${transacciones.paraQuienTipo} = 'mina' THEN ${transacciones.paraQuienId}
          END`);

        transaccionesStats.forEach(stat => {
          if (stat.minaId) {
            const minaIdNum = parseInt(stat.minaId);
            if (!isNaN(minaIdNum)) {
              transaccionesStatsMap.set(minaIdNum, stat.transaccionesNetas);
            }
          }
        });

        const transaccionesTime = Date.now() - transaccionesStart;
        console.log(`⏱️  [PERF] Query agregada de transacciones: ${transaccionesTime}ms (${minasNecesitanCalculo.length} minas)`);
      }

      // Construir resultado final combinando balances calculados y estadísticas
      for (const mina of allMinas) {
        const stats = viajesStatsMap.get(mina.id) || { viajesCount: 0, viajesUltimoMes: 0, ingresosViajes: 0 };
        
        // Usar balanceCalculado si está disponible y actualizado
        let balance: number;
        if (mina.balanceCalculado && !mina.balanceDesactualizado) {
          balance = parseFloat(mina.balanceCalculado);
        } else {
          // Calcular balance dinámicamente usando datos agregados
          const transaccionesNetas = transaccionesStatsMap.get(mina.id) || 0;
          balance = stats.ingresosViajes + transaccionesNetas;
        }

        balances[mina.id] = {
          balance,
          viajesCount: stats.viajesCount,
          viajesUltimoMes: stats.viajesUltimoMes
        };
      }

      const endTime = Date.now();
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getMinasBalances: ${endTime - startTime}ms (${allMinas.length} minas, ${minasNecesitanCalculo.length} necesitaron cálculo dinámico)`);
      return balances;
    });
  }

  // Obtener balances y estadísticas de todos los compradores sin cargar todos los viajes
  async getCompradoresBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log('🔵 [PERF] getCompradoresBalances() - INICIANDO (OPTIMIZADO)');

      // Obtener todos los compradores con sus balances calculados
      const allCompradores = await this.getCompradores(userId);
      const balances: Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }> = {};

      // Calcular fecha del último mes
      const hoy = new Date();
      const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      
      // Convertir fechas a strings ISO para usar en SQL
      const inicioMesPasadoISO = inicioMesPasado.toISOString();
      const finMesPasadoISO = finMesPasado.toISOString();

      // Preparar condiciones base para queries
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
        eq(viajes.oculta, false),
        sql`${viajes.compradorId} IS NOT NULL`
      ];
      if (userId) {
        viajesConditions.push(eq(viajes.userId, userId));
      }

      // QUERY 1: Estadísticas agregadas de viajes por comprador (1 query para todos los compradores)
      const viajesStatsStart = Date.now();
      const viajesStats = await db
        .select({
          compradorId: viajes.compradorId,
          viajesCount: sql<number>`COUNT(*)::int`,
          viajesUltimoMes: sql<number>`COUNT(CASE WHEN ${viajes.fechaDescargue} >= ${inicioMesPasadoISO}::timestamp AND ${viajes.fechaDescargue} <= ${finMesPasadoISO}::timestamp THEN 1 END)::int`,
          totalDeudaViajes: sql<number>`COALESCE(SUM(CAST(${viajes.valorConsignar} AS NUMERIC)), 0)`
        })
        .from(viajes)
        .where(and(...viajesConditions))
        .groupBy(viajes.compradorId);
      
      const viajesStatsTime = Date.now() - viajesStatsStart;
      console.log(`⏱️  [PERF] Query agregada de viajes: ${viajesStatsTime}ms (${viajesStats.length} compradores)`);

      // Crear map de estadísticas de viajes por comprador
      const viajesStatsMap = new Map<number, { viajesCount: number; viajesUltimoMes: number; totalDeudaViajes: number }>();
      viajesStats.forEach(stat => {
        if (stat.compradorId) {
          viajesStatsMap.set(stat.compradorId, {
            viajesCount: stat.viajesCount,
            viajesUltimoMes: stat.viajesUltimoMes,
            totalDeudaViajes: stat.totalDeudaViajes
          });
        }
      });

      // Identificar compradores que necesitan cálculo dinámico de balance
      const compradoresNecesitanCalculo = allCompradores.filter(c => !c.balanceCalculado);
      
      // QUERY 2: Transacciones agregadas solo para compradores que necesitan cálculo (1 query para todos)
      let transaccionesStatsMap = new Map<number, number>();
      if (compradoresNecesitanCalculo.length > 0) {
        const transaccionesStart = Date.now();
        const compradorIds = compradoresNecesitanCalculo.map(c => c.id.toString());
        
        const transaccionesConditions = [
          eq(transacciones.oculta, false),
          or(
            and(eq(transacciones.deQuienTipo, 'comprador'), inArray(transacciones.deQuienId, compradorIds)),
            and(eq(transacciones.paraQuienTipo, 'comprador'), inArray(transacciones.paraQuienId, compradorIds))
          )
        ];
        
        const transaccionesStats = await db
          .select({
            compradorId: sql<string>`CASE 
              WHEN ${transacciones.deQuienTipo} = 'comprador' THEN ${transacciones.deQuienId}
              WHEN ${transacciones.paraQuienTipo} = 'comprador' THEN ${transacciones.paraQuienId}
            END`,
            transaccionesNetas: sql<number>`COALESCE(SUM(
              CASE 
                WHEN ${transacciones.deQuienTipo} = 'comprador' THEN CAST(${transacciones.valor} AS NUMERIC)
                WHEN ${transacciones.paraQuienTipo} = 'comprador' THEN -CAST(${transacciones.valor} AS NUMERIC)
                ELSE 0
              END
            ), 0)`
          })
          .from(transacciones)
          .where(and(...transaccionesConditions))
          .groupBy(sql`CASE 
            WHEN ${transacciones.deQuienTipo} = 'comprador' THEN ${transacciones.deQuienId}
            WHEN ${transacciones.paraQuienTipo} = 'comprador' THEN ${transacciones.paraQuienId}
          END`);

        transaccionesStats.forEach(stat => {
          if (stat.compradorId) {
            const compradorIdNum = parseInt(stat.compradorId);
            if (!isNaN(compradorIdNum)) {
              transaccionesStatsMap.set(compradorIdNum, stat.transaccionesNetas);
            }
          }
        });

        const transaccionesTime = Date.now() - transaccionesStart;
        console.log(`⏱️  [PERF] Query agregada de transacciones: ${transaccionesTime}ms (${compradoresNecesitanCalculo.length} compradores)`);
      }

      // Construir resultado final combinando balances calculados y estadísticas
      for (const comprador of allCompradores) {
        const stats = viajesStatsMap.get(comprador.id) || { viajesCount: 0, viajesUltimoMes: 0, totalDeudaViajes: 0 };
        
        // Usar balanceCalculado si está disponible
        let balance: number;
        if (comprador.balanceCalculado) {
          balance = parseFloat(comprador.balanceCalculado);
        } else {
          // Calcular balance dinámicamente usando datos agregados
          const transaccionesNetas = transaccionesStatsMap.get(comprador.id) || 0;
          balance = transaccionesNetas - stats.totalDeudaViajes; // Negativo porque totalDeudaViajes es deuda
        }

        balances[comprador.id] = {
          balance,
          viajesCount: stats.viajesCount,
          viajesUltimoMes: stats.viajesUltimoMes
        };
      }

      const endTime = Date.now();
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getCompradoresBalances: ${endTime - startTime}ms (${allCompradores.length} compradores, ${compradoresNecesitanCalculo.length} necesitaron cálculo dinámico)`);
      return balances;
    });
  }

  // Obtener balances y estadísticas de todos los volqueteros sin cargar todos los viajes
  async getVolqueterosBalances(userId?: string): Promise<Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>> {
    return wrapDbOperation(async () => {
      const startTime = Date.now();
      console.log('🔵 [PERF] getVolqueterosBalances() - INICIANDO (OPTIMIZADO)');

      // Obtener todos los volqueteros
      const allVolqueteros = await this.getVolqueteros(userId);
      const balances: Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }> = {};

      // Calcular fecha del último mes
      const hoy = new Date();
      const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      
      // Convertir fechas a strings ISO para usar en SQL
      const inicioMesPasadoISO = inicioMesPasado.toISOString();
      const finMesPasadoISO = finMesPasado.toISOString();

      // Preparar condiciones base para queries
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
        eq(viajes.oculta, false),
        sql`${viajes.fechaDescargue} IS NOT NULL`,
        sql`${viajes.conductor} IS NOT NULL`
      ];
      if (userId) {
        viajesConditions.push(eq(viajes.userId, userId));
      }

      // Obtener nombres únicos de conductores de todos los volqueteros
      const nombresConductores = allVolqueteros.map(v => v.nombre).filter((n, i, arr) => arr.indexOf(n) === i);

      // QUERY 1: Estadísticas agregadas de viajes por conductor (1 query para todos los volqueteros)
      const viajesStatsStart = Date.now();
      const viajesStats = await db
        .select({
          conductor: viajes.conductor,
          viajesCount: sql<number>`COUNT(*)::int`,
          viajesUltimoMes: sql<number>`COUNT(CASE WHEN ${viajes.fechaDescargue} >= ${inicioMesPasadoISO}::timestamp AND ${viajes.fechaDescargue} <= ${finMesPasadoISO}::timestamp THEN 1 END)::int`,
          ingresosFletes: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${viajes.quienPagaFlete} NOT IN ('comprador', 'El comprador') 
              THEN CAST(${viajes.totalFlete} AS NUMERIC)
              ELSE 0
            END
          ), 0)`
        })
        .from(viajes)
        .where(and(...viajesConditions))
        .groupBy(viajes.conductor);
      
      const viajesStatsTime = Date.now() - viajesStatsStart;
      console.log(`⏱️  [PERF] Query agregada de viajes: ${viajesStatsTime}ms (${viajesStats.length} conductores)`);

      // Crear map de estadísticas de viajes por nombre de conductor
      const viajesStatsMap = new Map<string, { viajesCount: number; viajesUltimoMes: number; ingresosFletes: number }>();
      viajesStats.forEach(stat => {
        if (stat.conductor) {
          viajesStatsMap.set(stat.conductor, {
            viajesCount: stat.viajesCount,
            viajesUltimoMes: stat.viajesUltimoMes,
            ingresosFletes: stat.ingresosFletes
          });
        }
      });

      // QUERY 2: Transacciones agregadas por volquetero (1 query para todos los volqueteros)
      const transaccionesStart = Date.now();
      const volqueteroIds = allVolqueteros.map(v => v.id.toString());
      
      const transaccionesConditions = [
        eq(transacciones.oculta, false),
        or(
          and(eq(transacciones.deQuienTipo, 'volquetero'), inArray(transacciones.deQuienId, volqueteroIds)),
          and(eq(transacciones.paraQuienTipo, 'volquetero'), inArray(transacciones.paraQuienId, volqueteroIds))
        )
      ];
      
      const transaccionesStats = await db
        .select({
          volqueteroId: sql<string>`CASE 
            WHEN ${transacciones.deQuienTipo} = 'volquetero' THEN ${transacciones.deQuienId}
            WHEN ${transacciones.paraQuienTipo} = 'volquetero' THEN ${transacciones.paraQuienId}
          END`,
          ingresos: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${transacciones.deQuienTipo} = 'volquetero' THEN ABS(CAST(${transacciones.valor} AS NUMERIC))
              ELSE 0
            END
          ), 0)`,
          egresos: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${transacciones.paraQuienTipo} = 'volquetero' THEN ABS(CAST(${transacciones.valor} AS NUMERIC))
              ELSE 0
            END
          ), 0)`
        })
        .from(transacciones)
        .where(and(...transaccionesConditions))
        .groupBy(sql`CASE 
          WHEN ${transacciones.deQuienTipo} = 'volquetero' THEN ${transacciones.deQuienId}
          WHEN ${transacciones.paraQuienTipo} = 'volquetero' THEN ${transacciones.paraQuienId}
        END`);

      // Crear map de transacciones por volquetero
      const transaccionesStatsMap = new Map<number, { ingresos: number; egresos: number }>();
      transaccionesStats.forEach(stat => {
        if (stat.volqueteroId) {
          const volqueteroIdNum = parseInt(stat.volqueteroId);
          if (!isNaN(volqueteroIdNum)) {
            transaccionesStatsMap.set(volqueteroIdNum, {
              ingresos: stat.ingresos,
              egresos: stat.egresos
            });
          }
        }
      });

      const transaccionesTime = Date.now() - transaccionesStart;
      console.log(`⏱️  [PERF] Query agregada de transacciones: ${transaccionesTime}ms (${allVolqueteros.length} volqueteros)`);

      // Construir resultado final combinando balances y estadísticas
      for (const volquetero of allVolqueteros) {
        const viajesStats = viajesStatsMap.get(volquetero.nombre) || { viajesCount: 0, viajesUltimoMes: 0, ingresosFletes: 0 };
        const transaccionesStats = transaccionesStatsMap.get(volquetero.id) || { ingresos: 0, egresos: 0 };
        
        // Calcular balance: ingresos (fletes + transacciones) - egresos (transacciones)
        const balance = viajesStats.ingresosFletes + transaccionesStats.ingresos - transaccionesStats.egresos;

        balances[volquetero.id] = {
          balance,
          viajesCount: viajesStats.viajesCount,
          viajesUltimoMes: viajesStats.viajesUltimoMes
        };
      }

      const endTime = Date.now();
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getVolqueterosBalances: ${endTime - startTime}ms (${allVolqueteros.length} volqueteros)`);
      return balances;
    });
  }
}