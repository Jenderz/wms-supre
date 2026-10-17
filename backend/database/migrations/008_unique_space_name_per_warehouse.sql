-- ============================================================
-- MIGRACIÓN 008: Restricción UNIQUE compuesta (warehouse_id, name)
--               en warehouse_spaces
-- ============================================================
-- CONTEXTO:
--   La migración 007 eliminó el UNIQUE en `name` porque impedía
--   crear dos espacios con el mismo nombre en *distintos* almacenes.
--   Sin embargo, esto abrió la puerta a crear espacios con nombre
--   duplicado dentro del MISMO almacén, lo que es incorrecto.
--
-- SOLUCIÓN:
--   Agregar un índice UNIQUE compuesto (warehouse_id, name) que:
--     - Permite el mismo nombre en distintos almacenes ✓
--     - Impide nombres duplicados dentro del mismo almacén ✓
-- ============================================================

-- Paso 1: Eliminar duplicados existentes (si los hay) antes de
--         crear el índice. Se conserva el registro con id menor.
DELETE ws1
FROM warehouse_spaces ws1
INNER JOIN warehouse_spaces ws2
  ON  ws1.warehouse_id = ws2.warehouse_id
  AND ws1.name         = ws2.name
  AND ws1.id           > ws2.id;

-- Paso 2: Agregar el índice UNIQUE compuesto
ALTER TABLE warehouse_spaces
  ADD CONSTRAINT uk_space_name_per_warehouse
  UNIQUE (warehouse_id, name);

-- ============================================================
-- VERIFICACIÓN: Debe mostrar el nuevo índice
SELECT
    index_name,
    GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns,
    IF(non_unique = 0, 'UNIQUE', 'INDEX') AS index_type
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name   = 'warehouse_spaces'
GROUP BY index_name, non_unique
ORDER BY index_name;
-- ============================================================
