-- Script SQL para crear índices de optimización para cuentas RodMar
-- Ejecutar este script en Drizzle Studio o directamente en la base de datos PostgreSQL
-- Estos índices mejoran significativamente el rendimiento de la carga de cuentas RodMar

-- Índices simples para filtrado por tipo
CREATE INDEX IF NOT EXISTS "idx_transacciones_de_quien_tipo" ON "transacciones" ("de_quien_tipo");
CREATE INDEX IF NOT EXISTS "idx_transacciones_para_quien_tipo" ON "transacciones" ("para_quien_tipo");

-- Índices simples para filtrado por ID
CREATE INDEX IF NOT EXISTS "idx_transacciones_de_quien_id" ON "transacciones" ("de_quien_id");
CREATE INDEX IF NOT EXISTS "idx_transacciones_para_quien_id" ON "transacciones" ("para_quien_id");

-- Índices compuestos para queries comunes (filtrado por tipo e ID simultáneamente)
CREATE INDEX IF NOT EXISTS "idx_transacciones_de_quien" ON "transacciones" ("de_quien_tipo", "de_quien_id");
CREATE INDEX IF NOT EXISTS "idx_transacciones_para_quien" ON "transacciones" ("para_quien_tipo", "para_quien_id");

-- Verificar que los índices se crearon correctamente
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'transacciones' 
  AND indexname LIKE 'idx_transacciones_%quien%'
ORDER BY indexname;
