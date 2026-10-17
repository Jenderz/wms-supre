<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class SpaceGroup
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(?int $warehouseId = null): array
    {
        $sql = "SELECT id, name, warehouse_id as warehouseId, created_at as createdAt, updated_at as updatedAt 
                FROM space_groups";
        $params = [];

        if ($warehouseId !== null) {
            $sql .= " WHERE warehouse_id = :warehouseId";
            $params[':warehouseId'] = $warehouseId;
        }

        $sql .= " ORDER BY name ASC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $groups = $stmt->fetchAll();

        // Obtener los items
        if (!empty($groups)) {
            $groupIds = array_column($groups, 'id');
            $inQuery = implode(',', array_fill(0, count($groupIds), '?'));
            
            $itemStmt = $this->db->prepare("SELECT group_id, warehouse_space_id FROM space_group_items WHERE group_id IN ($inQuery)");
            $itemStmt->execute($groupIds);
            $items = $itemStmt->fetchAll();

            $itemsByGroup = [];
            foreach ($items as $item) {
                $itemsByGroup[$item['group_id']][] = $item['warehouse_space_id'];
            }

            foreach ($groups as &$group) {
                $group['spaceIds'] = $itemsByGroup[$group['id']] ?? [];
            }
        }

        return $groups;
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT id, name, warehouse_id as warehouseId FROM space_groups WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $group = $stmt->fetch();

        if (!$group) {
            return null;
        }

        $itemStmt = $this->db->prepare("SELECT warehouse_space_id FROM space_group_items WHERE group_id = :id");
        $itemStmt->execute([':id' => $id]);
        $items = $itemStmt->fetchAll(PDO::FETCH_COLUMN);

        $group['spaceIds'] = $items;
        return $group;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            // Validar nombre único
            $this->assertUniqueName($data['name']);

            $stmt = $this->db->prepare("INSERT INTO space_groups (name, warehouse_id) VALUES (:name, :warehouseId)");
            $stmt->execute([
                ':name' => $data['name'],
                ':warehouseId' => $data['warehouseId'] ?? null
            ]);
            
            $groupId = (int) $this->db->lastInsertId();

            if (!empty($data['spaceIds'])) {
                // Validar que los espacios no pertenezcan ya a otro grupo
                $this->assertSpacesNotInOtherGroup($data['spaceIds'], $groupId);
                $this->insertItems($groupId, $data['spaceIds']);
            }

            $this->db->commit();
            return $groupId;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        $this->db->beginTransaction();
        try {
            if (isset($data['name']) || array_key_exists('warehouseId', $data)) {
                // Validar nombre único (excluyendo el propio grupo)
                $this->assertUniqueName($data['name'], $id);

                $stmt = $this->db->prepare("UPDATE space_groups SET name = :name, warehouse_id = :warehouseId WHERE id = :id");
                $stmt->execute([
                    ':id' => $id,
                    ':name' => $data['name'],
                    ':warehouseId' => $data['warehouseId'] ?? null
                ]);
            }

            if (isset($data['spaceIds'])) {
                $this->db->prepare("DELETE FROM space_group_items WHERE group_id = :id")->execute([':id' => $id]);
                if (!empty($data['spaceIds'])) {
                    // Validar que los espacios no pertenezcan ya a otro grupo
                    $this->assertSpacesNotInOtherGroup($data['spaceIds'], $id);
                    $this->insertItems($id, $data['spaceIds']);
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
        $this->db->prepare("DELETE FROM space_groups WHERE id = :id")->execute([':id' => $id]);
    }

    /**
     * Lanza excepción si ya existe un grupo con el mismo nombre (case-insensitive).
     * @param int|null $excludeId ID del grupo a excluir en la búsqueda (útil en updates).
     */
    private function assertUniqueName(string $name, ?int $excludeId = null): void
    {
        $sql = "SELECT id FROM space_groups WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))";
        $params = [':name' => $name];

        if ($excludeId !== null) {
            $sql .= " AND id != :excludeId";
            $params[':excludeId'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $existing = $stmt->fetch();

        if ($existing) {
            throw new \RuntimeException("El grupo \"" . trim($name) . "\" ya existe. Por favor elige un nombre diferente.");
        }
    }

    /**
     * Lanza excepción si alguno de los espacios ya pertenece a un grupo distinto.
     * @param array $spaceIds IDs de los espacios a asignar.
     * @param int   $currentGroupId ID del grupo actual (se excluye de la búsqueda).
     */
    private function assertSpacesNotInOtherGroup(array $spaceIds, int $currentGroupId): void
    {
        if (empty($spaceIds)) {
            return;
        }

        $inQuery = implode(',', array_fill(0, count($spaceIds), '?'));
        $params  = array_map('intval', $spaceIds);
        $params[] = $currentGroupId;

        $stmt = $this->db->prepare(
            "SELECT sgi.warehouse_space_id, sg.name AS group_name
             FROM space_group_items sgi
             INNER JOIN space_groups sg ON sg.id = sgi.group_id
             WHERE sgi.warehouse_space_id IN ($inQuery)
               AND sgi.group_id != ?"
        );
        $stmt->execute($params);
        $conflicts = $stmt->fetchAll();

        if (!empty($conflicts)) {
            $spaceIdsList = implode(', ', array_column($conflicts, 'warehouse_space_id'));
            $groupName    = $conflicts[0]['group_name'];
            throw new \RuntimeException(
                "El espacio de almacén (ID: $spaceIdsList) ya pertenece al grupo \"$groupName\". "
                . "Un espacio solo puede pertenecer a un grupo a la vez."
            );
        }
    }

    private function insertItems(int $groupId, array $spaceIds): void
    {
        $values = [];
        $params = [];
        
        foreach ($spaceIds as $spaceId) {
            $values[] = "(?, ?)";
            $params[] = $groupId;
            $params[] = $spaceId;
        }

        $sql = "INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES " . implode(', ', $values);
        $this->db->prepare($sql)->execute($params);
    }
}
