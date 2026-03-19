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
                    p.category_id as categoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth,
                    GROUP_CONCAT(DISTINCT ps.store_id) as enabled_stores
             FROM products p
             LEFT JOIN product_stores ps ON p.id = ps.product_id
             GROUP BY p.id"
        )->fetchAll();

        foreach ($rows as &$row) {
            $row['dimensions']    = ['height' => $row['height'], 'width' => $row['width'], 'depth' => $row['depth']];
            $row['enabledStores'] = $row['enabled_stores'] ? array_map('intval', explode(',', $row['enabled_stores'])) : [];
            unset($row['height'], $row['width'], $row['depth'], $row['enabled_stores']);

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
                    p.category_id as categoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth
             FROM products p WHERE p.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row['dimensions']    = ['height' => $row['height'], 'width' => $row['width'], 'depth' => $row['depth']];
        $row['enabledStores'] = array_column($this->db->prepare("SELECT store_id FROM product_stores WHERE product_id = :id")->execute([':id' => $id]) ? $this->db->query("SELECT store_id FROM product_stores WHERE product_id = {$id}")->fetchAll() : [], 'store_id');
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
                "INSERT INTO products (code, name, image_url, footer_url, category_id, dimension_height, dimension_width, dimension_depth)
                 VALUES (:code, :name, :image_url, :footer_url, :category_id, :height, :width, :depth)"
            );
            $stmt->execute([
                ':code'        => $data['code'],
                ':name'        => $data['name'],
                ':image_url'   => $data['imageUrl'] ?? null,
                ':footer_url'  => $data['footerUrl'] ?? null,
                ':category_id' => $data['categoryId'],
                ':height'      => $data['dimensions']['height'] ?? null,
                ':width'       => $data['dimensions']['width'] ?? null,
                ':depth'       => $data['dimensions']['depth'] ?? null,
            ]);
            $id = (int) $this->db->lastInsertId();

            $this->syncStores($id, $data['enabledStores'] ?? []);
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
                 category_id=:category_id, dimension_height=:height, dimension_width=:width, dimension_depth=:depth
                 WHERE id=:id"
            );
            $stmt->execute([
                ':id'          => $id,
                ':code'        => $data['code'],
                ':name'        => $data['name'],
                ':image_url'   => $data['imageUrl'] ?? null,
                ':footer_url'  => $data['footerUrl'] ?? null,
                ':category_id' => $data['categoryId'],
                ':height'      => $data['dimensions']['height'] ?? null,
                ':width'       => $data['dimensions']['width'] ?? null,
                ':depth'       => $data['dimensions']['depth'] ?? null,
            ]);

            $this->syncStores($id, $data['enabledStores'] ?? []);
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
        $this->db->prepare("DELETE FROM products WHERE id = :id")->execute([':id' => $id]);
    }

    private function syncStores(int $productId, array $storeIds): void
    {
        $this->db->prepare("DELETE FROM product_stores WHERE product_id = :pid")->execute([':pid' => $productId]);
        if (empty($storeIds)) return;
        $stmt = $this->db->prepare("INSERT INTO product_stores (product_id, store_id) VALUES (:pid, :sid)");
        foreach ($storeIds as $sid) {
            $stmt->execute([':pid' => $productId, ':sid' => (int) $sid]);
        }
    }

    private function syncSubTable(string $table, string $column, int $productId, array $values): void
    {
        $this->db->prepare("DELETE FROM {$table} WHERE product_id = :pid")->execute([':pid' => $productId]);
        if (empty($values)) return;
        $stmt = $this->db->prepare("INSERT INTO {$table} (product_id, {$column}) VALUES (:pid, :val)");
        foreach ($values as $val) {
            $stmt->execute([':pid' => $productId, ':val' => $val]);
        }
    }

    private function loadSub(string $table, string $column, int $productId): array
    {
        $stmt = $this->db->prepare("SELECT {$column} FROM {$table} WHERE product_id = :pid ORDER BY id");
        $stmt->execute([':pid' => $productId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}
