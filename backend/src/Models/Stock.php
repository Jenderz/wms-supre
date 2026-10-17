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
            "SELECT s.id,
                    s.product_id              AS productId,
                    s.warehouse_id            AS warehouseId,
                    s.warehouse_space_id       AS warehouseSpaceId,
                    s.quantity,
                    s.reserved_quantity       AS reservedQuantity,
                    s.min_stock               AS minStock,
                    s.min_stock_dispatch      AS minStockDispatch
             FROM stock s
             ORDER BY s.product_id, s.warehouse_id"
        )->fetchAll();
    }

    /**
     * INSERT ... ON DUPLICATE KEY UPDATE:
     * Si ya existe stock para ese producto+almacén+espacio, actualiza la cantidad.
     *
     * NOTA IMPORTANTE sobre el diseño de la tabla:
     * MySQL/MariaDB no considera NULL == NULL en índices UNIQUE, por lo que no
     * podemos usar warehouse_space_id directamente en el índice para el caso del
     * stock pendiente (warehouse_space_id IS NULL). Se utiliza la columna auxiliar
     * `space_key` = COALESCE(warehouse_space_id, 0) como discriminador real del índice.
     * Esto garantiza que ON DUPLICATE KEY UPDATE se active correctamente tanto para
     * espacios asignados como para el stock pendiente (space_key = 0).
     */
    public function upsert(array $data): void
    {
        $spaceId             = isset($data['warehouseSpaceId']) && $data['warehouseSpaceId'] !== null
            ? (int) $data['warehouseSpaceId']
            : null;
        $deductFromUnassigned = !empty($data['deductFromUnassigned']) && $spaceId !== null;

        $this->db->beginTransaction();
        try {
            // Asegurarse de que el almacén esté asignado al producto
            $this->db->prepare(
                "INSERT IGNORE INTO product_warehouses (product_id, warehouse_id) VALUES (:pid, :wid)"
            )->execute([
                ':pid' => (int) $data['productId'],
                ':wid' => (int) $data['warehouseId'],
            ]);

            // Upsert en la ubicación destino (o en pendientes si spaceId es null)
            $stmt = $this->db->prepare(
                "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, min_stock, min_stock_dispatch)
                 VALUES (:product_id, :warehouse_id, :warehouse_space_id, :space_key, :quantity, :min_stock, :min_stock_dispatch)
                 ON DUPLICATE KEY UPDATE
                    quantity              = VALUES(quantity),
                    min_stock             = VALUES(min_stock),
                    min_stock_dispatch    = VALUES(min_stock_dispatch),
                    warehouse_space_id    = VALUES(warehouse_space_id)"
            );
            $stmt->execute([
                ':product_id'            => (int) $data['productId'],
                ':warehouse_id'          => (int) $data['warehouseId'],
                ':warehouse_space_id'    => $spaceId,
                ':space_key'             => $spaceId ?? 0,
                ':quantity'              => (float) $data['quantity'],
                ':min_stock'             => (float) ($data['minStock'] ?? 0),
                ':min_stock_dispatch'    => (float) ($data['minStockDispatch'] ?? 0),
            ]);

            // Si se pide descontar del stock sin asignar (space_key = 0), hacerlo dentro
            // de la misma transacción para mantener consistencia.
            if ($deductFromUnassigned) {
                $qty = (float) $data['quantity'];

                $this->db->prepare(
                    "UPDATE stock
                     SET quantity = quantity - :qty
                     WHERE product_id      = :product_id
                       AND warehouse_id    = :warehouse_id
                       AND space_key       = 0"
                )->execute([
                    ':qty'        => $qty,
                    ':product_id' => (int) $data['productId'],
                    ':warehouse_id' => (int) $data['warehouseId'],
                ]);

                // Limpiar fila pendiente si quedó en 0 o menos
                // Se excluyen espacios tipo 'Despachos': deben mantenerse con quantity=0
                // para indicar que requieren reabastecimiento (OBS 1.4)
                $this->db->prepare(
                    "DELETE FROM stock
                     WHERE product_id   = :product_id
                       AND warehouse_id = :warehouse_id
                       AND space_key    = 0
                       AND quantity    <= 0
                       AND (warehouse_space_id IS NULL
                            OR warehouse_space_id NOT IN (
                                SELECT id FROM warehouse_spaces
                                WHERE space_usage_type = 'Despachos'
                            ))"
                )->execute([
                    ':product_id'   => (int) $data['productId'],
                    ':warehouse_id' => (int) $data['warehouseId'],
                ]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function adjustQuantity(int $productId, int $warehouseId, ?int $warehouseSpaceId, float $delta): void
    {
        $stmt = $this->db->prepare(
            "UPDATE stock SET quantity = quantity + :delta
             WHERE product_id = :product_id
               AND warehouse_id = :warehouse_id
               AND (warehouse_space_id = :warehouse_space_id
                    OR (warehouse_space_id IS NULL AND :warehouse_space_id_check IS NULL))"
        );
        $stmt->execute([
            ':delta'                    => $delta,
            ':product_id'               => $productId,
            ':warehouse_id'             => $warehouseId,
            ':warehouse_space_id'       => $warehouseSpaceId,
            ':warehouse_space_id_check' => $warehouseSpaceId,
        ]);
    }

    public function moveStock(int $productId, int $warehouseId, ?int $fromSpaceId, int $toSpaceId, float $quantity, int $userId): void
    {
        $this->db->beginTransaction();
        try {
            // Restar stock de origen
            $this->adjustQuantity($productId, $warehouseId, $fromSpaceId, -$quantity);

            // Sumar stock en destino (space_key = toSpaceId siempre, nunca NULL aquí)
            $stmt = $this->db->prepare(
                "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, min_stock)
                 VALUES (:product_id, :warehouse_id, :warehouse_space_id, :space_key, :quantity, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)"
            );
            $stmt->execute([
                ':product_id'         => $productId,
                ':warehouse_id'       => $warehouseId,
                ':warehouse_space_id' => $toSpaceId,
                ':space_key'          => $toSpaceId,
                ':quantity'           => $quantity,
            ]);

            // Limpiar fila origen si quedó en 0 o menos.
            // Se excluyen espacios tipo 'Despachos': permanecen en quantity=0 (OBS 1.4)
            if ($fromSpaceId === null) {
                $this->db->prepare(
                    "DELETE FROM stock
                     WHERE product_id = ? AND warehouse_id = ?
                       AND warehouse_space_id IS NULL
                       AND quantity <= 0"
                )->execute([$productId, $warehouseId]);
            } else {
                $this->db->prepare(
                    "DELETE FROM stock
                     WHERE product_id = ? AND warehouse_id = ?
                       AND warehouse_space_id = ?
                       AND quantity <= 0
                       AND warehouse_space_id NOT IN (
                           SELECT id FROM warehouse_spaces
                           WHERE space_usage_type = 'Despachos'
                       )"
                )->execute([$productId, $warehouseId, $fromSpaceId]);
            }

            // Registrar en historial
            $hist = $this->db->prepare(
                "INSERT INTO stock_movements
                    (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, notes, created_by)
                 VALUES
                    (:product_id, :warehouse_id, :warehouse_space_id, 'IN', 'TRANSFER', :quantity, :notes, :created_by)"
            );
            $hist->execute([
                ':product_id'         => $productId,
                ':warehouse_id'       => $warehouseId,
                ':warehouse_space_id' => $toSpaceId,
                ':quantity'           => $quantity,
                ':notes'              => 'Movido desde ' . ($fromSpaceId ? 'espacio ' . $fromSpaceId : 'área de pendientes'),
                ':created_by'         => $userId,
            ]);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
