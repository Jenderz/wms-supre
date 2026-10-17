-- ============================================================
-- Migration 015: Añadir columna origin a dispatch_orders y
-- asegurar consistencia de espacios únicos tipo 'Despachos'
-- ============================================================

-- 1. Añadir columna origin si no existe
SET @col_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dispatch_orders' 
      AND COLUMN_NAME = 'origin'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE dispatch_orders ADD COLUMN origin VARCHAR(50) NOT NULL DEFAULT \'DIRECT\' AFTER delivery_type, ADD INDEX idx_dispatch_origin (origin);',
    'SELECT "Column origin already exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Limpieza de registros redundantes con cantidad 0 de tipo 'Despachos'
-- Si un producto tiene múltiples filas en `stock` con espacios tipo 'Despachos' con cantidad <= 0 en el mismo almacén,
-- conservar solo la que tenga mayor id o stock y eliminar duplicados residuales.
DELETE s1 FROM stock s1
JOIN warehouse_spaces ws1 ON s1.warehouse_space_id = ws1.id AND ws1.space_usage_type = 'Despachos'
JOIN stock s2 ON s1.product_id = s2.product_id AND s1.warehouse_id = s2.warehouse_id AND s1.id < s2.id
JOIN warehouse_spaces ws2 ON s2.warehouse_space_id = ws2.id AND ws2.space_usage_type = 'Despachos'
WHERE s1.quantity <= 0 AND s1.reserved_quantity <= 0;
