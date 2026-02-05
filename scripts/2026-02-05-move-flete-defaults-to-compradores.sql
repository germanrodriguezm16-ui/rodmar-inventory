-- Mover defaults de flete/OTG desde volqueteros hacia compradores,
-- discriminando por tipo de carro (Sencillo vs Doble Troque).

-- 1) Nuevos defaults en compradores
ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS flete_ton_default_sencillo NUMERIC(10,2) DEFAULT 0;

ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS otg_default_sencillo NUMERIC(10,2) DEFAULT 0;

ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS flete_ton_default_doble_troque NUMERIC(10,2) DEFAULT 0;

ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS otg_default_doble_troque NUMERIC(10,2) DEFAULT 0;

-- 2) Eliminar defaults en volqueteros (ya no se usarán)
ALTER TABLE volqueteros
DROP COLUMN IF EXISTS flete_ton_default;

ALTER TABLE volqueteros
DROP COLUMN IF EXISTS otros_gastos_flete_default;

