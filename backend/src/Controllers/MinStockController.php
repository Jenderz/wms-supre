<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\MinStockModel;
use App\Helpers\Response;

class MinStockController
{
    private MinStockModel $model;

    public function __construct()
    {
        $this->model = new MinStockModel();
    }

    public function general(): void
    {
        $warehouseId = isset($_GET['warehouseId']) && $_GET['warehouseId'] !== '' ? (int) $_GET['warehouseId'] : null;
        $stockFilter = $_GET['stockFilter'] ?? null;
        $search      = $_GET['search'] ?? null;

        $data = $this->model->getGeneralMinStock($warehouseId, $stockFilter, $search);
        Response::json(['data' => $data]);
    }

    public function dispatch(): void
    {
        $warehouseId = isset($_GET['warehouseId']) && $_GET['warehouseId'] !== '' ? (int) $_GET['warehouseId'] : null;
        $stockFilter = $_GET['stockFilter'] ?? null;
        $search      = $_GET['search'] ?? null;

        $data = $this->model->getDispatchSpaceMinStock($warehouseId, $stockFilter, $search);
        Response::json(['data' => $data]);
    }

    public function archived(): void
    {
        $warehouseId = isset($_GET['warehouseId']) && $_GET['warehouseId'] !== '' ? (int) $_GET['warehouseId'] : null;
        $search      = $_GET['search'] ?? null;

        $data = $this->model->getArchivedMinStock($warehouseId, $search);
        Response::json(['data' => $data]);
    }

    public function archive(object $authUser): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $body['items'] ?? [];
        $deadlineAt = $body['deadlineAt'] ?? date('Y-m-d H:i:s', strtotime('+30 days'));

        if (empty($items)) {
            Response::error('Debe seleccionar al menos un producto para archivar.', 400);
            return;
        }

        $userId = (int) ($authUser->user_id ?? $authUser->id ?? 1);
        $this->model->archiveItems($items, $deadlineAt, $userId);
        Response::json(['message' => 'Productos archivados correctamente.']);
    }

    public function unarchive(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $body['items'] ?? [];

        if (empty($items)) {
            Response::error('Debe seleccionar al menos un producto para desarchivar.', 400);
            return;
        }

        $this->model->unarchiveItems($items);
        Response::json(['message' => 'Productos desarchivados correctamente.']);
    }
}
