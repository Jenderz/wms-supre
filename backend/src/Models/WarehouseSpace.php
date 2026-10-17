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
                "SELECT ws.id, ws.warehouse_id as warehouseId, ws.space_type_id as spaceTypeId, st.name as spaceTypeName, ws.space_usage_type as spaceUsageType, ws.name, ws.proximity, ws.qr_code as qrCode,
                        COUNT(DISTINCT s.product_id) AS productCount,
                        COALESCE(SUM(s.quantity), 0) AS totalQuantity
                 FROM warehouse_spaces ws
                 LEFT JOIN space_types st ON ws.space_type_id = st.id
                 LEFT JOIN stock s ON ws.id = s.warehouse_space_id
                 WHERE ws.warehouse_id = :wid
                 GROUP BY ws.id, ws.warehouse_id, ws.space_type_id, st.name, ws.space_usage_type, ws.name, ws.proximity, ws.qr_code
                 ORDER BY ws.name"
            );
            $stmt->execute([':wid' => $warehouseId]);
            return $stmt->fetchAll();
        }
        return $this->db->query(
            "SELECT ws.id, ws.warehouse_id as warehouseId, w.name as warehouseName, ws.space_type_id as spaceTypeId, st.name as spaceTypeName, ws.space_usage_type as spaceUsageType, ws.name, ws.proximity, ws.qr_code as qrCode,
                    COUNT(DISTINCT s.product_id) AS productCount,
                    COALESCE(SUM(s.quantity), 0) AS totalQuantity
             FROM warehouse_spaces ws
             LEFT JOIN space_types st ON ws.space_type_id = st.id
             LEFT JOIN warehouses w ON ws.warehouse_id = w.id
             LEFT JOIN stock s ON ws.id = s.warehouse_space_id
             GROUP BY ws.id, ws.warehouse_id, w.name, ws.space_type_id, st.name, ws.space_usage_type, ws.name, ws.proximity, ws.qr_code
             ORDER BY ws.warehouse_id, ws.name"
        )->fetchAll();
    }

    /**
     * Verifica si ya existe un espacio con el mismo nombre (case-insensitive)
     * dentro del mismo almacén, excluyendo opcionalmente un id (para edición).
     */
    private function nameExistsInWarehouse(string $name, int $warehouseId, ?int $excludeId = null): bool
    {
        $sql = "SELECT COUNT(*) FROM warehouse_spaces
                WHERE warehouse_id = :wid
                  AND LOWER(name)  = LOWER(:name)";
        $params = [':wid' => $warehouseId, ':name' => trim($name)];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Recupera un espacio de almacén por su ID (para completar datos en UPDATE).
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, warehouse_id AS warehouseId, space_type_id AS spaceTypeId,
                    space_usage_type AS spaceUsageType, name, proximity, qr_code AS qrCode
             FROM warehouse_spaces WHERE id = :id LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int
    {
        // ── Validación de nombre duplicado dentro del mismo almacén ──────────
        if ($this->nameExistsInWarehouse((string)$data['name'], (int)$data['warehouseId'])) {
            throw new \RuntimeException(
                'Ya existe un espacio con ese nombre en este almacén. Por favor elige un nombre diferente.'
            );
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO warehouse_spaces (warehouse_id, space_type_id, space_usage_type, name, proximity, qr_code) VALUES (:warehouse_id, :space_type_id, :space_usage_type, :name, :proximity, :qr_code)"
            );
            $stmt->execute([
                ':warehouse_id'      => $data['warehouseId'],
                ':space_type_id'     => $data['spaceTypeId'],
                ':space_usage_type'  => $data['spaceUsageType'] ?? 'Almacenamiento',
                ':name'              => $data['name'],
                ':proximity'         => $data['proximity'] ?? 0,
                ':qr_code'           => $data['qrCode'] ?? null,
            ]);
            $spaceId = (int) $this->db->lastInsertId();

            if (!empty($data['groupId'])) {
                $stmtGroup = $this->db->prepare("INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES (:group_id, :space_id)");
                $stmtGroup->execute([':group_id' => $data['groupId'], ':space_id' => $spaceId]);
            } else {
                // Asignar grupo predeterminado "(sin grupo asignado)"
                $stmtFind = $this->db->prepare("SELECT id FROM space_groups WHERE warehouse_id = :wid AND name = '(sin grupo asignado)' LIMIT 1");
                $stmtFind->execute([':wid' => $data['warehouseId']]);
                $defaultGroup = $stmtFind->fetch();

                $groupId = null;
                if ($defaultGroup) {
                    $groupId = $defaultGroup['id'];
                } else {
                    $stmtInsertGroup = $this->db->prepare("INSERT INTO space_groups (name, warehouse_id) VALUES ('(sin grupo asignado)', :wid)");
                    $stmtInsertGroup->execute([':wid' => $data['warehouseId']]);
                    $groupId = (int) $this->db->lastInsertId();
                }

                $stmtGroup = $this->db->prepare("INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES (:group_id, :space_id)");
                $stmtGroup->execute([':group_id' => $groupId, ':space_id' => $spaceId]);
            }

            $this->db->commit();
            return $spaceId;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        // BUG #4 FIX: Si el payload no trae warehouseId (o llega vacío),
        // completarlo con el valor actual de la BD para evitar corrupción
        // del campo warehouse_id y que la validación de duplicados se salte.
        if (empty($data['warehouseId'])) {
            $current = $this->findById($id);
            if ($current) {
                $data['warehouseId'] = $current['warehouseId'];
            }
        }
        // Del mismo modo proteger spaceTypeId y name si vienen vacíos
        if (empty($data['spaceTypeId']) || empty($data['name']) || empty($data['spaceUsageType'])) {
            $current = $current ?? $this->findById($id);
            if ($current) {
                $data['spaceTypeId']    = $data['spaceTypeId']    ?? $current['spaceTypeId'];
                $data['name']           = $data['name']           ?? $current['name'];
                $data['spaceUsageType'] = $data['spaceUsageType'] ?? $current['spaceUsageType'] ?? 'Almacenamiento';
            }
        }

        // ── Validación de nombre duplicado dentro del mismo almacén ───────────────
        if (!empty($data['name']) && !empty($data['warehouseId'])) {
            if ($this->nameExistsInWarehouse((string)$data['name'], (int)$data['warehouseId'], $id)) {
                throw new \RuntimeException(
                    'Ya existe un espacio con ese nombre en este almacén. Por favor elige un nombre diferente.'
                );
            }
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "UPDATE warehouse_spaces SET warehouse_id=:warehouse_id, space_type_id=:space_type_id, space_usage_type=:space_usage_type, name=:name, proximity=:proximity, qr_code=:qr_code WHERE id=:id"
            );
            $stmt->execute([
                ':id'                => $id,
                ':warehouse_id'      => $data['warehouseId'],
                ':space_type_id'     => $data['spaceTypeId'],
                ':space_usage_type'  => $data['spaceUsageType'] ?? 'Almacenamiento',
                ':name'              => $data['name'],
                ':proximity'         => $data['proximity'] ?? 0,
                ':qr_code'           => $data['qrCode'] ?? null,
            ]);

            // Si se proporciona un nuevo grupo, actualizarlo.
            if (array_key_exists('groupId', $data)) {
                $this->db->prepare("DELETE FROM space_group_items WHERE warehouse_space_id = :id")->execute([':id' => $id]);
                if (!empty($data['groupId'])) {
                    $stmtGroup = $this->db->prepare("INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES (:group_id, :space_id)");
                    $stmtGroup->execute([':group_id' => $data['groupId'], ':space_id' => $id]);
                } else {
                    // Reasignar al grupo predeterminado si el groupId viene vacío
                    $stmtFind = $this->db->prepare("SELECT id FROM space_groups WHERE warehouse_id = :wid AND name = '(sin grupo asignado)' LIMIT 1");
                    $stmtFind->execute([':wid' => $data['warehouseId']]);
                    $defaultGroup = $stmtFind->fetch();

                    $groupId = null;
                    if ($defaultGroup) {
                        $groupId = $defaultGroup['id'];
                    } else {
                        $stmtInsertGroup = $this->db->prepare("INSERT INTO space_groups (name, warehouse_id) VALUES ('(sin grupo asignado)', :wid)");
                        $stmtInsertGroup->execute([':wid' => $data['warehouseId']]);
                        $groupId = (int) $this->db->lastInsertId();
                    }

                    $stmtGroup = $this->db->prepare("INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES (:group_id, :space_id)");
                    $stmtGroup->execute([':group_id' => $groupId, ':space_id' => $id]);
                }
            }

            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM warehouse_spaces WHERE id = :id")->execute([':id' => $id]);
    }
}
