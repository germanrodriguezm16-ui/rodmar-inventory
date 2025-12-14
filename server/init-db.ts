import { db } from './db';
import { minas, compradores, volqueteros, viajes, transacciones, roles, permissions, rolePermissions, users } from '../shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import { hashPassword } from './middleware/auth-helpers';
import { addMissingPermissions } from './add-missing-permissions';

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
      { key: 'module.COMPRADORES.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Compradores', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.TRANSACCIONES.view', descripcion: 'Ver pestaña Transacciones en Compradores', categoria: 'tab' },
      { key: 'module.COMPRADORES.tab.BALANCES.view', descripcion: 'Ver pestaña Balances en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Volqueteros', categoria: 'tab' },
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
    const mainUser = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roleId: users.roleId,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, 'main_user'))
      .limit(1);
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

export async function initializeDatabase() {
  console.log('=== INICIALIZANDO BASE DE DATOS POSTGRESQL ===');
  
  try {
    // Primero inicializar roles y permisos
    console.log('🔧 [INIT-DB] Llamando a initializeRolesAndPermissions()...');
    await initializeRolesAndPermissions();
    console.log('✅ [INIT-DB] initializeRolesAndPermissions() completado');
    
    // Agregar permisos faltantes (para bases de datos existentes)
    console.log('🔧 [INIT-DB] Llamando a addMissingPermissions()...');
    await addMissingPermissions();
    console.log('✅ [INIT-DB] addMissingPermissions() completado');
    
    // Luego crear usuario admin por defecto si no existe
    console.log('🔧 [INIT-DB] Llamando a initializeAdminUser()...');
    await initializeAdminUser();
    console.log('✅ [INIT-DB] initializeAdminUser() completado');
    
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