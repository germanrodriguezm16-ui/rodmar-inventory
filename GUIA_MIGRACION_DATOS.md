# 🔄 Guía Completa de Migración de Datos desde Replit

Esta guía te ayudará a migrar tus datos de forma segura, manejando correctamente los datos de ensayo y evitando conflictos de IDs.

## 📋 Problema de IDs

### Transacciones
- **Tipo de ID**: `serial` (auto-increment)
- **Problema**: Si migras datos de ensayo, los IDs se incrementarán. Si luego eliminas los de ensayo, habrá huecos pero **NO habrá conflictos**.
- **Ejemplo**: Si tienes transacciones con IDs 1-100 (ensayo) y las migras, luego creas transacciones reales, estas tendrán IDs 101, 102, etc. Si eliminas las de ensayo, los IDs 1-100 quedarán libres pero las nuevas seguirán usando 101+.

### Viajes
- **Tipo de ID**: Formato personalizado (A1, A2, B1, B2, etc.)
- **Problema**: Si migras viajes de ensayo con IDs como "A1", "A2", estos IDs quedarán ocupados. Cuando intentes crear viajes reales, el generador buscará el siguiente disponible (A3, A4, etc.), pero los IDs de ensayo estarán ocupando espacio.
- **Ejemplo**: Si migras viajes A1-A10 (ensayo), cuando crees viajes reales empezarán en A11, dejando A1-A10 ocupados pero sin usar.

## ✅ Recomendación: Limpiar ANTES de Migrar

**La mejor opción es limpiar los datos de ensayo en Replit ANTES de migrar.** Así:
- ✅ Los IDs de ensayo no se migran
- ✅ No ocupan espacio en Supabase
- ✅ Los IDs reales empiezan desde el principio
- ✅ No hay confusión entre datos de ensayo y reales

## 🚀 Proceso Recomendado

### Paso 1: Identificar Datos de Ensayo

Antes de limpiar, identifica qué datos son de ensayo:

**Transacciones de ensayo suelen tener:**
- Conceptos como: "prueba", "test", "ensayo", "demo", "ejemplo"
- Valores muy pequeños (menores a $1000)
- Fechas antiguas o de prueba

**Viajes de ensayo suelen tener:**
- Conductores como: "prueba", "test", "demo"
- Placas como: "TEST", "PRUEBA", "DEMO", "0000"
- Fechas antiguas o de prueba

### Paso 2: Limpiar Datos de Ensayo en Replit

1. **Configurar DATABASE_URL para Replit**:
   ```env
   # En tu .env, temporalmente cambia DATABASE_URL a Replit
   DATABASE_URL=postgresql://usuario:password@host-replit:5432/database
   ```

2. **Ejecutar script de limpieza**:
   ```bash
   npm run clean:test-data
   ```

3. **Seguir las instrucciones interactivas**:
   - Selecciona opción 1 (Replit)
   - Elige criterios automáticos o personalizados
   - Revisa los datos encontrados
   - Confirma la eliminación

### Paso 3: Verificar Limpieza

Después de limpiar, verifica que solo quedaron datos reales:
- Revisa las transacciones y viajes en Replit
- Asegúrate de que no eliminaste datos importantes

### Paso 4: Migrar Datos Limpios

1. **Configurar DATABASE_URL para Supabase**:
   ```env
   # Cambia DATABASE_URL de vuelta a Supabase
   DATABASE_URL=postgresql://postgres.ftzkvgawbigqfndualpu:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres
   ```

2. **Configurar REPLIT_DATABASE_URL**:
   ```env
   REPLIT_DATABASE_URL=postgresql://usuario:password@host-replit:5432/database
   ```

3. **Ejecutar migración**:
   ```bash
   npm run migrate:replit
   ```

### Paso 5: Verificar Migración

Después de migrar, verifica en Supabase:
- Todas las transacciones y viajes reales están presentes
- Los balances son correctos
- No hay datos de ensayo

## 🔄 Alternativa: Limpiar DESPUÉS de Migrar

Si prefieres migrar todo primero y luego limpiar:

1. **Migrar todo** (incluyendo datos de ensayo):
   ```bash
   npm run migrate:replit
   ```

2. **Limpiar en Supabase**:
   - Configura `DATABASE_URL` para Supabase
   - Ejecuta `npm run clean:test-data`
   - Selecciona opción 2 (Supabase)
   - Limpia los datos de ensayo

**⚠️ Desventaja**: Los IDs de ensayo quedarán ocupados en Supabase, aunque los registros estén eliminados.

## 🛠️ Opciones del Script de Limpieza

El script `clean-test-data.ts` ofrece 4 opciones:

### Opción 1: Criterios Automáticos (Recomendado)
- Busca transacciones con conceptos: "prueba", "test", "ensayo", "demo", "ejemplo", "temporal"
- Busca transacciones con valor menor a $1000
- Busca viajes con conductores o placas de prueba
- Muestra los resultados antes de eliminar

### Opción 2: Criterios Personalizados
- Permite especificar conceptos, valores, fechas, conductores, placas
- Útil si tienes criterios específicos para identificar datos de ensayo

### Opción 3: Ver Datos (Solo Visualización)
- Muestra los datos sin eliminar nada
- Útil para revisar qué hay antes de limpiar

### Opción 4: Limpiar Todo (PELIGROSO)
- Elimina TODAS las transacciones y viajes
- Requiere doble confirmación
- Solo usar si estás seguro de que quieres empezar desde cero

## 📊 Ejemplo de Uso

```bash
# 1. Limpiar en Replit
# (Configurar DATABASE_URL para Replit en .env)
npm run clean:test-data
# Seleccionar: 1 (Replit)
# Seleccionar: 1 (Criterios automáticos)
# Revisar resultados y confirmar

# 2. Migrar a Supabase
# (Configurar DATABASE_URL para Supabase y REPLIT_DATABASE_URL en .env)
npm run migrate:replit

# 3. Verificar en la aplicación
# Abrir la app y verificar que todos los datos están correctos
```

## ⚠️ Advertencias Importantes

1. **Backup**: Siempre haz un backup antes de limpiar o migrar
2. **Verificación**: Revisa cuidadosamente los datos antes de eliminar
3. **IDs de Viajes**: Los IDs de viajes eliminados (A1, A2, etc.) quedarán ocupados. Si necesitas reutilizarlos, tendrás que eliminarlos manualmente de la base de datos.
4. **Secuencias**: Las secuencias de IDs (`serial`) no se resetean automáticamente. Si eliminas registros, los nuevos seguirán incrementando desde el último ID usado.

## 🔧 Resetear Secuencias (Opcional)

Si quieres que los IDs empiecen desde 1 después de limpiar, puedes resetear las secuencias:

```sql
-- Conectarte a la base de datos y ejecutar:
SELECT setval('transacciones_id_seq', (SELECT MAX(id) FROM transacciones));
SELECT setval('minas_id_seq', (SELECT MAX(id) FROM minas));
SELECT setval('compradores_id_seq', (SELECT MAX(id) FROM compradores));
SELECT setval('volqueteros_id_seq', (SELECT MAX(id) FROM volqueteros));
```

**⚠️ Nota**: Esto solo funciona para tablas con `serial`. Los viajes usan IDs personalizados, así que no aplica.

## ❓ Preguntas Frecuentes

### ¿Puedo migrar sin limpiar?
Sí, pero los datos de ensayo ocuparán IDs y espacio. No es recomendado.

### ¿Qué pasa si elimino datos importantes por error?
Si tienes backup, puedes restaurarlos. Si no, se perderán permanentemente.

### ¿Los IDs de viajes eliminados se pueden reutilizar?
Sí, pero tendrías que eliminarlos manualmente de la base de datos o modificar el generador de IDs.

### ¿Puedo ejecutar el script múltiples veces?
Sí, es seguro ejecutarlo múltiples veces. Solo eliminará los datos que coincidan con los criterios.

## 🎉 ¡Listo!

Una vez completada la migración y limpieza, tendrás:
- ✅ Solo datos reales en Supabase
- ✅ IDs sin conflictos
- ✅ Base de datos limpia y lista para producción

