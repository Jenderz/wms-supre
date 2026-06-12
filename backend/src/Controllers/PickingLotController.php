<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\PickingLot;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Helpers\Response;

class PickingLotController
{
    private PickingLot $model;

    public function __construct()
    {
        $this->model = new PickingLot();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function show(string $id): void
    {
        $lot = $this->model->findById((int) $id);
        if (!$lot) {
            Response::error('Lote no encontrado.', 404);
            return;
        }
        Response::success($lot);
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['lotNumber']) || empty($data['storeId']) || empty($data['createdBy'])) {
            Response::error('lotNumber, storeId y createdBy son requeridos.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Lote actualizado.']);
    }

    /**
     * PATCH /picking-lots/{id}/conform
     * Al conformar, se incrementa el stock por cada ítem y se registra el movimiento.
     */
    public function conform(string $id, object $authUser): void
    {
        $lot = $this->model->findById((int) $id);
        if (!$lot || $lot['status'] !== 'PENDING') {
            Response::error('Lote no encontrado o no está en estado PENDING.', 400);
            return;
        }

        $stockModel    = new Stock();
        $movementModel = new StockMovement();

        foreach ($lot['items'] as $item) {
            $stockModel->upsert([
                'productId'        => $item['productId'],
                'warehouseId'      => $lot['warehouseId'],
                'warehouseSpaceId' => null,
                'quantity'         => $item['quantityToEnter'],
                'minStock'         => $item['minStockAlert'] ? 1 : 0,
            ]);

            $movementModel->create([
                'productId'        => $item['productId'],
                'warehouseId'      => $lot['warehouseId'],
                'warehouseSpaceId' => null,
                'type'             => 'IN',
                'reason'           => 'RECEPTION',
                'quantity'         => $item['quantityToEnter'],
                'referenceId'      => (int) $id,
                'createdBy'        => $authUser->user_id,
                'notes'            => "Conformación de lote #{$lot['lotNumber']}",
            ]);
        }

        $this->model->conform((int) $id, $authUser->user_id);
        Response::json(['message' => 'Lote conformado correctamente.']);
    }

    public function destroy(string $id, object $authUser): void
    {
        $lot = $this->model->findById((int) $id);
        if (!$lot) {
            Response::error('Lote no encontrado.', 404);
            return;
        }

        // Los lotes PENDING solo pueden eliminarse por un ADMIN (validación server-side)
        if ($lot['status'] === 'PENDING') {
            \App\Middleware\AuthMiddleware::requireRole($authUser, 'ADMIN');
        }

        // CONFORMED nunca se puede eliminar
        if ($lot['status'] === 'CONFORMED') {
            Response::error('No se puede eliminar un lote ya conformado.', 403);
            return;
        }

        $this->model->delete((int) $id);
        Response::noContent();
    }
}
