import { db } from './db';
import { permissions, rolePermissions, roles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Script para agregar los permisos faltantes de pestañas de Viajes
 * en Compradores y Volqueteros a la base de datos existente
 */
async function addMissingPermissions() {
  console.log('=== AGREGANDO PERMISOS FALTANTES ===');
  
  try {
    // Obtener rol ADMIN
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.nombre, 'ADMIN'))
      .limit(1);

    if (adminRole.length === 0) {
      console.log('❌ No se encontró el rol ADMIN');
      return;
    }

    // Permisos a agregar/verificar
    const missingPermissions = [
      { key: 'module.PRINCIPAL.view', descripcion: 'Ver módulo Principal (Viajes)', categoria: 'module' },
      { key: 'action.TRANSACCIONES.solicitar', descripcion: 'Solicitar transacciones pendientes', categoria: 'action' },
      { key: 'module.COMPRADORES.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Volqueteros', categoria: 'tab' },
      { key: 'module.RODMAR.tab.TERCEROS.view', descripcion: 'Ver pestaña Terceros en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.LCDM.view', descripcion: 'Ver sección LCDM en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.Banco.view', descripcion: 'Ver sección Banco en RodMar', categoria: 'tab' },
      { key: 'module.RODMAR.Postobon.view', descripcion: 'Ver sección Postobón en RodMar', categoria: 'tab' },
      // Permisos por cuenta RodMar individual
      { key: 'module.RODMAR.account.Bemovil.view', descripcion: 'Ver cuenta RodMar: Bemovil', categoria: 'account' },
      { key: 'module.RODMAR.account.Corresponsal.view', descripcion: 'Ver cuenta RodMar: Corresponsal', categoria: 'account' },
      { key: 'module.RODMAR.account.Efectivo.view', descripcion: 'Ver cuenta RodMar: Efectivo', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas German.view', descripcion: 'Ver cuenta RodMar: Cuentas German', categoria: 'account' },
      { key: 'module.RODMAR.account.Cuentas Jhon.view', descripcion: 'Ver cuenta RodMar: Cuentas Jhon', categoria: 'account' },
      { key: 'module.RODMAR.account.Otros.view', descripcion: 'Ver cuenta RodMar: Otros', categoria: 'account' },
    ];

    // Obtener todos los permisos del sistema para verificar si faltan asignaciones
    const allPermissions = await db.select().from(permissions);
    
    // Obtener permisos ya asignados al ADMIN
    const adminPermissions = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, adminRole[0].id));

    const assignedPermissionIds = new Set(adminPermissions.map(p => p.permissionId));
    
    console.log(`📊 Total permisos en sistema: ${allPermissions.length}`);
    console.log(`📊 Permisos asignados al ADMIN: ${assignedPermissionIds.size}`);
    
    // Verificar si hay permisos del sistema que no están asignados al ADMIN
    const unassignedSystemPermissions = allPermissions.filter(
      p => !assignedPermissionIds.has(p.id)
    );

    if (unassignedSystemPermissions.length > 0) {
      console.log(`\n⚠️  Encontrados ${unassignedSystemPermissions.length} permisos del sistema NO asignados al ADMIN:`);
      unassignedSystemPermissions.forEach(perm => {
        console.log(`   - ${perm.key} (${perm.categoria})`);
      });
      console.log('\n📝 Asignando permisos faltantes al ADMIN...\n');
    }

    // Primero, asignar todos los permisos del sistema que no están asignados
    let assignedCount = 0;
    for (const perm of unassignedSystemPermissions) {
      const existingAssignment = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, adminRole[0].id),
            eq(rolePermissions.permissionId, perm.id)
          )
        )
        .limit(1);

      if (existingAssignment.length === 0) {
        try {
          await db.insert(rolePermissions).values({
            roleId: adminRole[0].id,
            permissionId: perm.id,
          });
          assignedCount++;
          console.log(`✅ Permiso ${perm.key} asignado al rol ADMIN`);
        } catch (error: any) {
          // Si ya está asignado (error 23505), ignorar
          if (error.code === '23505' && error.constraint_name === 'unique_role_permission') {
            console.log(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      }
    }

    if (assignedCount > 0) {
      console.log(`\n✅ ${assignedCount} permisos del sistema asignados al ADMIN\n`);
    }

    // Luego, verificar y agregar los permisos específicos de la lista
    for (const perm of missingPermissions) {
      // Verificar si el permiso ya existe
      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.key, perm.key))
        .limit(1);

      let permissionId: number;

      if (existing.length > 0) {
        permissionId = existing[0].id;
        console.log(`✅ Permiso ${perm.key} ya existe (ID: ${permissionId})`);
      } else {
        // Crear el permiso con manejo de duplicados
        try {
          const [newPermission] = await db
            .insert(permissions)
            .values(perm)
            .returning();
          permissionId = newPermission.id;
          console.log(`✅ Permiso creado: ${perm.key} (ID: ${permissionId})`);
        } catch (error: any) {
          // Si el permiso ya existe (error 23505), obtenerlo
          if (error.code === '23505' && error.constraint_name === 'permissions_key_unique') {
            const existingPerm = await db
              .select()
              .from(permissions)
              .where(eq(permissions.key, perm.key))
              .limit(1);
            if (existingPerm.length > 0) {
              permissionId = existingPerm[0].id;
              console.log(`✅ Permiso ${perm.key} ya existía (ID: ${permissionId})`);
            } else {
              throw error; // Re-lanzar si no podemos obtenerlo
            }
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      }

      // Verificar si ya está asignado al ADMIN
      const existingAssignment = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, adminRole[0].id),
            eq(rolePermissions.permissionId, permissionId)
          )
        )
        .limit(1);

      if (existingAssignment.length === 0) {
        try {
          await db.insert(rolePermissions).values({
            roleId: adminRole[0].id,
            permissionId: permissionId,
          });
          console.log(`✅ Permiso ${perm.key} asignado al rol ADMIN`);
        } catch (error: any) {
          // Si ya está asignado (error 23505), ignorar
          if (error.code === '23505' && error.constraint_name === 'unique_role_permission') {
            console.log(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      } else {
        console.log(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
      }
    }

    console.log('=== PERMISOS FALTANTES AGREGADOS EXITOSAMENTE ===');
    
  } catch (error: any) {
    console.error('=== ERROR AGREGANDO PERMISOS FALTANTES ===', error);
    // No lanzar error para no bloquear la inicialización si es un error de duplicado
    if (error.code === '23505') {
      console.log('⚠️  Error de duplicado ignorado (permiso o asignación ya existe)');
    } else {
      throw error; // Re-lanzar otros errores
    }
  }
}

// Ejecutar solo si se llama directamente como script (no cuando se importa como módulo)
// Verificar si este archivo es el punto de entrada principal
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('add-missing-permissions.ts') ||
  process.argv[1].endsWith('add-missing-permissions.js') ||
  process.argv[1].includes('add-missing-permissions')
);

if (isMainModule) {
  addMissingPermissions()
    .then(() => {
      console.log('✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

export { addMissingPermissions };

