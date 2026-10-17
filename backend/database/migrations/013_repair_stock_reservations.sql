-- 013_repair_stock_reservations.sql
-- Limpieza atómica de reservas huérfanas en la tabla stock

UPDATE stock
SET reserved_quantity = 0
WHERE product_id NOT IN (
    SELECT DISTINCT i.product_id
    FROM dispatch_order_items i
    JOIN dispatch_orders d ON i.dispatch_order_id = d.id
    WHERE d.status IN ('PENDIENTE', 'PROCESANDO', 'EN_PROCESO', 'CONFIRMADO')
);
