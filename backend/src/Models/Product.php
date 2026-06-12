<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Product
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        $rows = $this->db->query(
            "SELECT p.id, p.code, p.name, p.image_url as imageUrl, p.footer_url as footerUrl,
                    p.category_id as categoryId, p.subcategory_id as subcategoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth,
                    GROUP_CONCAT(DISTINCT pw.warehouse_id) as enabled_warehouses,
                    GROUP_CONCAT(DISTINCT pp.provider_id) as providers
             FROM products p
             LEFT JOIN product_warehouses pw ON p.id = pw.product_id
             LEFT JOIN product_providers pp ON p.id = pp.product_id
             GROUP BY p.id"
        )->fetchAll();

        foreach ($rows as &$row) {
            $row['dimensions']        = ['height' => $row['height'], 'width' => $row['width'], 'depth' => $row['depth']];
            $row['enabledWarehouses'] = $row['enabled_warehouses'] ? array_map('intval', explode(',', $row['enabled_warehouses'])) : [];
            $row['providers']         = $row['providers'] ? array_map('intval', explode(',', $row['providers'])) : [];
            unset($row['height'], $row['width'], $row['depth'], $row['enabled_warehouses']);

            // Cargar costos y precios
            $row['costs']  = $this->loadSub('product_costs', 'cost', $row['id']);
            $row['prices'] = $this->loadSub('product_prices', 'price', $row['id']);
        }
        return $rows;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT p.id, p.code, p.name, p.image_url as imageUrl, p.footer_url as footerUrl,
                    p.category_id as categoryId, p.subcategory_id as subcategoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth
             FROM products p WHERE p.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row['dimensions']    = ['height' => $row['height'], 'width' => $row['width'], 'depth' => $row['depth']];
        $row['enabledStores'] = array_column($this->db->prepare("SELECT store_id FROM product_stores WHERE product_id = :id")->execute([':id' => $id]) ? $this->db->query("SELECT store_id FROM product_stores WHERE product_id = {$id}")->fetchAll() : [], 'store_id');
        $row['providers']     = array_column($this->db->prepare("SELECT provider_id FROM product_providers WHERE product_id = :id")->execute([':id' => $id]) ? $this->db->query("SELECT provider_id FROM product_providers WHERE product_id = {$id}")->fetchAll() : [], 'provider_id');
        $row['costs']         = $this->loadSub('product_costs', 'cost', $id);
        $row['prices']        = $this->loadSub('product_prices', 'price', $id);
        unset($row['height'], $row['width'], $row['depth']);
        return $row;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO products (code, name, image_url, footer_url, category_id, subcategory_id, dimension_height, dimension_width, dimension_depth)
                 VALUES (:code, :name, :image_url, :footer_url, :category_id, :subcategory_id, :height, :width, :depth)"
            );
            $stmt->execute([
                ':code'        => $data['code'],
                ':name'        => $data['name'],
                ':image_url'   => $data['imageUrl'] ?? null,
                ':footer_url'  => $data['footerUrl'] ?? null,
                ':category_id' => $data['categoryId'],
                ':subcategory_id' => $data['subcategoryId'] ?? null,
                ':height'      => $data['dimensions']['height'] ?? null,
                ':width'       => $data['dimensions']['width'] ?? null,
                ':depth'       => $data['dimensions']['depth'] ?? null,
            ]);
            $id = (int) $this->db->lastInsertId();

            $this->syncStores($id, $data['enabledWarehouses'] ?? []);
            $this->syncProviders($id, $data['providers'] ?? []);
            $this->syncSubTable('product_costs', 'cost', $id, $data['costs'] ?? []);
            $this->syncSubTable('product_prices', 'price', $id, $data['prices'] ?? []);

            $this->db->commit();
            return $id;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "UPDATE products SET code=:code, name=:name, image_url=:image_url, footer_url=:footer_url,
                 category_id=:category_id, subcategory_id=:subcategory_id, dimension_height=:height, dimension_width=:width, dimension_depth=:depth
                 WHERE id=:id"
            );
            $stmt->execute([
                ':id'          => $id,
                ':code'        => $data['code'],
                ':name'        => $data['name'],
                ':image_url'   => $data['imageUrl'] ?? null,
                ':footer_url'  => $data['footerUrl'] ?? null,
                ':category_id' => $data['categoryId'],
                ':subcategory_id' => $data['subcategoryId'] ?? null,
                ':height'      => $data['dimensions']['height'] ?? null,
                ':width'       => $data['dimensions']['width'] ?? null,
                ':depth'       => $data['dimensions']['depth'] ?? null,
            ]);

            $this->syncStores($id, $data['enabledWarehouses'] ?? []);
            $this->syncProviders($id, $data['providers'] ?? []);
            $this->syncSubTable('product_costs', 'cost', $id, $data['costs'] ?? []);
            $this->syncSubTable('product_prices', 'price', $id, $data['prices'] ?? []);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $this->db->beginTransaction();
        try {
            // Eliminar dependencias del producto en almacén, inventario y relaciones
            $this->db->prepare("DELETE FROM product_warehouses WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM product_providers WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM product_costs WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM product_prices WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM stock WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM stock_movements WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM disincorporation_items WHERE product_id = :id")->execute([':id' => $id]);
            $this->db->prepare("DELETE FROM picking_lot_items WHERE product_id = :id")->execute([':id' => $id]);
            
            // Si existiese la tabla antigua product_stores
            try { $this->db->prepare("DELETE FROM product_stores WHERE product_id = :id")->execute([':id' => $id]); } catch (\Throwable $e) {}

            $this->db->prepare("DELETE FROM products WHERE id = :id")->execute([':id' => $id]);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function syncStores(int $productId, array $warehouseIds): void
    {
        $this->db->prepare("DELETE FROM product_warehouses WHERE product_id = :pid")->execute([':pid' => $productId]);
        if (empty($warehouseIds)) return;
        $stmt = $this->db->prepare("INSERT INTO product_warehouses (product_id, warehouse_id) VALUES (:pid, :wid)");
        foreach ($warehouseIds as $wid) {
            $stmt->execute([':pid' => $productId, ':wid' => (int) $wid]);
        }
    }

    private function syncProviders(int $productId, array $providerIds): void
    {
        $providerIds = array_slice($providerIds, 0, 2); // Max 2
        $this->db->prepare("DELETE FROM product_providers WHERE product_id = :pid")->execute([':pid' => $productId]);
        if (empty($providerIds)) return;
        $stmt = $this->db->prepare("INSERT INTO product_providers (product_id, provider_id) VALUES (:pid, :sid)");
        foreach ($providerIds as $sid) {
            if ($sid) $stmt->execute([':pid' => $productId, ':sid' => (int) $sid]);
        }
    }

    private function syncSubTable(string $table, string $column, int $productId, array $values): void
    {
        if ($table === 'product_costs') $values = array_slice($values, 0, 2); // Max 2
        if ($table === 'product_prices') $values = array_slice($values, 0, 4); // Max 4

        $this->db->prepare("DELETE FROM {$table} WHERE product_id = :pid")->execute([':pid' => $productId]);
        if (empty($values)) return;
        $stmt = $this->db->prepare("INSERT INTO {$table} (product_id, {$column}) VALUES (:pid, :val)");
        foreach ($values as $val) {
            $stmt->execute([':pid' => $productId, ':val' => $val]);
        }
    }

    /**
     * Obtiene el ID de la categoría reservada "Sin Categoría" (code: SIN-CAT).
     * Si no existe en la BD, la crea automáticamente (idempotente).
     */
    public function getOrCreateDefaultCategoryId(): int
    {
        $stmt = $this->db->prepare("SELECT id FROM categories WHERE code = 'SIN-CAT' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row) {
            return (int) $row['id'];
        }

        // No existe aún — la creamos como fallback de seguridad
        $insert = $this->db->prepare(
            "INSERT INTO categories (name, code, description, is_fractional, fraction_type)
             VALUES ('Sin Categoría', 'SIN-CAT', 'Categoría reservada del sistema. Asignada automáticamente a productos sin clasificar.', 0, NULL)"
        );
        $insert->execute();
        return (int) $this->db->lastInsertId();
    }

    private function loadSub(string $table, string $column, int $productId): array
    {
        $stmt = $this->db->prepare("SELECT {$column} FROM {$table} WHERE product_id = :pid ORDER BY id");
        $stmt->execute([':pid' => $productId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}
