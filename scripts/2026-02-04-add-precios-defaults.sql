-- Defaults de precios por socio para precarga en modales

ALTER TABLE minas
ADD COLUMN IF NOT EXISTS precio_compra_ton_default NUMERIC(10,2) DEFAULT 0;

ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS venta_ton_default NUMERIC(10,2) DEFAULT 0;

ALTER TABLE volqueteros
ADD COLUMN IF NOT EXISTS flete_ton_default NUMERIC(10,2) DEFAULT 0;

ALTER TABLE volqueteros
ADD COLUMN IF NOT EXISTS otros_gastos_flete_default NUMERIC(10,2) DEFAULT 0;
