-- Migración: Agregar tabla para suscripciones push
-- Ejecutar este script en la base de datos de producción (Railway/Supabase)

-- Verificar si la tabla ya existe antes de crearla
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'push_subscriptions'
    ) THEN
        CREATE TABLE push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
        );

        -- Crear índices para mejor rendimiento
        CREATE INDEX idx_push_user ON push_subscriptions(user_id);

        RAISE NOTICE 'Tabla "push_subscriptions" creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla "push_subscriptions" ya existe';
    END IF;
END $$;

-- Verificar que la tabla se creó correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions'
ORDER BY ordinal_position;

