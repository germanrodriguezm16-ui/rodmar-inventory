import { db } from './db';
import { minas, compradores, volqueteros, viajes, transacciones, roles, permissions, rolePermissions, users } from '../shared/schema';
import { sql, eq, and, or } from 'drizzle-orm';
import { hashPassword } from './middleware/auth-helpers';
import { addMissingPermissions as addMissingPermissionsFromFile } from './add-missing-permissions';
import { storage } from './storage';

// Inicializar roles y permisos base
export async function initializeRolesAndPermissions() {
  console.log('=== INICIALIZANDO ROLES Y PERMISOS ===');
  
  try {
    // Verificar si ya hay permisos
    const existingPermissions = await db.select().from(permissions);
    
    if (existingPermissions.length > 0) {
      console.log('=== Roles y permisos ya existen, omitiendo inicialización ===');
      return;
    }

    // Definir todos los permisos del sistema
    const permisosBase = [
      // Módulos (7)
      { key: 'module.PRINCIPAL.view', descripcion: 'Ver módulo Principal (Viajes)', categoria: 'module' },
      { key: 'module.MINAS.view', descripcion: 'Ver módulo de Minas', categoria: 'module' },
      { key: 'module.COMPRADORES.view', descripcion: 'Ver módulo de Compradores', categoria: 'module' },
      { key: 'module.VOLQUETEROS.view', descripcion: 'Ver módulo de Volqueteros', categoria: 'module' },
      { key: 'module.RODMAR.view', descripcion: 'Ver módulo de RodMar', categoria: 'module' },
      { key: 'module.TRANSACCIONES.view', descripcion: 'Ver módulo de Transacciones', categoria: 'module' },
      { key: 'module.ANALYTICS.view', descripcion: 'Ver módulo de Analytics', categoria: 'module' },
      
      // Pestañas/Secciones (12)
      { key: 'module.MINAS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Minas', categoria: 'tab' },
      { key: 'module.MINAS.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Minas', categoria: 'tab' },
      { key: 'module.MINAS.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Minas', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Compradores', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Compradores', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Volqueteros', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Volqueteros', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Volqueteros', categoria: 'tab' },
      { key: 'module.RODMAR.accounts.view', descripcion: 'Ver cuentas RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.tab.TERCEROS.view', descripcion: 'Ver pestaña Terceros en RodMar', categoria: 'tab' },
      // Permisos por cuenta RodMar individual
      { key: 'module.RODMAR.account.Bemovil.view', descripcion: 'Ver cuenta RodMar: Bemovil', categoria: 'account' },
      { key: 'module.RODMAR.account.Corresponsal.view', descripcion: 'Ver cuenta RodMar: Corresponsal', categoria: 'account' },
      { key: 'module.RODMAR.account.Efectivo.view', descripcion: 'Ver cuenta RodMar: Efectivo', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas German.view', descripcion: 'Ver cuenta RodMar: Cuentas German', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas Jhon.view', descripcion: 'Ver cuenta RodMar: Cuentas Jhon', categoria: 'account' },
      { key: 'module.RODMAR.account.Otros.view', descripcion: 'Ver cuenta RodMar: Otros', categoria: 'account' },
      { key: 'module.RODMAR.LCDM.view', descripcion: 'Ver sección LCDM en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.Postobon.view', descripcion: 'Ver sección Postobón en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.balances.view', descripcion: 'Ver balances globales en RodMar', categoria: 'tab' },
      { key: 'module.TRANSACCIONES.tab.pending.view', descripcion: 'Ver transacciones pendientes', categoria: 'tab' },
      
      // Acciones (18)
      { key: 'action.TRANSACCIONES.create', descripcion: 'Crear transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.edit', descripcion: 'Editar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.delete', descripcion: 'Eliminar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.hide', descripcion: 'Ocultar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.viewPending', descripcion: 'Ver transacciones pendientes', categoria: 'action' },
      { key: 'action.TRANSACCIONES.completePending', descripcion: 'Completar transacciones pendientes', categoria: 'action' },
      { key: 'action.TRANSACCIONES.solicitar', descripcion: 'Solicitar transacciones pendientes', categoria: 'action' },
      { key: 'action.VIAJES.create', descripcion: 'Crear viajes', categoria: 'action' },
      { key: 'action.VIAJES.edit', descripcion: 'Editar viajes', categoria: 'action' },
      { key: 'action.VIAJES.delete', descripcion: 'Eliminar viajes', categoria: 'action' },
      { key: 'action.RODMAR.createTransaction', descripcion: 'Crear transacciones desde RodMar', categoria: 'action' },
      { key: 'action.RODMAR.viewGlobalBalances', descripcion: 'Ver balances globales', categoria: 'action' },
      { key: 'action.RODMAR.createInvestment', descripcion: 'Crear inversiones', categoria: 'action' },
      { key: 'action.ENTITIES.fusion', descripcion: 'Fusionar entidades (minas/compradores/volqueteros)', categoria: 'action' },
      { key: 'action.ENTITIES.edit', descripcion: 'Editar nombres de entidades', categoria: 'action' },
      { key: 'action.ENTITIES.create', descripcion: 'Crear nuevas entidades', categoria: 'action' },
      { key: 'action.ANALYTICS.view', descripcion: 'Ver analytics y reportes', categoria: 'action' },
      { key: 'module.ADMIN.view', descripcion: 'Acceso a configuración y administración', categoria: 'module' },
    ];

    console.log('=== Creando permisos base ===');
    const permisosInsertados = await db.insert(permissions).values(permisosBase).returning();
    console.log(`✅ ${permisosInsertados.length} permisos creados`);

    // Crear rol ADMIN con todos los permisos
    console.log('=== Creando rol ADMIN ===');
    const [adminRole] = await db.insert(roles).values({
      nombre: 'ADMIN',
      descripcion: 'Administrador con acceso completo al sistema',
    }).returning();

    // Asignar todos los permisos al rol ADMIN
    const adminPermissions = permisosInsertados.map(p => ({
      roleId: adminRole.id,
      permissionId: p.id,
    }));

    await db.insert(rolePermissions).values(adminPermissions);
    console.log(`✅ Rol ADMIN creado con ${adminPermissions.length} permisos`);

    // Asignar rol ADMIN al usuario principal si existe
    const mainUser = await db.select().from(users).where(eq(users.id, 'main_user')).limit(1);
    if (mainUser.length > 0 && !mainUser[0].roleId) {
      await db.update(users)
        .set({ roleId: adminRole.id })
        .where(eq(users.id, 'main_user'));
      console.log('✅ Rol ADMIN asignado al usuario principal');
    }

    console.log('=== ROLES Y PERMISOS INICIALIZADOS EXITOSAMENTE ===');
    
  } catch (error) {
    console.error('=== ERROR INICIALIZANDO ROLES Y PERMISOS ===', error);
    throw error;
  }
}

// Inicializar usuario admin por defecto
export async function initializeAdminUser() {
  console.log('=== VERIFICANDO USUARIO ADMIN ===');
  
  try {
    // Buscar si existe algún usuario con rol ADMIN
    const adminUsers = await db
      .select()
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.nombre, 'ADMIN'))
      .limit(1);

    if (adminUsers.length > 0) {
      console.log('=== Ya existe un usuario ADMIN, omitiendo creación ===');
      return;
    }

    // Buscar el rol ADMIN
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.nombre, 'ADMIN'))
      .limit(1);

    if (adminRole.length === 0) {
      console.log('⚠️  No se encontró el rol ADMIN, debe ejecutarse initializeRolesAndPermissions primero');
      return;
    }

    // Crear usuario admin por defecto
    const defaultPhone = process.env.ADMIN_PHONE || '3000000000';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await hashPassword(defaultPassword);

    const [adminUser] = await db
      .insert(users)
      .values({
        id: `admin_${Date.now()}`,
        phone: defaultPhone,
        firstName: 'Administrador',
        lastName: 'Sistema',
        passwordHash,
        roleId: adminRole[0].id,
      })
      .returning();

    console.log('✅ Usuario ADMIN creado por defecto');
    console.log(`   📱 Celular: ${defaultPhone}`);
    console.log(`   🔑 Contraseña: ${defaultPassword}`);
    console.log(`   ⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión`);
    
  } catch (error) {
    console.error('=== ERROR CREANDO USUARIO ADMIN ===', error);
    // No lanzar error para no bloquear la inicialización
  }
}

// Agregar permisos faltantes a la base de datos existente
export async function addMissingPermissions() {
  console.log('=== VERIFICANDO PERMISOS FALTANTES ===');
  
  try {
    // Permisos a agregar
    const missingPermissions = [
      { key: 'module.COMPRADORES.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Volqueteros', categoria: 'tab' },
      { key: 'module.RODMAR.LCDM.view', descripcion: 'Ver sección LCDM en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.Postobon.view', descripcion: 'Ver sección Postobón en RodMar', categoria: 'tab' },
      // Permisos por cuenta RodMar individual
      { key: 'module.RODMAR.account.Bemovil.view', descripcion: 'Ver cuenta RodMar: Bemovil', categoria: 'account' },
      { key: 'module.RODMAR.account.Corresponsal.view', descripcion: 'Ver cuenta RodMar: Corresponsal', categoria: 'account' },
      { key: 'module.RODMAR.account.Efectivo.view', descripcion: 'Ver cuenta RodMar: Efectivo', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas German.view', descripcion: 'Ver cuenta RodMar: Cuentas German', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas Jhon.view', descripcion: 'Ver cuenta RodMar: Cuentas Jhon', categoria: 'account' },
      { key: 'module.RODMAR.account.Otros.view', descripcion: 'Ver cuenta RodMar: Otros', categoria: 'account' },
    ];

    // Verificar y agregar cada permiso
    for (const perm of missingPermissions) {
      // Verificar si el permiso ya existe
      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.key, perm.key))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ Permiso ${perm.key} ya existe`);
        continue;
      }

      // Crear el permiso
      const [newPermission] = await db
        .insert(permissions)
        .values(perm)
        .returning();

      console.log(`✅ Permiso creado: ${perm.key} (ID: ${newPermission.id})`);

      // Asignar el permiso al rol ADMIN
      const adminRole = await db
        .select()
        .from(roles)
        .where(eq(roles.nombre, 'ADMIN'))
        .limit(1);

      if (adminRole.length > 0) {
        // Verificar si ya está asignado
        const existingAssignment = await db
          .select()
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, adminRole[0].id),
              eq(rolePermissions.permissionId, newPermission.id)
            )
          )
          .limit(1);

        if (existingAssignment.length === 0) {
          await db.insert(rolePermissions).values({
            roleId: adminRole[0].id,
            permissionId: newPermission.id,
          });
          console.log(`✅ Permiso ${perm.key} asignado al rol ADMIN`);
        }
      }
    }

    console.log('=== VERIFICACIÓN DE PERMISOS COMPLETADA ===');
    
  } catch (error) {
    console.error('=== ERROR VERIFICANDO PERMISOS FALTANTES ===', error);
    // No lanzar error para no bloquear la inicialización
  }
}

/**
 * Migra transacciones huérfanas: actualiza transacciones que referencian IDs artificiales
 * de volqueteros (>= 1000) para que apunten a los IDs reales correspondientes.
 * 
 * Esta función usa la misma lógica que GET /api/volqueteros/:id/viajes para reconstruir
 * el mapeo de IDs artificiales a nombres, y luego busca el volquetero real por nombre.
 */
export async function migrateTransaccionesOrphanas() {
  console.log('=== MIGRANDO TRANSACCIONES HUÉRFANAS DE VOLQUETEROS ===');
  
  try {
    // Obtener todas las transacciones que referencian volqueteros con IDs >= 1000
    const transaccionesOrfanas = await db
      .select()
      .from(transacciones)
      .where(
        or(
          and(
            eq(transacciones.deQuienTipo, 'volquetero'),
            sql`CAST(${transacciones.deQuienId} AS INTEGER) >= 1000`
          ),
          and(
            eq(transacciones.paraQuienTipo, 'volquetero'),
            sql`CAST(${transacciones.paraQuienId} AS INTEGER) >= 1000`
          )
        )
      );
    
    if (transaccionesOrfanas.length === 0) {
      console.log('✅ No hay transacciones huérfanas para migrar');
      return;
    }
    
    console.log(`🔍 Encontradas ${transaccionesOrfanas.length} transacciones con IDs artificiales`);
    
    // Obtener todos los viajes y volqueteros para reconstruir el mapeo (igual que en GET /api/volqueteros/:id/viajes)
    const todosViajes = await storage.getViajes();
    const volqueterosReales = await storage.getVolqueteros();
    const volqueterosPorNombreMap: Record<string, any> = {};
    volqueterosReales.forEach((v) => {
      volqueterosPorNombreMap[v.nombre.toLowerCase()] = v;
    });
    
    // Reconstruir el mapeo de IDs artificiales a nombres (igual que en GET /api/volqueteros)
    const conductoresPorNombre: Record<string, { id: number | null; nombre: string }> = {};
    
    todosViajes.forEach((viaje) => {
      if (viaje.conductor) {
        if (viaje.estado !== "completado" || !viaje.fechaDescargue) {
          return;
        }
        const nombreLower = viaje.conductor.toLowerCase();
        const nombre = viaje.conductor;
        const volqueteroReal = volqueterosPorNombreMap[nombreLower];
        
        if (!conductoresPorNombre[nombreLower]) {
          conductoresPorNombre[nombreLower] = {
            id: volqueteroReal?.id || null,
            nombre: nombre,
          };
        }
      }
    });
    
    volqueterosReales.forEach((volquetero) => {
      const nombreLower = volquetero.nombre.toLowerCase();
      if (!conductoresPorNombre[nombreLower]) {
        conductoresPorNombre[nombreLower] = {
          id: volquetero.id,
          nombre: volquetero.nombre,
        };
      } else {
        if (!conductoresPorNombre[nombreLower].id) {
          conductoresPorNombre[nombreLower].id = volquetero.id;
        }
      }
    });
    
    // Crear mapeo de nombre a ID real (más confiable que IDs artificiales)
    const mapeoNombreAIdReal = new Map<string, number>();
    volqueterosReales.forEach((v) => {
      mapeoNombreAIdReal.set(v.nombre.toLowerCase().trim(), v.id);
    });
    
    // Función helper para extraer nombre de volquetero del concepto
    const extraerNombreDelConcepto = (concepto: string | null): string | null => {
      if (!concepto) return null;
      // Buscar patrones como "Volquetero (Nombre)" o "a Volquetero (Nombre)" o "de Volquetero (Nombre)"
      const patrones = [
        /Volquetero\s*\(([^)]+)\)/i,
        /a\s+Volquetero\s*\(([^)]+)\)/i,
        /de\s+Volquetero\s*\(([^)]+)\)/i,
      ];
      for (const patron of patrones) {
        const match = concepto.match(patron);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return null;
    };
    
    // Actualizar transacciones huérfanas
    let actualizadas = 0;
    let sinMapeo = 0;
    
    for (const transaccion of transaccionesOrfanas) {
      let necesitaActualizacion = false;
      const updates: any = {};
      
      // Estrategia 1: Intentar extraer nombre del concepto (más confiable)
      // Estrategia 2: Reconstruir mapeo de IDs artificiales (menos confiable pero como fallback)
      
      // Crear mapeo de ID artificial a nombre (solo para fallback)
      let artificialIdCounter = 1000;
      const mapeoIdArtificialANombre = new Map<number, string>();
      Object.entries(conductoresPorNombre).forEach(([nombreKey, data]) => {
        const idAsignado = data.id || artificialIdCounter++;
        mapeoIdArtificialANombre.set(idAsignado, data.nombre);
      });
      
      // Verificar y actualizar deQuienId si es necesario
      if (transaccion.deQuienTipo === 'volquetero' && transaccion.deQuienId) {
        const idActual = parseInt(transaccion.deQuienId);
        if (idActual >= 1000) {
          let idReal: number | undefined;
          
          // Estrategia 1: Buscar nombre en el concepto
          const nombreDelConcepto = extraerNombreDelConcepto(transaccion.concepto);
          if (nombreDelConcepto) {
            idReal = mapeoNombreAIdReal.get(nombreDelConcepto.toLowerCase().trim());
            if (idReal) {
              console.log(`🔍 Transacción ${transaccion.id}: Encontrado nombre "${nombreDelConcepto}" en concepto -> ID real ${idReal}`);
            }
          }
          
          // Estrategia 2: Usar mapeo de ID artificial (fallback)
          if (!idReal) {
            const nombreVolquetero = mapeoIdArtificialANombre.get(idActual);
            if (nombreVolquetero) {
              idReal = mapeoNombreAIdReal.get(nombreVolquetero.toLowerCase().trim());
              if (idReal) {
                console.log(`🔍 Transacción ${transaccion.id}: ID artificial ${idActual} -> "${nombreVolquetero}" -> ID real ${idReal}`);
              }
            }
          }
          
          if (idReal) {
            updates.deQuienId = idReal.toString();
            necesitaActualizacion = true;
          } else {
            sinMapeo++;
            console.log(`⚠️  No se encontró ID real para transacción ${transaccion.id} (ID artificial ${idActual}, concepto: "${transaccion.concepto}")`);
          }
        }
      }
      
      // Verificar y actualizar paraQuienId si es necesario
      if (transaccion.paraQuienTipo === 'volquetero' && transaccion.paraQuienId) {
        const idActual = parseInt(transaccion.paraQuienId);
        if (idActual >= 1000) {
          let idReal: number | undefined;
          
          // Estrategia 1: Buscar nombre en el concepto
          const nombreDelConcepto = extraerNombreDelConcepto(transaccion.concepto);
          if (nombreDelConcepto) {
            idReal = mapeoNombreAIdReal.get(nombreDelConcepto.toLowerCase().trim());
            if (idReal) {
              console.log(`🔍 Transacción ${transaccion.id}: Encontrado nombre "${nombreDelConcepto}" en concepto -> ID real ${idReal}`);
            }
          }
          
          // Estrategia 2: Usar mapeo de ID artificial (fallback)
          if (!idReal) {
            const nombreVolquetero = mapeoIdArtificialANombre.get(idActual);
            if (nombreVolquetero) {
              idReal = mapeoNombreAIdReal.get(nombreVolquetero.toLowerCase().trim());
              if (idReal) {
                console.log(`🔍 Transacción ${transaccion.id}: ID artificial ${idActual} -> "${nombreVolquetero}" -> ID real ${idReal}`);
              }
            }
          }
          
          if (idReal) {
            updates.paraQuienId = idReal.toString();
            necesitaActualizacion = true;
          } else {
            sinMapeo++;
            console.log(`⚠️  No se encontró ID real para transacción ${transaccion.id} (ID artificial ${idActual}, concepto: "${transaccion.concepto}")`);
          }
        }
      }
      
      // Actualizar la transacción si es necesario
      if (necesitaActualizacion) {
        try {
          await db
            .update(transacciones)
            .set(updates)
            .where(eq(transacciones.id, transaccion.id));
          actualizadas++;
          console.log(`✅ Transacción ${transaccion.id} actualizada: ${JSON.stringify(updates)}`);
        } catch (error: any) {
          console.error(`❌ Error actualizando transacción ${transaccion.id}:`, error.message);
        }
      }
    }
    
    console.log(`=== MIGRACIÓN DE TRANSACCIONES COMPLETADA ===`);
    console.log(`✅ Transacciones actualizadas: ${actualizadas}`);
    console.log(`⚠️  Transacciones sin mapeo: ${sinMapeo}`);
    console.log(`📊 Total transacciones procesadas: ${transaccionesOrfanas.length}`);
    
  } catch (error: any) {
    console.error('❌ Error migrando transacciones huérfanas:', error.message);
    console.error('❌ Stack:', error.stack);
    // No lanzar error para no bloquear la inicialización
  }
}

/**
 * Migra volqueteros desde viajes: crea registros en la tabla volqueteros
 * para todos los conductores únicos que aparecen en viajes pero no tienen
 * un registro correspondiente en volqueteros.
 * 
 * Esta función es idempotente: puede ejecutarse múltiples veces sin crear duplicados.
 */
export async function migrateVolqueterosFromViajes() {
  console.log('=== MIGRANDO VOLQUETEROS DESDE VIAJES ===');
  
  try {
    // Obtener todos los viajes (sin filtrar por userId para migración completa)
    const todosViajes = await storage.getViajes();
    
    if (todosViajes.length === 0) {
      console.log('✅ No hay viajes para migrar');
      return;
    }
    
    // Obtener todos los volqueteros existentes
    const volqueterosExistentes = await storage.getVolqueteros();
    const volqueterosPorNombre = new Map<string, boolean>();
    volqueterosExistentes.forEach((v) => {
      const nombreNormalizado = v.nombre.toLowerCase().trim();
      volqueterosPorNombre.set(nombreNormalizado, true);
    });
    
    // Agrupar viajes por conductor (nombre normalizado)
    const conductoresPorNombre = new Map<string, {
      nombre: string;
      placaMasComun: string;
      userId: string | null;
      totalViajes: number;
    }>();
    
    // Contar placas por conductor para encontrar la más común
    const placasPorConductor = new Map<string, Map<string, number>>();
    
    todosViajes.forEach((viaje) => {
      if (!viaje.conductor) return;
      
      const nombreOriginal = viaje.conductor;
      const nombreNormalizado = nombreOriginal.toLowerCase().trim();
      
      // Inicializar contador de placas para este conductor
      if (!placasPorConductor.has(nombreNormalizado)) {
        placasPorConductor.set(nombreNormalizado, new Map());
      }
      
      const placa = viaje.placa || "Sin placa";
      const contadorPlacas = placasPorConductor.get(nombreNormalizado)!;
      contadorPlacas.set(placa, (contadorPlacas.get(placa) || 0) + 1);
      
      // Inicializar datos del conductor
      if (!conductoresPorNombre.has(nombreNormalizado)) {
        conductoresPorNombre.set(nombreNormalizado, {
          nombre: nombreOriginal, // Mantener el nombre original (con mayúsculas)
          placaMasComun: placa, // Temporal, se actualizará después
          userId: viaje.userId || null,
          totalViajes: 0,
        });
      }
      
      const datosConductor = conductoresPorNombre.get(nombreNormalizado)!;
      datosConductor.totalViajes++;
    });
    
    // Encontrar la placa más común para cada conductor
    conductoresPorNombre.forEach((datos, nombreNormalizado) => {
      const contadorPlacas = placasPorConductor.get(nombreNormalizado);
      if (contadorPlacas) {
        let placaMasComun = "Sin placa";
        let maxCount = 0;
        contadorPlacas.forEach((count, placa) => {
          if (count > maxCount) {
            maxCount = count;
            placaMasComun = placa;
          }
        });
        datos.placaMasComun = placaMasComun;
      }
    });
    
    // Crear volqueteros que no existen
    let creados = 0;
    let yaExistentes = 0;
    
    for (const [nombreNormalizado, datos] of conductoresPorNombre) {
      // Verificar si ya existe un volquetero con este nombre
      if (volqueterosPorNombre.has(nombreNormalizado)) {
        yaExistentes++;
        continue;
      }
      
      // Crear volquetero usando findOrCreateVolqueteroByNombre (maneja duplicados y race conditions)
      try {
        await storage.findOrCreateVolqueteroByNombre(
          datos.nombre,
          datos.placaMasComun,
          datos.userId || undefined
        );
        creados++;
        console.log(`✅ Volquetero creado: "${datos.nombre}" (${datos.totalViajes} viajes, placa: ${datos.placaMasComun})`);
      } catch (error: any) {
        // Si hay un error (por ejemplo, ya fue creado por otra instancia), continuar
        console.log(`⚠️  No se pudo crear volquetero "${datos.nombre}": ${error.message}`);
      }
    }
    
    console.log(`=== MIGRACIÓN COMPLETADA ===`);
    console.log(`✅ Volqueteros creados: ${creados}`);
    console.log(`ℹ️  Volqueteros ya existentes: ${yaExistentes}`);
    console.log(`📊 Total conductores únicos: ${conductoresPorNombre.size}`);
    
  } catch (error: any) {
    console.error('❌ Error migrando volqueteros desde viajes:', error.message);
    // No lanzar error para no bloquear la inicialización
    // La migración puede ejecutarse en el próximo inicio
  }
}

export async function initializeDatabase() {
  console.log('=== INICIALIZANDO BASE DE DATOS POSTGRESQL ===');
  
  try {
    // Primero inicializar roles y permisos
    await initializeRolesAndPermissions();
    
    // Agregar permisos faltantes (para bases de datos existentes)
    await addMissingPermissionsFromFile();
    
    // Luego crear usuario admin por defecto si no existe
    await initializeAdminUser();
    
    // Migrar volqueteros desde viajes (crear IDs reales para todos los conductores)
    await migrateVolqueterosFromViajes();
    
    // Migrar transacciones huérfanas (actualizar IDs artificiales a reales)
    await migrateTransaccionesOrphanas();
    
    // Verificar si ya hay datos
    const existingMinas = await db.select().from(minas);
    
    if (existingMinas.length > 0) {
      console.log('=== Base de datos ya tiene datos, omitiendo inicialización ===');
      return;
    }

    // Crear datos iniciales
    console.log('=== Creando minas iniciales ===');
    const mina1 = await db.insert(minas).values({
      nombre: 'Mina El Dorado',
      saldo: '315000',
      createdAt: new Date()
    }).returning();

    const mina2 = await db.insert(minas).values({
      nombre: 'Mina La Esperanza',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando compradores iniciales ===');
    const comprador1 = await db.insert(compradores).values({
      nombre: 'Cemex S.A.',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    const comprador2 = await db.insert(compradores).values({
      nombre: 'Argos Colombia',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando volqueteros iniciales ===');
    const volquetero1 = await db.insert(volqueteros).values({
      nombre: 'Uver',
      placa: 'SRS148',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando viaje inicial TRP001 ===');
    const viajeInicial = await db.insert(viajes).values({
      id: 'TRP001',
      fechaCargue: new Date('2025-06-25T05:00:00Z'),
      fechaDescargue: new Date('2025-06-25T10:00:00Z'),
      conductor: 'Uver',
      tipoCarro: 'Sencillo',
      placa: 'SRS148',
      minaId: mina1[0].id,
      compradorId: comprador1[0].id,
      peso: '21',
      precioCompraTon: '100000',
      ventaTon: '150000',
      fleteTon: '40000',
      otrosGastosFlete: '0',
      vut: '3150000',
      cut: '2100000',
      fut: '840000',
      totalVenta: '3150000',
      totalCompra: '2100000',
      totalFlete: '840000',
      valorConsignar: '2310000',
      ganancia: '210000',
      estado: 'completado',
      quienPagaFlete: 'Tú',
      voucher: null,
      recibo: null,
      comentario: null,
      createdAt: new Date()
    }).returning();

    console.log('=== Creando transacción inicial para el viaje ===');
    await db.insert(transacciones).values({
      tipoSocio: 'comprador',
      socioId: comprador1[0].id,
      concepto: 'Viaje TRP001',
      valor: '-2310000',
      fecha: new Date('2025-06-25T10:00:00Z'),
      formaPago: 'Efectivo',
      voucher: null,
      comentario: 'Valor a consignar del viaje TRP001',
      createdAt: new Date()
    });

    console.log('=== BASE DE DATOS INICIALIZADA EXITOSAMENTE ===');
    console.log(`- Minas creadas: ${mina1.length + mina2.length}`);
    console.log(`- Compradores creados: ${comprador1.length + comprador2.length}`);
    console.log(`- Volqueteros creados: ${volquetero1.length}`);
    console.log(`- Viajes creados: ${viajeInicial.length}`);
    console.log('- Transacciones creadas: 1');
    
  } catch (error) {
    console.error('=== ERROR INICIALIZANDO BASE DE DATOS ===', error);
    throw error;
  }
}