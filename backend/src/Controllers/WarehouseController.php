<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Warehouse;
use App\Helpers\Response;

class WarehouseController
{
    private Warehouse $model;

    public function __construct()
    {
        $this->model = new Warehouse();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            Response::error('name es requerido.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Almacén actualizado.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
