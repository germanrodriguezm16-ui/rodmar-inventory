-- Migration: Create terceros table
-- This table stores third-party accounts (credit cards, loans, personal accounts, etc.)
-- Similar structure to compradores but without placa field

CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  saldo DECIMAL(15, 2) DEFAULT '0',
  balance_calculado DECIMAL(15, 2) DEFAULT '0',
  balance_desactualizado BOOLEAN DEFAULT false NOT NULL,
  ultimo_recalculo TIMESTAMP DEFAULT NOW(),
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_terceros_user_id ON terceros(user_id);
