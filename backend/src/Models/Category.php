<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use App\Exceptions\ValidationException;
use PDO;

class Category
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------------
    // READ
    // ----------------------------------------------------------------

    /**
     * Retorna todas las categorías con sus subcategorías.
     * Usa 2 queries totales (no N+1) y agrupa en PHP.
     */
    public function getAll(): array
    {
        $categories = $this->db->query(
            "SELECT id, name, code, description, qr_code AS qrCode,
                    is_fractional AS isFractional, fraction_type AS fractionType
             FROM categories
             ORDER BY name ASC"
        )->fetchAll();

        if (empty($categories)) {
            return [];
        }

        // Un único query adicional para todas las subcategorías
        $ids     = implode(',', array_column($categories, 'id'));
        $subs    = $this->db->query(
            "SELECT id, category_id, name
             FROM subcategories
             WHERE category_id IN ($ids)
             ORDER BY name ASC"
        )->fetchAll();

        // Indexar subcategorías por category_id para O(n) lookup
        $subMap = [];
        foreach ($subs as $sub) {
            $subMap[$sub['category_id']][] = [
                'id'   => $sub['id'],
                'name' => $sub['name'],
            ];
        }

        foreach ($categories as &$category) {
            $category['subcategories'] = $subMap[$category['id']] ?? [];
            $category['isFractional']  = (bool) $category['isFractional'];
        }

        return $categories;
    }

    /**
     * Retorna una categoría por ID, incluyendo sus subcategorías.
     * Consistente con getAll().
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, code, description, qr_code AS qrCode,
                    is_fractional AS isFractional, fraction_type AS fractionType
             FROM categories
             WHERE id = ?
             LIMIT 1"
        );
        $stmt->execute([$id]);
        $category = $stmt->fetch();

        if (!$category) {
            return null;
        }

        $subStmt = $this->db->prepare(
            "SELECT id, name FROM subcategories WHERE category_id = ? ORDER BY name ASC"
        );
        $subStmt->execute([$id]);
        $category['subcategories'] = $subStmt->fetchAll();
        $category['isFractional']  = (bool) $category['isFractional'];

        return $category;
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->db->prepare("SELECT id FROM categories WHERE code = ?");
        $stmt->execute([$code]);
        $res = $stmt->fetch();
        return $res ?: null;
    }

    /**
     * Retorna true si la categoría tiene productos asociados.
     * Usado para proteger el DELETE.
     */
    public function hasProducts(int $categoryId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM products WHERE category_id = ?"
        );
        $stmt->execute([$categoryId]);
        return (int) $stmt->fetchColumn() > 0;
    }

    // ----------------------------------------------------------------
    // WRITE
    // ----------------------------------------------------------------

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
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
                $this->insertSubcategories($categoryId, $data['subcategories']);
            }

            $this->db->commit();
            return $categoryId;

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $this->wrapException($e);
        }
    }

    public function update(int $id, array $data): void
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "UPDATE categories
                 SET name=:name, code=:code, description=:description,
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
                $this->syncSubcategories($id, $data['subcategories']);
            }

            $this->db->commit();

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $this->wrapException($e);
        }
    }

    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM categories WHERE id = :id")->execute([':id' => $id]);
    }

    // ----------------------------------------------------------------
    // PRIVATE HELPERS
    // ----------------------------------------------------------------

    /**
     * Inserta subcategorías nuevas validando unicidad de nombre dentro
     * de la misma categoría (normaliza con trim + strtolower).
     */
    private function insertSubcategories(int $categoryId, array $subcategories): void
    {
        $seen    = [];
        $subStmt = $this->db->prepare(
            "INSERT INTO subcategories (category_id, name) VALUES (:cid, :sname)"
        );

        foreach ($subcategories as $sub) {
            $name = trim($sub['name'] ?? '');
            if ($name === '') {
                continue;
            }

            $key = mb_strtolower($name);
            if (isset($seen[$key])) {
                throw new ValidationException(
                    "La sub-categoría \"{$name}\" está duplicada. Cada sub-categoría debe tener un nombre único."
                );
            }
            $seen[$key] = true;

            $subStmt->execute([':cid' => $categoryId, ':sname' => $name]);
        }
    }

    /**
     * Sincroniza las subcategorías de una categoría existente:
     *  - Actualiza las que vienen con id.
     *  - Inserta las nuevas (sin id).
     *  - Elimina las que ya no están en el payload.
     * Valida unicidad de nombres en todo el set final.
     */
    private function syncSubcategories(int $categoryId, array $subcategories): void
    {
        // Obtener los IDs actuales en BD
        $existingStmt = $this->db->prepare(
            "SELECT id FROM subcategories WHERE category_id = ?"
        );
        $existingStmt->execute([$categoryId]);
        $existingIds = $existingStmt->fetchAll(PDO::FETCH_COLUMN);

        // Validar unicidad de nombres en el payload completo (antes de tocar BD)
        $seen = [];
        foreach ($subcategories as $sub) {
            $name = trim($sub['name'] ?? '');
            if ($name === '') {
                continue;
            }
            $key = mb_strtolower($name);
            if (isset($seen[$key])) {
                throw new ValidationException(
                    "La sub-categoría \"{$name}\" está duplicada. Cada sub-categoría debe tener un nombre único."
                );
            }
            $seen[$key] = true;
        }

        $keptIds    = [];
        $updateStmt = $this->db->prepare(
            "UPDATE subcategories SET name = :sname WHERE id = :sid AND category_id = :cid"
        );
        $insertStmt = $this->db->prepare(
            "INSERT INTO subcategories (category_id, name) VALUES (:cid, :sname)"
        );

        foreach ($subcategories as $sub) {
            $name = trim($sub['name'] ?? '');
            if ($name === '') {
                continue;
            }

            if (!empty($sub['id'])) {
                $updateStmt->execute([':sname' => $name, ':sid' => $sub['id'], ':cid' => $categoryId]);
                $keptIds[] = (int) $sub['id'];
            } else {
                $insertStmt->execute([':cid' => $categoryId, ':sname' => $name]);
            }
        }

        // Eliminar las subcategorías removidas del payload
        $idsToDelete = array_diff($existingIds, $keptIds);
        if (!empty($idsToDelete)) {
            $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
            $deleteStmt   = $this->db->prepare(
                "DELETE FROM subcategories WHERE id IN ($placeholders)"
            );
            $deleteStmt->execute(array_values($idsToDelete));
        }
    }

    /**
     * Convierte errores de BD (ej: duplicate entry) en ValidationException
     * con mensaje amigable para el usuario.
     */
    private function wrapException(\Exception $e): \Exception
    {
        // MySQL error 1062 = Duplicate entry (viola UNIQUE KEY)
        if ($e instanceof \PDOException && $e->getCode() === '23000') {
            $msg = $e->getMessage();

            if (str_contains($msg, 'uk_subcategory_name')) {
                return new ValidationException(
                    'Ya existe una sub-categoría con ese nombre en esta categoría.'
                );
            }
            if (str_contains($msg, 'categories.code') || str_contains($msg, "'code'")) {
                return new ValidationException(
                    'Ya existe una categoría con ese código.'
                );
            }
        }
        return $e;
    }
}
