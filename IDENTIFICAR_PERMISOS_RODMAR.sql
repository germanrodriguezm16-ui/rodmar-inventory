-- Script para IDENTIFICAR todos los permisos de cuentas RodMar
-- Este script NO elimina nada, solo muestra información para que decidas qué eliminar

-- ==========================================
-- CONSULTA 1: Cuentas que EXISTEN en la BD
-- ==========================================
SELECT 
    id,
    nombre,
    codigo,
    created_at
FROM rodmar_cuentas
ORDER BY nombre;

-- ==========================================
-- CONSULTA 2: Todos los permisos de cuentas RodMar
-- ==========================================
SELECT 
    p.id,
    p.key,
    p.descripcion,
    p.categoria,
    p.created_at
FROM permissions p
WHERE p.key LIKE 'module.RODMAR.account.%.view'
ORDER BY p.key;

-- ==========================================
-- CONSULTA 3: Permisos que SÍ tienen cuenta asociada
-- ==========================================
-- Estos permisos están bien, NO deben eliminarse
SELECT 
    p.id,
    p.key,
    p.descripcion,
    rc.id as cuenta_id,
    rc.nombre as cuenta_nombre,
    rc.codigo as cuenta_codigo
FROM permissions p
INNER JOIN rodmar_cuentas rc ON p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
WHERE p.key LIKE 'module.RODMAR.account.%.view'
ORDER BY rc.nombre;

-- ==========================================
-- CONSULTA 4: Permisos HUÉRFANOS (sin cuenta asociada)
-- ==========================================
-- ⚠️ REVISAR ESTOS: Algunos pueden ser de cuentas hardcodeadas antiguas
-- que aún no están en la BD, otros pueden ser de cuentas eliminadas
SELECT 
    p.id,
    p.key,
    p.descripcion,
    p.created_at,
    -- Extraer el nombre de la cuenta del key del permiso
    REPLACE(REPLACE(p.key, 'module.RODMAR.account.', ''), '.view', '') as nombre_cuenta_del_permiso
FROM permissions p
WHERE p.key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
  )
ORDER BY p.key;

-- ==========================================
-- CONSULTA 5: Permisos huérfanos con sus asignaciones de roles
-- ==========================================
-- Muestra qué roles tienen estos permisos huérfanos
SELECT 
    p.id as permiso_id,
    p.key as permiso_key,
    REPLACE(REPLACE(p.key, 'module.RODMAR.account.', ''), '.view', '') as nombre_cuenta_del_permiso,
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
-- CONSULTA 6: Comparación - Cuentas hardcodeadas esperadas
-- ==========================================
-- Lista de cuentas hardcodeadas que deberían existir:
-- Bemovil, Corresponsal, Efectivo, Cuentas German, Cuentas Jhon, Otros
-- 
-- Si un permiso huérfano tiene uno de estos nombres, probablemente es de una cuenta
-- hardcodeada que aún no se migró a la BD. NO deberías eliminarlo.
-- 
-- Si un permiso huérfano tiene otro nombre (como "Luz", "Norida", etc.), 
-- probablemente es de una cuenta que creaste y eliminaste. SÍ puedes eliminarlo.

SELECT 
    p.id,
    p.key,
    REPLACE(REPLACE(p.key, 'module.RODMAR.account.', ''), '.view', '') as nombre_cuenta,
    CASE 
        WHEN REPLACE(REPLACE(p.key, 'module.RODMAR.account.', ''), '.view', '') IN 
            ('Bemovil', 'Corresponsal', 'Efectivo', 'Cuentas German', 'Cuentas Jhon', 'Otros')
        THEN '⚠️ POSIBLE CUENTA HARDCODEADA - Revisar antes de eliminar'
        ELSE '✅ Probablemente cuenta eliminada - Puede eliminarse'
    END as recomendacion
FROM permissions p
WHERE p.key LIKE 'module.RODMAR.account.%.view'
  AND NOT EXISTS (
    SELECT 1 
    FROM rodmar_cuentas rc
    WHERE p.key = ('module.RODMAR.account.' || rc.codigo || '.view')
  )
ORDER BY 
    CASE 
        WHEN REPLACE(REPLACE(p.key, 'module.RODMAR.account.', ''), '.view', '') IN 
            ('Bemovil', 'Corresponsal', 'Efectivo', 'Cuentas German', 'Cuentas Jhon', 'Otros')
        THEN 1
        ELSE 2
    END,
    p.key;



