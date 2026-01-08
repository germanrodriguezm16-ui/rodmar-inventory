-- Script para encontrar y eliminar permisos huérfanos de cuentas RodMar
-- (permisos de cuentas que ya no existen)

-- PASO 1: Identificar permisos huérfanos
-- Esta consulta muestra todos los permisos de cuentas RodMar que NO tienen una cuenta asociada

SELECT 
    p.id,
    p.key,
    p.descripcion,
    p.categoria,
    p.created_at
FROM permissions p
WHERE p.key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    -- Verificar si existe una cuenta con el código extraído del permiso
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = CONCAT('module.RODMAR.account.', rc.codigo, '.view')
  )
ORDER BY p.key;

-- PASO 2: Ver asignaciones de roles a estos permisos huérfanos
-- (para saber qué roles tienen estos permisos antes de eliminarlos)

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
    WHERE p.key = CONCAT('module.RODMAR.account.', rc.codigo, '.view')
  )
ORDER BY p.key, r.nombre;

-- PASO 3: Eliminar asignaciones de roles primero (para evitar problemas de foreign key)
-- ⚠️ CUIDADO: Ejecuta esto solo después de revisar los resultados anteriores

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT p.id
    FROM permissions p
    WHERE p.key LIKE 'module.RODMAR.account.%.view'
      AND NOT EXISTS (
        SELECT 1 
        FROM rodmar_cuentas rc
        WHERE p.key = CONCAT('module.RODMAR.account.', rc.codigo, '.view')
      )
);

-- PASO 4: Eliminar los permisos huérfanos
-- ⚠️ CUIDADO: Ejecuta esto solo después de ejecutar el PASO 3

DELETE FROM permissions
WHERE key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = CONCAT('module.RODMAR.account.', rc.codigo, '.view')
  );

-- NOTA: En PostgreSQL, la sintaxis puede variar. Si la consulta anterior no funciona,
-- usa esta versión alternativa:

-- Alternativa para PostgreSQL:
-- DELETE FROM role_permissions
-- WHERE permission_id IN (
--     SELECT p.id
--     FROM permissions p
--     WHERE p.key LIKE 'module.RODMAR.account.%.view'
--       AND NOT EXISTS (
--         SELECT 1 
--         FROM rodmar_cuentas rc
--         WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
--       )
-- );
--
-- DELETE FROM permissions
-- WHERE key LIKE 'module.RODMAR.account.%.view'
--   AND NOT EXISTS (
--     SELECT 1 
--     FROM rodmar_cuentas rc
--     WHERE ('module.RODMAR.account.' || rc.codigo || '.view') = permissions.key
--   );



