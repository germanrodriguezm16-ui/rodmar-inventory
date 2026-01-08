-- Script para PostgreSQL: Encontrar y eliminar permisos huérfanos de cuentas RodMar
-- Ejecuta estas consultas en Drizzle Studio o en tu cliente SQL

-- ==========================================
-- PASO 1: IDENTIFICAR permisos huérfanos
-- ==========================================
-- Muestra todos los permisos de cuentas RodMar que NO tienen una cuenta asociada

SELECT 
    p.id,
    p.key,
    p.descripcion,
    p.categoria,
    p.created_at
FROM permissions p
WHERE p.key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
  )
ORDER BY p.key;

-- ==========================================
-- PASO 2: Ver asignaciones de roles
-- ==========================================
-- Muestra qué roles tienen estos permisos antes de eliminarlos

SELECT 
    p.id as permiso_id,
    p.key as permiso_key,
    r.id as role_id,
    r.nombre as role_nombre,
    rp.id as role_permission_id
FROM permissions p
INNER JOIN role_permissions rp ON rp.permission_id = p.id
INNER JOIN roles r ON r.id = rp.role_id
WHERE p.key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
  )
ORDER BY p.key, r.nombre;

-- ==========================================
-- PASO 3: ELIMINAR asignaciones de roles
-- ==========================================
-- ⚠️ IMPORTANTE: Ejecuta primero el PASO 1 y PASO 2 para revisar qué se va a eliminar
-- Este paso elimina las asignaciones de roles a permisos huérfanos

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT p.id
    FROM permissions p
    WHERE p.key LIKE 'module.RODMAR.account.%.view'
      AND NOT EXISTS (
        SELECT 1 
        FROM rodmar_cuentas rc
        WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
      )
);

-- ==========================================
-- PASO 4: ELIMINAR permisos huérfanos
-- ==========================================
-- ⚠️ IMPORTANTE: Ejecuta esto SOLO después de ejecutar el PASO 3
-- Este paso elimina los permisos huérfanos

DELETE FROM permissions
WHERE key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE ('module.RODMAR.account.' || rc.codigo || '.view') = permissions.key
  );

-- ==========================================
-- VERIFICACIÓN FINAL
-- ==========================================
-- Verifica que todos los permisos de cuentas RodMar tengan una cuenta asociada

SELECT 
    p.key,
    rc.nombre as cuenta_nombre,
    rc.codigo as cuenta_codigo
FROM permissions p
INNER JOIN rodmar_cuentas rc ON p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
WHERE p.key LIKE 'module.RODMAR.account.%.view'
ORDER BY rc.nombre;



