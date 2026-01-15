# Cambios recientes: no recrear permisos legacy de cuentas RodMar

## Resumen
Se evitó que en cada deploy/reinicio del servidor se vuelvan a crear permisos obsoletos por nombre (legacy) como:
- `module.RODMAR.account.Bemovil.view`
- `module.RODMAR.account.Corresponsal.view`
- etc.

## Causa raíz
Durante el arranque, `initializeDatabase()` ejecuta `addMissingPermissionsFromFile()` (archivo `server/add-missing-permissions.ts`), que contenía una lista hardcodeada con permisos legacy por nombre.  
Al faltar en la base de datos (por limpiezas/migraciones), el script los detectaba como “faltantes” y los recreaba.

## Solución
- Se eliminaron de los scripts las entradas hardcodeadas de permisos legacy por nombre.
- Se reemplazó por verificación/creación **dinámica** basada en `rodmarCuentas`:
  - Para cada cuenta, se asegura el permiso **por código**: `module.RODMAR.account.{CODIGO}.view`
  - Se asigna al rol ADMIN como conveniencia.

## Archivos modificados
- `server/add-missing-permissions.ts`
- `server/init-db.ts`


