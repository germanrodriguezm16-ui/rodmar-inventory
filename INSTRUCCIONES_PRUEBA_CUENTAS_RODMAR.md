# Instrucciones para Probar Cuentas RodMar Dinámicas (Opción A)

## ✅ Cambios Implementados

1. **Tabla `rodmar_cuentas`** creada en el schema (similar a `terceros`)
   - `id`: ID numérico (PK)
   - `nombre`: Nombre de la cuenta (puede cambiar)
   - `codigo`: Código único persistente para permisos (nunca cambia)
   - `userId`, `createdAt`, `updatedAt`

2. **Script de migración** (`server/migrate-rodmar-cuentas.ts`)
   - Migra las 6 cuentas existentes a la BD
   - Crea permisos automáticamente usando códigos

3. **Endpoints CRUD** creados:
   - `GET /api/rodmar-cuentas` - Listar todas las cuentas
   - `POST /api/rodmar-cuentas` - Crear nueva cuenta
   - `PATCH /api/rodmar-cuentas/:id/nombre` - Editar nombre
   - `DELETE /api/rodmar-cuentas/:id` - Eliminar cuenta (si no tiene transacciones)

4. **Endpoint `/api/rodmar-accounts`** actualizado:
   - Ahora lee de la BD en lugar de hardcoded
   - Mantiene compatibilidad con transacciones existentes (soporta slugs legacy y IDs)

## 🔧 Pasos para Probar Localmente

### Paso 1: Ejecutar Migración de Base de Datos

Primero, necesitas crear la tabla en la BD. Ejecuta la migración de Drizzle:

```bash
cd RodMarInventory
npm run db:generate  # Si tienes comandos configurados
# O manualmente usando Drizzle Kit
```

### Paso 2: Ejecutar Script de Migración de Datos

Ejecuta el script que migra las 6 cuentas existentes:

```bash
cd RodMarInventory
npx tsx server/migrate-rodmar-cuentas.ts
```

Esto debería crear:
- 6 cuentas en la tabla `rodmar_cuentas`
- 6 permisos correspondientes usando códigos

**Salida esperada:**
```
🔄 Iniciando migración de cuentas RodMar...
✅ Cuenta creada: Bemovil (ID: 1, Código: BEMOVIL)
   → Permiso creado para: Bemovil (código: BEMOVIL)
...
✅ Migración completada: 6 cuentas creadas, 0 omitidas
```

### Paso 3: Iniciar el Servidor

```bash
npm run dev
```

### Paso 4: Probar Endpoints con Postman/Thunder Client

#### 4.1. Listar todas las cuentas
```
GET http://localhost:5000/api/rodmar-cuentas
Headers: 
  Cookie: connect.sid=<tu-session-cookie>
```

#### 4.2. Verificar que el endpoint de balances funciona
```
GET http://localhost:5000/api/rodmar-accounts
Headers:
  Cookie: connect.sid=<tu-session-cookie>
```

Deberías ver las 6 cuentas con sus balances calculados.

#### 4.3. Crear una nueva cuenta
```
POST http://localhost:5000/api/rodmar-cuentas
Headers:
  Cookie: connect.sid=<tu-session-cookie>
  Content-Type: application/json

Body:
{
  "nombre": "Cuenta Prueba",
  "codigo": "CUENTA_PRUEBA"
}
```

#### 4.4. Editar nombre de una cuenta
```
PATCH http://localhost:5000/api/rodmar-cuentas/1/nombre
Headers:
  Cookie: connect.sid=<tu-session-cookie>
  Content-Type: application/json

Body:
{
  "nombre": "Bemovil Pro"
}
```

Verifica que:
- El nombre cambia en la BD
- El permiso se actualiza (descripción cambia, pero el key sigue usando el código)
- Las transacciones existentes siguen funcionando

#### 4.5. Intentar eliminar una cuenta sin transacciones
```
DELETE http://localhost:5000/api/rodmar-cuentas/7  # (ID de la cuenta de prueba)
Headers:
  Cookie: connect.sid=<tu-session-cookie>
```

Debería eliminarse exitosamente.

#### 4.6. Intentar eliminar una cuenta con transacciones
```
DELETE http://localhost:5000/api/rodmar-cuentas/1  # Bemovil (probablemente tiene transacciones)
Headers:
  Cookie: connect.sid=<tu-session-cookie>
```

Debería retornar error 400: "No se puede eliminar esta cuenta porque tiene transacciones asociadas"

### Paso 5: Probar en el Frontend (Opcional - si quieres)

**NOTA**: El frontend aún no está actualizado para usar la nueva API. Por ahora, los endpoints de backend funcionan, pero el frontend sigue usando arrays hardcodeados.

Para probar el frontend completamente, necesitarías:
1. Actualizar `rodmar.tsx` para usar `/api/rodmar-cuentas`
2. Actualizar formularios de transacciones para usar IDs numéricos
3. Crear modales CRUD (crear, editar, eliminar)

## 🐛 Verificación de Compatibilidad

### Transacciones Existentes

Las transacciones existentes pueden tener `deQuienId` o `paraQuienId` como:
- **Slug legacy**: `"bemovil"`, `"cuentas-german"`, etc.
- **ID numérico**: `"1"`, `"2"`, etc. (después de la migración completa)

El endpoint `/api/rodmar-accounts` soporta ambos durante el período de transición.

### Permisos

Los permisos ahora usan el **código** en lugar del nombre:
- Antes: `module.RODMAR.account.Bemovil.view`
- Ahora: `module.RODMAR.account.BEMOVIL.view`

El script de migración crea los nuevos permisos. Los permisos antiguos seguirán funcionando durante la transición, pero deberías migrarlos eventualmente.

## 📝 Próximos Pasos (No Implementados Aún)

1. **Migrar transacciones existentes**: Crear script para convertir slugs a IDs numéricos
2. **Actualizar frontend**: Remover arrays hardcodeados y usar API
3. **Crear UI CRUD**: Modales para crear/editar/eliminar cuentas (similar a terceros)
4. **Migrar permisos**: Actualizar permisos antiguos para usar códigos

## ⚠️ Advertencias

- **NO subir a producción** hasta probar completamente localmente
- Las transacciones existentes seguirán usando slugs hasta que se migren
- Los permisos antiguos (usando nombres) seguirán funcionando, pero los nuevos usan códigos
- Si creas una nueva cuenta, asegúrate de asignar el permiso al rol ADMIN manualmente (por ahora)

## 🔍 Debug

Si algo no funciona:

1. **Verifica que la tabla existe:**
   ```sql
   SELECT * FROM rodmar_cuentas;
   ```

2. **Verifica que los permisos se crearon:**
   ```sql
   SELECT * FROM permissions WHERE key LIKE 'module.RODMAR.account.%';
   ```

3. **Verifica transacciones existentes:**
   ```sql
   SELECT DISTINCT de_quien_id, para_quien_id 
   FROM transacciones 
   WHERE de_quien_tipo = 'rodmar' OR para_quien_tipo = 'rodmar'
   LIMIT 20;
   ```

4. **Revisa logs del servidor** para ver mensajes de `[RODMAR-ACCOUNTS]`



