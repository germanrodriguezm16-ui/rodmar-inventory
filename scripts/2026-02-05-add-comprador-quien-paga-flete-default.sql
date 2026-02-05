-- Default de quién paga el flete por comprador (precarga en modal de descargue)
ALTER TABLE compradores
ADD COLUMN IF NOT EXISTS quien_paga_flete_default TEXT DEFAULT 'comprador';

