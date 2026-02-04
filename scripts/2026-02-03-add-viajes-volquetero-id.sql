-- Agregar columna volquetero_id y normalizar viajes a IDs
ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS volquetero_id INTEGER;

-- Agregar FK (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'viajes'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'viajes_volquetero_id_fkey'
  ) THEN
    ALTER TABLE viajes
    ADD CONSTRAINT viajes_volquetero_id_fkey
    FOREIGN KEY (volquetero_id) REFERENCES volqueteros(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill 1: match por nombre + placa
UPDATE viajes v
SET volquetero_id = vt.id
FROM volqueteros vt
WHERE v.volquetero_id IS NULL
  AND LOWER(TRIM(v.conductor)) = LOWER(TRIM(vt.nombre))
  AND LOWER(TRIM(v.placa)) = LOWER(TRIM(vt.placa));

-- Backfill 2: match por nombre único (sin placa)
WITH unique_volq AS (
  SELECT LOWER(TRIM(nombre)) AS nombre_norm, MIN(id) AS id
  FROM volqueteros
  GROUP BY LOWER(TRIM(nombre))
  HAVING COUNT(*) = 1
)
UPDATE viajes v
SET volquetero_id = u.id
FROM unique_volq u
WHERE v.volquetero_id IS NULL
  AND LOWER(TRIM(v.conductor)) = u.nombre_norm;

-- Índice recomendado
CREATE INDEX IF NOT EXISTS idx_viajes_volquetero_id ON viajes(volquetero_id);
