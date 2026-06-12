-- ============================================================
-- SUPRE WMS — Script seguro para borrar registros (Reset)
-- ============================================================

-- Desactivar la verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Borrar todas las tablas usando DELETE
DELETE FROM stock_movements;
DELETE FROM disincorporation_items;
DELETE FROM disincorporations;
DELETE FROM picking_lot_items;
DELETE FROM picking_lots;
DELETE FROM stock;
DELETE FROM product_providers;
DELETE FROM product_warehouses;
DELETE FROM product_prices;
DELETE FROM product_costs;
DELETE FROM products;
DELETE FROM subcategories;
DELETE FROM categories;
DELETE FROM warehouse_spaces;
DELETE FROM space_types;
DELETE FROM user_warehouses;
DELETE FROM warehouses;
DELETE FROM users;

-- 2. Reiniciar los contadores AUTO_INCREMENT a 1
ALTER TABLE stock_movements AUTO_INCREMENT = 1;
ALTER TABLE disincorporation_items AUTO_INCREMENT = 1;
ALTER TABLE disincorporations AUTO_INCREMENT = 1;
ALTER TABLE picking_lot_items AUTO_INCREMENT = 1;
ALTER TABLE picking_lots AUTO_INCREMENT = 1;
ALTER TABLE stock AUTO_INCREMENT = 1;
ALTER TABLE products AUTO_INCREMENT = 1;
ALTER TABLE subcategories AUTO_INCREMENT = 1;
ALTER TABLE categories AUTO_INCREMENT = 1;
ALTER TABLE warehouse_spaces AUTO_INCREMENT = 1;
ALTER TABLE space_types AUTO_INCREMENT = 1;
ALTER TABLE warehouses AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
-- Nota: product_warehouses y user_warehouses no tienen auto_increment porque usan claves compuestas

-- Restaurar la verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- RE-INSERTAR USUARIO ADMIN
-- Password: admin123 
-- ============================================================
INSERT INTO users (name, username, password_hash, role, permissions) VALUES
('Administrador', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', '[]');

-- ============================================================
-- RE-INSERTAR CATEGORÍA DEL SISTEMA
-- NO ELIMINAR — productos sin categoría la necesitan
-- ============================================================
INSERT IGNORE INTO categories (name, code, description, is_fractional, fraction_type)
VALUES ('Sin Categoría', 'SIN-CAT', 'Categoría reservada del sistema. Asignada automáticamente a productos sin clasificar.', 0, NULL);
