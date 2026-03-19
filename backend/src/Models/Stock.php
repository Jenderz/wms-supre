<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Stock
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT s.id, s.product_id as productId, s.store_id as storeId,
                    s.location_id as locationId, s.quantity, s.min_stock as minStock
             FROM stock s ORDER BY s.product_id, s.store_id"
        )->fetchAll();
    }

    /**
     * INSERT ... ON DUPLICATE KEY UPDATE:
     * Si ya existe stock para ese producto+tienda+ubicación, actualiza la cantidad.
     */
    public function upsert(array $data): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO stock (product_id, store_id, location_id, quantity, min_stock)
             VALUES (:product_id, :store_id, :location_id, :quantity, :min_stock)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), min_stock = VALUES(min_stock)"
        );
        $stmt->execute([
            ':product_id'  => $data['productId'],
            ':store_id'    => $data['storeId'],
            ':location_id' => $data['locationId'] ?? null,
            ':quantity'    => $data['quantity'],
            ':min_stock'   => $data['minStock'] ?? 0,
        ]);
    }

    public function adjustQuantity(int $productId, int $storeId, ?int $locationId, float $delta): void
    {
        $stmt = $this->db->prepare(
            "UPDATE stock SET quantity = quantity + :delta
             WHERE product_id = :product_id AND store_id = :store_id
             AND (location_id = :location_id OR (location_id IS NULL AND :location_id IS NULL))"
        );
        $stmt->execute([
            ':delta'       => $delta,
            ':product_id'  => $productId,
            ':store_id'    => $storeId,
            ':location_id' => $locationId,
        ]);
    }
}
