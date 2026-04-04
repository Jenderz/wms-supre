<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use Exception;
use PDO;

class Provider
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query("SELECT id, code, name, contact_number, address, created_at, updated_at FROM providers ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM providers WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $provider = $stmt->fetch();
        return $provider ?: null;
    }

    public function create(array $data): array
    {
        // Simple check for duplicate code
        $stmt = $this->db->prepare("SELECT id FROM providers WHERE code = :code");
        $stmt->execute(['code' => $data['code']]);
        if ($stmt->fetch()) {
            throw new Exception("El código del proveedor ya existe.");
        }

        $stmt = $this->db->prepare("
            INSERT INTO providers (code, name, contact_number, address)
            VALUES (:code, :name, :contact_number, :address)
        ");

        $stmt->execute([
            'code'           => $data['code'],
            'name'           => $data['name'],
            'contact_number' => $data['contact_number'] ?? null,
            'address'        => $data['address'] ?? null,
        ]);

        $id = (int) $this->db->lastInsertId();
        return $this->getById($id);
    }

    public function update(int $id, array $data): array
    {
        // Simple check for duplicate code
        $stmt = $this->db->prepare("SELECT id FROM providers WHERE code = :code AND id != :id");
        $stmt->execute(['code' => $data['code'], 'id' => $id]);
        if ($stmt->fetch()) {
            throw new Exception("El código del proveedor ya existe.");
        }

        $stmt = $this->db->prepare("
            UPDATE providers
            SET code = :code, name = :name, contact_number = :contact_number, address = :address
            WHERE id = :id
        ");

        $stmt->execute([
            'id'             => $id,
            'code'           => $data['code'],
            'name'           => $data['name'],
            'contact_number' => $data['contact_number'] ?? null,
            'address'        => $data['address'] ?? null,
        ]);

        return $this->getById($id);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM providers WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}
