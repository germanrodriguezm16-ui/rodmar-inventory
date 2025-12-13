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
    // Permisos a agregar
    const missingPermissions = [
      { key: 'module.COMPRADORES.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Compradores', categoria: 'tab' },
      { key: 'module.VOLQUETEROS.tab.VIAJES.view', descripcion: 'Ver pestaña Viajes en Volqueteros', categoria: 'tab' },
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
        console.log(`⚠️  Permiso ${perm.key} ya existe, omitiendo...`);
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
        } else {
          console.log(`⚠️  Permiso ${perm.key} ya estaba asignado al rol ADMIN`);
        }
      } else {
        console.log(`⚠️  No se encontró el rol ADMIN, no se puede asignar el permiso`);
      }
    }

    console.log('=== PERMISOS FALTANTES AGREGADOS EXITOSAMENTE ===');
    
  } catch (error) {
    console.error('=== ERROR AGREGANDO PERMISOS FALTANTES ===', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
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

