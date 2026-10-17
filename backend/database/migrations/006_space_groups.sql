-- ============================================================
-- Migración: Añadir Grupos de Espacios de Almacén
-- ============================================================

-- Tabla para definir los grupos
CREATE TABLE IF NOT EXISTS space_groups (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    warehouse_id INT, -- Puede ser null si el grupo aplica globalmente o si se flexibiliza
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para la relación muchos a muchos entre grupos y espacios
CREATE TABLE IF NOT EXISTS space_group_items (
    group_id           INT NOT NULL,
    warehouse_space_id INT NOT NULL,
    PRIMARY KEY (group_id, warehouse_space_id),
    FOREIGN KEY (group_id) REFERENCES space_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_space_id) REFERENCES warehouse_spaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
