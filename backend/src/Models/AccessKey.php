<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class AccessKey
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Devuelve todas las llaves SIN exponer key_hash.
     */
    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, name, module, action, is_active as isActive, description, created_at, updated_at
             FROM access_keys ORDER BY module ASC, action ASC"
        )->fetchAll();
    }

    /**
     * Crea una nueva llave hasheando la clave con bcrypt.
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO access_keys (name, module, action, key_hash, is_active, description)
             VALUES (:name, :module, :action, :key_hash, :is_active, :description)"
        );
        $stmt->execute([
            ':name'        => $data['name'],
            ':module'      => strtoupper($data['module']),
            ':action'      => strtoupper($data['action'] ?? '*'),
            ':key_hash'    => password_hash($data['key'], PASSWORD_BCRYPT),
            ':is_active'   => (int) ($data['isActive'] ?? true),
            ':description' => $data['description'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Actualiza una llave. Si viene 'key' nueva la re-hashea;
     * si no viene, mantiene el hash actual.
     */
    public function update(int $id, array $data): void
    {
        // Construir set dinámico
        $fields = [
            'name'        => $data['name'],
            'module'      => strtoupper($data['module']),
            'action'      => strtoupper($data['action'] ?? '*'),
            'is_active'   => (int) ($data['isActive'] ?? true),
            'description' => $data['description'] ?? null,
        ];

        $setSql = "name=:name, module=:module, action=:action, is_active=:is_active, description=:description";
        $params = $fields;
        $params[':id'] = $id;

        // Si viene nueva clave, re-hashear
        if (!empty($data['key'])) {
            $setSql .= ', key_hash=:key_hash';
            $params[':key_hash'] = password_hash($data['key'], PASSWORD_BCRYPT);
        }

        $stmt = $this->db->prepare("UPDATE access_keys SET {$setSql} WHERE id=:id");
        // Reindexar params con prefijo ':'
        $bound = [];
        foreach ($params as $k => $v) {
            $key = str_starts_with($k, ':') ? $k : ":$k";
            $bound[$key] = $v;
        }
        $stmt->execute($bound);
    }

    /**
     * Elimina una llave por ID.
     */
    public function delete(int $id): void
    {
        $this->db->prepare("DELETE FROM access_keys WHERE id = :id")->execute([':id' => $id]);
    }

    /**
     * Verifica si la clave es correcta para el módulo+acción dados.
     *
     * Prioridad: llave específica (module, action) > llave de módulo (module, '*').
     * Si no existe ninguna llave activa: devuelve true (acción libre).
     * Si la llave existe pero está inactiva: devuelve true.
     */
    public function verify(string $module, string $action, string $key): bool
    {
        $module = strtoupper($module);
        $action = strtoupper($action);

        // 1. Buscar llave específica
        $stmt = $this->db->prepare(
            "SELECT key_hash, is_active FROM access_keys WHERE module = :m AND action = :a LIMIT 1"
        );
        $stmt->execute([':m' => $module, ':a' => $action]);
        $row = $stmt->fetch();

        // 2. Si no hay específica, buscar llave de módulo (action = '*')
        if (!$row) {
            $stmt = $this->db->prepare(
                "SELECT key_hash, is_active FROM access_keys WHERE module = :m AND action = '*' LIMIT 1"
            );
            $stmt->execute([':m' => $module]);
            $row = $stmt->fetch();
        }

        // 3. Sin llave → libre
        if (!$row) return true;

        // 4. Llave inactiva → libre
        if (!(bool) $row['is_active']) return true;

        // 5. Verificar hash
        return password_verify($key, $row['key_hash']);
    }

    /**
     * Devuelve si existe alguna llave activa para el módulo+acción.
     * Usado por el frontend para saber si mostrar el candado.
     */
    public function exists(string $module, string $action): bool
    {
        $module = strtoupper($module);
        $action = strtoupper($action);

        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM access_keys
             WHERE module = :m AND (action = :a OR action = '*') AND is_active = 1 LIMIT 1"
        );
        $stmt->execute([':m' => $module, ':a' => $action]);
        return (int) $stmt->fetchColumn() > 0;
    }
}
