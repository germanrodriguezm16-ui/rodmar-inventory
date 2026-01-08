-- Script para eliminar permisos ESPECÍFICOS de cuentas eliminadas
-- ⚠️ IMPORTANTE: Reemplaza 'NOMBRE_CUENTA' con el nombre exacto de la cuenta eliminada
-- Ejemplo: Si eliminaste una cuenta llamada "Luz", reemplaza 'NOMBRE_CUENTA' con 'Luz'

-- ==========================================
-- PASO 1: Identificar el permiso específico
-- ==========================================
-- Reemplaza 'NOMBRE_CUENTA' con el nombre de la cuenta eliminada
-- Ejemplo: 'Luz', 'Norida', etc.

SELECT 
    p.id,
    p.key,
    p.descripcion
FROM permissions p
WHERE p.key = ('module.RODMAR.account.' || 'NOMBRE_CUENTA' || '.view');

-- ==========================================
-- PASO 2: Ver asignaciones de roles
-- ==========================================
-- Muestra qué roles tienen este permiso

SELECT 
    p.id as permiso_id,
    p.key as permiso_key,
    r.id as role_id,
    r.nombre as role_nombre
FROM permissions p
INNER JOIN role_permissions rp ON rp.permission_id = p.id
INNER JOIN roles r ON r.id = rp.role_id
WHERE p.key = ('module.RODMAR.account.' || 'NOMBRE_CUENTA' || '.view');

-- ==========================================
-- PASO 3: Eliminar asignaciones de roles
-- ==========================================
-- ⚠️ Reemplaza 'NOMBRE_CUENTA' con el nombre exacto antes de ejecutar

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE key = ('module.RODMAR.account.' || 'NOMBRE_CUENTA' || '.view')
);

-- ==========================================
-- PASO 4: Eliminar el permiso
-- ==========================================
-- ⚠️ Reemplaza 'NOMBRE_CUENTA' con el nombre exacto antes de ejecutar

DELETE FROM permissions
WHERE key = ('module.RODMAR.account.' || 'NOMBRE_CUENTA' || '.view');

-- ==========================================
-- EJEMPLO: Eliminar permiso de cuenta "Luz"
-- ==========================================
-- Si eliminaste una cuenta llamada "Luz", usa estas consultas:

-- 1. Verificar el permiso
-- SELECT * FROM permissions WHERE key = 'module.RODMAR.account.Luz.view';

-- 2. Eliminar asignaciones
-- DELETE FROM role_permissions
-- WHERE permission_id IN (
--     SELECT id FROM permissions WHERE key = 'module.RODMAR.account.Luz.view'
-- );

-- 3. Eliminar permiso
-- DELETE FROM permissions WHERE key = 'module.RODMAR.account.Luz.view';



