import { db } from './db';
import { permissions, rolePermissions, roles, rodmarCuentas, terceros, userPermissionsOverride, minas, compradores, volqueteros } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { assignPermissionToAdminRole, createRodMarAccountPermission } from './rodmar-account-permissions';
import { createTerceroPermission, getTerceroPermissionKey } from './tercero-permissions';

/**
 * Script para agregar los permisos faltantes de pestañas de Viajes
 * en Compradores y Volqueteros a la base de datos existente
 */
async function addMissingPermissions() {
  console.log('=== AGREGANDO PERMISOS FALTANTES ===');
  
  try {
    const verboseEnv = (process.env.PERMISSIONS_SYNC_VERBOSE || "").toLowerCase();
    const verbose = verboseEnv === "1" || verboseEnv === "true" || verboseEnv === "yes";
    const detail = (...args: any[]) => {
      if (verbose) console.log(...args);
    };

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

    const ensurePermission = async (key: string, descripcion: string, categoria: string) => {
      const existing = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.key, key))
        .limit(1);

      if (existing.length > 0) {
        return existing[0].id;
      }

      const [created] = await db
        .insert(permissions)
        .values({ key, descripcion, categoria })
        .returning();
      return created.id;
    };

    const transactionAccessKeys = [
      'action.TRANSACCIONES.create',
      'action.TRANSACCIONES.completePending',
      'action.TRANSACCIONES.edit',
      'action.TRANSACCIONES.solicitar',
    ];

    const rolesWithTransactionAccess = await db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(permissions.key, transactionAccessKeys));

    const rolesWithAccessSet = new Set(rolesWithTransactionAccess.map((r) => r.roleId));

    const assignPermissionToRoles = async (permissionId: number) => {
      for (const roleId of rolesWithAccessSet) {
        try {
          await db.insert(rolePermissions).values({
            roleId,
            permissionId,
          });
        } catch (error: any) {
          if (error.code !== '23505') {
            throw error;
          }
        }
      }
    };

    const assignAllowOverride = async (permissionId: number, userId: string) => {
      try {
        await db.insert(userPermissionsOverride).values({
          userId,
          permissionId,
          overrideType: "allow",
        });
      } catch (error: any) {
        if (error.code !== '23505') {
          throw error;
        }
      }
    };

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
          detail(`✅ Permiso ${perm.key} asignado al rol ADMIN`);
        } catch (error: any) {
          // Si ya está asignado (error 23505), ignorar
          if (error.code === '23505' && error.constraint_name === 'unique_role_permission') {
            detail(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
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
        detail(`✅ Permiso ${perm.key} ya existe (ID: ${permissionId})`);
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
              detail(`✅ Permiso ${perm.key} ya existía (ID: ${permissionId})`);
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
          detail(`✅ Permiso ${perm.key} asignado al rol ADMIN`);
        } catch (error: any) {
          // Si ya está asignado (error 23505), ignorar
          if (error.code === '23505' && error.constraint_name === 'unique_role_permission') {
            detail(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      } else {
        detail(`✅ Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
      }
    }

    // RodMar: permisos por cuenta deben ser DINÁMICOS (por código), no hardcodeados.
    // Esto evita que se "recreen" permisos legacy obsoletos al hacer deploy/restart.
    try {
      const cuentas = await db.select().from(rodmarCuentas);
      if (cuentas.length > 0) {
        console.log(`🔐 Verificando permisos dinámicos de RodMar para ${cuentas.length} cuentas...`);
      }

      for (const cuenta of cuentas) {
        // Crear (o reutilizar) permiso por código
        const permissionId = await createRodMarAccountPermission(cuenta.codigo, cuenta.nombre);
        if (!permissionId) continue;

        // Asegurar que ADMIN lo tenga asignado (conveniencia)
        await assignPermissionToAdminRole(`module.RODMAR.account.${cuenta.codigo}.view`);

        // Permiso USE por cuenta
        const useKey = `action.TRANSACCIONES.rodmar.account.${cuenta.codigo}.use`;
        const usePermissionId = await ensurePermission(
          useKey,
          `Usar cuenta RodMar: ${cuenta.nombre}`,
          'action',
        );
        await assignPermissionToAdminRole(useKey);
        await assignPermissionToRoles(usePermissionId);
      }
    } catch (error: any) {
      console.warn('⚠️  No se pudo verificar/crear permisos dinámicos de RodMar (se omite):', error?.message || error);
    }

    // Terceros: permisos por ID (dinámicos)
    try {
      const tercerosList = await db.select().from(terceros);
      if (tercerosList.length > 0) {
        console.log(`🔐 Verificando permisos dinámicos de Terceros para ${tercerosList.length} registros...`);
      }

      for (const tercero of tercerosList) {
        const permissionId = await createTerceroPermission(tercero.id, tercero.nombre);
        if (!permissionId) continue;

        const permisoKey = getTerceroPermissionKey(tercero.id);
        await assignPermissionToAdminRole(permisoKey);

        // Mantener acceso al dueño (override allow) para compatibilidad con el flujo actual
        if (tercero.userId) {
          try {
            await db.insert(userPermissionsOverride).values({
              userId: tercero.userId,
              permissionId,
              overrideType: "allow",
            });
          } catch (error: any) {
            if (error?.code !== "23505") throw error;
          }
        }

        // Permiso USE por tercero
        const useKey = `action.TRANSACCIONES.tercero.${tercero.id}.use`;
        const usePermissionId = await ensurePermission(
          useKey,
          `Usar tercero: ${tercero.nombre}`,
          'action',
        );
        await assignPermissionToAdminRole(useKey);
        await assignPermissionToRoles(usePermissionId);
      }
    } catch (error: any) {
      console.warn('⚠️  No se pudo verificar/crear permisos dinámicos de Terceros (se omite):', error?.message || error);
    }

    // Minas: permisos USE por ID
    try {
      const minasList = await db.select().from(minas);
      if (minasList.length > 0) {
        console.log(`🔐 Verificando permisos USE de Minas para ${minasList.length} registros...`);
      }

      for (const mina of minasList) {
        const useKey = `action.TRANSACCIONES.mina.${mina.id}.use`;
        const usePermissionId = await ensurePermission(
          useKey,
          `Usar mina: ${mina.nombre}`,
          'action',
        );
        await assignPermissionToAdminRole(useKey);
        await assignPermissionToRoles(usePermissionId);

        const viewKey = `module.MINAS.mina.${mina.id}.view`;
        const viewPermissionId = await ensurePermission(
          viewKey,
          `Ver mina: ${mina.nombre}`,
          'entity',
        );
        await assignPermissionToAdminRole(viewKey);
        if (mina.userId) {
          await assignAllowOverride(viewPermissionId, mina.userId);
        }
      }
    } catch (error: any) {
      console.warn('⚠️  No se pudo verificar/crear permisos USE de Minas (se omite):', error?.message || error);
    }

    // Compradores: permisos USE por ID
    try {
      const compradoresList = await db.select().from(compradores);
      if (compradoresList.length > 0) {
        console.log(`🔐 Verificando permisos USE de Compradores para ${compradoresList.length} registros...`);
      }

      for (const comprador of compradoresList) {
        const useKey = `action.TRANSACCIONES.comprador.${comprador.id}.use`;
        const usePermissionId = await ensurePermission(
          useKey,
          `Usar comprador: ${comprador.nombre}`,
          'action',
        );
        await assignPermissionToAdminRole(useKey);
        await assignPermissionToRoles(usePermissionId);

        const viewKey = `module.COMPRADORES.comprador.${comprador.id}.view`;
        const viewPermissionId = await ensurePermission(
          viewKey,
          `Ver comprador: ${comprador.nombre}`,
          'entity',
        );
        await assignPermissionToAdminRole(viewKey);
        if (comprador.userId) {
          await assignAllowOverride(viewPermissionId, comprador.userId);
        }
      }
    } catch (error: any) {
      console.warn('⚠️  No se pudo verificar/crear permisos USE de Compradores (se omite):', error?.message || error);
    }

    // Volqueteros: permisos USE por ID
    try {
      const volqueterosList = await db.select().from(volqueteros);
      if (volqueterosList.length > 0) {
        console.log(`🔐 Verificando permisos USE de Volqueteros para ${volqueterosList.length} registros...`);
      }

      for (const volquetero of volqueterosList) {
        const useKey = `action.TRANSACCIONES.volquetero.${volquetero.id}.use`;
        const usePermissionId = await ensurePermission(
          useKey,
          `Usar volquetero: ${volquetero.nombre}`,
          'action',
        );
        await assignPermissionToAdminRole(useKey);
        await assignPermissionToRoles(usePermissionId);

        const viewKey = `module.VOLQUETEROS.volquetero.${volquetero.id}.view`;
        const viewPermissionId = await ensurePermission(
          viewKey,
          `Ver volquetero: ${volquetero.nombre}`,
          'entity',
        );
        await assignPermissionToAdminRole(viewKey);
        if (volquetero.userId) {
          await assignAllowOverride(viewPermissionId, volquetero.userId);
        }
      }
    } catch (error: any) {
      console.warn('⚠️  No se pudo verificar/crear permisos USE de Volqueteros (se omite):', error?.message || error);
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

