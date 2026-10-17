-- ============================================================
-- SUPRE WMS — Migración 016: Índices de Alto Rendimiento y Escalabilidad
-- Compatible con MySQL 8.0+ y MariaDB 10.5+ / 11.4+
-- 
-- Optimiza consultas frecuentes, elimina 'filesort' en ordenamientos por fecha
-- e implementa covering indexes para carga masiva sin tocar disco.
-- ============================================================

-- 1. PRODUCTOS: Búsqueda rápida por nombre y filtros por jerarquía de categorías
ALTER TABLE `products`
  ADD INDEX `idx_products_name` (`name`),
  ADD INDEX `idx_products_cat_sub` (`category_id`, `subcategory_id`);

-- 2. COSTOS Y PRECIOS: Covering indexes para que hydrateSubData lea directamente de RAM
ALTER TABLE `product_costs`
  ADD INDEX `idx_costs_covering` (`product_id`, `cost`);

ALTER TABLE `product_prices`
  ADD INDEX `idx_prices_covering` (`product_id`, `price`);

-- 3. MOVIMIENTOS DE STOCK (KARDEX): Índices compuestos para fechas y trazabilidad por almacén
ALTER TABLE `stock_movements`
  ADD INDEX `idx_movements_wh_created` (`warehouse_id`, `created_at`),
  ADD INDEX `idx_movements_prod_created` (`product_id`, `created_at`);

-- 4. DESPACHOS: Acelera ordenamiento por fecha y cálculo atómico de reservas
ALTER TABLE `dispatch_orders`
  ADD INDEX `idx_dispatch_wh_created` (`warehouse_id`, `created_at`),
  ADD INDEX `idx_dispatch_wh_status` (`warehouse_id`, `status`),
  ADD INDEX `idx_dispatch_created_at` (`created_at`);

-- 5. LOTES DE ABASTECIMIENTO (PICKING): Listados recientes sin ordenamiento en disco
ALTER TABLE `picking_lots`
  ADD INDEX `idx_picking_wh_created` (`warehouse_id`, `created_at`),
  ADD INDEX `idx_picking_created_at` (`created_at`);

-- 6. DESINCORPORACIONES / MERMAS: Filtro rápido por almacén y orden cronológico
ALTER TABLE `disincorporations`
  ADD INDEX `idx_disinc_created_at` (`created_at`),
  ADD INDEX `idx_disinc_wh_status` (`warehouse_id`, `status`);

-- 7. STOCK: Búsqueda de existencias por almacén y espacio asignado
ALTER TABLE `stock`
  ADD INDEX `idx_stock_wh_space` (`warehouse_id`, `warehouse_space_id`);
