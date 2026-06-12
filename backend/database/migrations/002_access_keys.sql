-- ============================================================
-- SUPRE WMS — Migración 002: Tabla de Llaves de Acceso
-- Ejecutar sobre una BD existente (producción/staging)
-- ============================================================

CREATE TABLE IF NOT EXISTS access_keys (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL COMMENT 'Etiqueta descriptiva de la llave',
    module      VARCHAR(50)  NOT NULL COMMENT 'CATALOG, CATEGORIES, PROVIDERS, etc.',
    action      VARCHAR(50)  NOT NULL DEFAULT '*' COMMENT 'DELETE, EDIT, CREATE, IMPORT, EXPORT, * = todas',
    key_hash    VARCHAR(255) NOT NULL COMMENT 'bcrypt del PIN/clave — nunca se expone',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_module_action (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
