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
            "SELECT pl.id, pl.lot_number as lotNumber, pl.store_id as storeId,
                    pl.description, pl.status, pl.created_at as createdAt,
                    pl.conformed_at as conformedAt, pl.created_by as createdBy
             FROM picking_lots pl ORDER BY pl.created_at DESC"
        )->fetchAll();

        foreach ($lots as &$lot) {
            $lot['items'] = $this->getItems((int) $lot['id']);
        }
        return $lots;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, lot_number as lotNumber, store_id as storeId, description,
                    status, created_at as createdAt, conformed_at as conformedAt, created_by as createdBy
             FROM picking_lots WHERE id = :id"
        );
        $stmt->execute([':id' => $id]);
        $lot = $stmt->fetch();
        if (!$lot) return null;
        $lot['items'] = $this->getItems($id);
        return $lot;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO picking_lots (lot_number, store_id, description, status, created_by)
                 VALUES (:lot_number, :store_id, :description, :status, :created_by)"
            );
            $stmt->execute([
                ':lot_number'  => $data['lotNumber'],
                ':store_id'    => $data['storeId'],
                ':description' => $data['description'] ?? null,
                ':status'      => $data['status'] ?? 'DRAFT',
                ':created_by'  => $data['createdBy'],
            ]);
            $id = (int) $this->db->lastInsertId();

            $this->syncItems($id, $data['items'] ?? []);
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
                "UPDATE picking_lots SET lot_number=:lot_number, store_id=:store_id,
                 description=:description, status=:status WHERE id=:id"
            );
            $stmt->execute([
                ':id'          => $id,
                ':lot_number'  => $data['lotNumber'],
                ':store_id'    => $data['storeId'],
                ':description' => $data['description'] ?? null,
                ':status'      => $data['status'],
            ]);
            $this->syncItems($id, $data['items'] ?? []);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function conform(int $id, int $userId): void
    {
        $this->db->prepare(
            "UPDATE picking_lots SET status='CONFORMED', conformed_at=NOW() WHERE id=:id AND status='PENDING'"
        )->execute([':id' => $id]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM picking_lots WHERE id = :id AND status = 'DRAFT'")->execute([':id' => $id]);
    }

    private function getItems(int $lotId): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, product_id as productId, quantity_to_enter as quantityToEnter,
                    number_of_packages as numberOfPackages, packages_config as packagesConfig,
                    package_dim_height as height, package_dim_width as width, package_dim_depth as depth,
                    min_stock_alert as minStockAlert
             FROM picking_lot_items WHERE picking_lot_id = :lid"
        );
        $stmt->execute([':lid' => $lotId]);
        $items = $stmt->fetchAll();
        foreach ($items as &$item) {
            $item['packagesConfig']    = json_decode($item['packagesConfig'] ?? '[]', true);
            $item['packageDimensions'] = ['height' => $item['height'], 'width' => $item['width'], 'depth' => $item['depth']];
            unset($item['height'], $item['width'], $item['depth']);
        }
        return $items;
    }

    private function syncItems(int $lotId, array $items): void
    {
        $this->db->prepare("DELETE FROM picking_lot_items WHERE picking_lot_id = :lid")->execute([':lid' => $lotId]);
        if (empty($items)) return;
        $stmt = $this->db->prepare(
            "INSERT INTO picking_lot_items (picking_lot_id, product_id, quantity_to_enter, number_of_packages,
             packages_config, package_dim_height, package_dim_width, package_dim_depth, min_stock_alert)
             VALUES (:lid, :pid, :qty, :nop, :cfg, :ph, :pw, :pd, :msa)"
        );
        foreach ($items as $item) {
            $stmt->execute([
                ':lid' => $lotId,
                ':pid' => $item['productId'],
                ':qty' => $item['quantityToEnter'],
                ':nop' => $item['numberOfPackages'],
                ':cfg' => json_encode($item['packagesConfig'] ?? []),
                ':ph'  => $item['packageDimensions']['height'] ?? null,
                ':pw'  => $item['packageDimensions']['width'] ?? null,
                ':pd'  => $item['packageDimensions']['depth'] ?? null,
                ':msa' => (int) ($item['minStockAlert'] ?? false),
            ]);
        }
    }
}
