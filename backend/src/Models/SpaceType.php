<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class SpaceType
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, name FROM space_types ORDER BY name"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO space_types (name) VALUES (:name)"
        );
        $stmt->execute([
            ':name' => $data['name']
        ]);
        return (int) $this->db->lastInsertId();
    }
    
    public function update(int $id, array $data): void
    {
        $this->db->prepare(
            "UPDATE space_types SET name = :name WHERE id = :id"
        )->execute([
            ':name' => $data['name'],
            ':id'   => $id,
        ]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM space_types WHERE id = :id")->execute([':id' => $id]);
    }
}
