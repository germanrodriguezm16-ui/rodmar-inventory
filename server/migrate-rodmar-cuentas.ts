import { db } from './db';
import { rodmarCuentas } from '../shared/schema';
import { createRodMarAccountPermission } from './rodmar-account-permissions';
import { eq } from 'drizzle-orm';

/**
 * Script para migrar las cuentas RodMar hardcodeadas a la tabla rodmar_cuentas
 * Ejecutar una sola vez después de crear la tabla
 */
export async function migrateRodMarCuentas() {
  try {
    console.log('🔄 Iniciando migración de cuentas RodMar...');

    // Definir las 6 cuentas existentes con sus códigos únicos
    const cuentasExistentes = [
      { nombre: 'Bemovil', codigo: 'BEMOVIL' },
      { nombre: 'Corresponsal', codigo: 'CORRESPONSAL' },
      { nombre: 'Efectivo', codigo: 'EFECTIVO' },
      { nombre: 'Cuentas German', codigo: 'CUENTAS_GERMAN' },
      { nombre: 'Cuentas Jhon', codigo: 'CUENTAS_JHON' },
      { nombre: 'Otros', codigo: 'OTROS' },
    ];

    let created = 0;
    let skipped = 0;

    for (const cuenta of cuentasExistentes) {
      // Verificar si ya existe por código
      const existing = await db
        .select()
        .from(rodmarCuentas)
        .where(eq(rodmarCuentas.codigo, cuenta.codigo))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Cuenta "${cuenta.nombre}" (${cuenta.codigo}) ya existe, omitiendo...`);
        skipped++;
        continue;
      }

      // Crear la cuenta
      const [newCuenta] = await db
        .insert(rodmarCuentas)
        .values({
          nombre: cuenta.nombre,
          codigo: cuenta.codigo,
          userId: null, // Las cuentas originales no tienen userId específico
        })
        .returning();

      console.log(`✅ Cuenta creada: ${newCuenta.nombre} (ID: ${newCuenta.id}, Código: ${newCuenta.codigo})`);

      // Crear el permiso automáticamente (usando código, no nombre)
      await createRodMarAccountPermission(newCuenta.codigo, newCuenta.nombre);
      console.log(`   → Permiso creado para: ${newCuenta.nombre} (código: ${newCuenta.codigo})`);

      created++;
    }

    console.log(`\n✅ Migración completada: ${created} cuentas creadas, ${skipped} omitidas`);
    return { created, skipped };
  } catch (error) {
    console.error('❌ Error en migración de cuentas RodMar:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateRodMarCuentas()
    .then(() => {
      console.log('✅ Migración completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}

