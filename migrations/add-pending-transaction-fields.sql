-- Migración: Agregar campos para transacciones pendientes
-- Ejecutar este script en la base de datos de producción (Railway/Supabase)

-- Verificar si las columnas ya existen antes de agregarlas
DO $$ 
BEGIN
    -- Agregar columna 'estado' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transacciones' AND column_name = 'estado'
    ) THEN
        ALTER TABLE transacciones 
        ADD COLUMN estado text NOT NULL DEFAULT 'completada';
        RAISE NOTICE 'Columna "estado" agregada';
    ELSE
        RAISE NOTICE 'Columna "estado" ya existe';
    END IF;

    -- Agregar columna 'detalle_solicitud' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transacciones' AND column_name = 'detalle_solicitud'
    ) THEN
        ALTER TABLE transacciones 
        ADD COLUMN detalle_solicitud text;
        RAISE NOTICE 'Columna "detalle_solicitud" agregada';
    ELSE
        RAISE NOTICE 'Columna "detalle_solicitud" ya existe';
    END IF;

    -- Agregar columna 'codigo_solicitud' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transacciones' AND column_name = 'codigo_solicitud'
    ) THEN
        ALTER TABLE transacciones 
        ADD COLUMN codigo_solicitud varchar(50);
        RAISE NOTICE 'Columna "codigo_solicitud" agregada';
    ELSE
        RAISE NOTICE 'Columna "codigo_solicitud" ya existe';
    END IF;

    -- Agregar columna 'tiene_voucher' si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transacciones' AND column_name = 'tiene_voucher'
    ) THEN
        ALTER TABLE transacciones 
        ADD COLUMN tiene_voucher boolean NOT NULL DEFAULT false;
        RAISE NOTICE 'Columna "tiene_voucher" agregada';
    ELSE
        RAISE NOTICE 'Columna "tiene_voucher" ya existe';
    END IF;
END $$;

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'transacciones' 
AND column_name IN ('estado', 'detalle_solicitud', 'codigo_solicitud', 'tiene_voucher')
ORDER BY column_name;



