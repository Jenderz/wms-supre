-- ============================================================
-- SUPRE WMS — Schema de Base de Datos
-- MySQL / MariaDB | utf8mb4 | InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS supre_wms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supre_wms;

-- ============================================================
-- 1. INFRAESTRUCTURA
-- ============================================================

CREATE TABLE warehouses (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    qr_code     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE space_types (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE warehouse_spaces (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id  INT NOT NULL,
    space_type_id INT NOT NULL,
    name          VARCHAR(100) NOT NULL,
    proximity     DECIMAL(10,2) NOT NULL DEFAULT 0,
    qr_code       VARCHAR(255),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    FOREIGN KEY (space_type_id) REFERENCES space_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. USUARIOS
-- ============================================================

CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('COMPRAS','DEPOSITO','DESINCORPORACION','ADMIN') NOT NULL,
    permissions   JSON COMMENT 'Array de permisos extra, descriptivo',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación M:N users <-> warehouses (normalización estricta + integridad referencial)
CREATE TABLE user_warehouses (
    user_id      INT NOT NULL,
    warehouse_id INT NOT NULL,
    PRIMARY KEY (user_id, warehouse_id),
    FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. CATÁLOGO
-- ============================================================

CREATE TABLE categories (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    code          VARCHAR(50)  NOT NULL UNIQUE,
    description   TEXT,
    qr_code       VARCHAR(255),
    is_fractional BOOLEAN DEFAULT FALSE,
    fraction_type VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subcategories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    -- Garantiza unicidad de nombre dentro de la misma categoría (case-insensitive via utf8mb4_unicode_ci)
    UNIQUE KEY uk_subcategory_name (category_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE providers (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    code           VARCHAR(50)  NOT NULL UNIQUE,
    name           VARCHAR(150) NOT NULL,
    contact_number VARCHAR(100),
    address        TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE products (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    code             VARCHAR(50)  NOT NULL UNIQUE,
    name             VARCHAR(150) NOT NULL,
    image_url        VARCHAR(255),
    footer_url       VARCHAR(255),
    category_id      INT NOT NULL,
    subcategory_id   INT NULL,
    dimension_height DECIMAL(10,2),
    dimension_width  DECIMAL(10,2),
    dimension_depth  DECIMAL(10,2),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalización estricta: costos y precios en tablas separadas para analytics
CREATE TABLE product_costs (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    cost       DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_prices (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    price      DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relación M:N products <-> warehouses
CREATE TABLE product_warehouses (
    product_id   INT NOT NULL,
    warehouse_id INT NOT NULL,
    PRIMARY KEY (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id)   REFERENCES warehouses(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- M:N products <-> providers
CREATE TABLE product_providers (
    product_id INT NOT NULL,
    provider_id   INT NOT NULL,
    PRIMARY KEY (product_id, provider_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id)   REFERENCES providers(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. INVENTARIO
-- ============================================================

CREATE TABLE stock (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    product_id         INT NOT NULL,
    warehouse_id       INT NOT NULL,
    warehouse_space_id INT,
    quantity           DECIMAL(12,4) NOT NULL DEFAULT 0,
    min_stock          DECIMAL(12,4) NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id)         REFERENCES products(id),
    FOREIGN KEY (warehouse_id)       REFERENCES warehouses(id),
    FOREIGN KEY (warehouse_space_id) REFERENCES warehouse_spaces(id) ON DELETE SET NULL,
    UNIQUE KEY uk_stock_location (product_id, warehouse_id, warehouse_space_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. OPERACIONES: ABASTECIMIENTO (PickingLot)
-- ============================================================

CREATE TABLE picking_lots (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    lot_number   VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id INT NOT NULL,
    description  TEXT,
    status       ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conformed_at TIMESTAMP NULL,
    created_by   INT NOT NULL,
    FOREIGN KEY (warehouse_id)   REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_picking_lots_status (status),
    INDEX idx_picking_lots_warehouse  (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE picking_lot_items (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    picking_lot_id   INT NOT NULL,
    product_id       INT NOT NULL,
    quantity_to_enter DECIMAL(12,4) NOT NULL,
    number_of_packages INT NOT NULL DEFAULT 1,
    packages_config   JSON COMMENT '[{"packageIndex": 1, "quantity": 10}]',
    package_dim_height DECIMAL(10,2),
    package_dim_width  DECIMAL(10,2),
    package_dim_depth  DECIMAL(10,2),
    min_stock_alert    BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (picking_lot_id) REFERENCES picking_lots(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)     REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. OPERACIONES: BAJAS (Disincorporation)
-- ============================================================

CREATE TABLE disincorporations (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    status       ENUM('DRAFT','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
    description  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by   INT NOT NULL,
    approved_at  TIMESTAMP NULL,
    approved_by  INT,
    FOREIGN KEY (warehouse_id)   REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_disincorporations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE disincorporation_items (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    disincorporation_id INT NOT NULL,
    product_id          INT NOT NULL,
    warehouse_space_id  INT,
    quantity            DECIMAL(12,4) NOT NULL,
    reason              VARCHAR(255),
    notes               TEXT,
    FOREIGN KEY (disincorporation_id) REFERENCES disincorporations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (warehouse_space_id) REFERENCES warehouse_spaces(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. HISTORIAL DE MOVIMIENTOS
-- ============================================================

CREATE TABLE stock_movements (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    product_id         INT NOT NULL,
    warehouse_id       INT NOT NULL,
    warehouse_space_id INT,
    type               ENUM('IN','OUT','TRANSFER') NOT NULL,
    reason             VARCHAR(100) NOT NULL,
    quantity           DECIMAL(12,4) NOT NULL,
    reference_id       INT,
    notes              TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by         INT NOT NULL,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (warehouse_id)    REFERENCES warehouses(id),
    FOREIGN KEY (warehouse_space_id) REFERENCES warehouse_spaces(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id),
    INDEX idx_movements_product (product_id),
    INDEX idx_movements_warehouse   (warehouse_id),
    INDEX idx_movements_type    (type),
    INDEX idx_movements_date    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATOS INICIALES: Usuario ADMIN por defecto
-- Password: admin123 (cambiar en producción)
-- ============================================================
INSERT INTO users (name, username, password_hash, role, permissions) VALUES
('Administrador', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', '[]');

-- ============================================================
-- DATOS INICIALES: Categoría reservada del sistema
-- NO ELIMINAR — Usada automáticamente para productos sin categoría
-- ============================================================
INSERT IGNORE INTO categories (name, code, description, is_fractional, fraction_type)
VALUES ('Sin Categoría', 'SIN-CAT', 'Categoría reservada del sistema. Asignada automáticamente a productos sin clasificar.', 0, NULL);
