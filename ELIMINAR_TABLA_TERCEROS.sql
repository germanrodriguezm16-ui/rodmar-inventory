-- Script SQL para eliminar la tabla terceros y todos sus datos
-- Este script elimina completamente la funcionalidad de Terceros de la base de datos
--
-- IMPORTANTE: Este script es irreversible. Asegúrate de hacer un backup si necesitas
-- conservar los datos antes de ejecutarlo.
--
-- INSTRUCCIONES:
-- 1. Abre Drizzle Studio: npm run drizzle:studio
-- 2. Ve a la pestaña "SQL Console"
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script
-- 5. Verifica que la consulta final retorne 0 filas

-- ============================================
-- PASO 1: Verificar si hay transacciones que referencien terceros
-- ============================================
-- (Opcional: Ver cuántas transacciones hay con terceros antes de eliminar)
SELECT 
    COUNT(*) as total_transacciones_con_terceros
FROM 
    transacciones
WHERE 
    (de_quien_tipo = 'tercero' OR para_quien_tipo = 'tercero');

-- ============================================
-- PASO 2: Eliminar transacciones que referencien terceros
-- ============================================
-- ADVERTENCIA: Esto eliminará permanentemente todas las transacciones relacionadas con terceros
-- Si quieres conservar estas transacciones, comenta esta sección
DELETE FROM transacciones 
WHERE 
    de_quien_tipo = 'tercero' OR para_quien_tipo = 'tercero';

-- ============================================
-- PASO 3: Eliminar índices asociados a la tabla terceros
-- ============================================
DROP INDEX IF EXISTS idx_terceros_user_id;

-- ============================================
-- PASO 4: Eliminar la tabla terceros y todos sus datos
-- ============================================
DROP TABLE IF EXISTS terceros CASCADE;

-- ============================================
-- PASO 5: Verificar que la tabla fue eliminada
-- ============================================
-- Esta consulta debería retornar 0 filas si la tabla fue eliminada correctamente
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_name = 'terceros';

-- Si la consulta anterior retorna 0 filas, la tabla fue eliminada exitosamente.
-- Si retorna 1 fila, la tabla aún existe y algo salió mal.

