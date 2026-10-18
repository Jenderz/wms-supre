<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\TransferPicking;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use Exception;

class TransferPickingController
{
    private TransferPicking $model;

    public function __construct()
    {
        $this->model = new TransferPicking();
    }

    public function index(): void
    {
        $origWid = isset($_GET['originWarehouseId']) && $_GET['originWarehouseId'] !== '' ? (int) $_GET['originWarehouseId'] : null;
        $destWid = isset($_GET['destinationWarehouseId']) && $_GET['destinationWarehouseId'] !== '' ? (int) $_GET['destinationWarehouseId'] : null;
        $respUid = isset($_GET['responsibleUserId']) && $_GET['responsibleUserId'] !== '' ? (int) $_GET['responsibleUserId'] : null;
        $status  = $_GET['status'] ?? null;
        $search  = $_GET['search'] ?? null;

        $data = $this->model->getAll($origWid, $destWid, $respUid, $status, $search);
        Response::json(['data' => $data]);
    }

    public function show(string $id): void
    {
        $row = $this->model->findById((int) $id);
        if (!$row) {
            Response::error('Picking de transferencia no encontrado.', 404);
            return;
        }
        Response::json(['data' => $row]);
    }

    public function store(object $authUser): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['originWarehouseId']) || empty($body['destinationWarehouseId']) || empty($body['responsibleUserId'])) {
            Response::error('Los almacenes de origen y destino y el responsable son obligatorios.', 400);
            return;
        }
        if (empty($body['items'])) {
            Response::error('Debe incluir al menos un producto a transferir.', 400);
            return;
        }

        $userId = (int) ($authUser->user_id ?? $authUser->id ?? 1);
        try {
            $id = $this->model->create($body, $userId);
            $transfer = $this->model->findById($id);
            Response::json(['message' => 'Picking de transferencia creado exitosamente.', 'data' => $transfer], 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function update(string $id, object $authUser): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $userId = (int) ($authUser->user_id ?? $authUser->id ?? 1);

        try {
            $this->model->update((int) $id, $body, $userId);
            $transfer = $this->model->findById((int) $id);
            Response::json(['message' => 'Picking de transferencia actualizado exitosamente.', 'data' => $transfer]);
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
            $transfer = $this->model->findById((int) $id);
            Response::json(['message' => "Estado actualizado a {$status}.", 'data' => $transfer]);
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
