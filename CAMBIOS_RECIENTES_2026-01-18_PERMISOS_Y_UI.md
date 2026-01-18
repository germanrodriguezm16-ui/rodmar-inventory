# Cambios recientes (2026-01-18): Permisos + UX Admin + Dev local

## 1) Modelo de permisos granular por entidad (VIEW vs USE)

Se implementó un modelo donde **ver una entidad en su módulo** es distinto de **poder usarla en transacciones**:

- **Ver en módulo (UI/Detalle)**: `module.{MODULO}.{entidad}.{id}.view`
  - Ejemplos:
    - `module.MINAS.mina.{ID}.view`
    - `module.COMPRADORES.comprador.{ID}.view`
    - `module.VOLQUETEROS.volquetero.{ID}.view`
    - `module.RODMAR.tercero.{ID}.view`
    - `module.RODMAR.account.{CODIGO}.view`
- **Usar en transacciones**: `action.TRANSACCIONES.{tipo}.{id}.use`
  - Ejemplos:
    - `action.TRANSACCIONES.mina.{ID}.use`
    - `action.TRANSACCIONES.comprador.{ID}.use`
    - `action.TRANSACCIONES.volquetero.{ID}.use`
    - `action.TRANSACCIONES.tercero.{ID}.use`
    - `action.TRANSACCIONES.rodmar.account.{CODIGO}.use`

Esto permite el caso “**usar sin ver**”: un rol puede seleccionar la entidad en modales de transacciones, sin necesariamente verla en el listado principal del módulo.

**Archivos clave**:
- `server/routes.ts`
- `server/add-missing-permissions.ts`

## 2) Filtrado server-side por modo (view/use) en listados

Los endpoints de listado aceptan `?mode=use`:

- Si `mode=use`: filtra por permisos `action.TRANSACCIONES.*.use`
- Si no: filtra por permisos `module.*.view`

Endpoints impactados:
- `GET /api/minas`
- `GET /api/compradores`
- `GET /api/volqueteros`
- `GET /api/terceros`
- `GET /api/rodmar-cuentas`

## 3) Validación de permisos USE en transacciones

Al crear/editar/solicitar/completar transacciones, el backend valida que el usuario tenga permiso:

- `action.TRANSACCIONES.{tipo}.{id}.use` para las entidades involucradas.

**Archivo clave**:
- `server/routes.ts`

## 4) Auto-provision de permisos al crear/editar/eliminar entidades

En CRUD de entidades se asegura:
- creación de permisos `view` y `use` al crear
- actualización de descripciones al editar
- eliminación de permisos y asignaciones al eliminar

**Archivo clave**:
- `server/routes.ts`

## 5) Sync masivo de permisos en boot (más rápido y silencioso en local)

El proceso de “agregar permisos faltantes” puede ser costoso con muchas entidades.
Ahora el comportamiento en el arranque es configurable:

- `PERMISSIONS_SYNC_ON_BOOT=off`: no corre al iniciar (recomendado en local: **rápido y silencioso**)
- `PERMISSIONS_SYNC_ON_BOOT=background`: corre en background (no bloquea)
- `PERMISSIONS_SYNC_ON_BOOT=blocking`: bloquea el arranque (modo “repair” puntual)

Logs:
- `PERMISSIONS_SYNC_VERBOSE=0` (default): logs resumidos
- `PERMISSIONS_SYNC_VERBOSE=1`: logs detallados (muy verboso)

**Archivos clave**:
- `server/init-db.ts`
- `server/add-missing-permissions.ts`
- `server/rodmar-account-permissions.ts`
- `start-server.ps1`
- `scripts/restart-backend.ps1`
- `configurar-env.ps1`

## 6) UX Admin: permisos más legibles y modal de Roles estable

### 6.1 Mostrar descripción como título

En “Administración → Permisos” y en el modal de roles:
- **Título principal**: `descripcion`
- **Texto secundario**: `key`

**Archivos**:
- `client/src/components/admin/permissions-tab.tsx`
- `client/src/components/admin/role-modal.tsx`

### 6.2 Scroll estable en “Editar Rol” (móvil y desktop)

Se corrigió el layout del modal para que el área de permisos tenga un contenedor flex real (altura calculable),
y el `ScrollArea` pueda scrollear internamente sin que el footer se superponga.

**Archivo**:
- `client/src/components/admin/role-modal.tsx`

## 7) Dev UX: frontend fijado en 5173

Se fijó el frontend en `5173` con `strictPort` para evitar confusiones por puertos cambiantes.

**Archivo**:
- `vite.config.ts`

