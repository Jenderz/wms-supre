-- ============================================================
-- Migración 018: 4 Nuevos Módulos WMS
-- Stock Mínimo (min_stock_archived),
-- Picking Transferencia (transfer_pickings, transfer_picking_items),
-- Registro RDI (rdi_records),
-- Registro Averías (damage_records)
-- ============================================================

CREATE TABLE IF NOT EXISTS min_stock_archived (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    product_id          INT NOT NULL,
    warehouse_id        INT NOT NULL,
    archived_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archive_deadline_at DATETIME NOT NULL,
    archived_by         INT NULL,
    UNIQUE KEY uk_min_stock_archived (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_min_stock_deadline (archive_deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfer_pickings (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    lot_number               VARCHAR(50) NOT NULL UNIQUE,
    origin_warehouse_id      INT NOT NULL,
    destination_warehouse_id INT NOT NULL,
    responsible_user_id      INT NOT NULL,
    description              TEXT NULL,
    status                   ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    linked_picking_lot_id    INT NULL,
    stock_deducted           TINYINT(1) NOT NULL DEFAULT 0,
    created_by               INT NOT NULL,
    created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at             DATETIME NULL,
    FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (linked_picking_lot_id) REFERENCES picking_lots(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_transfer_status (status),
    INDEX idx_transfer_linked_lot (linked_picking_lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfer_picking_items (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    transfer_picking_id INT NOT NULL,
    product_id          INT NOT NULL,
    quantity            DECIMAL(12,4) NOT NULL,
    number_of_packages  INT NOT NULL DEFAULT 1,
    spaces_distribution JSON NOT NULL,
    FOREIGN KEY (transfer_picking_id) REFERENCES transfer_pickings(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rdi_records (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id        INT NOT NULL,
    product_id          INT NOT NULL,
    rdi_type            ENUM('FALTANTE','SOBRANTE') NOT NULL,
    quantity            DECIMAL(12,4) NOT NULL,
    spaces_distribution JSON NOT NULL,
    status              ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    stock_applied       TINYINT(1) NOT NULL DEFAULT 0,
    responsible_user_id INT NOT NULL,
    description         TEXT NULL,
    created_by          INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at        DATETIME NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_rdi_status (status),
    INDEX idx_rdi_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS damage_records (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    code                 VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id         INT NOT NULL,
    product_id           INT NOT NULL,
    inventory_correction TINYINT(1) NOT NULL DEFAULT 1,
    quantity             DECIMAL(12,4) NOT NULL,
    spaces_distribution  JSON NULL,
    status               ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    stock_applied        TINYINT(1) NOT NULL DEFAULT 0,
    responsible_user_id  INT NOT NULL,
    description          TEXT NULL,
    created_by           INT NOT NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at         DATETIME NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_damage_status (status),
    INDEX idx_damage_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
