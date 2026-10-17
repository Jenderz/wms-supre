-- ============================================================
-- Migración 009: Tipo de Uso de Espacio en warehouse_spaces
-- Clasificación: Despachos | Almacenamiento
-- DEFAULT 'Almacenamiento' garantiza retrocompatibilidad con
-- registros existentes sin necesidad de UPDATE masivo.
-- ============================================================

ALTER TABLE warehouse_spaces
    ADD COLUMN space_usage_type
        ENUM('Despachos', 'Almacenamiento')
        NOT NULL
        DEFAULT 'Almacenamiento'
    AFTER space_type_id;

-- Índice para consultas de filtrado/agrupación eficientes
CREATE INDEX idx_space_usage_type ON warehouse_spaces (space_usage_type);

-- ============================================================
-- Verificación (ejecutar manualmente para confirmar)
-- SHOW COLUMNS FROM warehouse_spaces LIKE 'space_usage_type';
-- ============================================================
