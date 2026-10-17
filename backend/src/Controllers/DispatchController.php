<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\DispatchOrder;
use App\Helpers\Response;
use Exception;

class DispatchController
{
    private DispatchOrder $model;

    public function __construct()
    {
        $this->model = new DispatchOrder();
    }

    public function index(): void
    {
        $warehouseId = isset($_GET['warehouse_id']) ? (int) $_GET['warehouse_id'] : (isset($_GET['warehouseId']) ? (int) $_GET['warehouseId'] : null);
        $page = isset($_GET['page']) ? (int) $_GET['page'] : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;
        $status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : null;

        // Modo retrocompatible si no se solicitan parámetros de paginación o filtros
        if ($page === null && $limit === null && empty($status) && empty($search)) {
            Response::success($this->model->getAll($warehouseId));
            return;
        }

        $result = $this->model->getPaginated(
            $page ?? 1,
            $limit ?? 50,
            $warehouseId,
            $status,
            $search
        );
        Response::success($result);
    }

    public function show(string $id): void
    {
        $record = $this->model->findById((int) $id);
        if (!$record) {
            Response::error('Orden de despacho no encontrada.', 404);
            return;
        }
        Response::success($record);
    }

    public function store(object $authUser): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['warehouseId'])) {
            Response::error('warehouseId es requerido.', 400);
            return;
        }
        if (empty($data['items']) || !is_array($data['items'])) {
            Response::error('La orden debe incluir al menos un ítem.', 400);
            return;
        }

        try {
            $userId = (int) ($authUser->user_id ?? 1);
            $id = $this->model->create($data, $userId);
            $created = $this->model->findById($id);
            Response::created($created);
        } catch (Exception $e) {
            Response::error('Error al crear despacho: ' . $e->getMessage(), 400);
        }
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $this->model->update((int) $id, $data);
            $updated = $this->model->findById((int) $id);
            Response::success($updated);
        } catch (Exception $e) {
            Response::error('Error al actualizar despacho: ' . $e->getMessage(), 400);
        }
    }

    public function updateStatus(string $id, object $authUser): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $data['status'] ?? null;
        if (!$status) {
            Response::error('El parámetro status es requerido.', 400);
            return;
        }

        try {
            $userId = (int) ($authUser->user_id ?? 1);
            $this->model->updateStatus((int) $id, (string) $status, $userId);
            $updated = $this->model->findById((int) $id);
            Response::success($updated);
        } catch (Exception $e) {
            Response::error('Error al actualizar estado del despacho: ' . $e->getMessage(), 400);
        }
    }

    public function destroy(string $id): void
    {
        try {
            $this->model->delete((int) $id);
            Response::success(['message' => 'Orden de despacho eliminada.']);
        } catch (Exception $e) {
            Response::error('Error al eliminar despacho: ' . $e->getMessage(), 400);
        }
    }

    public function syncStock(): void
    {
        try {
            $this->model->recalculateStockReservations();
            Response::success(['message' => 'Stock y reservas sincronizados correctamente.']);
        } catch (Exception $e) {
            Response::error('Error al sincronizar stock: ' . $e->getMessage(), 400);
        }
    }
}
