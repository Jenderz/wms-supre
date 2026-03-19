<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Store
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, name, description, qr_code as qrCode FROM stores ORDER BY name"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO stores (name, description, qr_code) VALUES (:name, :description, :qr_code)"
        );
        $stmt->execute([
            ':name'        => $data['name'],
            ':description' => $data['description'] ?? null,
            ':qr_code'     => $data['qrCode'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $this->db->prepare(
            "UPDATE stores SET name=:name, description=:description, qr_code=:qr_code WHERE id=:id"
        )->execute([
            ':id'          => $id,
            ':name'        => $data['name'],
            ':description' => $data['description'] ?? null,
            ':qr_code'     => $data['qrCode'] ?? null,
        ]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM stores WHERE id = :id")->execute([':id' => $id]);
    }
}
