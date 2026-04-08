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
        $categories = $this->db->query(
            "SELECT id, name, code, description, qr_code as qrCode,
                    is_fractional as isFractional, fraction_type as fractionType
             FROM categories ORDER BY name ASC"
        )->fetchAll();

        foreach ($categories as &$category) {
            $stmt = $this->db->prepare("SELECT id, name FROM subcategories WHERE category_id = ? ORDER BY name ASC");
            $stmt->execute([$category['id']]);
            $category['subcategories'] = $stmt->fetchAll();
            $category['isFractional'] = (bool) $category['isFractional'];
        }

        return $categories;
    }

    public function create(array $data): int
    {
        try {
            $this->db->beginTransaction();

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
            $categoryId = (int) $this->db->lastInsertId();

            if (!empty($data['subcategories']) && is_array($data['subcategories'])) {
                $subStmt = $this->db->prepare("INSERT INTO subcategories (category_id, name) VALUES (:cid, :sname)");
                foreach ($data['subcategories'] as $sub) {
                    if (!empty($sub['name'])) {
                        $subStmt->execute([':cid' => $categoryId, ':sname' => $sub['name']]);
                    }
                }
            }

            $this->db->commit();
            return $categoryId;

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        try {
            $this->db->beginTransaction();

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

            if (isset($data['subcategories']) && is_array($data['subcategories'])) {
                $existingStmt = $this->db->prepare("SELECT id FROM subcategories WHERE category_id = ?");
                $existingStmt->execute([$id]);
                $existingIds = $existingStmt->fetchAll(PDO::FETCH_COLUMN);

                $keptIds = [];
                $insertStmt = $this->db->prepare("INSERT INTO subcategories (category_id, name) VALUES (:cid, :sname)");
                $updateStmt = $this->db->prepare("UPDATE subcategories SET name = :sname WHERE id = :sid AND category_id = :cid");

                foreach ($data['subcategories'] as $sub) {
                    if (!empty($sub['id'])) {
                        $updateStmt->execute([':sname' => $sub['name'], ':sid' => $sub['id'], ':cid' => $id]);
                        $keptIds[] = $sub['id'];
                    } elseif (!empty($sub['name'])) {
                        $insertStmt->execute([':cid' => $id, ':sname' => $sub['name']]);
                    }
                }

                $idsToDelete = array_diff($existingIds, $keptIds);
                if (!empty($idsToDelete)) {
                    $deleteStmt = $this->db->prepare("DELETE FROM subcategories WHERE id = ?");
                    foreach ($idsToDelete as $delId) {
                        $deleteStmt->execute([$delId]);
                    }
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
        $this->db->prepare("DELETE FROM categories WHERE id = :id")->execute([':id' => $id]);
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->db->prepare("SELECT id FROM categories WHERE code = ?");
        $stmt->execute([$code]);
        $res = $stmt->fetch();
        return $res ?: null;
    }
}
