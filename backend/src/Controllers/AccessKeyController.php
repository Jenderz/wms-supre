<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\AccessKey;
use App\Helpers\Response;

class AccessKeyController
{
    private AccessKey $model;

    public function __construct()
    {
        $this->model = new AccessKey();
    }

    /** GET /locks — Lista todas las llaves (sin hash). Solo ADMIN. */
    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    /** POST /locks — Crea una nueva llave. Solo ADMIN. */
    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name']) || empty($data['module']) || empty($data['key'])) {
            Response::error('name, module y key son requeridos.', 400);
            return;
        }

        try {
            $id = $this->model->create($data);
            Response::created(['id' => $id]);
        } catch (\PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Ya existe una llave para ese módulo y acción.', 409);
            } else {
                throw $e;
            }
        }
    }

    /** PUT /locks/{id} — Actualiza una llave. Solo ADMIN. */
    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name']) || empty($data['module'])) {
            Response::error('name y module son requeridos.', 400);
            return;
        }

        try {
            $this->model->update((int) $id, $data);
            Response::json(['message' => 'Llave actualizada correctamente.']);
        } catch (\PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Ya existe una llave para ese módulo y acción.', 409);
            } else {
                throw $e;
            }
        }
    }

    /** DELETE /locks/{id} — Elimina una llave. Solo ADMIN. */
    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }

    /**
     * POST /locks/verify — Verifica una clave de acceso.
     * Disponible para todos los roles autenticados.
     * Body: { module, action, key }
     * Responde 200 { success: true } o 403 { error: ... }
     */
    public function verify(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['module']) || empty($data['action']) || !isset($data['key'])) {
            Response::error('module, action y key son requeridos.', 400);
            return;
        }

        $ok = $this->model->verify($data['module'], $data['action'], $data['key']);

        if ($ok) {
            Response::json(['success' => true, 'message' => 'Acceso autorizado.']);
        } else {
            Response::json(['success' => false, 'error' => 'Llave incorrecta. Acceso denegado.'], 403);
        }
    }

    /**
     * GET /locks/status?module=X&action=Y — Devuelve si una llave activa existe.
     * Usado por el frontend para construir el LockContext sin hashear nada.
     */
    public function status(): void
    {
        $module = strtoupper($_GET['module'] ?? '');
        $action = strtoupper($_GET['action'] ?? '*');

        if (empty($module)) {
            Response::error('module es requerido.', 400);
            return;
        }

        $locked = $this->model->exists($module, $action);
        Response::json(['locked' => $locked]);
    }
}
