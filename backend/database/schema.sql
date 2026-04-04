-- ============================================================
-- SUPRE WMS — Schema de Base de Datos
-- MySQL / MariaDB | utf8mb4 | InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS supre_wms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supre_wms;

-- ============================================================
-- 1. INFRAESTRUCTURA
-- ============================================================

CREATE TABLE stores (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    qr_code     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE locations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    store_id    INT NOT NULL,
    room        VARCHAR(50) NOT NULL,
    shelf       VARCHAR(50) NOT NULL,
    cubicle     VARCHAR(50) NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
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

-- Relación M:N users <-> stores (normalización estricta + integridad referencial)
CREATE TABLE user_stores (
    user_id  INT NOT NULL,
    store_id INT NOT NULL,
    PRIMARY KEY (user_id, store_id),
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
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
    dimension_height DECIMAL(10,2),
    dimension_width  DECIMAL(10,2),
    dimension_depth  DECIMAL(10,2),
    FOREIGN KEY (category_id) REFERENCES categories(id)
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

-- Relación M:N products <-> stores
CREATE TABLE product_stores (
    product_id INT NOT NULL,
    store_id   INT NOT NULL,
    PRIMARY KEY (product_id, store_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id)   REFERENCES stores(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. INVENTARIO
-- ============================================================

CREATE TABLE stock (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    store_id    INT NOT NULL,
    location_id INT,
    quantity    DECIMAL(12,4) NOT NULL DEFAULT 0,
    min_stock   DECIMAL(12,4) NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (store_id)    REFERENCES stores(id),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    UNIQUE KEY uk_stock_location (product_id, store_id, location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. OPERACIONES: ABASTECIMIENTO (PickingLot)
-- ============================================================

CREATE TABLE picking_lots (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    lot_number   VARCHAR(100) NOT NULL UNIQUE,
    store_id     INT NOT NULL,
    description  TEXT,
    status       ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conformed_at TIMESTAMP NULL,
    created_by   INT NOT NULL,
    FOREIGN KEY (store_id)   REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_picking_lots_status (status),
    INDEX idx_picking_lots_store  (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE picking_lot_items (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    picking_lot_id   INT NOT NULL,
    product_id       INT NOT NULL,
    quantity_to_enter DECIMAL(12,4) NOT NULL,
    number_of_packages INT NOT NULL DEFAULT 1,
    -- packagesConfig es descriptivo de un pallet específico, no se consulta por índice
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
    id          INT AUTO_INCREMENT PRIMARY KEY,
    store_id    INT NOT NULL,
    status      ENUM('DRAFT','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by  INT NOT NULL,
    approved_at TIMESTAMP NULL,
    approved_by INT,
    FOREIGN KEY (store_id)   REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_disincorporations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE disincorporation_items (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    disincorporation_id INT NOT NULL,
    product_id          INT NOT NULL,
    location_id         INT,
    quantity            DECIMAL(12,4) NOT NULL,
    reason              VARCHAR(255),
    notes               TEXT,
    FOREIGN KEY (disincorporation_id) REFERENCES disincorporations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. HISTORIAL DE MOVIMIENTOS
-- ============================================================

CREATE TABLE stock_movements (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    product_id   INT NOT NULL,
    store_id     INT NOT NULL,
    location_id  INT,
    type         ENUM('IN','OUT','TRANSFER') NOT NULL,
    reason       VARCHAR(100) NOT NULL,
    quantity     DECIMAL(12,4) NOT NULL,
    -- reference_id apunta a picking_lots.id o disincorporations.id según el reason
    reference_id INT,
    notes        TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by   INT NOT NULL,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (store_id)    REFERENCES stores(id),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id),
    INDEX idx_movements_product (product_id),
    INDEX idx_movements_store   (store_id),
    INDEX idx_movements_type    (type),
    INDEX idx_movements_date    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATOS INICIALES: Usuario ADMIN por defecto
-- Password: admin123 (cambiar en producción)
-- ============================================================
INSERT INTO users (name, username, password_hash, role, permissions) VALUES
('Administrador', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', '[]');
