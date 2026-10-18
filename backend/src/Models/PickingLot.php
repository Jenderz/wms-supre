<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class PickingLot
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        $lots = $this->db->query(
            "SELECT pl.id,
                    pl.lot_number    AS lotNumber,
                    pl.warehouse_id  AS warehouseId,
                    pl.description,
                    pl.status,
                    pl.created_at    AS createdAt,
                    pl.conformed_at  AS conformedAt,
                    pl.created_by    AS createdBy
             FROM picking_lots pl
             ORDER BY pl.created_at DESC"
        )->fetchAll();

        $this->hydrateItems($lots);
        return $lots;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id,
                    lot_number    AS lotNumber,
                    warehouse_id  AS warehouseId,
                    description,
                    status,
                    created_at    AS createdAt,
                    conformed_at  AS conformedAt,
                    created_by    AS createdBy
             FROM picking_lots WHERE id = :id"
        );
        $stmt->execute([':id' => $id]);
        $lot = $stmt->fetch();
        if (!$lot) return null;
        $lot['id']          = (string) $lot['id'];
        $lot['warehouseId'] = (string) $lot['warehouseId'];
        $lot['createdBy']   = (string) $lot['createdBy'];
        $lot['items']       = $this->getItems($id);
        return $lot;
    }

    public function create(array $data): int
    {
        $ownsTransaction = false;
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
            $ownsTransaction = true;
        }
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO picking_lots (lot_number, warehouse_id, description, status, created_by)
                 VALUES (:lot_number, :warehouse_id, :description, :status, :created_by)"
            );
            $stmt->execute([
                ':lot_number'   => $data['lotNumber'],
                ':warehouse_id' => $data['warehouseId'],
                ':description'  => $data['description'] ?? null,
                ':status'       => $data['status'] ?? 'DRAFT',
                ':created_by'   => $data['createdBy'],
            ]);
            $id = (int) $this->db->lastInsertId();

            $this->syncItems($id, $data['items'] ?? []);
            if ($ownsTransaction) {
                $this->db->commit();
            }
            return $id;
        } catch (\Throwable $e) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        $existing = $this->findById($id);
        if (!$existing) {
            throw new \Exception("Lote no encontrado.");
        }

        // Un lote conformado ya ingresó stock: no se puede editar ni revertir vía update()
        if ($existing['status'] === 'CONFORMED') {
            throw new \Exception("No se puede editar un lote ya conformado.");
        }

        // CONFORMED solo es alcanzable vía conform() (mueve stock y registra movimientos).
        $newStatus = $data['status'] ?? $existing['status'];
        if (!in_array($newStatus, ['DRAFT', 'PENDING'], true)) {
            throw new \Exception("Estado no permitido '$newStatus'. Solo DRAFT o PENDING; use conformar para CONFORMED.");
        }

        $ownsTransaction = false;
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
            $ownsTransaction = true;
        }
        try {
            $stmt = $this->db->prepare(
                "UPDATE picking_lots
                 SET lot_number=:lot_number, warehouse_id=:warehouse_id,
                     description=:description, status=:status
                 WHERE id=:id"
            );
            $stmt->execute([
                ':id'           => $id,
                ':lot_number'   => $data['lotNumber'] ?? $existing['lotNumber'],
                ':warehouse_id' => $data['warehouseId'] ?? $existing['warehouseId'],
                ':description'  => array_key_exists('description', $data) ? $data['description'] : ($existing['description'] ?? null),
                ':status'       => $newStatus,
            ]);
            if (array_key_exists('items', $data)) {
                $this->syncItems($id, $data['items'] ?? []);
            }
            if ($ownsTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function updateStatus(int $id, string $status): void
    {
        $existing = $this->findById($id);
        if (!$existing) {
            throw new \Exception("Lote no encontrado.");
        }

        // Un lote conformado ya ingresó stock: no se puede revertir sin reintegrar el inventario
        if ($existing['status'] === 'CONFORMED') {
            throw new \Exception("No se puede modificar el estado de un lote ya conformado.");
        }

        // CONFORMED solo es alcanzable vía conform() (mueve stock y registra movimientos).
        if (!in_array($status, ['DRAFT', 'PENDING'], true)) {
            throw new \Exception("Estado no permitido '$status'. Solo DRAFT o PENDING; use conformar para CONFORMED.");
        }

        $stmt = $this->db->prepare("UPDATE picking_lots SET status=:status WHERE id=:id");
        $stmt->execute([':id' => $id, ':status' => $status]);
    }

    public function conform(int $id, int $userId): void
    {
        $this->db->prepare(
            "UPDATE picking_lots SET status='CONFORMED', conformed_at=NOW() WHERE id=:id AND status='PENDING'"
        )->execute([':id' => $id]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare(
            "DELETE FROM picking_lots WHERE id = :id AND status IN ('DRAFT', 'PENDING')"
        )->execute([':id' => $id]);
    }

    private function getItems(int $lotId): array
    {
        $stmt = $this->db->prepare(
            "SELECT id,
                    product_id           AS productId,
                    quantity_to_enter    AS quantityToEnter,
                    number_of_packages   AS numberOfPackages,
                    packages_config      AS packagesConfig,
                    package_dim_height   AS height,
                    package_dim_width    AS width,
                    package_dim_depth    AS depth,
                    min_stock_alert      AS minStockAlert
             FROM picking_lot_items WHERE picking_lot_id = :lid"
        );
        $stmt->execute([':lid' => $lotId]);
        $items = $stmt->fetchAll();
        foreach ($items as &$item) {
            $item['id']                = (string) $item['id'];
            $item['productId']         = (string) $item['productId'];
            $item['quantityToEnter']   = (float) $item['quantityToEnter'];
            $item['numberOfPackages']  = (int) $item['numberOfPackages'];
            $item['packagesConfig']    = json_decode($item['packagesConfig'] ?? '[]', true) ?: [];
            $item['packageDimensions'] = [
                'height' => $item['height'] !== null ? (float) $item['height'] : null,
                'width'  => $item['width'] !== null ? (float) $item['width'] : null,
                'depth'  => $item['depth'] !== null ? (float) $item['depth'] : null,
            ];
            $item['minStockAlert']     = (int) ($item['minStockAlert'] ?? 0);
            unset($item['height'], $item['width'], $item['depth']);
        }
        return $items;
    }

    private function hydrateItems(array &$lots): void
    {
        if (empty($lots)) return;
        $lotIds = array_column($lots, 'id');
        if (empty($lotIds)) return;

        $placeholders = implode(',', array_map('intval', $lotIds));
        $stmt = $this->db->query(
            "SELECT id,
                    picking_lot_id       AS pickingLotId,
                    product_id           AS productId,
                    quantity_to_enter    AS quantityToEnter,
                    number_of_packages   AS numberOfPackages,
                    packages_config      AS packagesConfig,
                    package_dim_height   AS height,
                    package_dim_width    AS width,
                    package_dim_depth    AS depth,
                    min_stock_alert      AS minStockAlert
             FROM picking_lot_items
             WHERE picking_lot_id IN ({$placeholders})
             ORDER BY id ASC"
        );
        $allItems = $stmt->fetchAll();

        $itemsMap = [];
        foreach ($allItems as $item) {
            $lid = (int) $item['pickingLotId'];
            $itemsMap[$lid][] = [
                'id'                => (string) $item['id'],
                'productId'         => (string) $item['productId'],
                'quantityToEnter'   => (float) $item['quantityToEnter'],
                'numberOfPackages'  => (int) $item['numberOfPackages'],
                'packagesConfig'    => json_decode($item['packagesConfig'] ?? '[]', true) ?: [],
                'packageDimensions' => [
                    'height' => $item['height'] !== null ? (float) $item['height'] : null,
                    'width'  => $item['width'] !== null ? (float) $item['width'] : null,
                    'depth'  => $item['depth'] !== null ? (float) $item['depth'] : null,
                ],
                'minStockAlert'     => (int) ($item['minStockAlert'] ?? 0),
            ];
        }

        foreach ($lots as &$lot) {
            $lid = (int) $lot['id'];
            $lot['id']          = (string) $lot['id'];
            $lot['warehouseId'] = (string) $lot['warehouseId'];
            $lot['createdBy']   = (string) $lot['createdBy'];
            $lot['items']       = $itemsMap[$lid] ?? [];
        }
    }

    private function syncItems(int $lotId, array $items): void
    {
        $this->db->prepare(
            "DELETE FROM picking_lot_items WHERE picking_lot_id = :lid"
        )->execute([':lid' => $lotId]);

        if (empty($items)) return;

        $stmt = $this->db->prepare(
            "INSERT INTO picking_lot_items
                (picking_lot_id, product_id, quantity_to_enter, number_of_packages,
                 packages_config, package_dim_height, package_dim_width, package_dim_depth,
                 min_stock_alert)
             VALUES
                (:lid, :pid, :qty, :nop, :cfg, :ph, :pw, :pd, :msa)"
        );
        foreach ($items as $item) {
            $stmt->execute([
                ':lid'  => $lotId,
                ':pid'  => $item['productId'],
                ':qty'  => $item['quantityToEnter'],
                ':nop'  => $item['numberOfPackages'],
                ':cfg'  => json_encode($item['packagesConfig'] ?? []),
                ':ph'   => $item['packageDimensions']['height'] ?? null,
                ':pw'   => $item['packageDimensions']['width']  ?? null,
                ':pd'   => $item['packageDimensions']['depth']  ?? null,
                ':msa'  => (int) ($item['minStockAlert'] ?? 0),
            ]);
        }
    }
}
