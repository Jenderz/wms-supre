-- ============================================================
-- Migración: Agregar columna code_type a la tabla products
-- Ejecutar en la base de datos MySQL del WMS
-- Fecha: 2026-07-13
-- ============================================================

-- Agrega el tipo de representación visual del código:
-- 'qr'      → se muestra como código QR (default, compatibilidad con productos existentes)
-- 'barcode' → se muestra como código de barras lineal (CODE128)
ALTER TABLE products
  ADD COLUMN code_type ENUM('qr', 'barcode') NOT NULL DEFAULT 'qr'
  COMMENT 'Tipo de representación visual del código: qr o barcode.';
