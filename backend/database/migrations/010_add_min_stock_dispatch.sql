-- ============================================================
-- Migración 010: Agregar columna min_stock_dispatch a la tabla stock
-- Esta columna almacena el umbral de alerta de stock mínimo
-- para espacios cuyo spaceUsageType = 'Despachos'.
-- Es independiente de min_stock (umbral general).
-- ============================================================

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS min_stock_dispatch DECIMAL(12,4) NOT NULL DEFAULT 0;
