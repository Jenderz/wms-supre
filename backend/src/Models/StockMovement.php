<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class StockMovement
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, product_id as productId, store_id as storeId, location_id as locationId,
                    type, reason, quantity, reference_id as referenceId,
                    notes, created_at as createdAt, created_by as createdBy
             FROM stock_movements ORDER BY created_at DESC"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO stock_movements (product_id, store_id, location_id, type, reason, quantity, reference_id, notes, created_by)
             VALUES (:product_id, :store_id, :location_id, :type, :reason, :quantity, :reference_id, :notes, :created_by)"
        );
        $stmt->execute([
            ':product_id'  => $data['productId'],
            ':store_id'    => $data['storeId'],
            ':location_id' => $data['locationId'] ?? null,
            ':type'        => $data['type'],
            ':reason'      => $data['reason'],
            ':quantity'    => $data['quantity'],
            ':reference_id'=> $data['referenceId'] ?? null,
            ':notes'       => $data['notes'] ?? null,
            ':created_by'  => $data['createdBy'],
        ]);
        return (int) $this->db->lastInsertId();
    }
}
