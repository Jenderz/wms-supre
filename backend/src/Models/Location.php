<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Location
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(?int $storeId = null): array
    {
        if ($storeId) {
            $stmt = $this->db->prepare(
                "SELECT id, store_id as storeId, room, shelf, cubicle FROM locations WHERE store_id = :sid ORDER BY room, shelf, cubicle"
            );
            $stmt->execute([':sid' => $storeId]);
            return $stmt->fetchAll();
        }
        return $this->db->query(
            "SELECT id, store_id as storeId, room, shelf, cubicle FROM locations ORDER BY store_id, room, shelf, cubicle"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO locations (store_id, room, shelf, cubicle) VALUES (:store_id, :room, :shelf, :cubicle)"
        );
        $stmt->execute([
            ':store_id' => $data['storeId'],
            ':room'     => $data['room'],
            ':shelf'    => $data['shelf'],
            ':cubicle'  => $data['cubicle'],
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM locations WHERE id = :id")->execute([':id' => $id]);
    }
}
