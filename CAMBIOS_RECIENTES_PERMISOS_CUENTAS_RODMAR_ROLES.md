# Cambios recientes: Permisos por cuenta RodMar (por rol)

## Resumen
Se corrigió el comportamiento de permisos para cuentas RodMar: el permiso **general** `module.RODMAR.accounts.view` ahora **solo habilita la pestaña** “Cuentas”, pero **no** otorga acceso a todas las cuentas.  
El acceso real se controla únicamente mediante permisos específicos por cuenta: `module.RODMAR.account.{CODIGO}.view`.

## Problema
Un rol con `module.RODMAR.accounts.view` podía:
- Ver **todas** las cuentas RodMar aunque solo tuviera permisos para algunas.
- Acceder a transacciones de cuentas no asignadas.

## Solución (backend)
- `GET /api/rodmar-accounts`: ahora calcula y devuelve balances solo de cuentas permitidas por permisos específicos.
- `GET /api/transacciones/cuenta/:cuentaNombre`: ahora exige permiso específico de cuenta (se quitó el fallback por `module.RODMAR.accounts.view`).
- `GET /api/rodmar-cuentas`: ahora devuelve solo las cuentas permitidas (para UI).
- `GET /api/rodmar-cuentas/all`: nuevo endpoint para administración (requiere `module.ADMIN.view`).
- `POST/PATCH/DELETE /api/rodmar-cuentas`: ahora requieren `module.ADMIN.view`.

## Solución (frontend)
- La pestaña “Cuentas” puede mostrarse aunque no haya cuentas permitidas, mostrando un estado vacío: “No tienes cuentas asignadas”.
- Acciones administrativas (crear/editar/eliminar cuentas) quedan visibles solo para usuarios con `module.ADMIN.view`.

## Archivos relevantes
- `server/routes.ts`
- `client/src/components/modules/rodmar.tsx`


