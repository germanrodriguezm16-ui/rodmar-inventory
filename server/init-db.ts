import { db } from './db';
import { minas, compradores, volqueteros, viajes, transacciones, roles, permissions, rolePermissions, users } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

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
      // Módulos (6)
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
      { key: 'module.COMPRADORES.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Compradores', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Volqueteros', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Volqueteros', categoria: 'tab' },
      { key: 'module.RODMAR.accounts.view', descripcion: 'Ver cuentas RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.LCDM.view', descripcion: 'Ver sección LCDM en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.Postobon.view', descripcion: 'Ver sección Postobón en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.balances.view', descripcion: 'Ver balances globales en RodMar', categoria: 'tab' },
      { key: 'module.TRANSACCIONES.tab.pending.view', descripcion: 'Ver transacciones pendientes', categoria: 'tab' },
      
      // Acciones (17)
      { key: 'action.TRANSACCIONES.create', descripcion: 'Crear transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.edit', descripcion: 'Editar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.delete', descripcion: 'Eliminar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.hide', descripcion: 'Ocultar transacciones', categoria: 'action' },
      { key: 'action.TRANSACCIONES.viewPending', descripcion: 'Ver transacciones pendientes', categoria: 'action' },
      { key: 'action.TRANSACCIONES.completePending', descripcion: 'Completar transacciones pendientes', categoria: 'action' },
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

export async function initializeDatabase() {
  console.log('=== INICIALIZANDO BASE DE DATOS POSTGRESQL ===');
  
  try {
    // Primero inicializar roles y permisos
    await initializeRolesAndPermissions();
    
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