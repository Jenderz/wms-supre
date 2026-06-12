-- ============================================================
-- SUPRE WMS — Migración 001: Categoría reservada del sistema
-- Ejecutar sobre una BD existente (producción/staging)
-- Es idempotente: usa INSERT IGNORE para no duplicar
-- ============================================================

INSERT IGNORE INTO categories (name, code, description, is_fractional, fraction_type)
VALUES ('Sin Categoría', 'SIN-CAT', 'Categoría reservada del sistema. Asignada automáticamente a productos sin clasificar. NO ELIMINAR.', 0, NULL);
