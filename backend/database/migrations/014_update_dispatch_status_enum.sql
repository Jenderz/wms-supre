-- Migration 014: Cambiar columna status en dispatch_orders a VARCHAR(50)
-- Permite los estados PENDIENTE, EN_PROCESO, CONFIRMADO, DESPACHADO, CANCELADO sin restricciones de ENUM
ALTER TABLE dispatch_orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE';

-- Convertir cualquier estado antiguo 'PROCESANDO' a 'EN_PROCESO' para mantener consistencia
UPDATE dispatch_orders SET status = 'EN_PROCESO' WHERE status = 'PROCESANDO';
