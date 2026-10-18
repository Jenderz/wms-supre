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

        // Obtener los items de todos los grupos de una sola consulta
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
        if (!$group) return null;

        $itemStmt = $this->db->prepare("SELECT warehouse_space_id FROM space_group_items WHERE group_id = :id");
        $itemStmt->execute([':id' => $id]);
        $items = array_column($itemStmt->fetchAll(), 'warehouse_space_id');

        $group['spaceIds'] = $items;
        return $group;
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $warehouseId = isset($data['warehouseId']) && $data['warehouseId'] !== '' && $data['warehouseId'] !== null
                ? (int) $data['warehouseId']
                : null;

            // Si no viene warehouseId pero vienen spaceIds, inferirlo del primer espacio
            if ($warehouseId === null && !empty($data['spaceIds'])) {
                $firstSpaceId = (int) $data['spaceIds'][0];
                $stmtWh = $this->db->prepare("SELECT warehouse_id FROM warehouse_spaces WHERE id = :id");
                $stmtWh->execute([':id' => $firstSpaceId]);
                $row = $stmtWh->fetch();
                if ($row) {
                    $warehouseId = (int) $row['warehouse_id'];
                }
            }

            // El almacén es obligatorio: sin él, el grupo aparecería en todos los almacenes
            if ($warehouseId === null) {
                throw new \RuntimeException(
                    "Debes especificar el almacén del grupo (o seleccionar espacios para deducirlo automáticamente)."
                );
            }

            // Validar nombre único con alcance de almacén
            $this->assertUniqueName($data['name'], $warehouseId);

            $stmt = $this->db->prepare("INSERT INTO space_groups (name, warehouse_id) VALUES (:name, :warehouseId)");
            $stmt->execute([
                ':name'        => trim($data['name']),
                ':warehouseId' => $warehouseId,
            ]);
            
            $groupId = (int) $this->db->lastInsertId();

            if (!empty($data['spaceIds'])) {
                // Validar que los espacios no pertenezcan ya a otro grupo
                $this->assertSpacesNotInOtherGroup($data['spaceIds'], $groupId);
                // Validar que todos los espacios pertenezcan al almacén del grupo
                $this->assertSpacesBelongToWarehouse($data['spaceIds'], $warehouseId);
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
            $stmtCur = $this->db->prepare(
                "SELECT id, name, warehouse_id FROM space_groups WHERE id = :id"
            );
            $stmtCur->execute([':id' => $id]);
            $existing = $stmtCur->fetch();
            if (!$existing) {
                throw new \RuntimeException("El grupo de espacios #{$id} no existe.");
            }

            // Resolver warehouseId: payload > grupo existente > inferido de los espacios.
            // Nunca se escribe NULL si el payload no trae el almacén (evita desvincular el grupo).
            if (array_key_exists('warehouseId', $data) && $data['warehouseId'] !== null && $data['warehouseId'] !== '') {
                $warehouseId = (int) $data['warehouseId'];
            } else {
                $warehouseId = $existing['warehouse_id'] !== null ? (int) $existing['warehouse_id'] : null;
            }
            if ($warehouseId === null && isset($data['spaceIds']) && !empty($data['spaceIds'])) {
                $stmtWh = $this->db->prepare("SELECT warehouse_id FROM warehouse_spaces WHERE id = :id");
                $stmtWh->execute([':id' => (int) $data['spaceIds'][0]]);
                $row = $stmtWh->fetch();
                if ($row) {
                    $warehouseId = (int) $row['warehouse_id'];
                }
            }

            $newName = array_key_exists('name', $data) ? trim((string) $data['name']) : $existing['name'];
            if ($newName === '') {
                throw new \RuntimeException("El nombre del grupo no puede estar vacío.");
            }

            if (array_key_exists('name', $data) || array_key_exists('warehouseId', $data)) {
                // Validar nombre único con alcance de almacén (excluye al propio grupo)
                $this->assertUniqueName($newName, $warehouseId, $id);

                $stmt = $this->db->prepare("UPDATE space_groups SET name = :name, warehouse_id = :warehouseId WHERE id = :id");
                $stmt->execute([
                    ':id'          => $id,
                    ':name'        => $newName,
                    ':warehouseId' => $warehouseId,
                ]);
            }

            if (isset($data['spaceIds'])) {
                $this->db->prepare("DELETE FROM space_group_items WHERE group_id = :id")->execute([':id' => $id]);
                if (!empty($data['spaceIds'])) {
                    // Validar que los espacios no pertenezcan ya a otro grupo
                    $this->assertSpacesNotInOtherGroup($data['spaceIds'], $id);
                    // Validar que todos los espacios pertenezcan al almacén del grupo
                    if ($warehouseId !== null) {
                        $this->assertSpacesBelongToWarehouse($data['spaceIds'], $warehouseId);
                    }
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
     * Obtiene los grupos que contienen un spaceId dado.
     */
    public function getGroupsForSpace(int $spaceId): array
    {
        $sql = "SELECT sg.id, sg.name, sg.warehouse_id AS warehouseId
                FROM space_group_items sgi
                INNER JOIN space_groups sg ON sg.id = sgi.group_id
                WHERE sgi.warehouse_space_id = :spaceId";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':spaceId' => $spaceId]);
        return $stmt->fetchAll();
    }

    /**
     * Añade espacios a un grupo existente en bloque (usado por importación CSV).
     */
    public function addSpacesToGroup(int $groupId, array $spaceIds): void
    {
        if (empty($spaceIds)) return;
        $this->db->beginTransaction();
        try {
            $stmtG = $this->db->prepare("SELECT warehouse_id FROM space_groups WHERE id = :id");
            $stmtG->execute([':id' => $groupId]);
            $group = $stmtG->fetch();
            if (!$group) {
                throw new \RuntimeException("El grupo de espacios #{$groupId} no existe.");
            }
            if ($group['warehouse_id'] !== null) {
                $this->assertSpacesBelongToWarehouse($spaceIds, (int) $group['warehouse_id']);
            }
            $this->assertSpacesNotInOtherGroup($spaceIds, $groupId);
            $this->insertItems($groupId, $spaceIds);
            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Métodos privados ─────────────────────────────────────────────────────

    /**
     * Lanza excepción si ya existe un grupo con el mismo nombre dentro del
     * mismo almacén (case-insensitive). La unicidad es por (name, warehouse_id).
     *
     * @param string   $name        Nombre del grupo a validar.
     * @param int|null $warehouseId Almacén al que pertenece el grupo (null = global).
     * @param int|null $excludeId   ID del grupo a excluir en la búsqueda (útil en updates).
     */
    private function assertUniqueName(string $name, ?int $warehouseId, ?int $excludeId = null): void
    {
        if ($warehouseId !== null) {
            $sql = "SELECT id FROM space_groups
                    WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))
                      AND warehouse_id = :warehouseId";
            $params = [':name' => $name, ':warehouseId' => $warehouseId];
        } else {
            // Para grupos sin almacén asignado, validar únicamente en el scope global
            $sql = "SELECT id FROM space_groups
                    WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))
                      AND warehouse_id IS NULL";
            $params = [':name' => $name];
        }

        if ($excludeId !== null) {
            $sql .= " AND id != :excludeId";
            $params[':excludeId'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $existing = $stmt->fetch();

        if ($existing) {
            throw new \RuntimeException("El grupo \"" . trim($name) . "\" ya existe en este almacén. Por favor elige un nombre diferente.");
        }
    }

    /**
     * Lanza excepción si alguno de los espacios ya pertenece a un grupo distinto.
     * @param array $spaceIds       IDs de los espacios a asignar.
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

    /**
     * Lanza excepción si alguno de los espacios no pertenece al almacén del grupo.
     * Garantiza que un grupo quede estrictamente vinculado a un único almacén.
     * @param array $spaceIds    IDs de los espacios a asignar.
     * @param int   $warehouseId Almacén obligatorio del grupo.
     */
    private function assertSpacesBelongToWarehouse(array $spaceIds, int $warehouseId): void
    {
        if (empty($spaceIds)) {
            return;
        }

        $inQuery = implode(',', array_fill(0, count($spaceIds), '?'));
        $params  = array_map('intval', $spaceIds);
        $params[] = $warehouseId;

        $stmt = $this->db->prepare(
            "SELECT id FROM warehouse_spaces
             WHERE id IN ($inQuery)
               AND warehouse_id != ?"
        );
        $stmt->execute($params);
        $conflicts = $stmt->fetchAll();

        if (!empty($conflicts)) {
            $spaceIdsList = implode(', ', array_column($conflicts, 'id'));
            throw new \RuntimeException(
                "Los espacios (IDs: $spaceIdsList) no pertenecen al almacén del grupo. "
                . "Un grupo solo puede contener espacios del mismo almacén."
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
            $params[] = (int) $spaceId;
        }

        $sql = "INSERT INTO space_group_items (group_id, warehouse_space_id) VALUES " . implode(', ', $values);
        $this->db->prepare($sql)->execute($params);
    }
}
