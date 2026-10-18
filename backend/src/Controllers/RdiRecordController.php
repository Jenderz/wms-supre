<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\RdiRecord;
use App\Helpers\Response;
use Exception;

class RdiRecordController
{
    private RdiRecord $model;

    public function __construct()
    {
        $this->model = new RdiRecord();
    }

    public function index(): void
    {
        $rdiType     = $_GET['rdiType'] ?? null;
        $warehouseId = isset($_GET['warehouseId']) && $_GET['warehouseId'] !== '' ? (int) $_GET['warehouseId'] : null;
        $status      = $_GET['status'] ?? null;
        $search      = $_GET['search'] ?? null;

        $data = $this->model->getAll($rdiType, $warehouseId, $status, $search);
        Response::json(['data' => $data]);
    }

    public function show(string $id): void
    {
        $row = $this->model->findById((int) $id);
        if (!$row) {
            Response::error('Registro RDI no encontrado.', 404);
            return;
        }
        Response::json(['data' => $row]);
    }

    public function store(object $authUser): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['warehouseId']) || empty($body['responsibleUserId'])) {
            Response::error('El almacén y el responsable son obligatorios.', 400);
            return;
        }
        if (empty($body['items'])) {
            Response::error('Debe incluir al menos un producto.', 400);
            return;
        }

        $userId = (int) ($authUser->user_id ?? $authUser->id ?? 1);
        try {
            $createdIds = $this->model->createBatch($body, $userId);
            Response::json(['message' => 'Registros RDI guardados correctamente.', 'data' => ['ids' => $createdIds]], 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function updateStatus(string $id, object $authUser): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $body['status'] ?? null;

        if (!$status || !in_array($status, ['DRAFT', 'PENDING', 'CONFORMED'], true)) {
            Response::error('Estado no válido.', 400);
            return;
        }

        $userId = (int) ($authUser->user_id ?? $authUser->id ?? 1);
        try {
            $this->model->updateStatus((int) $id, $status, $userId);
            $record = $this->model->findById((int) $id);
            Response::json(['message' => "Estado actualizado a {$status}.", 'data' => $record]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function destroy(string $id, object $authUser): void
    {
        try {
            $this->model->delete((int) $id, $authUser);
            Response::noContent();
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
