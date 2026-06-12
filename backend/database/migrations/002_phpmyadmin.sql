-- ============================================================
-- SUPRE WMS — Migración para phpMyAdmin
-- Fecha: 2026-05-06
-- Ejecutar completo en la pestaña SQL de phpMyAdmin
-- ============================================================

-- PASO 1: Tabla de Llaves de Acceso (nueva)
-- CREATE TABLE IF NOT EXISTS es seguro si ya existe

CREATE TABLE IF NOT EXISTS access_keys (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    module      VARCHAR(50)  NOT NULL,
    action      VARCHAR(50)  NOT NULL DEFAULT '*',
    key_hash    VARCHAR(255) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_module_action (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 2: Categoría del sistema SIN-CAT
-- INSERT IGNORE no genera error si ya existe

INSERT IGNORE INTO categories (name, code, description, is_fractional, fraction_type)
VALUES (
    'Sin Categoría',
    'SIN-CAT',
    'Categoría reservada del sistema. Asignada automáticamente a productos sin clasificar.',
    0,
    NULL
);
