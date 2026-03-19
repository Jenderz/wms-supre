<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Disincorporation;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

class DisincorporationController
{
    private Disincorporation $model;

    public function __construct()
    {
        $this->model = new Disincorporation();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function show(string $id): void
    {
        $record = $this->model->findById((int) $id);
        if (!$record) {
            Response::error('Desincorporación no encontrada.', 404);
            return;
        }
        Response::success($record);
    }

    public function store(object $authUser): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['storeId'])) {
            Response::error('storeId es requerido.', 400);
            return;
        }
        $data['createdBy'] = $authUser->user_id;
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    /**
     * PATCH /disincorporations/{id}/approve
     * Solo roles ADMIN y DESINCORPORACION pueden aprobar.
     * Al aprobar, reduce el stock por cada ítem y registra movimientos de salida.
     */
    public function approve(string $id, object $authUser): void
    {
        AuthMiddleware::requireRole($authUser, 'ADMIN', 'DESINCORPORACION');

        $record = $this->model->findById((int) $id);
        if (!$record || $record['status'] !== 'DRAFT') {
            Response::error('Desincorporación no encontrada o ya procesada.', 400);
            return;
        }

        $stockModel    = new Stock();
        $movementModel = new StockMovement();

        foreach ($record['items'] as $item) {
            $stockModel->adjustQuantity(
                (int) $item['productId'],
                (int) $record['storeId'],
                isset($item['locationId']) ? (int) $item['locationId'] : null,
                -(float) $item['quantity'] // Resta stock
            );

            $movementModel->create([
                'productId'   => $item['productId'],
                'storeId'     => $record['storeId'],
                'locationId'  => $item['locationId'] ?? null,
                'type'        => 'OUT',
                'reason'      => 'DISINCORPORATION',
                'quantity'    => $item['quantity'],
                'referenceId' => (int) $id,
                'createdBy'   => $authUser->user_id,
                'notes'       => $item['reason'] ?? 'Desincorporación aprobada',
            ]);
        }

        $this->model->changeStatus((int) $id, 'APPROVED', $authUser->user_id);
        Response::json(['message' => 'Desincorporación aprobada y stock actualizado.']);
    }

    public function reject(string $id, object $authUser): void
    {
        AuthMiddleware::requireRole($authUser, 'ADMIN', 'DESINCORPORACION');

        $record = $this->model->findById((int) $id);
        if (!$record || $record['status'] !== 'DRAFT') {
            Response::error('Desincorporación no encontrada o ya procesada.', 400);
            return;
        }

        $this->model->changeStatus((int) $id, 'REJECTED', $authUser->user_id);
        Response::json(['message' => 'Desincorporación rechazada.']);
    }
}
