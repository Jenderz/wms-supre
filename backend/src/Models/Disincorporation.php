<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Disincorporation
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        $rows = $this->db->query(
            "SELECT d.id, d.store_id as storeId, d.status, d.description,
                    d.created_at as createdAt, d.created_by as createdBy,
                    d.approved_at as approvedAt, d.approved_by as approvedBy
             FROM disincorporations d ORDER BY d.created_at DESC"
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['items'] = $this->getItems((int) $row['id']);
        }
        return $rows;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, store_id as storeId, status, description, created_at as createdAt,
                    created_by as createdBy, approved_at as approvedAt, approved_by as approvedBy
             FROM disincorporations WHERE id = :id"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['items'] = $this->getItems($id);
        return $row;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO disincorporations (store_id, description, status, created_by)
                 VALUES (:store_id, :description, 'DRAFT', :created_by)"
            );
            $stmt->execute([
                ':store_id'    => $data['storeId'],
                ':description' => $data['description'] ?? null,
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

    public function changeStatus(int $id, string $status, int $userId): void
    {
        $this->db->prepare(
            "UPDATE disincorporations SET status=:status, approved_at=NOW(), approved_by=:uid WHERE id=:id"
        )->execute([':status' => $status, ':uid' => $userId, ':id' => $id]);
    }

    private function getItems(int $disId): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, product_id as productId, location_id as locationId,
                    quantity, reason, notes
             FROM disincorporation_items WHERE disincorporation_id = :did"
        );
        $stmt->execute([':did' => $disId]);
        return $stmt->fetchAll();
    }

    private function syncItems(int $disId, array $items): void
    {
        $this->db->prepare("DELETE FROM disincorporation_items WHERE disincorporation_id = :did")->execute([':did' => $disId]);
        if (empty($items)) return;
        $stmt = $this->db->prepare(
            "INSERT INTO disincorporation_items (disincorporation_id, product_id, location_id, quantity, reason, notes)
             VALUES (:did, :pid, :lid, :qty, :reason, :notes)"
        );
        foreach ($items as $item) {
            $stmt->execute([
                ':did'    => $disId,
                ':pid'    => $item['productId'],
                ':lid'    => $item['locationId'] ?? null,
                ':qty'    => $item['quantity'],
                ':reason' => $item['reason'] ?? null,
                ':notes'  => $item['notes'] ?? null,
            ]);
        }
    }
}
