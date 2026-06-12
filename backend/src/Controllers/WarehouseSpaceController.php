<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\WarehouseSpace;
use App\Helpers\Response;

class WarehouseSpaceController
{
    private WarehouseSpace $model;

    public function __construct()
    {
        $this->model = new WarehouseSpace();
    }

    public function index(): void
    {
        $warehouseId = $_GET['warehouseId'] ?? null;
        Response::success($this->model->getAll($warehouseId ? (int)$warehouseId : null));
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['warehouseId']) || empty($data['spaceTypeId']) || empty($data['name'])) {
            Response::error('warehouseId, spaceTypeId y name son requeridos.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Espacio de almacén actualizado.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
