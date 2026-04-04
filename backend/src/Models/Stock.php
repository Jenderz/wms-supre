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
        // Nota: PDO no permite usar el mismo named placeholder más de una vez.
        // Se usa :location_id y :location_id_check para el mismo valor.
        $stmt = $this->db->prepare(
            "UPDATE stock SET quantity = quantity + :delta
             WHERE product_id = :product_id AND store_id = :store_id
             AND (location_id = :location_id OR (location_id IS NULL AND :location_id_check IS NULL))"
        );
        $stmt->execute([
            ':delta'            => $delta,
            ':product_id'       => $productId,
            ':store_id'         => $storeId,
            ':location_id'      => $locationId,
            ':location_id_check' => $locationId,
        ]);
    }

    public function moveStock(int $productId, int $storeId, ?int $fromLocationId, int $toLocationId, float $quantity, int $userId): void
    {
        $this->db->beginTransaction();
        try {
            // Restar stock de origen
            $this->adjustQuantity($productId, $storeId, $fromLocationId, -$quantity);
            
            // Sumar stock en destino: usamos upsert para que lo cree si no existía ese producto en esa caja
            $stmt = $this->db->prepare(
                "INSERT INTO stock (product_id, store_id, location_id, quantity, min_stock)
                 VALUES (:product_id, :store_id, :location_id, :quantity, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)"
            );
            $stmt->execute([
                ':product_id'  => $productId,
                ':store_id'    => $storeId,
                ':location_id' => $toLocationId,
                ':quantity'    => $quantity,
            ]);

            // Eliminar fila origen si quedó en 0 o menos para mantener la bd limpia.
            // Cuando fromLocationId es NULL se debe usar IS NULL, no = NULL.
            if ($fromLocationId === null) {
                $this->db->prepare(
                    "DELETE FROM stock WHERE product_id = ? AND store_id = ? AND location_id IS NULL AND quantity <= 0"
                )->execute([$productId, $storeId]);
            } else {
                $this->db->prepare(
                    "DELETE FROM stock WHERE product_id = ? AND store_id = ? AND location_id = ? AND quantity <= 0"
                )->execute([$productId, $storeId, $fromLocationId]);
            }

            // Registrar en historial
            $hist = $this->db->prepare(
                "INSERT INTO stock_movements (product_id, store_id, location_id, type, reason, quantity, notes, created_by)
                 VALUES (:product_id, :store_id, :location_id, 'IN', 'TRANSFER', :quantity, :notes, :created_by)"
            );
            $hist->execute([
                ':product_id'  => $productId,
                ':store_id'    => $storeId,
                ':location_id' => $toLocationId,
                ':quantity'    => $quantity,
                ':notes'       => "Movido desde " . ($fromLocationId ? "ubicación " . $fromLocationId : "área de pendientes"),
                ':created_by'  => $userId
            ]);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
