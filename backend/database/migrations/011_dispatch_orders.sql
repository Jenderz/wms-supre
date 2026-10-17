-- ============================================================
-- Migración 011: Tablas para Gestión de Órdenes de Despacho
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_orders (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    code           VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id   INT NOT NULL,
    requested_by   VARCHAR(100) NOT NULL,
    client_name    VARCHAR(150) NOT NULL,
    delivery_type  VARCHAR(100) NOT NULL DEFAULT 'TIENDA SUPREPARTS',
    status         ENUM('PENDIENTE','PROCESANDO','DESPACHADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    notes          TEXT,
    created_by     INT NOT NULL,
    dispatched_by  INT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    dispatched_at  TIMESTAMP NULL,
    FOREIGN KEY (warehouse_id)  REFERENCES warehouses(id),
    FOREIGN KEY (created_by)    REFERENCES users(id),
    FOREIGN KEY (dispatched_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_dispatch_status (status),
    INDEX idx_dispatch_warehouse (warehouse_id),
    INDEX idx_dispatch_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispatch_order_items (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    dispatch_order_id    INT NOT NULL,
    product_id           INT NOT NULL,
    requested_quantity   DECIMAL(12,4) NOT NULL,
    warehouse_space_id   INT NULL,
    space_selection_type ENUM('AUTO','MANUAL') NOT NULL DEFAULT 'AUTO',
    dispatch_status      ENUM('PENDIENTE','DESPACHADO','INSUFICIENTE') NOT NULL DEFAULT 'PENDIENTE',
    notes                TEXT,
    FOREIGN KEY (dispatch_order_id) REFERENCES dispatch_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)        REFERENCES products(id),
    FOREIGN KEY (warehouse_space_id) REFERENCES warehouse_spaces(id) ON DELETE SET NULL,
    INDEX idx_dispatch_items_order (dispatch_order_id),
    INDEX idx_dispatch_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
