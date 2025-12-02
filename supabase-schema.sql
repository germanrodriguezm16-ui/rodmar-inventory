-- ============================================
-- RODMAR INVENTORY - SCHEMA COMPLETO PARA SUPABASE
-- ============================================
-- Ejecuta este SQL en el SQL Editor de Supabase
-- ============================================

-- Tabla: users (Usuarios)
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY NOT NULL,
  "email" varchar UNIQUE,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Tabla: sessions (Sesiones)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Tabla: minas (Minas)
CREATE TABLE IF NOT EXISTS "minas" (
  "id" serial PRIMARY KEY,
  "nombre" text NOT NULL,
  "saldo" numeric(15, 2) DEFAULT '0',
  "balance_calculado" numeric(15, 2) DEFAULT '0',
  "balance_desactualizado" boolean DEFAULT false NOT NULL,
  "ultimo_recalculo" timestamp DEFAULT now(),
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

-- Tabla: compradores (Compradores)
CREATE TABLE IF NOT EXISTS "compradores" (
  "id" serial PRIMARY KEY,
  "nombre" text NOT NULL,
  "saldo" numeric(15, 2) DEFAULT '0',
  "balance_calculado" numeric(15, 2) DEFAULT '0',
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

-- Tabla: volqueteros (Volqueteros)
CREATE TABLE IF NOT EXISTS "volqueteros" (
  "id" serial PRIMARY KEY,
  "nombre" text NOT NULL,
  "placa" text NOT NULL,
  "saldo" numeric(15, 2) DEFAULT '0',
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

-- Tabla: viajes (Viajes/Trips)
CREATE TABLE IF NOT EXISTS "viajes" (
  "id" text PRIMARY KEY,
  "fecha_cargue" timestamp NOT NULL,
  "fecha_descargue" timestamp,
  "conductor" text NOT NULL,
  "tipo_carro" text NOT NULL,
  "placa" text NOT NULL,
  "mina_id" integer REFERENCES "minas"("id"),
  "comprador_id" integer REFERENCES "compradores"("id"),
  "peso" numeric(8, 2),
  "precio_compra_ton" numeric(10, 2) NOT NULL,
  "venta_ton" numeric(10, 2),
  "flete_ton" numeric(10, 2),
  "otros_gastos_flete" numeric(10, 2),
  "quien_paga_flete" text,
  "vut" numeric(10, 2),
  "cut" numeric(10, 2),
  "fut" numeric(10, 2),
  "total_venta" numeric(15, 2),
  "total_compra" numeric(15, 2),
  "total_flete" numeric(15, 2),
  "valor_consignar" numeric(15, 2),
  "ganancia" numeric(15, 2),
  "recibo" text,
  "observaciones" text,
  "estado" text NOT NULL DEFAULT 'pendiente',
  "oculta" boolean DEFAULT false NOT NULL,
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

-- Tabla: transacciones (Transacciones)
CREATE TABLE IF NOT EXISTS "transacciones" (
  "id" serial PRIMARY KEY,
  "de_quien_tipo" text,
  "de_quien_id" text,
  "para_quien_tipo" text,
  "para_quien_id" text,
  "postobon_cuenta" text,
  "concepto" text NOT NULL,
  "valor" numeric(15, 2) NOT NULL,
  "fecha" timestamp NOT NULL,
  "hora_interna" timestamp DEFAULT now() NOT NULL,
  "forma_pago" text NOT NULL,
  "voucher" text,
  "comentario" text,
  "tipo_transaccion" text DEFAULT 'manual',
  "oculta" boolean DEFAULT false NOT NULL,
  "oculta_en_comprador" boolean DEFAULT false NOT NULL,
  "oculta_en_mina" boolean DEFAULT false NOT NULL,
  "oculta_en_volquetero" boolean DEFAULT false NOT NULL,
  "oculta_en_general" boolean DEFAULT false NOT NULL,
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "tipo_socio" text,
  "socio_id" integer
);

-- Tabla: inversiones (Inversiones)
CREATE TABLE IF NOT EXISTS "inversiones" (
  "id" serial PRIMARY KEY,
  "concepto" text NOT NULL,
  "valor" numeric(15, 2) NOT NULL,
  "fecha" timestamp NOT NULL,
  "origen" text NOT NULL,
  "origen_detalle" text,
  "destino" text NOT NULL,
  "destino_detalle" text,
  "observaciones" text,
  "voucher" text,
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

-- Tabla: fusion_backups (Respaldo de Fusiones)
CREATE TABLE IF NOT EXISTS "fusion_backups" (
  "id" serial PRIMARY KEY,
  "tipo_entidad" varchar(20) NOT NULL,
  "origen_id" integer NOT NULL,
  "destino_id" integer NOT NULL,
  "origen_nombre" varchar(255) NOT NULL,
  "destino_nombre" varchar(255) NOT NULL,
  "datos_originales" jsonb NOT NULL,
  "transacciones_afectadas" jsonb NOT NULL,
  "viajes_afectados" jsonb NOT NULL,
  "fecha_fusion" timestamp DEFAULT now(),
  "revertida" boolean DEFAULT false,
  "fecha_reversion" timestamp,
  "user_id" varchar REFERENCES "users"("id")
);

-- ============================================
-- ÍNDICES ADICIONALES PARA MEJOR RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_viajes_mina_id" ON "viajes" ("mina_id");
CREATE INDEX IF NOT EXISTS "idx_viajes_comprador_id" ON "viajes" ("comprador_id");
CREATE INDEX IF NOT EXISTS "idx_viajes_estado" ON "viajes" ("estado");
CREATE INDEX IF NOT EXISTS "idx_transacciones_fecha" ON "transacciones" ("fecha");
CREATE INDEX IF NOT EXISTS "idx_transacciones_user_id" ON "transacciones" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_transacciones_oculta" ON "transacciones" ("oculta");
CREATE INDEX IF NOT EXISTS "idx_minas_user_id" ON "minas" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_compradores_user_id" ON "compradores" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_volqueteros_user_id" ON "volqueteros" ("user_id");

-- ============================================
-- FIN DEL SCHEMA
-- ============================================
-- Todas las tablas han sido creadas exitosamente
-- ============================================


