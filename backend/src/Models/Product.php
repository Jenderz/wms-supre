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
            "SELECT p.id, p.code, p.code_type as codeType, p.name, p.image_url as imageUrl, p.footer_url as footerUrl,
                    p.category_id as categoryId, p.subcategory_id as subcategoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth,
                    GROUP_CONCAT(DISTINCT pw.warehouse_id) as enabled_warehouses,
                    GROUP_CONCAT(DISTINCT pp.provider_id) as providers
             FROM products p
             LEFT JOIN product_warehouses pw ON p.id = pw.product_id
             LEFT JOIN product_providers pp ON p.id = pp.product_id
             GROUP BY p.id"
        )->fetchAll();

        $this->hydrateSubData($rows);
        return $rows;
    }

    public function getPaginated(int $page = 1, int $limit = 50, ?string $search = null, ?int $categoryId = null): array
    {
        $page = max(1, $page);
        $limit = max(1, min(200, $limit));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if ($search !== null && $search !== '') {
            $where[] = "(p.name LIKE :search_name OR p.code LIKE :search_code)";
            $params[':search_name'] = "%{$search}%";
            $params[':search_code'] = "%{$search}%";
        }

        if ($categoryId !== null) {
            $where[] = "p.category_id = :cat_id";
            $params[':cat_id'] = $categoryId;
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Conteo total para paginación
        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM products p {$whereClause}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Consulta de página
        $sql = "SELECT p.id, p.code, p.code_type as codeType, p.name, p.image_url as imageUrl, p.footer_url as footerUrl,
                       p.category_id as categoryId, p.subcategory_id as subcategoryId,
                       p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth,
                       GROUP_CONCAT(DISTINCT pw.warehouse_id) as enabled_warehouses,
                       GROUP_CONCAT(DISTINCT pp.provider_id) as providers
                FROM products p
                LEFT JOIN product_warehouses pw ON p.id = pw.product_id
                LEFT JOIN product_providers pp ON p.id = pp.product_id
                {$whereClause}
                GROUP BY p.id
                ORDER BY p.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $this->hydrateSubData($rows);

        return [
            'items' => $rows,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT p.id, p.code, p.code_type as codeType, p.name, p.image_url as imageUrl, p.footer_url as footerUrl,
                    p.category_id as categoryId, p.subcategory_id as subcategoryId,
                    p.dimension_height as height, p.dimension_width as width, p.dimension_depth as depth
             FROM products p WHERE p.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row['dimensions'] = ['height' => $row['height'], 'width' => $row['width'], 'depth' => $row['depth']];
        
        $stmtPw = $this->db->prepare("SELECT warehouse_id FROM product_warehouses WHERE product_id = :id");
        $stmtPw->execute([':id' => $id]);
        $row['enabledWarehouses'] = array_map('strval', array_column($stmtPw->fetchAll(), 'warehouse_id'));

        $stmtPp = $this->db->prepare("SELECT provider_id FROM product_providers WHERE product_id = :id");
        $stmtPp->execute([':id' => $id]);
        $row['providers'] = array_map('strval', array_column($stmtPp->fetchAll(), 'provider_id'));

        $row['costs']  = $this->loadSub('product_costs', 'cost', $id);
        $row['prices'] = $this->loadSub('product_prices', 'price', $id);
        unset($row['height'], $row['width'], $row['depth']);
        return $row;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO products (code, code_type, name, image_url, footer_url, category_id, subcategory_id, dimension_height, dimension_width, dimension_depth)
                 VALUES (:code, :code_type, :name, :image_url, :footer_url, :category_id, :subcategory_id, :height, :width, :depth)"
            );
            $stmt->execute([
                ':code'        => $data['code'],
                ':code_type'   => in_array($data['codeType'] ?? '', ['qr', 'barcode']) ? $data['codeType'] : 'qr',
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
                "UPDATE products SET code=:code, code_type=:code_type, name=:name, image_url=:image_url, footer_url=:footer_url,
                 category_id=:category_id, subcategory_id=:subcategory_id, dimension_height=:height, dimension_width=:width, dimension_depth=:depth
                 WHERE id=:id"
            );
            $stmt->execute([
                ':id'          => $id,
                ':code'        => $data['code'],
                ':code_type'   => in_array($data['codeType'] ?? '', ['qr', 'barcode']) ? $data['codeType'] : 'qr',
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
        
        $stockStmt = $this->db->prepare(
            "INSERT IGNORE INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, min_stock)
             VALUES (:pid, :wid, NULL, 0, 0, 0)"
        );

        foreach ($warehouseIds as $wid) {
            $stmt->execute([':pid' => $productId, ':wid' => (int) $wid]);
            $stockStmt->execute([':pid' => $productId, ':wid' => (int) $wid]);
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
        return array_map('floatval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    private function hydrateSubData(array &$rows): void
    {
        if (empty($rows)) {
            return;
        }

        $productIds = array_column($rows, 'id');
        if (empty($productIds)) {
            return;
        }

        $placeholders = implode(',', array_map('intval', $productIds));

        // Carga por lotes de costos en 1 sola consulta
        $costsMap = [];
        $costRows = $this->db->query(
            "SELECT product_id, cost FROM product_costs WHERE product_id IN ({$placeholders}) ORDER BY id"
        )->fetchAll();
        foreach ($costRows as $cr) {
            $costsMap[(int)$cr['product_id']][] = (float) $cr['cost'];
        }

        // Carga por lotes de precios en 1 sola consulta
        $pricesMap = [];
        $priceRows = $this->db->query(
            "SELECT product_id, price FROM product_prices WHERE product_id IN ({$placeholders}) ORDER BY id"
        )->fetchAll();
        foreach ($priceRows as $pr) {
            $pricesMap[(int)$pr['product_id']][] = (float) $pr['price'];
        }

        foreach ($rows as &$row) {
            $pid = (int) $row['id'];
            $row['dimensions']        = [
                'height' => $row['height'] !== null ? (float) $row['height'] : null,
                'width'  => $row['width'] !== null ? (float) $row['width'] : null,
                'depth'  => $row['depth'] !== null ? (float) $row['depth'] : null,
            ];
            $row['enabledWarehouses'] = !empty($row['enabled_warehouses'])
                ? array_map('strval', explode(',', (string) $row['enabled_warehouses']))
                : [];
            $row['providers']         = !empty($row['providers'])
                ? array_map('strval', explode(',', (string) $row['providers']))
                : [];
            unset($row['height'], $row['width'], $row['depth'], $row['enabled_warehouses']);

            $row['costs']  = $costsMap[$pid] ?? [];
            $row['prices'] = $pricesMap[$pid] ?? [];
        }
    }

    // ================================================================
    // MÉTODOS BATCH — operaciones masivas sobre múltiples productos
    // ================================================================

    /**
     * Elimina múltiples productos y todas sus dependencias en una sola transacción.
     */
    public function batchDelete(array $ids): void
    {
        if (empty($ids)) return;
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', $ids);

        $this->db->beginTransaction();
        try {
            $tables = [
                'product_warehouses',
                'product_providers',
                'product_costs',
                'product_prices',
                'stock',
                'stock_movements',
                'disincorporation_items',
                'picking_lot_items',
            ];
            foreach ($tables as $table) {
                $this->db->exec("DELETE FROM {$table} WHERE product_id IN ({$placeholders})");
            }
            // Tabla legacy, puede no existir
            try {
                $this->db->exec("DELETE FROM product_stores WHERE product_id IN ({$placeholders})");
            } catch (\Throwable $e) {}

            $this->db->exec("DELETE FROM products WHERE id IN ({$placeholders})");
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Asigna la misma categoría a múltiples productos.
     */
    public function batchSetCategory(array $ids, int $categoryId): void
    {
        if (empty($ids)) return;
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', $ids);
        $this->db->prepare(
            "UPDATE products SET category_id = :cat WHERE id IN ({$placeholders})"
        )->execute([':cat' => $categoryId]);
    }

    /**
     * Asigna la misma subcategoría a múltiples productos.
     * Pasar NULL para quitar la subcategoría.
     */
    public function batchSetSubcategory(array $ids, ?int $subcategoryId): void
    {
        if (empty($ids)) return;
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', $ids);
        $this->db->prepare(
            "UPDATE products SET subcategory_id = :sub WHERE id IN ({$placeholders})"
        )->execute([':sub' => $subcategoryId]);
    }

    /**
     * Asigna el mismo proveedor a múltiples productos.
     * Reemplaza solo el primer proveedor (slot 0) sin tocar el segundo si existe.
     */
    public function batchSetProvider(array $ids, int $providerId): void
    {
        if (empty($ids)) return;
        $ids = array_map('intval', $ids);

        $this->db->beginTransaction();
        try {
            $del  = $this->db->prepare("DELETE FROM product_providers WHERE product_id = :pid");
            $ins  = $this->db->prepare(
                "INSERT INTO product_providers (product_id, provider_id) VALUES (:pid, :pvid)"
            );
            foreach ($ids as $pid) {
                $del->execute([':pid' => $pid]);
                $ins->execute([':pid' => $pid, ':pvid' => $providerId]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Añade un almacén a múltiples productos usando INSERT IGNORE para no
     * eliminar los almacenes ya asignados. También crea registro de stock
     * inicial (quantity=0) si no existía.
     */
    public function batchAddWarehouse(array $ids, int $warehouseId): void
    {
        if (empty($ids)) return;
        $ids = array_map('intval', $ids);

        $this->db->beginTransaction();
        try {
            $stmtWh = $this->db->prepare(
                "INSERT IGNORE INTO product_warehouses (product_id, warehouse_id) VALUES (:pid, :wid)"
            );
            $stmtSt = $this->db->prepare(
                "INSERT IGNORE INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, min_stock)
                 VALUES (:pid, :wid, NULL, 0, 0, 0)"
            );
            foreach ($ids as $pid) {
                $stmtWh->execute([':pid' => $pid, ':wid' => $warehouseId]);
                $stmtSt->execute([':pid' => $pid, ':wid' => $warehouseId]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
