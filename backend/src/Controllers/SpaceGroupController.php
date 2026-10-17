<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\SpaceGroup;
use App\Helpers\Response;

class SpaceGroupController
{
    private SpaceGroup $model;

    public function __construct()
    {
        $this->model = new SpaceGroup();
    }

    public function index(): void
    {
        $warehouseId = isset($_GET['warehouseId']) ? (int)$_GET['warehouseId'] : null;
        Response::success($this->model->getAll($warehouseId));
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            Response::error('El nombre del grupo es requerido.', 400);
            return;
        }

        try {
            $id = $this->model->create($data);
            Response::created(['id' => $id]);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        } catch (\Exception $e) {
            Response::error('Error al crear el grupo de espacios: ' . $e->getMessage(), 500);
        }
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            Response::error('El nombre del grupo es requerido.', 400);
            return;
        }

        try {
            $this->model->update((int) $id, $data);
            Response::json(['message' => 'Grupo de espacios actualizado correctamente.']);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        } catch (\Exception $e) {
            Response::error('Error al actualizar el grupo de espacios: ' . $e->getMessage(), 500);
        }
    }

    public function destroy(string $id): void
    {
        try {
            $this->model->delete((int) $id);
            Response::noContent();
        } catch (\Exception $e) {
            Response::error('Error al eliminar el grupo de espacios: ' . $e->getMessage(), 500);
        }
    }
}
