import {
  users,
  minas,
  compradores,
  volqueteros,
  viajes,
  transacciones,
  inversiones,
  fusionBackups,
  pushSubscriptions,
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
  type FusionBackup,
  type PushSubscription,
  type InsertPushSubscription
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, isNull, inArray, ne } from "drizzle-orm";
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

    // Obtener el viaje ANTES de actualizarlo para poder actualizar balances de socios anteriores
    const [oldViaje] = await db
      .select()
      .from(viajes)
      .where(and(...conditions))
      .limit(1);

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
    // Pasar tanto el viaje anterior como el actualizado para actualizar balances de ambos
    if (updatedViaje) {
      await this.updateViajeRelatedBalances(updatedViaje, oldViaje);
    }

    return updatedViaje;
  }

  async deleteViaje(id: string, userId?: string): Promise<boolean> {
    // Obtener el viaje ANTES de eliminarlo para recalcular balances
    // No filtrar por userId aquí porque muchos viajes pueden tener userId NULL
    const [viajeToDelete] = await db
      .select()
      .from(viajes)
      .where(eq(viajes.id, id));
    
    if (!viajeToDelete) {
      console.log(`⚠️ [deleteViaje] Viaje ${id} no encontrado`);
      return false;
    }

    // Eliminar el viaje (NO filtrar por userId - similar a hideViaje)
    // Muchos viajes pueden tener userId NULL o diferente
    const result = await db
      .delete(viajes)
      .where(eq(viajes.id, id))
      .returning();
    
    // Si se eliminó exitosamente, recalcular balances
    if (result.length > 0) {
      console.log(`✅ [deleteViaje] Viaje ${id} eliminado, recalculando balances...`);
      await this.updateViajeRelatedBalances(viajeToDelete);
      console.log(`✅ [deleteViaje] Balances recalculados para viaje ${id}`);
    } else {
      console.log(`⚠️ [deleteViaje] No se pudo eliminar viaje ${id}`);
    }
    
    return result.length > 0;
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
          estado: transacciones.estado,
          detalle_solicitud: transacciones.detalle_solicitud,
          codigo_solicitud: transacciones.codigo_solicitud,
          tiene_voucher: transacciones.tiene_voucher,
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

  // Obtener todas las transacciones incluyendo las ocultas (para contar ocultas)
  async getTransaccionesIncludingHidden(userId?: string): Promise<TransaccionWithSocio[]> {
    return wrapDbOperation(async () => {
      const conditions: any[] = []; // Sin filtro de oculta
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

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
          tipoSocio: transacciones.deQuienTipo,
          socioId: transacciones.deQuienId,
          createdAt: transacciones.horaInterna,
        })
        .from(transacciones)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna));

      // Mapear resultados (sin joins para optimizar - solo para contar)
      // Retornar como TransaccionWithSocio para compatibilidad
      return results.map((t: any) => ({
        ...t,
        deQuien: null,
        paraQuien: null,
        socioNombre: '',
        voucher: null,
        socioId: t.socioId ? (typeof t.socioId === 'string' ? parseInt(t.socioId) || null : t.socioId) : null,
      } as TransaccionWithSocio));
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
    // Solo si la transacción NO está pendiente (las pendientes no afectan balances)
    if (newTransaccion.estado !== 'pendiente') {
      await this.updateRelatedBalances(newTransaccion);
    }

    return newTransaccion;
  }

  // Crear transacción pendiente (solicitud)
  async createTransaccionPendiente(
    transaccion: InsertTransaccion & { 
      userId?: string;
      detalle_solicitud?: string;
    }
  ): Promise<Transaccion> {
    // Generar código único para la solicitud (TX-{id} se generará después, pero preparamos el formato)
    const [newTransaccion] = await db.insert(transacciones).values({
      ...transaccion,
      estado: 'pendiente',
      deQuienTipo: null, // Origen no definido aún
      deQuienId: null,
      formaPago: transaccion.formaPago || 'pendiente', // Valor temporal
      userId: transaccion.userId || 'main_user',
      detalle_solicitud: transaccion.detalle_solicitud || null,
      tiene_voucher: false,
    } as any).returning();

    // Generar código de solicitud basado en el ID
    const codigoSolicitud = `TX-${newTransaccion.id}`;
    await db
      .update(transacciones)
      .set({ codigo_solicitud: codigoSolicitud })
      .where(eq(transacciones.id, newTransaccion.id));

    // Las transacciones pendientes NO afectan balances
    // No llamamos a updateRelatedBalances

    return { ...newTransaccion, codigo_solicitud: codigoSolicitud } as Transaccion;
  }

  // Obtener todas las transacciones pendientes
  async getTransaccionesPendientes(userId?: string): Promise<TransaccionWithSocio[]> {
    return wrapDbOperation(async () => {
      const conditions = [
        eq(transacciones.estado, 'pendiente'),
        eq(transacciones.oculta, false)
      ];
      
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

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
          estado: transacciones.estado,
          detalle_solicitud: transacciones.detalle_solicitud,
          codigo_solicitud: transacciones.codigo_solicitud,
          tiene_voucher: transacciones.tiene_voucher,
          userId: transacciones.userId,
          tipoSocio: transacciones.deQuienTipo,
          createdAt: transacciones.horaInterna,
          hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END`
        })
        .from(transacciones)
        .where(and(...conditions))
        .orderBy(desc(transacciones.fecha), desc(transacciones.horaInterna));

      // OPTIMIZACIÓN: Batch loading de nombres - cargar todos los nombres en 3 queries
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

      // Procesar resultados para incluir info de socios
      const processedResults = results.map((t) => {
        let socioNombre = 'Desconocido';
        
        // Determinar el socio principal (destino en solicitudes)
        if (t.paraQuienTipo && t.paraQuienId && ['mina', 'comprador', 'volquetero'].includes(t.paraQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.paraQuienTipo, parseInt(t.paraQuienId), minasMap, compradoresMap, volqueterosMap);
        } else if (t.deQuienTipo && t.deQuienId && ['mina', 'comprador', 'volquetero'].includes(t.deQuienTipo)) {
          socioNombre = this.getSocioNombreFromMap(t.deQuienTipo, parseInt(t.deQuienId), minasMap, compradoresMap, volqueterosMap);
        }

        // Actualizar concepto dinámicamente con nombres actuales
        const conceptoActualizado = this.updateConceptoWithCurrentNamesSync(t, minasMap, compradoresMap, volqueterosMap);
        
        return {
          ...t,
          socioNombre,
          concepto: conceptoActualizado,
          voucher: null, // Excluir voucher para optimización
        };
      });

      return processedResults;
    });
  }

  // Contar transacciones pendientes
  async countTransaccionesPendientes(userId?: string): Promise<number> {
    return wrapDbOperation(async () => {
      const conditions = [
        eq(transacciones.estado, 'pendiente'),
        eq(transacciones.oculta, false)
      ];
      
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transacciones)
        .where(and(...conditions));

      return Number(result?.count || 0);
    });
  }

  // Completar transacción pendiente
  async completarTransaccionPendiente(
    id: number,
    updates: {
      deQuienTipo: string;
      deQuienId: string;
      formaPago: string;
      fecha?: string | Date;
      voucher?: string;
      userId?: string;
    }
  ): Promise<Transaccion | undefined> {
    return wrapDbOperation(async () => {
      // Verificar que la transacción existe y está pendiente
      const [transaccion] = await db
        .select()
        .from(transacciones)
        .where(and(
          eq(transacciones.id, id),
          eq(transacciones.estado, 'pendiente')
        ))
        .limit(1);

      if (!transaccion) {
        throw new Error(`Transacción ${id} no encontrada o no está pendiente`);
      }

      // Convertir fecha si viene como string
      let fechaDate: Date | undefined;
      if (updates.fecha) {
        if (typeof updates.fecha === 'string') {
          // Si viene como string YYYY-MM-DD, convertir a Date
          fechaDate = new Date(updates.fecha + 'T00:00:00');
        } else {
          fechaDate = updates.fecha;
        }
      }

      // Generar concepto con el formato: ${formaPago} de ${deQuienTipo} (${deQuienNombre}) a ${paraQuienTipo} (${paraQuienNombre})
      let deQuienNombre = "Desconocido";
      let paraQuienNombre = "Desconocido";
      
      try {
        // Obtener nombre de origen
        switch (updates.deQuienTipo) {
          case "mina":
            const minaOrigen = await this.getMinaById(parseInt(updates.deQuienId), updates.userId);
            deQuienNombre = minaOrigen?.nombre || updates.deQuienId;
            break;
          case "comprador":
            const compradorOrigen = await this.getCompradorById(parseInt(updates.deQuienId), updates.userId);
            deQuienNombre = compradorOrigen?.nombre || updates.deQuienId;
            break;
          case "volquetero":
            const volqueteroOrigen = await this.getVolqueteroById(parseInt(updates.deQuienId), updates.userId);
            deQuienNombre = volqueteroOrigen?.nombre || updates.deQuienId;
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
            deQuienNombre = rodmarOptions[updates.deQuienId] || updates.deQuienId;
            break;
          case "banco":
            deQuienNombre = "Banco";
            break;
          case "lcdm":
            deQuienNombre = "La Casa del Motero";
            break;
          case "postobon":
            deQuienNombre = "Postobón";
            break;
          default:
            deQuienNombre = updates.deQuienId;
        }

        // Obtener nombre de destino
        switch (transaccion.paraQuienTipo) {
          case "mina":
            const minaDestino = await this.getMinaById(parseInt(transaccion.paraQuienId || ''), updates.userId);
            paraQuienNombre = minaDestino?.nombre || transaccion.paraQuienId || "Desconocido";
            break;
          case "comprador":
            const compradorDestino = await this.getCompradorById(parseInt(transaccion.paraQuienId || ''), updates.userId);
            paraQuienNombre = compradorDestino?.nombre || transaccion.paraQuienId || "Desconocido";
            break;
          case "volquetero":
            const volqueteroDestino = await this.getVolqueteroById(parseInt(transaccion.paraQuienId || ''), updates.userId);
            paraQuienNombre = volqueteroDestino?.nombre || transaccion.paraQuienId || "Desconocido";
            break;
          case "rodmar":
            const rodmarOptionsDest: Record<string, string> = {
              "bemovil": "Bemovil",
              "corresponsal": "Corresponsal",
              "efectivo": "Efectivo",
              "cuentas-german": "Cuentas German",
              "cuentas-jhon": "Cuentas Jhon",
              "otras": "Otras",
            };
            paraQuienNombre = rodmarOptionsDest[transaccion.paraQuienId || ''] || transaccion.paraQuienId || "Desconocido";
            break;
          case "banco":
            paraQuienNombre = "Banco";
            break;
          case "lcdm":
            paraQuienNombre = "La Casa del Motero";
            break;
          case "postobon":
            paraQuienNombre = "Postobón";
            break;
          default:
            paraQuienNombre = transaccion.paraQuienId || "Desconocido";
        }
      } catch (error) {
        console.error("Error obteniendo nombres para concepto:", error);
      }

      const deQuienTipoCapitalizado = updates.deQuienTipo.charAt(0).toUpperCase() + updates.deQuienTipo.slice(1);
      const paraQuienTipoCapitalizado = (transaccion.paraQuienTipo || '').charAt(0).toUpperCase() + (transaccion.paraQuienTipo || '').slice(1);
      const conceptoGenerado = `${updates.formaPago} de ${deQuienTipoCapitalizado} (${deQuienNombre}) a ${paraQuienTipoCapitalizado} (${paraQuienNombre})`;

      // Actualizar la transacción
      const [updatedTransaccion] = await db
        .update(transacciones)
        .set({
          estado: 'completada',
          deQuienTipo: updates.deQuienTipo,
          deQuienId: updates.deQuienId,
          formaPago: updates.formaPago,
          fecha: fechaDate || transaccion.fecha,
          voucher: updates.voucher || transaccion.voucher,
          tiene_voucher: !!(updates.voucher || transaccion.voucher),
          concepto: conceptoGenerado,
        } as any)
        .where(eq(transacciones.id, id))
        .returning();

      if (updatedTransaccion) {
        // Ahora que está completada, actualizar balances
        await this.updateRelatedBalances(updatedTransaccion);
      }

      return updatedTransaccion;
    });
  }

  async updateTransaccion(id: number, updates: Partial<InsertTransaccion>, userId?: string): Promise<Transaccion | undefined> {
    const conditions = [eq(transacciones.id, id)];
    if (userId) {
      conditions.push(eq(transacciones.userId, userId));
    }

    // Obtener transacción original ANTES de actualizar para poder actualizar balances de socios anteriores
    const [oldTransaccion] = await db
      .select()
      .from(transacciones)
      .where(and(...conditions))
      .limit(1);

    const [updatedTransaccion] = await db
      .update(transacciones)
      .set(updates as any)
      .where(and(...conditions))
      .returning();

    // Actualizar balances calculados después de actualizar la transacción
    // Pasar tanto la transacción anterior como la actualizada para actualizar balances de ambos
    if (updatedTransaccion) {
      await this.updateRelatedBalances(updatedTransaccion, oldTransaccion);
    }

    return updatedTransaccion;
  }

  async deleteTransaccion(id: number, userId?: string): Promise<boolean> {
    // Obtener la transacción ANTES de eliminarla para recalcular balances
    // No filtrar por userId aquí porque muchas transacciones pueden tener userId NULL
    const [transaccionToDelete] = await db
      .select()
      .from(transacciones)
      .where(eq(transacciones.id, id));
    
    if (!transaccionToDelete) {
      console.log(`⚠️ [deleteTransaccion] Transacción ${id} no encontrada`);
      return false;
    }

    // Eliminar la transacción (NO filtrar por userId - similar a hideTransaccion)
    // Muchas transacciones pueden tener userId NULL o diferente
    const result = await db
      .delete(transacciones)
      .where(eq(transacciones.id, id))
      .returning();
    
    // Si se eliminó exitosamente, recalcular balances
    if (result.length > 0) {
      console.log(`✅ [deleteTransaccion] Transacción ${id} eliminada, recalculando balances...`);
      console.log(`🔍 [deleteTransaccion] Transacción a procesar:`, {
        id: transaccionToDelete.id,
        deQuienTipo: transaccionToDelete.deQuienTipo,
        deQuienId: transaccionToDelete.deQuienId,
        paraQuienTipo: transaccionToDelete.paraQuienTipo,
        paraQuienId: transaccionToDelete.paraQuienId,
      });
      try {
        await this.updateRelatedBalances(transaccionToDelete);
        console.log(`✅ [deleteTransaccion] updateRelatedBalances completado para transacción ${id}`);
      } catch (error) {
        console.error(`❌ [deleteTransaccion] Error en updateRelatedBalances:`, error);
        throw error; // Re-lanzar para que el endpoint sepa que hubo un error
      }
      console.log(`✅ [deleteTransaccion] Balances recalculados para transacción ${id}`);
    } else {
      console.log(`⚠️ [deleteTransaccion] No se pudo eliminar transacción ${id}`);
    }
    
    return result.length > 0;
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
    return wrapDbOperation(async () => {
      // Buscar transacciones que VIENEN DESDE el socio O que VAN HACIA el socio
      const conditionsFrom = [
        eq(transacciones.deQuienTipo, tipoSocio), 
        eq(transacciones.deQuienId, socioId.toString())
      ];
      const conditionsTo = [
        eq(transacciones.paraQuienTipo, tipoSocio), 
        eq(transacciones.paraQuienId, socioId.toString())
      ];
      
      // NOTA: Las transacciones pendientes SÍ aparecen en las listas (para visualización)
      // pero NO afectan los cálculos de balance (se excluyen en updateRelatedBalances)
      
      // Solo agregar filtro de ocultas específico del módulo si no se incluyen las ocultas
      // IMPORTANTE: Usar SQL directo para manejar null correctamente - incluir transacciones con null O false
      // NOTA: Las transacciones con null en ocultaEn* deben tratarse como no ocultas (visible)
      if (!includeHidden) {
        switch (modulo) {
          case 'comprador':
            // Incluir transacciones con ocultaEnComprador = false O null (transacciones antiguas)
            conditionsFrom.push(sql`(${transacciones.ocultaEnComprador} IS NULL OR ${transacciones.ocultaEnComprador} = false)`);
            conditionsTo.push(sql`(${transacciones.ocultaEnComprador} IS NULL OR ${transacciones.ocultaEnComprador} = false)`);
            break;
          case 'mina':
            // Incluir transacciones con ocultaEnMina = false O null (transacciones antiguas)
            conditionsFrom.push(sql`(${transacciones.ocultaEnMina} IS NULL OR ${transacciones.ocultaEnMina} = false)`);
            conditionsTo.push(sql`(${transacciones.ocultaEnMina} IS NULL OR ${transacciones.ocultaEnMina} = false)`);
            break;
          case 'volquetero':
            // Incluir transacciones con ocultaEnVolquetero = false O null (transacciones antiguas)
            conditionsFrom.push(sql`(${transacciones.ocultaEnVolquetero} IS NULL OR ${transacciones.ocultaEnVolquetero} = false)`);
            conditionsTo.push(sql`(${transacciones.ocultaEnVolquetero} IS NULL OR ${transacciones.ocultaEnVolquetero} = false)`);
            break;
          case 'general':
          default:
            // Incluir transacciones con ocultaEnGeneral = false O null (transacciones antiguas)
            conditionsFrom.push(sql`(${transacciones.ocultaEnGeneral} IS NULL OR ${transacciones.ocultaEnGeneral} = false)`);
            conditionsTo.push(sql`(${transacciones.ocultaEnGeneral} IS NULL OR ${transacciones.ocultaEnGeneral} = false)`);
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
          estado: transacciones.estado,
          detalle_solicitud: transacciones.detalle_solicitud,
          codigo_solicitud: transacciones.codigo_solicitud,
          tiene_voucher: transacciones.tiene_voucher,
          userId: transacciones.userId,
          updatedAt: transacciones.updatedAt,
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
          estado: transacciones.estado,
          detalle_solicitud: transacciones.detalle_solicitud,
          codigo_solicitud: transacciones.codigo_solicitud,
          tiene_voucher: transacciones.tiene_voucher,
          userId: transacciones.userId,
          updatedAt: transacciones.updatedAt,
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

      // Ordenar transacciones: completadas por fecha de finalización (updatedAt), pendientes por fecha de solicitud (fecha)
      uniqueResults.sort((a, b) => {
        // Para transacciones completadas, usar updatedAt (fecha de finalización)
        // Para transacciones pendientes, usar fecha (fecha de solicitud)
        const getSortDate = (transaction: any) => {
          if (transaction.estado === 'completada' && transaction.updatedAt) {
            return new Date(transaction.updatedAt).getTime();
          }
          return new Date(transaction.fecha || 0).getTime();
        };
        
        const dateA = getSortDate(a);
        const dateB = getSortDate(b);
        
        return dateB - dateA; // Más reciente primero
      });

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
    });
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
    console.log(`🔍 [hideViaje] Attempting to hide viaje ID: ${id}`);
    // Solo buscar por ID, no filtrar por userId
    // Muchos viajes pueden tener userId NULL o diferente
    const conditions = [eq(viajes.id, id)];

    const result = await db
      .update(viajes)
      .set({ oculta: true })
      .where(and(...conditions))
      .returning(); // Añadir .returning() para obtener las filas actualizadas
    
    console.log(`🔍 [hideViaje] ID: ${id}, result length: ${result.length}, Result:`, result);
    return result.length > 0; // Verificar si se actualizó al menos una fila
  }

  async showViaje(id: string, userId?: string): Promise<boolean> {
    console.log(`🔍 [showViaje] Attempting to show viaje ID: ${id}`);
    // Solo buscar por ID, no filtrar por userId
    const conditions = [eq(viajes.id, id)];

    const result = await db
      .update(viajes)
      .set({ oculta: false })
      .where(and(...conditions))
      .returning(); // Añadir .returning() para obtener las filas actualizadas
    
    console.log(`🔍 [showViaje] ID: ${id}, result length: ${result.length}`);
    return result.length > 0; // Verificar si se actualizó al menos una fila
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

  // Métodos específicos para mostrar elementos ocultos de volqueteros
  async showAllHiddenTransaccionesForVolquetero(volqueteroId: number, userId?: string): Promise<number> {
    try {
      console.log(`🔍 [showAllHiddenTransaccionesForVolquetero] Volquetero ID: ${volqueteroId}`);
      
      // Mostrar transacciones ocultas que estén relacionadas con este volquetero específico
      // Buscar por ocultaEnVolquetero: true y que el volquetero sea origen o destino
      const conditions = [
        eq(transacciones.ocultaEnVolquetero, true),
        or(
          // Transacciones donde el volquetero es el origen
          and(eq(transacciones.deQuienTipo, 'volquetero'), eq(transacciones.deQuienId, volqueteroId.toString())),
          // Transacciones donde el volquetero es el destino  
          and(eq(transacciones.paraQuienTipo, 'volquetero'), eq(transacciones.paraQuienId, volqueteroId.toString()))
        )
      ];
      
      if (userId) {
        conditions.push(eq(transacciones.userId, userId));
      }

      const result = await db
        .update(transacciones)
        .set({ ocultaEnVolquetero: false })
        .where(and(...conditions))
        .returning();
      
      console.log(`✅ [showAllHiddenTransaccionesForVolquetero] Restauradas ${result.length} transacciones`);
      return result.length;
    } catch (error) {
      console.error('❌ [showAllHiddenTransaccionesForVolquetero] Error:', error);
      throw error;
    }
  }

  async showAllHiddenViajesForVolquetero(volqueteroNombre: string, userId?: string): Promise<number> {
    try {
      console.log(`🔍 [showAllHiddenViajesForVolquetero] Volquetero: ${volqueteroNombre}`);
      
      // Mostrar viajes ocultos que pertenezcan a este volquetero específico (por conductor)
      const conditions = [
        eq(viajes.oculta, true),
        eq(viajes.conductor, volqueteroNombre)
      ];
      
      if (userId) {
        conditions.push(eq(viajes.userId, userId));
      }

      const result = await db
        .update(viajes)
        .set({ oculta: false })
        .where(and(...conditions))
        .returning();
      
      console.log(`✅ [showAllHiddenViajesForVolquetero] Restaurados ${result.length} viajes`);
      return result.length;
    } catch (error) {
      console.error('❌ [showAllHiddenViajesForVolquetero] Error:', error);
      throw error;
    }
  }

  // ===== MÉTODOS PARA BALANCE CALCULADO =====

  // Actualizar balances después de transacción
  // Actualizar balances después de transacción (ESTRATEGIA HÍBRIDA OPTIMIZADA)
  // oldTransaccion es opcional y se usa cuando se actualiza una transacción para también actualizar balances de socios anteriores
  async updateRelatedBalances(transaccion: Transaccion, oldTransaccion?: Transaccion): Promise<void> {
    try {
      // IMPORTANTE: Las transacciones pendientes NO afectan balances
      // Si la transacción es pendiente, no actualizar balances
      if (transaccion.estado === 'pendiente') {
        console.log(`⏭️  [updateRelatedBalances] Transacción ${transaccion.id} está pendiente, no se actualizan balances`);
        return;
      }
      
      // Si hay una transacción anterior y era pendiente, tampoco afectaba balances, así que no hay que revertir nada
      if (oldTransaccion && oldTransaccion.estado === 'pendiente') {
        console.log(`⏭️  [updateRelatedBalances] Transacción anterior ${oldTransaccion.id} era pendiente, no se revierten balances`);
        // Continuar con la actualización normal de la nueva transacción
      }
      const affectedPartners: Array<{ tipo: 'mina' | 'comprador' | 'volquetero'; id: number }> = [];
      const processedPartnerIds = new Set<string>(); // Para evitar procesar el mismo socio dos veces
      
      // Identificar socios afectados del origen NUEVO (marcar stale síncronamente)
      if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId) {
        const minaId = parseInt(transaccion.deQuienId);
        if (!isNaN(minaId) && minaId > 0) {
          const key = `mina-${minaId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markMinaBalanceStale(minaId);
            affectedPartners.push({ tipo: 'mina', id: minaId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId) {
        const minaId = parseInt(transaccion.paraQuienId);
        if (!isNaN(minaId) && minaId > 0) {
          const key = `mina-${minaId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markMinaBalanceStale(minaId);
            affectedPartners.push({ tipo: 'mina', id: minaId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId) {
        const compradorId = parseInt(transaccion.deQuienId);
        if (!isNaN(compradorId) && compradorId > 0) {
          const key = `comprador-${compradorId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markCompradorBalanceStale(compradorId);
            affectedPartners.push({ tipo: 'comprador', id: compradorId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      if (transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId) {
        const compradorId = parseInt(transaccion.paraQuienId);
        if (!isNaN(compradorId) && compradorId > 0) {
          const key = `comprador-${compradorId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markCompradorBalanceStale(compradorId);
            affectedPartners.push({ tipo: 'comprador', id: compradorId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      if (transaccion.deQuienTipo === 'volquetero' && transaccion.deQuienId) {
        const volqueteroId = parseInt(transaccion.deQuienId);
        if (!isNaN(volqueteroId) && volqueteroId > 0) {
          const key = `volquetero-${volqueteroId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markVolqueteroBalanceStale(volqueteroId);
            affectedPartners.push({ tipo: 'volquetero', id: volqueteroId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      if (transaccion.paraQuienTipo === 'volquetero' && transaccion.paraQuienId) {
        const volqueteroId = parseInt(transaccion.paraQuienId);
        if (!isNaN(volqueteroId) && volqueteroId > 0) {
          const key = `volquetero-${volqueteroId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markVolqueteroBalanceStale(volqueteroId);
            affectedPartners.push({ tipo: 'volquetero', id: volqueteroId });
            processedPartnerIds.add(key);
          }
        }
      }
      
      // Si hay una transacción anterior, también actualizar balances de sus socios (si son diferentes)
      if (oldTransaccion) {
        // Si el origen cambió, actualizar balance del origen anterior
        const oldOrigenKey = oldTransaccion.deQuienTipo && oldTransaccion.deQuienId 
          ? `${oldTransaccion.deQuienTipo}-${oldTransaccion.deQuienId}` 
          : null;
        const newOrigenKey = transaccion.deQuienTipo && transaccion.deQuienId 
          ? `${transaccion.deQuienTipo}-${transaccion.deQuienId}` 
          : null;
        
        if (oldOrigenKey && oldOrigenKey !== newOrigenKey) {
          // El origen cambió o se eliminó
          if (oldTransaccion.deQuienTipo === 'mina' && oldTransaccion.deQuienId) {
            const minaId = parseInt(oldTransaccion.deQuienId);
            if (!isNaN(minaId) && minaId > 0) {
              const key = `mina-${minaId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markMinaBalanceStale(minaId);
                affectedPartners.push({ tipo: 'mina', id: minaId });
                processedPartnerIds.add(key);
              }
            }
          } else if (oldTransaccion.deQuienTipo === 'comprador' && oldTransaccion.deQuienId) {
            const compradorId = parseInt(oldTransaccion.deQuienId);
            if (!isNaN(compradorId) && compradorId > 0) {
              const key = `comprador-${compradorId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markCompradorBalanceStale(compradorId);
                affectedPartners.push({ tipo: 'comprador', id: compradorId });
                processedPartnerIds.add(key);
              }
            }
          } else if (oldTransaccion.deQuienTipo === 'volquetero' && oldTransaccion.deQuienId) {
            const volqueteroId = parseInt(oldTransaccion.deQuienId);
            if (!isNaN(volqueteroId) && volqueteroId > 0) {
              const key = `volquetero-${volqueteroId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markVolqueteroBalanceStale(volqueteroId);
                affectedPartners.push({ tipo: 'volquetero', id: volqueteroId });
                processedPartnerIds.add(key);
              }
            }
          }
        }
        
        // Si el destino cambió, actualizar balance del destino anterior
        const oldDestinoKey = oldTransaccion.paraQuienTipo && oldTransaccion.paraQuienId 
          ? `${oldTransaccion.paraQuienTipo}-${oldTransaccion.paraQuienId}` 
          : null;
        const newDestinoKey = transaccion.paraQuienTipo && transaccion.paraQuienId 
          ? `${transaccion.paraQuienTipo}-${transaccion.paraQuienId}` 
          : null;
        
        if (oldDestinoKey && oldDestinoKey !== newDestinoKey) {
          // El destino cambió o se eliminó
          if (oldTransaccion.paraQuienTipo === 'mina' && oldTransaccion.paraQuienId) {
            const minaId = parseInt(oldTransaccion.paraQuienId);
            if (!isNaN(minaId) && minaId > 0) {
              const key = `mina-${minaId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markMinaBalanceStale(minaId);
                affectedPartners.push({ tipo: 'mina', id: minaId });
                processedPartnerIds.add(key);
              }
            }
          } else if (oldTransaccion.paraQuienTipo === 'comprador' && oldTransaccion.paraQuienId) {
            const compradorId = parseInt(oldTransaccion.paraQuienId);
            if (!isNaN(compradorId) && compradorId > 0) {
              const key = `comprador-${compradorId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markCompradorBalanceStale(compradorId);
                affectedPartners.push({ tipo: 'comprador', id: compradorId });
                processedPartnerIds.add(key);
              }
            }
          } else if (oldTransaccion.paraQuienTipo === 'volquetero' && oldTransaccion.paraQuienId) {
            const volqueteroId = parseInt(oldTransaccion.paraQuienId);
            if (!isNaN(volqueteroId) && volqueteroId > 0) {
              const key = `volquetero-${volqueteroId}`;
              if (!processedPartnerIds.has(key)) {
                await this.markVolqueteroBalanceStale(volqueteroId);
                affectedPartners.push({ tipo: 'volquetero', id: volqueteroId });
                processedPartnerIds.add(key);
              }
            }
          }
        }
      }
      
      // Recalcular balances síncronamente para asegurar que estén actualizados antes de consultas
      if (affectedPartners.length > 0) {
        const balanceMap: Map<string, string> = new Map(); // tipo:id -> balance
        
        for (const partner of affectedPartners) {
          try {
            if (partner.tipo === 'mina') {
              await this.calculateAndUpdateMinaBalance(partner.id);
              // Obtener el balance actualizado
              const [mina] = await db.select({ balanceCalculado: minas.balanceCalculado })
                .from(minas)
                .where(eq(minas.id, partner.id));
              if (mina?.balanceCalculado) {
                balanceMap.set(`${partner.tipo}:${partner.id}`, mina.balanceCalculado);
              }
            } else if (partner.tipo === 'comprador') {
              await this.calculateAndUpdateCompradorBalance(partner.id);
              // Obtener el balance actualizado
              const [comprador] = await db.select({ balanceCalculado: compradores.balanceCalculado })
                .from(compradores)
                .where(eq(compradores.id, partner.id));
              if (comprador?.balanceCalculado) {
                balanceMap.set(`${partner.tipo}:${partner.id}`, comprador.balanceCalculado);
              }
            } else if (partner.tipo === 'volquetero') {
              await this.calculateAndUpdateVolqueteroBalance(partner.id);
              // Obtener el balance actualizado
              const [volquetero] = await db.select({ balanceCalculado: volqueteros.balanceCalculado })
                .from(volqueteros)
                .where(eq(volqueteros.id, partner.id));
              if (volquetero?.balanceCalculado) {
                balanceMap.set(`${partner.tipo}:${partner.id}`, volquetero.balanceCalculado);
              }
            }
          } catch (error) {
            console.error(`Error recalculando balance de ${partner.tipo} ${partner.id}:`, error);
          }
        }
        
        // Emitir eventos WebSocket después de recalcular
        const io = await import('./socket').then(m => m.getIO());
        const { emitTransactionSpecificUpdates } = await import('./socket');
        
        if (io) {
          // Emitir evento genérico balance-updated (para compatibilidad)
          io.emit('balance-updated', {
            affectedPartners,
            timestamp: new Date().toISOString()
          });

          // Emitir eventos específicos para ambos socios
          if (transaccion.deQuienTipo && transaccion.deQuienId && 
              transaccion.paraQuienTipo && transaccion.paraQuienId) {
            
            const origenBalance = balanceMap.get(`${transaccion.deQuienTipo}:${transaccion.deQuienId}`);
            const destinoBalance = balanceMap.get(`${transaccion.paraQuienTipo}:${transaccion.paraQuienId}`);
            
            emitTransactionSpecificUpdates({
              transactionId: transaccion.id,
              origenTipo: transaccion.deQuienTipo,
              origenId: transaccion.deQuienId,
              destinoTipo: transaccion.paraQuienTipo,
              destinoId: transaccion.paraQuienId,
              nuevoBalanceOrigen: origenBalance,
              nuevoBalanceDestino: destinoBalance,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error en updateRelatedBalances para transacción ${transaccion.id}:`, error);
      // No re-throw para no bloquear la operación principal
    }
  }

  // Actualizar balances después de viaje (ESTRATEGIA HÍBRIDA OPTIMIZADA)
  // oldViaje es opcional y se usa cuando se actualiza un viaje para también actualizar balances de socios anteriores
  async updateViajeRelatedBalances(viaje: Viaje, oldViaje?: Viaje): Promise<void> {
    try {
      const affectedPartners: Array<{ tipo: 'mina' | 'comprador' | 'volquetero'; id: number }> = [];
      const processedPartnerIds = new Set<string>(); // Para evitar procesar el mismo socio dos veces
      
      // Identificar socios afectados del viaje NUEVO (marcar stale síncronamente)
      if (viaje.minaId) {
        const key = `mina-${viaje.minaId}`;
        if (!processedPartnerIds.has(key)) {
          await this.markMinaBalanceStale(viaje.minaId);
          affectedPartners.push({ tipo: 'mina', id: viaje.minaId });
          processedPartnerIds.add(key);
        }
      }
      
      if (viaje.compradorId) {
        const key = `comprador-${viaje.compradorId}`;
        if (!processedPartnerIds.has(key)) {
          await this.markCompradorBalanceStale(viaje.compradorId);
          affectedPartners.push({ tipo: 'comprador', id: viaje.compradorId });
          processedPartnerIds.add(key);
        }
      }
      
      // Si el viaje involucra un volquetero (conductor) y RodMar paga el flete
      if (viaje.conductor && viaje.estado === 'completado' && viaje.fechaDescargue && 
          viaje.quienPagaFlete && viaje.quienPagaFlete !== 'comprador' && viaje.quienPagaFlete !== 'El comprador') {
        // Buscar volquetero por nombre
        const volquetero = await db.select({ id: volqueteros.id })
          .from(volqueteros)
          .where(eq(volqueteros.nombre, viaje.conductor))
          .limit(1);
        
        if (volquetero.length > 0) {
          const key = `volquetero-${volquetero[0].id}`;
          if (!processedPartnerIds.has(key)) {
            await this.markVolqueteroBalanceStale(volquetero[0].id);
            affectedPartners.push({ tipo: 'volquetero', id: volquetero[0].id });
            processedPartnerIds.add(key);
          }
        }
      }
      
      // Si hay un viaje anterior, también actualizar balances de sus socios (si son diferentes)
      if (oldViaje) {
        // Si la mina cambió, actualizar balance de la mina anterior
        if (oldViaje.minaId && oldViaje.minaId !== viaje.minaId) {
          const key = `mina-${oldViaje.minaId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markMinaBalanceStale(oldViaje.minaId);
            affectedPartners.push({ tipo: 'mina', id: oldViaje.minaId });
            processedPartnerIds.add(key);
          }
        }
        
        // Si el comprador cambió, actualizar balance del comprador anterior
        // Nota: Los compradores afectan el balance siempre que el viaje esté completado
        if (oldViaje.compradorId && oldViaje.compradorId !== viaje.compradorId) {
          const key = `comprador-${oldViaje.compradorId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markCompradorBalanceStale(oldViaje.compradorId);
            affectedPartners.push({ tipo: 'comprador', id: oldViaje.compradorId });
            processedPartnerIds.add(key);
          }
        }
        
        // Si el comprador se eliminó (tenía comprador antes pero ahora no), también actualizar
        if (oldViaje.compradorId && !viaje.compradorId) {
          const key = `comprador-${oldViaje.compradorId}`;
          if (!processedPartnerIds.has(key)) {
            await this.markCompradorBalanceStale(oldViaje.compradorId);
            affectedPartners.push({ tipo: 'comprador', id: oldViaje.compradorId });
            processedPartnerIds.add(key);
          }
        }
        
        // Si el conductor cambió, actualizar balance del volquetero anterior
        // Los volqueteros solo afectan el balance cuando el viaje está completado y RodMar paga el flete
        if (oldViaje.conductor && oldViaje.conductor !== viaje.conductor) {
          // Si el viaje anterior estaba completado y afectaba el balance del volquetero
          const oldViajeAfectaVolquetero = oldViaje.estado === 'completado' && 
            oldViaje.fechaDescargue &&
            oldViaje.quienPagaFlete && 
            oldViaje.quienPagaFlete !== 'comprador' && 
            oldViaje.quienPagaFlete !== 'El comprador';
          
          if (oldViajeAfectaVolquetero) {
            const oldVolquetero = await db.select({ id: volqueteros.id })
              .from(volqueteros)
              .where(eq(volqueteros.nombre, oldViaje.conductor))
              .limit(1);
            
            if (oldVolquetero.length > 0) {
              const key = `volquetero-${oldVolquetero[0].id}`;
              if (!processedPartnerIds.has(key)) {
                await this.markVolqueteroBalanceStale(oldVolquetero[0].id);
                affectedPartners.push({ tipo: 'volquetero', id: oldVolquetero[0].id });
                processedPartnerIds.add(key);
              }
            }
          }
        }
        
        // Si el conductor se eliminó (tenía conductor antes pero ahora no) y el viaje anterior afectaba el balance
        if (oldViaje.conductor && !viaje.conductor) {
          const oldViajeAfectaVolquetero = oldViaje.estado === 'completado' && 
            oldViaje.fechaDescargue &&
            oldViaje.quienPagaFlete && 
            oldViaje.quienPagaFlete !== 'comprador' && 
            oldViaje.quienPagaFlete !== 'El comprador';
          
          if (oldViajeAfectaVolquetero) {
            const oldVolquetero = await db.select({ id: volqueteros.id })
              .from(volqueteros)
              .where(eq(volqueteros.nombre, oldViaje.conductor))
              .limit(1);
            
            if (oldVolquetero.length > 0) {
              const key = `volquetero-${oldVolquetero[0].id}`;
              if (!processedPartnerIds.has(key)) {
                await this.markVolqueteroBalanceStale(oldVolquetero[0].id);
                affectedPartners.push({ tipo: 'volquetero', id: oldVolquetero[0].id });
                processedPartnerIds.add(key);
              }
            }
          }
        }
      }
      
      // Recalcular balances síncronamente para asegurar que estén actualizados antes de consultas
      if (affectedPartners.length > 0) {
        for (const partner of affectedPartners) {
          try {
            if (partner.tipo === 'mina') {
              await this.calculateAndUpdateMinaBalance(partner.id);
            } else if (partner.tipo === 'comprador') {
              await this.calculateAndUpdateCompradorBalance(partner.id);
            } else if (partner.tipo === 'volquetero') {
              await this.calculateAndUpdateVolqueteroBalance(partner.id);
            }
          } catch (error) {
            console.error(`Error recalculando balance de ${partner.tipo} ${partner.id}:`, error);
          }
        }
        
        // Emitir evento WebSocket después de recalcular
        const io = await import('./socket').then(m => m.getIO());
        if (io) {
          io.emit('balance-updated', {
            affectedPartners,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error updating viaje related balances:', error);
      // No re-throw para no bloquear la operación principal
    }
  }

  // Calcular y actualizar balance de mina
  async calculateAndUpdateMinaBalance(minaId: number): Promise<void> {
    try {
      // Validaciones
      if (!minaId || isNaN(minaId) || minaId <= 0) {
        throw new Error(`ID de mina inválido: ${minaId}`);
      }
      
      // Verificar que la mina existe
      const minaCheck = await db.select({ id: minas.id }).from(minas).where(eq(minas.id, minaId)).limit(1);
      if (!minaCheck.length) {
        throw new Error(`Mina con ID ${minaId} no encontrada`);
      }

      // Obtener viajes completados de la mina (INCLUIR OCULTOS para balance real)
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.minaId, minaId),
          eq(viajes.estado, 'completado')
        ));

      // Obtener transacciones manuales de la mina (INCLUIR OCULTOS para balance real)
      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(and(
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), eq(transacciones.deQuienId, minaId.toString())),
            and(eq(transacciones.paraQuienTipo, 'mina'), eq(transacciones.paraQuienId, minaId.toString()))
          )
        ));

      // Filtrar solo transacciones manuales (excluir las que tienen concepto con "viaje")
      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );

      // LÓGICA ESTANDARIZADA PARA MINAS:
      // Positivos: Viajes completados (totalCompra) + Transacciones desde mina
      // Negativos: Transacciones hacia mina
      
      // Calcular ingresos de viajes (positivos)
      const ingresosViajes = viajesCompletados.reduce((sum, viaje) => {
        return sum + parseFloat(viaje.totalCompra || '0');
      }, 0);

      // Calcular transacciones netas (positivos - negativos)
      const transaccionesNetas = transaccionesManualesFiltered.reduce((sum, transaccion) => {
        const valor = parseFloat(transaccion.valor || '0');
        
        // Positivo: desde mina (origen)
        if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId.toString()) {
          return sum + valor;
        }
        // Negativo: hacia mina (destino)
        else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId.toString()) {
          return sum - valor;
        }
        
        return sum;
      }, 0);

      const balanceCalculado = ingresosViajes + transaccionesNetas;
      // Actualizar el balance calculado en la base de datos
      await db
        .update(minas)
        .set({ 
          balanceCalculado: balanceCalculado.toString(),
          balanceDesactualizado: false,
          ultimoRecalculo: new Date()
        })
        .where(eq(minas.id, minaId));
    } catch (error) {
      console.error(`Error calculando balance para mina ${minaId}:`, error);
      throw error;
    }
  }

  // Función para marcar balance como desactualizado
  async markMinaBalanceStale(minaId: number): Promise<void> {
    try {
      if (!minaId || isNaN(minaId) || minaId <= 0) {
        throw new Error(`ID de mina inválido: ${minaId}`);
      }
      
      await db
        .update(minas)
        .set({ balanceDesactualizado: true })
        .where(eq(minas.id, minaId));
    } catch (error) {
      console.error(`Error marcando balance stale para mina ${minaId}:`, error);
      throw error;
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
  // Función para marcar balance de comprador como desactualizado
  async markCompradorBalanceStale(compradorId: number): Promise<void> {
    try {
      if (!compradorId || isNaN(compradorId) || compradorId <= 0) {
        throw new Error(`ID de comprador inválido: ${compradorId}`);
      }
      
      await db
        .update(compradores)
        .set({ balanceDesactualizado: true })
        .where(eq(compradores.id, compradorId));
    } catch (error) {
      console.error(`Error marcando balance stale para comprador ${compradorId}:`, error);
      throw error;
    }
  }

  async calculateAndUpdateCompradorBalance(compradorId: number): Promise<void> {
    try {
      // Validaciones
      if (!compradorId || isNaN(compradorId) || compradorId <= 0) {
        throw new Error(`ID de comprador inválido: ${compradorId}`);
      }

      // Obtener viajes completados del comprador (INCLUIR OCULTOS para balance real)
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.compradorId, compradorId),
          eq(viajes.estado, 'completado')
        ));

      // Obtener transacciones manuales del comprador (INCLUIR OCULTOS para balance real)
      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(or(
          and(eq(transacciones.deQuienTipo, 'comprador'), eq(transacciones.deQuienId, compradorId.toString())),
          and(eq(transacciones.paraQuienTipo, 'comprador'), eq(transacciones.paraQuienId, compradorId.toString()))
        ));

      // Filtrar solo transacciones manuales (excluir las que tienen concepto con "viaje")
      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );

      // LÓGICA ESTANDARIZADA PARA COMPRADORES:
      // Positivos: Transacciones desde comprador (origen)
      // Negativos: Viajes completados (valorConsignar) + Transacciones hacia comprador (destino)
      
      // Calcular positivos (desde comprador)
      const totalPositivos = transaccionesManualesFiltered
        .filter(t => t.deQuienTipo === 'comprador' && t.deQuienId === compradorId.toString())
        .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);

      // Calcular negativos (hacia comprador + viajes)
      const totalNegativosViajes = viajesCompletados.reduce((sum, viaje) => {
        return sum + parseFloat(viaje.valorConsignar || '0');
      }, 0);

      const totalNegativosTransacciones = transaccionesManualesFiltered
        .filter(t => t.paraQuienTipo === 'comprador' && t.paraQuienId === compradorId.toString())
        .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);

      const balanceCalculado = totalPositivos - (totalNegativosViajes + totalNegativosTransacciones);

      // Actualizar el balance calculado en la base de datos
      await db
        .update(compradores)
        .set({ 
          balanceCalculado: balanceCalculado.toString(),
          balanceDesactualizado: false,
          ultimoRecalculo: new Date()
        })
        .where(eq(compradores.id, compradorId));
    } catch (error) {
      console.error('Error calculating comprador balance:', error);
      throw error;
    }
  }

  // Función para marcar balance de volquetero como desactualizado
  async markVolqueteroBalanceStale(volqueteroId: number): Promise<void> {
    try {
      if (!volqueteroId || isNaN(volqueteroId) || volqueteroId <= 0) {
        throw new Error(`ID de volquetero inválido: ${volqueteroId}`);
      }
      
      await db
        .update(volqueteros)
        .set({ balanceDesactualizado: true })
        .where(eq(volqueteros.id, volqueteroId));
    } catch (error) {
      console.error(`Error marcando balance stale para volquetero ${volqueteroId}:`, error);
      throw error;
    }
  }

  async calculateAndUpdateVolqueteroBalance(volqueteroId: number): Promise<void> {
    try {
      // Validaciones
      if (!volqueteroId || isNaN(volqueteroId) || volqueteroId <= 0) {
        throw new Error(`ID de volquetero inválido: ${volqueteroId}`);
      }

      // Verificar que el volquetero existe
      const volqueteroCheck = await db.select({ id: volqueteros.id, nombre: volqueteros.nombre }).from(volqueteros).where(eq(volqueteros.id, volqueteroId)).limit(1);
      if (!volqueteroCheck.length) {
        throw new Error(`Volquetero con ID ${volqueteroId} no encontrado`);
      }

      const volqueteroNombre = volqueteroCheck[0].nombre;

      // Obtener viajes completados del volquetero donde RodMar paga el flete (INCLUIR OCULTOS para balance real)
      const viajesCompletados = await db
        .select()
        .from(viajes)
        .where(and(
          eq(viajes.conductor, volqueteroNombre),
          eq(viajes.estado, 'completado'),
          sql`${viajes.fechaDescargue} IS NOT NULL`,
          sql`${viajes.quienPagaFlete} NOT IN ('comprador', 'El comprador')`
        ));

      // Obtener transacciones manuales del volquetero (INCLUIR OCULTOS para balance real)
      const transaccionesManuales = await db
        .select()
        .from(transacciones)
        .where(or(
          and(eq(transacciones.deQuienTipo, 'volquetero'), eq(transacciones.deQuienId, volqueteroId.toString())),
          and(eq(transacciones.paraQuienTipo, 'volquetero'), eq(transacciones.paraQuienId, volqueteroId.toString()))
        ));

      // Filtrar solo transacciones manuales (excluir las que tienen concepto con "viaje")
      const transaccionesManualesFiltered = transaccionesManuales.filter(t => 
        !t.concepto.toLowerCase().includes('viaje')
      );

      // LÓGICA ESTANDARIZADA PARA VOLQUETEROS:
      // Positivos: Viajes completados (totalFlete donde RodMar paga) + Transacciones desde volquetero (origen)
      // Negativos: Transacciones hacia volquetero (destino)
      
      // Calcular ingresos de viajes (positivos)
      const ingresosViajes = viajesCompletados.reduce((sum, viaje) => {
        return sum + parseFloat(viaje.totalFlete || '0');
      }, 0);

      // Calcular transacciones netas (positivos - negativos)
      const transaccionesNetas = transaccionesManualesFiltered.reduce((sum, transaccion) => {
        const valor = parseFloat(transaccion.valor || '0');
        
        // Positivo: desde volquetero (origen)
        if (transaccion.deQuienTipo === 'volquetero' && transaccion.deQuienId === volqueteroId.toString()) {
          return sum + valor;
        }
        // Negativo: hacia volquetero (destino)
        else if (transaccion.paraQuienTipo === 'volquetero' && transaccion.paraQuienId === volqueteroId.toString()) {
          return sum - valor;
        }
        
        return sum;
      }, 0);

      const balanceCalculado = ingresosViajes + transaccionesNetas;

      // Actualizar el balance calculado en la base de datos
      await db
        .update(volqueteros)
        .set({ 
          balanceCalculado: balanceCalculado.toString(),
          balanceDesactualizado: false,
          ultimoRecalculo: new Date()
        })
        .where(eq(volqueteros.id, volqueteroId));
    } catch (error) {
      console.error('Error calculating volquetero balance:', error);
      throw error;
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

      // Recalcular balances de volqueteros
      const allVolqueteros = await db.select().from(volqueteros);
      for (const volquetero of allVolqueteros) {
        await this.calculateAndUpdateVolqueteroBalance(volquetero.id);
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

      // Preparar condiciones base para queries (INCLUIR OCULTOS para balance real)
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
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
          // Asegurar que ingresosViajes sea un número válido
          const ingresosViajes = typeof stat.ingresosViajes === 'number' 
            ? stat.ingresosViajes 
            : parseFloat(String(stat.ingresosViajes || 0));
          
          viajesStatsMap.set(stat.minaId, {
            viajesCount: stat.viajesCount || 0,
            viajesUltimoMes: stat.viajesUltimoMes || 0,
            ingresosViajes: isNaN(ingresosViajes) ? 0 : ingresosViajes
          });
        }
      });

      // QUERY 2: Transacciones agregadas para TODAS las minas (1 query para todas)
      // SIEMPRE calcular para asegurar que se excluyan transacciones pendientes
      const transaccionesStart = Date.now();
      const minaIds = allMinas.map(m => m.id.toString());
      let transaccionesStatsMap = new Map<number, number>();
      
      if (minaIds.length > 0) {
        
        // Construir condiciones OR para cada mina (INCLUIR OCULTOS para balance real)
        // EXCLUIR transacciones pendientes (no afectan balances)
        // EXCLUIR transacciones con "viaje" en el concepto (igual que calculateAndUpdateMinaBalance)
        // para mantener consistencia con el cálculo del encabezado y balanceCalculado en BD
        const transaccionesConditions = [
          or(
            and(eq(transacciones.deQuienTipo, 'mina'), inArray(transacciones.deQuienId, minaIds)),
            and(eq(transacciones.paraQuienTipo, 'mina'), inArray(transacciones.paraQuienId, minaIds))
          ),
          or(
            eq(transacciones.estado, 'completada'),
            isNull(transacciones.estado) // Incluir transacciones antiguas sin estado
          ),
          sql`LOWER(${transacciones.concepto}) NOT LIKE '%viaje%'` // Excluir transacciones con "viaje" en concepto (igual que calculateAndUpdateMinaBalance)
        ];
        
        // Query mejorada para manejar transacciones entre minas correctamente
        // Hace dos queries separadas: una para minas como origen, otra para minas como destino
        // Esto asegura que las transacciones entre minas se cuenten en ambas minas
        
        // 1. Transacciones donde la mina es origen (deQuienTipo = 'mina') - valor positivo
        const transaccionesDesdeMinas = await db
          .select({
            minaId: transacciones.deQuienId,
            valor: sql<number>`CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
          })
          .from(transacciones)
          .where(and(
            eq(transacciones.deQuienTipo, 'mina'),
            inArray(transacciones.deQuienId, minaIds),
            or(
              eq(transacciones.estado, 'completada'),
              isNull(transacciones.estado)
            ),
            sql`LOWER(${transacciones.concepto}) NOT LIKE '%viaje%'`
          ));

        // 2. Transacciones donde la mina es destino (paraQuienTipo = 'mina') - valor negativo
        const transaccionesHaciaMinas = await db
          .select({
            minaId: transacciones.paraQuienId,
            valor: sql<number>`-CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
          })
          .from(transacciones)
          .where(and(
            eq(transacciones.paraQuienTipo, 'mina'),
            inArray(transacciones.paraQuienId, minaIds),
            or(
              eq(transacciones.estado, 'completada'),
              isNull(transacciones.estado)
            ),
            sql`LOWER(${transacciones.concepto}) NOT LIKE '%viaje%'`
          ));

        // Combinar ambas queries y agrupar por minaId
        const transaccionesCombinadas = [
          ...transaccionesDesdeMinas.map(t => ({ minaId: t.minaId, valor: t.valor })),
          ...transaccionesHaciaMinas.map(t => ({ minaId: t.minaId, valor: t.valor }))
        ];

        // Agrupar por minaId y sumar valores
        const transaccionesStatsMapTemp = new Map<number, number>();
        transaccionesCombinadas.forEach(t => {
          if (t.minaId) {
            const minaIdNum = parseInt(t.minaId);
            if (!isNaN(minaIdNum)) {
              const valorActual = transaccionesStatsMapTemp.get(minaIdNum) || 0;
              const valorNuevo = typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor || 0));
              transaccionesStatsMapTemp.set(minaIdNum, valorActual + (isNaN(valorNuevo) ? 0 : valorNuevo));
            }
          }
        });

        // Convertir a formato esperado
        const transaccionesStats = Array.from(transaccionesStatsMapTemp.entries()).map(([minaId, transaccionesNetas]) => ({
          minaId: minaId.toString(),
          transaccionesNetas
        }));

        transaccionesStats.forEach(stat => {
          if (stat.minaId) {
            const minaIdNum = parseInt(stat.minaId);
            if (!isNaN(minaIdNum)) {
              // Asegurar que transaccionesNetas sea un número válido
              const transaccionesNetas = typeof stat.transaccionesNetas === 'number'
                ? stat.transaccionesNetas
                : parseFloat(String(stat.transaccionesNetas || 0));
              transaccionesStatsMap.set(minaIdNum, isNaN(transaccionesNetas) ? 0 : transaccionesNetas);
            }
          }
        });

        const transaccionesTime = Date.now() - transaccionesStart;
        console.log(`⏱️  [PERF] Query agregada de transacciones: ${transaccionesTime}ms (${allMinas.length} minas)`);
      }

      // Construir resultado final combinando balances calculados y estadísticas
      for (const mina of allMinas) {
        const stats = viajesStatsMap.get(mina.id) || { viajesCount: 0, viajesUltimoMes: 0, ingresosViajes: 0 };
        
        // SIEMPRE calcular balance dinámicamente para asegurar que se excluyan transacciones pendientes
        // (balanceCalculado podría incluir transacciones pendientes si fue calculado antes de implementar la exclusión)
        const transaccionesNetas = transaccionesStatsMap.get(mina.id) || 0;
        
        // Asegurar que los valores sean números válidos
        const ingresosViajes = typeof stats.ingresosViajes === 'number' ? stats.ingresosViajes : parseFloat(String(stats.ingresosViajes || 0));
        const transaccionesNetasNum = typeof transaccionesNetas === 'number' ? transaccionesNetas : parseFloat(String(transaccionesNetas || 0));
        const balance = ingresosViajes + transaccionesNetasNum;

        balances[mina.id] = {
          balance: isNaN(balance) ? 0 : balance,
          viajesCount: stats.viajesCount || 0,
          viajesUltimoMes: stats.viajesUltimoMes || 0
        };
      }

      const endTime = Date.now();
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getMinasBalances: ${endTime - startTime}ms (${allMinas.length} minas, todas con cálculo dinámico para excluir pendientes)`);
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

      // Preparar condiciones base para queries (INCLUIR OCULTOS para balance real)
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
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

      // QUERY 2: Transacciones agregadas para TODOS los compradores (1 query para todos)
      // SIEMPRE calcular para asegurar que se excluyan transacciones pendientes
      const transaccionesStart = Date.now();
      const compradorIds = allCompradores.map(c => c.id.toString());
      let transaccionesStatsMap = new Map<number, number>();
      
      if (compradorIds.length > 0) {
        
        // Construir condiciones OR para cada comprador (INCLUIR OCULTOS para balance real)
        // EXCLUIR transacciones pendientes (no afectan balances)
        const transaccionesConditions = [
          or(
            and(eq(transacciones.deQuienTipo, 'comprador'), inArray(transacciones.deQuienId, compradorIds)),
            and(eq(transacciones.paraQuienTipo, 'comprador'), inArray(transacciones.paraQuienId, compradorIds))
          ),
          ne(transacciones.estado, 'pendiente') // Excluir transacciones pendientes
        ];
        
        // Query mejorada para manejar transacciones entre compradores correctamente
        // Hace dos queries separadas: una para compradores como origen, otra para compradores como destino
        // Esto asegura que las transacciones entre compradores se cuenten en ambos compradores
        
        // 1. Transacciones donde el comprador es origen (deQuienTipo = 'comprador') - valor positivo
        const transaccionesDesdeCompradores = await db
          .select({
            compradorId: transacciones.deQuienId,
            valor: sql<number>`CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
          })
          .from(transacciones)
          .where(and(
            eq(transacciones.deQuienTipo, 'comprador'),
            inArray(transacciones.deQuienId, compradorIds),
            ne(transacciones.estado, 'pendiente')
          ));

        // 2. Transacciones donde el comprador es destino (paraQuienTipo = 'comprador') - valor negativo
        const transaccionesHaciaCompradores = await db
          .select({
            compradorId: transacciones.paraQuienId,
            valor: sql<number>`-CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
          })
          .from(transacciones)
          .where(and(
            eq(transacciones.paraQuienTipo, 'comprador'),
            inArray(transacciones.paraQuienId, compradorIds),
            ne(transacciones.estado, 'pendiente')
          ));

        // Combinar ambas queries y agrupar por compradorId
        const transaccionesCombinadas = [
          ...transaccionesDesdeCompradores.map(t => ({ compradorId: t.compradorId, valor: t.valor })),
          ...transaccionesHaciaCompradores.map(t => ({ compradorId: t.compradorId, valor: t.valor }))
        ];

        // Agrupar por compradorId y sumar valores
        const transaccionesStatsMapTemp = new Map<number, number>();
        transaccionesCombinadas.forEach(t => {
          if (t.compradorId) {
            const compradorIdNum = parseInt(t.compradorId);
            if (!isNaN(compradorIdNum)) {
              const valorActual = transaccionesStatsMapTemp.get(compradorIdNum) || 0;
              const valorNuevo = typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor || 0));
              transaccionesStatsMapTemp.set(compradorIdNum, valorActual + (isNaN(valorNuevo) ? 0 : valorNuevo));
            }
          }
        });

        // Convertir a formato esperado
        const transaccionesStats = Array.from(transaccionesStatsMapTemp.entries()).map(([compradorId, transaccionesNetas]) => ({
          compradorId: compradorId.toString(),
          transaccionesNetas
        }));

        transaccionesStats.forEach(stat => {
          if (stat.compradorId) {
            const compradorIdNum = parseInt(stat.compradorId);
            if (!isNaN(compradorIdNum)) {
              transaccionesStatsMap.set(compradorIdNum, stat.transaccionesNetas);
            }
          }
        });

        const transaccionesTime = Date.now() - transaccionesStart;
        console.log(`⏱️  [PERF] Query agregada de transacciones: ${transaccionesTime}ms (${allCompradores.length} compradores)`);
      }

      // Construir resultado final combinando balances calculados y estadísticas
      for (const comprador of allCompradores) {
        const stats = viajesStatsMap.get(comprador.id) || { viajesCount: 0, viajesUltimoMes: 0, totalDeudaViajes: 0 };
        
        // SIEMPRE calcular balance dinámicamente para asegurar que se excluyan transacciones pendientes
        // (balanceCalculado podría incluir transacciones pendientes si fue calculado antes de implementar la exclusión)
        // Lógica estandarizada: Positivos (desde comprador) - Negativos (hacia comprador + viajes)
        const transaccionesNetas = transaccionesStatsMap.get(comprador.id) || 0;
        const balance = transaccionesNetas - stats.totalDeudaViajes; // Negativo porque totalDeudaViajes es deuda

        balances[comprador.id] = {
          balance,
          viajesCount: stats.viajesCount,
          viajesUltimoMes: stats.viajesUltimoMes
        };
      }

      const endTime = Date.now();
      console.log(`⏱️  [PERF] ⚡ TIEMPO TOTAL getCompradoresBalances: ${endTime - startTime}ms (${allCompradores.length} compradores, todos con cálculo dinámico para excluir pendientes)`);
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

      // Preparar condiciones base para queries (INCLUIR OCULTOS para balance real)
      const viajesConditions = [
        eq(viajes.estado, 'completado'),
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
      
      // Construir condiciones OR para cada volquetero (INCLUIR OCULTOS para balance real)
      // EXCLUIR transacciones pendientes (no afectan balances)
      const transaccionesConditions = [
        or(
          and(eq(transacciones.deQuienTipo, 'volquetero'), inArray(transacciones.deQuienId, volqueteroIds)),
          and(eq(transacciones.paraQuienTipo, 'volquetero'), inArray(transacciones.paraQuienId, volqueteroIds))
        ),
        ne(transacciones.estado, 'pendiente') // Excluir transacciones pendientes
      ];
      
      // Query mejorada para manejar transacciones entre volqueteros correctamente
      // Hace dos queries separadas: una para volqueteros como origen (ingresos), otra para volqueteros como destino (egresos)
      // Esto asegura que las transacciones entre volqueteros se cuenten en ambos volqueteros
      
      // 1. Transacciones donde el volquetero es origen (deQuienTipo = 'volquetero') - ingresos
      const transaccionesDesdeVolqueteros = await db
        .select({
          volqueteroId: transacciones.deQuienId,
          valor: sql<number>`CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
        })
        .from(transacciones)
        .where(and(
          eq(transacciones.deQuienTipo, 'volquetero'),
          inArray(transacciones.deQuienId, volqueteroIds),
          ne(transacciones.estado, 'pendiente')
        ));

      // 2. Transacciones donde el volquetero es destino (paraQuienTipo = 'volquetero') - egresos
      const transaccionesHaciaVolqueteros = await db
        .select({
          volqueteroId: transacciones.paraQuienId,
          valor: sql<number>`CAST(${transacciones.valor} AS NUMERIC)`.as('valor')
        })
        .from(transacciones)
        .where(and(
          eq(transacciones.paraQuienTipo, 'volquetero'),
          inArray(transacciones.paraQuienId, volqueteroIds),
          ne(transacciones.estado, 'pendiente')
        ));

      // Combinar ambas queries y agrupar por volqueteroId
      const ingresosMap = new Map<number, number>();
      const egresosMap = new Map<number, number>();

      transaccionesDesdeVolqueteros.forEach(t => {
        if (t.volqueteroId) {
          const volqueteroIdNum = parseInt(t.volqueteroId);
          if (!isNaN(volqueteroIdNum)) {
            const valorActual = ingresosMap.get(volqueteroIdNum) || 0;
            const valorNuevo = typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor || 0));
            ingresosMap.set(volqueteroIdNum, valorActual + (isNaN(valorNuevo) ? 0 : valorNuevo));
          }
        }
      });

      transaccionesHaciaVolqueteros.forEach(t => {
        if (t.volqueteroId) {
          const volqueteroIdNum = parseInt(t.volqueteroId);
          if (!isNaN(volqueteroIdNum)) {
            const valorActual = egresosMap.get(volqueteroIdNum) || 0;
            const valorNuevo = typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor || 0));
            egresosMap.set(volqueteroIdNum, valorActual + (isNaN(valorNuevo) ? 0 : valorNuevo));
          }
        }
      });

      // Convertir a formato esperado
      const transaccionesStats = Array.from(new Set([
        ...Array.from(ingresosMap.keys()),
        ...Array.from(egresosMap.keys())
      ])).map(volqueteroId => ({
        volqueteroId: volqueteroId.toString(),
        ingresos: ingresosMap.get(volqueteroId) || 0,
        egresos: egresosMap.get(volqueteroId) || 0
      }));

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

      // Identificar volqueteros que necesitan cálculo dinámico de balance
      const volqueterosNecesitanCalculo = allVolqueteros.filter(v => !v.balanceCalculado || v.balanceDesactualizado);

      // Construir resultado final combinando balances y estadísticas
      for (const volquetero of allVolqueteros) {
        const viajesStats = viajesStatsMap.get(volquetero.nombre) || { viajesCount: 0, viajesUltimoMes: 0, ingresosFletes: 0 };
        const transaccionesStats = transaccionesStatsMap.get(volquetero.id) || { ingresos: 0, egresos: 0 };
        
        // SIEMPRE calcular balance dinámicamente para asegurar que se excluyan transacciones pendientes
        // (balanceCalculado podría incluir transacciones pendientes si fue calculado antes de implementar la exclusión)
        // Lógica estandarizada: Positivos (viajes + desde volquetero) - Negativos (hacia volquetero)
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

  // Push subscriptions methods
  async savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    return wrapDbOperation(async () => {
      // Intentar actualizar si ya existe, sino crear
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, subscription.userId),
            eq(pushSubscriptions.endpoint, subscription.endpoint)
          )
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(pushSubscriptions)
          .set({
            p256dh: subscription.p256dh,
            auth: subscription.auth,
            updatedAt: new Date()
          })
          .where(eq(pushSubscriptions.id, existing.id))
          .returning();
        return updated;
      } else {
        const [newSubscription] = await db
          .insert(pushSubscriptions)
          .values(subscription)
          .returning();
        return newSubscription;
      }
    });
  }

  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return wrapDbOperation(async () => {
      return await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));
    });
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<boolean> {
    return wrapDbOperation(async () => {
      const result = await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, endpoint)
          )
        )
        .returning();
      return result.length > 0;
    });
  }
}