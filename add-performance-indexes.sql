-- Script para agregar índices de rendimiento a la base de datos
-- Ejecutar este script en Supabase SQL Editor para mejorar el rendimiento de las queries

-- Índice para filtrado por fecha (usado frecuentemente en ordenamiento)
CREATE INDEX IF NOT EXISTS idx_transacciones_fecha ON transacciones(fecha DESC);

-- Índice para filtrado por oculta (usado en WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_transacciones_oculta ON transacciones(oculta) WHERE oculta = false;

-- Índice para filtrado por ocultaEnMina (usado en módulo de minas)
CREATE INDEX IF NOT EXISTS idx_transacciones_oculta_en_mina ON transacciones(oculta_en_mina) WHERE oculta_en_mina = false;

-- Índice para filtrado por ocultaEnComprador (usado en módulo de compradores)
CREATE INDEX IF NOT EXISTS idx_transacciones_oculta_en_comprador ON transacciones(oculta_en_comprador) WHERE oculta_en_comprador = false;

-- Índice para filtrado por ocultaEnVolquetero (usado en módulo de volqueteros)
CREATE INDEX IF NOT EXISTS idx_transacciones_oculta_en_volquetero ON transacciones(oculta_en_volquetero) WHERE oculta_en_volquetero = false;

-- Índice para filtrado por ocultaEnGeneral (usado en módulo general)
CREATE INDEX IF NOT EXISTS idx_transacciones_oculta_en_general ON transacciones(oculta_en_general) WHERE oculta_en_general = false;

-- Índice compuesto para búsquedas por tipo e ID (usado en getTransaccionesForModule)
CREATE INDEX IF NOT EXISTS idx_transacciones_de_quien ON transacciones(de_quien_tipo, de_quien_id) WHERE de_quien_tipo IS NOT NULL AND de_quien_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacciones_para_quien ON transacciones(para_quien_tipo, para_quien_id) WHERE para_quien_tipo IS NOT NULL AND para_quien_id IS NOT NULL;

-- Índice para horaInterna (usado como criterio secundario de ordenamiento)
CREATE INDEX IF NOT EXISTS idx_transacciones_hora_interna ON transacciones(hora_interna DESC);

-- Índice para userId (usado en filtrado por usuario)
CREATE INDEX IF NOT EXISTS idx_transacciones_user_id ON transacciones(user_id) WHERE user_id IS NOT NULL;

-- Índices para viajes (mejoran rendimiento en cálculos de balance)
CREATE INDEX IF NOT EXISTS idx_viajes_mina_id ON viajes(mina_id) WHERE mina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_viajes_comprador_id ON viajes(comprador_id) WHERE comprador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_viajes_estado ON viajes(estado) WHERE estado = 'completado';
CREATE INDEX IF NOT EXISTS idx_viajes_oculta ON viajes(oculta) WHERE oculta = false;

-- Índice compuesto para viajes completados de una mina (usado en cálculo de balance)
CREATE INDEX IF NOT EXISTS idx_viajes_mina_completados ON viajes(mina_id, estado, oculta) WHERE estado = 'completado' AND oculta = false;

-- Verificar índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('transacciones', 'viajes', 'minas', 'compradores', 'volqueteros')
ORDER BY tablename, indexname;

