-- ============================================================
-- SUPRE WMS — Migración 003
-- Fecha: 2026-05-13
-- Descripción: Garantiza unicidad de nombre de sub-categoría
--              dentro de la misma categoría a nivel de BD.
--
-- IMPORTANTE: Ejecutar primero el script de limpieza de duplicados
-- si ya existen filas duplicadas en la tabla subcategories.
-- ============================================================

-- PASO 1: Limpiar duplicados preexistentes (si los hay).
-- Conserva el registro con id más bajo para cada combinación.
DELETE s1
FROM subcategories s1
INNER JOIN subcategories s2
    ON  s1.category_id = s2.category_id
    AND LOWER(s1.name) = LOWER(s2.name)
    AND s1.id > s2.id;

-- PASO 2: Agregar el índice único.
-- Si ya existe (re-ejecución), el ALTER lo ignora con el nombre del índice.
ALTER TABLE subcategories
    ADD UNIQUE KEY uk_subcategory_name (category_id, name);
