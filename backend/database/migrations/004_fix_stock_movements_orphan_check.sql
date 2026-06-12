-- ============================================================
-- MIGRACIÓN 004: Diagnóstico y limpieza de stock huérfano
-- Ejecutar en phpMyAdmin o consola MySQL para verificar
-- si hay registros defectuosos de conformaciones anteriores.
-- ============================================================

-- 1. Ver registros de stock sin warehouse_id válido (huérfanos)
--    (Antes del fix, el código pasaba storeId/locationId incorrectos
--     por lo que el INSERT fallaba silenciosamente o insertaba NULL)
SELECT s.id, s.product_id, s.warehouse_id, s.warehouse_space_id, s.quantity
FROM stock s
WHERE s.warehouse_id IS NULL
   OR s.warehouse_id NOT IN (SELECT id FROM warehouses);

-- 2. Si la consulta anterior devuelve filas, ejecutar la limpieza:
--    PRECAUCIÓN: Solo eliminar registros si warehouse_id es NULL o inválido
-- DELETE FROM stock
-- WHERE warehouse_id IS NULL
--    OR warehouse_id NOT IN (SELECT id FROM warehouses);

-- 3. Ver movimientos de stock sin warehouse_id válido
SELECT sm.id, sm.product_id, sm.warehouse_id, sm.type, sm.reason, sm.quantity, sm.created_at
FROM stock_movements sm
WHERE sm.warehouse_id IS NULL
   OR sm.warehouse_id NOT IN (SELECT id FROM warehouses);

-- 4. Si hay movimientos huérfanos y deseas limpiarlos:
-- DELETE FROM stock_movements
-- WHERE warehouse_id IS NULL
--    OR warehouse_id NOT IN (SELECT id FROM warehouses);
