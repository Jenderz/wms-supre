-- ============================================================
-- Migración 012: Agregar columna reserved_quantity a la tabla stock
-- Permite reservar stock cuando una orden de despacho se crea en PENDIENTE
-- y liberarlo si se CANCELA o confirmarlo cuando pasa a DESPACHADO.
-- ============================================================

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS reserved_quantity DECIMAL(12,4) NOT NULL DEFAULT 0;
