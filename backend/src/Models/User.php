<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class User
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findByUsername(string $username): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, username, password_hash, role, permissions 
             FROM users WHERE username = :username LIMIT 1"
        );
        $stmt->execute([':username' => $username]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['permissions'] = json_decode($row['permissions'] ?? '[]', true);
        return $row;
    }

    public function getAll(): array
    {
        $stmt = $this->db->query(
            "SELECT u.id, u.name, u.username, u.role, u.permissions,
                    GROUP_CONCAT(us.store_id) as assigned_stores
             FROM users u
             LEFT JOIN user_stores us ON u.id = us.user_id
             GROUP BY u.id"
        );
        return array_map(function ($row) {
            $row['permissions']    = json_decode($row['permissions'] ?? '[]', true);
            $row['assignedStores'] = $row['assigned_stores']
                ? array_map('intval', explode(',', $row['assigned_stores']))
                : [];
            unset($row['assigned_stores']);
            return $row;
        }, $stmt->fetchAll());
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO users (name, username, password_hash, role, permissions)
                 VALUES (:name, :username, :password_hash, :role, :permissions)"
            );
            $stmt->execute([
                ':name'          => $data['name'],
                ':username'      => $data['username'],
                ':password_hash' => password_hash($data['password'], PASSWORD_BCRYPT),
                ':role'          => $data['role'],
                ':permissions'   => json_encode($data['permissions'] ?? []),
            ]);
            $id = (int) $this->db->lastInsertId();

            $this->syncStores($id, $data['assignedStores'] ?? []);

            $this->db->commit();
            return $id;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): bool
    {
        $this->db->beginTransaction();
        try {
            $fields = [
                ':id'          => $id,
                ':name'        => $data['name'],
                ':username'    => $data['username'],
                ':role'        => $data['role'],
                ':permissions' => json_encode($data['permissions'] ?? []),
            ];
            $sql = "UPDATE users SET name=:name, username=:username, role=:role, permissions=:permissions";
            if (!empty($data['password'])) {
                $sql .= ", password_hash=:password_hash";
                $fields[':password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
            }
            $sql .= " WHERE id=:id";
            $this->db->prepare($sql)->execute($fields);

            $this->syncStores($id, $data['assignedStores'] ?? []);

            $this->db->commit();
            return true;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function delete(int $id): bool
    {
        return (bool) $this->db->prepare("DELETE FROM users WHERE id = :id")
            ->execute([':id' => $id]);
    }

    private function syncStores(int $userId, array $storeIds): void
    {
        $this->db->prepare("DELETE FROM user_stores WHERE user_id = :uid")->execute([':uid' => $userId]);
        if (empty($storeIds)) return;
        $stmt = $this->db->prepare("INSERT INTO user_stores (user_id, store_id) VALUES (:uid, :sid)");
        foreach ($storeIds as $storeId) {
            $stmt->execute([':uid' => $userId, ':sid' => (int) $storeId]);
        }
    }
}
