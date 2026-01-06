# Cambios Recientes - Permisos de Transacciones y Cuentas RodMar

## Fecha: Diciembre 2024

### 1. Corrección de Filtrado de Cuentas RodMar

**Problema**: Los usuarios con permisos de transacciones veían todas las cuentas RodMar en el listado principal, incluso si solo tenían permisos específicos para algunas cuentas.

**Solución**: Se eliminó la excepción que permitía ver todas las cuentas cuando el usuario tenía permisos de transacciones en el endpoint `/api/rodmar-accounts`. Ahora el listado principal respeta siempre los permisos específicos de cada cuenta.

**Archivos modificados**:
- `server/routes.ts`: Endpoint `/api/rodmar-accounts` y `/api/transacciones/cuenta/:cuentaNombre`

**Comportamiento resultante**:
- El listado principal de cuentas RodMar (`/api/rodmar-accounts`) solo muestra las cuentas para las que el usuario tiene permisos específicos (`module.RODMAR.account.[Nombre].view`).
- Al crear transacciones, los usuarios con permisos de transacciones pueden seleccionar todas las cuentas (esto se maneja en otros endpoints que ya tienen esa lógica).

---

### 2. Corrección de Acceso a Vouchers de Transacciones

**Problema**: Los usuarios con permisos de transacciones no podían ver los vouchers de transacciones que no habían creado ellos mismos, aunque podían ver las transacciones.

**Solución**: Se modificó el endpoint `/api/transacciones/:id/voucher` para verificar si el usuario tiene permisos de transacciones. Si los tiene, no se filtra por `userId`, permitiendo ver vouchers de todas las transacciones que puede ver.

**Archivos modificados**:
- `server/routes.ts`: Endpoint `/api/transacciones/:id/voucher`

**Comportamiento resultante**:
- Usuarios con permisos de transacciones: Pueden ver vouchers de todas las transacciones que pueden ver, no solo las que crearon.
- Usuarios sin permisos de transacciones: Solo pueden ver vouchers de sus propias transacciones (comportamiento original).

---

## Notas Técnicas

### Permisos de Transacciones

Los siguientes permisos se consideran "permisos de transacciones" y otorgan acceso ampliado:
- `action.TRANSACCIONES.create`
- `action.TRANSACCIONES.completePending`
- `action.TRANSACCIONES.edit`
- `action.TRANSACCIONES.delete`

Cuando un usuario tiene cualquiera de estos permisos:
- Puede ver todas las transacciones del sistema (no solo las que creó).
- Puede ver vouchers de todas las transacciones que puede ver.
- Puede seleccionar todas las entidades (minas, compradores, volqueteros, cuentas RodMar) al crear transacciones.

Sin embargo:
- El listado principal de cuentas RodMar sigue respetando permisos específicos de cada cuenta.
- El acceso a transacciones de cuentas RodMar específicas sigue requiriendo el permiso específico de esa cuenta.









