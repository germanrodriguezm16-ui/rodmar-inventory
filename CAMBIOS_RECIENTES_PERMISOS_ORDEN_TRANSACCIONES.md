# Cambios Recientes: Permisos, Orden de Transacciones y Transacciones Pendientes

**Fecha:** Diciembre 2024

## Resumen

Este documento describe los cambios recientes relacionados con:
1. Preservación del orden de transacciones al editar
2. Verificación de permisos en modales y botones de transacciones
3. Visibilidad de transacciones pendientes para usuarios con permisos restringidos

---

## 1. Preservación del Orden de Transacciones al Editar

### Problema Identificado

Cuando se editaba una transacción sin cambiar la fecha, la transacción se movía al principio del día, perdiendo su posición original dentro de las transacciones del mismo día. Esto ocurría porque el campo `horaInterna` (usado para ordenar transacciones dentro del mismo día) no se estaba preservando correctamente.

### Solución Implementada

**Archivo modificado:** `server/routes.ts`

**Cambios realizados:**

1. **Obtener transacción original primero:**
   - Se obtiene la transacción original antes de construir `updateData` para tener acceso a `horaInterna` original.

2. **Comparación de fechas mejorada:**
   - Se normalizan ambas fechas a UTC antes de comparar (solo día, mes y año) para evitar problemas de timezone.
   - Se compara si la fecha realmente cambió antes de decidir si actualizar `horaInterna`.

3. **No actualizar `fecha` si no cambió:**
   - Si la fecha no cambió, `updateData.fecha` se deja como `undefined` para evitar que PostgreSQL trate la actualización de forma diferente.

4. **Preservar `horaInterna`:**
   - Si la fecha no cambió, se preserva `horaInterna` original en `updateData` para mantener el orden dentro del mismo día.
   - Si la fecha cambió, `horaInterna` se actualiza automáticamente para reflejar el nuevo orden en el nuevo día.

**Código relevante:**

```typescript
// Obtener transacción original PRIMERO para comparar fechas y preservar horaInterna
const originalTransaction = await storage.getTransaccion(id);

// Comparar fechas normalizando a la misma zona horaria (UTC)
let fechaCambio = false;
if (nuevaFecha) {
  const fechaOriginalUTC = new Date(Date.UTC(
    fechaOriginal.getFullYear(),
    fechaOriginal.getMonth(),
    fechaOriginal.getDate()
  ));
  const nuevaFechaUTC = new Date(Date.UTC(
    nuevaFecha.getFullYear(),
    nuevaFecha.getMonth(),
    nuevaFecha.getDate()
  ));
  fechaCambio = fechaOriginalUTC.getTime() !== nuevaFechaUTC.getTime();
}

// Solo actualizar fecha si realmente cambió
fecha: fechaCambio && nuevaFecha ? nuevaFecha : undefined,

// Si la fecha NO cambió, preservar horaInterna original
if (!fechaCambio && originalTransaction.horaInterna) {
  updateData.horaInterna = originalTransaction.horaInterna;
}
```

### Resultado

- Al editar una transacción sin cambiar la fecha: mantiene su posición dentro de las transacciones del mismo día.
- Al cambiar la fecha: la transacción se reordena según la nueva fecha y su nuevo `horaInterna`.

---

## 2. Verificación de Permisos en Modales y Botones de Transacciones

### Problema Identificado

Los usuarios con permisos restringidos podían ver botones y opciones en los modales de transacciones que no tenían permiso para usar. Esto causaba confusión y errores 403 cuando intentaban usar estas funciones.

### Solución Implementada

**Archivos modificados:**
- `client/src/components/modals/gestionar-transacciones-modal.tsx`
- `client/src/pages/dashboard.tsx`
- `client/src/pages/mina-detail.tsx`
- `client/src/pages/comprador-detail.tsx`
- `client/src/pages/volquetero-detail.tsx`
- `client/src/pages/rodmar-cuenta-detail.tsx`

**Cambios realizados:**

1. **Modal `GestionarTransaccionesModal`:**
   - Agregado `usePermissions` para verificar permisos.
   - Verifica permisos antes de mostrar cada botón:
     - "Crear" solo se muestra si tiene `action.TRANSACCIONES.create`
     - "Solicitar" solo se muestra si tiene `action.TRANSACCIONES.solicitar`
     - "Completar" solo se muestra si tiene `action.TRANSACCIONES.completePending`
   - Si el usuario no tiene ningún permiso, el modal no se renderiza.

2. **Botón flotante en `dashboard.tsx`:**
   - Actualizado para verificar también `action.TRANSACCIONES.solicitar` y `action.TRANSACCIONES.completePending`.
   - El botón se muestra si tiene al menos uno de estos permisos:
     - `action.TRANSACCIONES.create`
     - `action.TRANSACCIONES.solicitar`
     - `action.TRANSACCIONES.completePending`
     - `action.TRANSACCIONES.viewPending`
     - O si hay transacciones pendientes

3. **Páginas de detalle:**
   - Agregada verificación de permisos antes de mostrar el botón flotante.
   - El botón solo se muestra si el usuario tiene al menos uno de los permisos de transacciones.

**Código relevante:**

```typescript
// En GestionarTransaccionesModal
const { has } = usePermissions();
const canCreate = has("action.TRANSACCIONES.create");
const canSolicitar = has("action.TRANSACCIONES.solicitar");
const canCompletar = has("action.TRANSACCIONES.completePending");

// Mostrar botones condicionalmente
{canCreate && <Button onClick={onCrear}>Crear</Button>}
{canSolicitar && <Button onClick={onSolicitar}>Solicitar</Button>}
{canCompletar && <Button onClick={onCompletar}>Completar</Button>}
```

### Resultado

- Los usuarios con permisos restringidos solo ven los botones que tienen permitidos.
- El botón flotante solo aparece si tienen al menos un permiso de transacciones.
- Se evita que los usuarios vean opciones que no pueden usar.

---

## 3. Visibilidad de Transacciones Pendientes para Usuarios con Permisos

### Problema Identificado

Los usuarios con permisos restringidos que tenían `action.TRANSACCIONES.viewPending` o `action.TRANSACCIONES.completePending` no podían ver las transacciones pendientes creadas por otros usuarios. El botón parpadeante no aparecía aunque hubiera transacciones pendientes de otros usuarios.

### Solución Implementada

**Archivo modificado:** `server/routes.ts`

**Endpoints modificados:**

1. **`GET /api/transacciones/pendientes`:**
   - Verifica si el usuario tiene `action.TRANSACCIONES.viewPending` o `action.TRANSACCIONES.completePending`.
   - Si tiene alguno de estos permisos: pasa `undefined` como `userId` para ver todas las transacciones pendientes.
   - Si no tiene estos permisos: pasa `userId` para ver solo las suyas.

2. **`GET /api/transacciones/pendientes/count`:**
   - Misma lógica: verifica permisos antes de filtrar.
   - Si tiene permisos: cuenta todas las transacciones pendientes.
   - Si no tiene permisos: cuenta solo las suyas.

**Código relevante:**

```typescript
// Obtener todas las transacciones pendientes
app.get("/api/transacciones/pendientes", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  
  // Si el usuario tiene permisos para ver o completar transacciones pendientes,
  // puede ver TODAS las transacciones pendientes (no solo las suyas)
  const userPermissions = await getUserPermissions(userId);
  const hasPendingPermissions = 
    userPermissions.includes("action.TRANSACCIONES.viewPending") ||
    userPermissions.includes("action.TRANSACCIONES.completePending");
  
  // Si tiene permisos, no filtrar por userId (ver todas)
  const effectiveUserId = hasPendingPermissions ? undefined : userId;
  
  const pendientes = await storage.getTransaccionesPendientes(effectiveUserId);
  res.json(pendientes);
});

// Contar transacciones pendientes
app.get("/api/transacciones/pendientes/count", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  
  // Misma lógica para el conteo
  const userPermissions = await getUserPermissions(userId);
  const hasPendingPermissions = 
    userPermissions.includes("action.TRANSACCIONES.viewPending") ||
    userPermissions.includes("action.TRANSACCIONES.completePending");
  
  const effectiveUserId = hasPendingPermissions ? undefined : userId;
  const count = await storage.countTransaccionesPendientes(effectiveUserId);
  res.json({ count });
});
```

### Resultado

- Usuarios con `action.TRANSACCIONES.viewPending` o `action.TRANSACCIONES.completePending`:
  - Ven todas las transacciones pendientes (no solo las suyas).
  - El botón parpadeante aparece cuando hay transacciones pendientes de cualquier usuario.
  - Pueden completar transacciones pendientes creadas por otros usuarios.

- Usuarios sin estos permisos:
  - Solo ven sus propias transacciones pendientes.
  - El botón parpadeante solo aparece si tienen transacciones pendientes propias.

---

## Impacto en el Sistema

### Mejoras de UX

1. **Orden consistente:** Las transacciones mantienen su posición al editar, mejorando la experiencia de usuario.
2. **Interfaz clara:** Los usuarios solo ven las opciones que pueden usar, reduciendo confusión.
3. **Visibilidad correcta:** Los usuarios con permisos pueden ver y gestionar todas las transacciones pendientes relevantes.

### Seguridad

- Los permisos se verifican tanto en el frontend (UI) como en el backend (endpoints).
- Los usuarios no pueden acceder a funciones para las que no tienen permisos.

### Compatibilidad

- Los cambios son retrocompatibles con usuarios existentes.
- Los usuarios sin permisos específicos continúan viendo solo sus propias transacciones.

---

## Archivos Modificados

### Backend
- `server/routes.ts`: Preservación de `horaInterna` y visibilidad de transacciones pendientes

### Frontend
- `client/src/components/modals/gestionar-transacciones-modal.tsx`: Verificación de permisos
- `client/src/pages/dashboard.tsx`: Verificación de permisos en botón flotante
- `client/src/pages/mina-detail.tsx`: Verificación de permisos en botón flotante
- `client/src/pages/comprador-detail.tsx`: Verificación de permisos en botón flotante
- `client/src/pages/volquetero-detail.tsx`: Verificación de permisos en botón flotante
- `client/src/pages/rodmar-cuenta-detail.tsx`: Verificación de permisos en botón flotante

---

## Notas Técnicas

1. **Preservación de `horaInterna`:**
   - El campo `horaInterna` se usa para ordenar transacciones dentro del mismo día.
   - Se preserva solo si la fecha no cambió, manteniendo el orden cronológico original.

2. **Verificación de permisos:**
   - Los permisos se verifican en el frontend para mejorar la UX (no mostrar opciones no disponibles).
   - Los permisos también se verifican en el backend para seguridad (prevenir acceso no autorizado).

3. **Filtrado por `userId`:**
   - Los endpoints ahora verifican permisos antes de filtrar por `userId`.
   - Si el usuario tiene permisos relevantes, se pasa `undefined` como `userId` para ver todas las entidades/transacciones.

