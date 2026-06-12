<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Stock;
use App\Helpers\Response;

class StockController
{
    private Stock $model;

    public function __construct()
    {
        $this->model = new Stock();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function upsert(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['productId']) || empty($data['warehouseId']) || !isset($data['quantity'])) {
            Response::error('productId, warehouseId y quantity son requeridos.', 400);
            return;
        }
        $this->model->upsert($data);
        Response::json(['message' => 'Stock actualizado.']);
    }

    public function move(object $authUser): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['productId']) || empty($data['warehouseId']) || empty($data['toLocationId']) || empty($data['quantity'])) {
            Response::error('productId, warehouseId, toLocationId y quantity son requeridos.', 400);
            return;
        }

        $fromLocationId = isset($data['fromLocationId']) ? (int) $data['fromLocationId'] : null;
        
        $this->model->moveStock(
            (int)$data['productId'], 
            (int)$data['warehouseId'], 
            $fromLocationId, 
            (int)$data['toLocationId'], 
            (float)$data['quantity'],
            (int)$authUser->user_id
        );

        Response::json(['message' => 'Stock movido exitosamente.']);
    }
}
