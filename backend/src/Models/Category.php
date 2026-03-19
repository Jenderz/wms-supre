<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class Category
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, name, code, description, qr_code as qrCode,
                    is_fractional as isFractional, fraction_type as fractionType
             FROM categories ORDER BY name ASC"
        )->fetchAll();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO categories (name, code, description, qr_code, is_fractional, fraction_type)
             VALUES (:name, :code, :description, :qr_code, :is_fractional, :fraction_type)"
        );
        $stmt->execute([
            ':name'          => $data['name'],
            ':code'          => $data['code'],
            ':description'   => $data['description'] ?? null,
            ':qr_code'       => $data['qrCode'] ?? null,
            ':is_fractional' => (int) ($data['isFractional'] ?? false),
            ':fraction_type' => $data['fractionType'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = $this->db->prepare(
            "UPDATE categories SET name=:name, code=:code, description=:description,
             qr_code=:qr_code, is_fractional=:is_fractional, fraction_type=:fraction_type
             WHERE id=:id"
        );
        $stmt->execute([
            ':id'            => $id,
            ':name'          => $data['name'],
            ':code'          => $data['code'],
            ':description'   => $data['description'] ?? null,
            ':qr_code'       => $data['qrCode'] ?? null,
            ':is_fractional' => (int) ($data['isFractional'] ?? false),
            ':fraction_type' => $data['fractionType'] ?? null,
        ]);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM categories WHERE id = :id")->execute([':id' => $id]);
    }
}
