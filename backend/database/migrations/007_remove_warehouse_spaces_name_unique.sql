-- ============================================================
-- MIGRACIÓN 007: Eliminar restricción UNIQUE en nombre de
--               warehouse_spaces (si existe)
-- ============================================================
-- PROBLEMA:
--   Si en la base de datos real existe un índice UNIQUE sobre
--   el campo `name` de la tabla `warehouse_spaces`, impide crear
--   dos espacios con el mismo nombre aunque pertenezcan a
--   distintos almacenes.
--
-- SOLUCIÓN:
--   Eliminar ese índice UNIQUE del campo `name` para permitir
--   nombres de espacio repetidos (el ID los diferencia).
--   Los espacios son únicos por ID, no por nombre.
-- ============================================================

-- Verificar y eliminar el índice UNIQUE en name (si existe)
-- Este bloque usa un procedimiento para evitar error si el índice no existe.
DROP PROCEDURE IF EXISTS drop_unique_if_exists;

DELIMITER $$
CREATE PROCEDURE drop_unique_if_exists()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name   = 'warehouse_spaces'
          AND index_name  != 'PRIMARY'
          AND non_unique   = 0
          AND column_name  = 'name'
    ) THEN
        SET @idx = (
            SELECT index_name
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name   = 'warehouse_spaces'
              AND index_name  != 'PRIMARY'
              AND non_unique   = 0
              AND column_name  = 'name'
            LIMIT 1
        );
        SET @sql = CONCAT('ALTER TABLE warehouse_spaces DROP INDEX `', @idx, '`');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL drop_unique_if_exists();
DROP PROCEDURE IF EXISTS drop_unique_if_exists;

-- ============================================================
-- VERIFICACIÓN: Esta consulta debe devolver 0 si no hay UNIQUE
--               en name de warehouse_spaces
SELECT COUNT(*) as unique_name_indexes_remaining
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name   = 'warehouse_spaces'
  AND index_name  != 'PRIMARY'
  AND non_unique   = 0
  AND column_name  = 'name';
-- ============================================================
