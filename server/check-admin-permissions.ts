import { db } from './db';
import { permissions, rolePermissions, roles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Script para verificar que el rol ADMIN tiene todos los permisos asignados
 */
async function checkAdminPermissions() {
  console.log('=== VERIFICANDO PERMISOS DEL ROL ADMIN ===\n');
  
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

    console.log(`✅ Rol ADMIN encontrado (ID: ${adminRole[0].id})\n`);

    // Obtener todos los permisos del sistema
    const allPermissions = await db.select().from(permissions);
    console.log(`📋 Total de permisos en el sistema: ${allPermissions.length}\n`);

    // Obtener permisos asignados al ADMIN
    const adminPermissions = await db
      .select({
        permissionId: rolePermissions.permissionId,
        permissionKey: permissions.key,
        permissionDescripcion: permissions.descripcion,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, adminRole[0].id));

    console.log(`✅ Permisos asignados al ADMIN: ${adminPermissions.length}\n`);

    // Crear un Set de IDs de permisos asignados para búsqueda rápida
    const assignedPermissionIds = new Set(adminPermissions.map(p => p.permissionId));

    // Encontrar permisos faltantes
    const missingPermissions = allPermissions.filter(
      p => !assignedPermissionIds.has(p.id)
    );

    if (missingPermissions.length === 0) {
      console.log('✅ El rol ADMIN tiene TODOS los permisos asignados\n');
      console.log('📊 Resumen por categoría:');
      
      const byCategory: Record<string, number> = {};
      adminPermissions.forEach(p => {
        const categoria = allPermissions.find(ap => ap.id === p.permissionId)?.categoria || 'unknown';
        byCategory[categoria] = (byCategory[categoria] || 0) + 1;
      });
      
      Object.entries(byCategory).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });
    } else {
      console.log(`⚠️  El rol ADMIN tiene ${missingPermissions.length} permisos FALTANTES:\n`);
      
      missingPermissions.forEach(perm => {
        console.log(`   ❌ ${perm.key} - ${perm.descripcion} (${perm.categoria})`);
      });
      
      console.log('\n💡 Ejecuta el script add-missing-permissions para asignarlos automáticamente');
    }

    // Mostrar lista completa de permisos asignados por categoría
    console.log('\n=== PERMISOS ASIGNADOS AL ADMIN (por categoría) ===\n');
    
    const byCategory: Record<string, typeof adminPermissions> = {};
    adminPermissions.forEach(p => {
      const perm = allPermissions.find(ap => ap.id === p.permissionId);
      if (perm) {
        const categoria = perm.categoria || 'unknown';
        if (!byCategory[categoria]) {
          byCategory[categoria] = [];
        }
        byCategory[categoria].push(p);
      }
    });

    Object.entries(byCategory).forEach(([cat, perms]) => {
      console.log(`\n📁 ${cat.toUpperCase()} (${perms.length} permisos):`);
      perms.forEach(p => {
        console.log(`   ✅ ${p.permissionKey}`);
      });
    });

    console.log('\n=== VERIFICACIÓN COMPLETADA ===');
    
  } catch (error) {
    console.error('=== ERROR VERIFICANDO PERMISOS ===', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('check-admin-permissions.ts')) {
  checkAdminPermissions()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

export { checkAdminPermissions };

