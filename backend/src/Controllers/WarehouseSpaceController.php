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
        if (empty($data['warehouseId']) || empty($data['spaceTypeId']) || empty($data['name']) || empty($data['spaceUsageType'])) {
            Response::error('warehouseId, spaceTypeId, spaceUsageType y name son requeridos.', 400);
            return;
        }
        // Validar que el valor sea uno de los permitidos
        $allowedUsageTypes = ['Despachos', 'Almacenamiento'];
        if (!in_array($data['spaceUsageType'], $allowedUsageTypes, true)) {
            Response::error('spaceUsageType debe ser "Despachos" o "Almacenamiento".', 400);
            return;
        }
        try {
            $id = $this->model->create($data);
            Response::created(['id' => $id]);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        } catch (\PDOException $e) {
            if ($e->getCode() == '23000') {
                Response::error('Ya existe un espacio con ese nombre en este almacén. Por favor elige un nombre diferente.', 409);
            } else {
                Response::error('Error al crear el espacio de almacén: ' . $e->getMessage(), 500);
            }
        }
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        try {
            $this->model->update((int) $id, $data);
            Response::json(['message' => 'Espacio de almacén actualizado.']);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        } catch (\PDOException $e) {
            if ($e->getCode() == '23000') {
                Response::error('Ya existe un espacio con ese nombre en este almacén. Por favor elige un nombre diferente.', 409);
            } else {
                Response::error('Error al actualizar el espacio de almacén: ' . $e->getMessage(), 500);
            }
        }
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
