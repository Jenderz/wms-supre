-- ============================================================
-- MIGRACIÓN 005: Corrección del UNIQUE KEY en la tabla stock
-- ============================================================
-- PROBLEMA:
--   En MySQL/MariaDB, NULL no es igual a NULL en índices UNIQUE.
--   Esto significa que el UNIQUE KEY uk_stock_location sobre
--   (product_id, warehouse_id, warehouse_space_id) NO previene
--   filas duplicadas cuando warehouse_space_id es NULL.
--   Como resultado, "ON DUPLICATE KEY UPDATE" nunca se activaba
--   para el stock pendiente (sin espacio asignado), generando
--   múltiples filas acumuladas para el mismo producto+almacén.
--
-- SOLUCIÓN:
--   Agregar una columna auxiliar `space_key` NOT NULL que:
--     - Almacena el warehouse_space_id real si existe
--     - Almacena 0 cuando warehouse_space_id es NULL
--   El UNIQUE KEY se reemplaza para usar esta columna auxiliar,
--   garantizando unicidad real incluso para el stock pendiente.
-- ============================================================

-- PASO 1: Limpiar filas duplicadas de stock pendiente ANTES de
--         modificar la tabla (dejar la fila con mayor id)
-- ⚠️ EJECUTAR PRIMERO para evitar errores al crear el índice

DELETE s1
FROM stock s1
INNER JOIN stock s2
  ON  s1.product_id   = s2.product_id
  AND s1.warehouse_id = s2.warehouse_id
  AND s1.warehouse_space_id IS NULL
  AND s2.warehouse_space_id IS NULL
  AND s1.id < s2.id;

-- PASO 2: Agregar columna auxiliar space_key
ALTER TABLE stock
    ADD COLUMN space_key INT NOT NULL DEFAULT 0 COMMENT '0 = stock pendiente (sin espacio), warehouse_space_id en cualquier otro caso';

-- PASO 3: Poblar space_key con los valores actuales
UPDATE stock
SET space_key = COALESCE(warehouse_space_id, 0);

-- PASO 4: Eliminar el índice UNIQUE original (no funciona con NULLs)
ALTER TABLE stock
    DROP INDEX uk_stock_location;

-- PASO 5: Crear el nuevo índice UNIQUE usando space_key
ALTER TABLE stock
    ADD UNIQUE KEY uk_stock_location (product_id, warehouse_id, space_key);

-- ============================================================
-- VERIFICACIÓN: Esta consulta debe devolver 0 filas si todo OK
SELECT product_id, warehouse_id, space_key, COUNT(*) as duplicates
FROM stock
GROUP BY product_id, warehouse_id, space_key
HAVING duplicates > 1;
-- ============================================================
