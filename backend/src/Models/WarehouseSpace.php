<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class WarehouseSpace
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(?int $warehouseId = null): array
    {
        if ($warehouseId) {
            $stmt = $this->db->prepare(
                "SELECT ws.id, ws.warehouse_id as warehouseId, ws.space_type_id as spaceTypeId, st.name as spaceTypeName, ws.name, ws.proximity, ws.qr_code as qrCode,
                        COUNT(DISTINCT s.product_id) AS productCount,
                        COALESCE(SUM(s.quantity), 0) AS totalQuantity
                 FROM warehouse_spaces ws
                 LEFT JOIN space_types st ON ws.space_type_id = st.id
                 LEFT JOIN stock s ON ws.id = s.warehouse_space_id
                 WHERE ws.warehouse_id = :wid
                 GROUP BY ws.id, ws.warehouse_id, ws.space_type_id, st.name, ws.name, ws.proximity, ws.qr_code
                 ORDER BY ws.name"
            );
            $stmt->execute([':wid' => $warehouseId]);
            return $stmt->fetchAll();
        }
        return $this->db->query(
            "SELECT ws.id, ws.warehouse_id as warehouseId, w.name as warehouseName, ws.space_type_id as spaceTypeId, st.name as spaceTypeName, ws.name, ws.proximity, ws.qr_code as qrCode,
                    COUNT(DISTINCT s.product_id) AS productCount,
                    COALESCE(SUM(s.quantity), 0) AS totalQuantity
             FROM warehouse_spaces ws
             LEFT JOIN space_types st ON ws.space_type_id = st.id
             LEFT JOIN warehouses w ON ws.warehouse_id = w.id
             LEFT JOIN stock s ON ws.id = s.warehouse_space_id
             GROUP BY ws.id, ws.warehouse_id, w.name, ws.space_type_id, st.name, ws.name, ws.proximity, ws.qr_code
             ORDER BY ws.warehouse_id, ws.name"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO warehouse_spaces (warehouse_id, space_type_id, name, proximity, qr_code) VALUES (:warehouse_id, :space_type_id, :name, :proximity, :qr_code)"
        );
        $stmt->execute([
            ':warehouse_id'  => $data['warehouseId'],
            ':space_type_id' => $data['spaceTypeId'],
            ':name'          => $data['name'],
            ':proximity'     => $data['proximity'] ?? 0,
            ':qr_code'       => $data['qrCode'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = $this->db->prepare(
            "UPDATE warehouse_spaces SET warehouse_id=:warehouse_id, space_type_id=:space_type_id, name=:name, proximity=:proximity, qr_code=:qr_code WHERE id=:id"
        );
        $stmt->execute([
            ':id'            => $id,
            ':warehouse_id'  => $data['warehouseId'],
            ':space_type_id' => $data['spaceTypeId'],
            ':name'          => $data['name'],
            ':proximity'     => $data['proximity'] ?? 0,
            ':qr_code'       => $data['qrCode'] ?? null,
        ]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM warehouse_spaces WHERE id = :id")->execute([':id' => $id]);
    }
}
