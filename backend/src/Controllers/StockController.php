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
        if (empty($data['productId']) || empty($data['storeId']) || !isset($data['quantity'])) {
            Response::error('productId, storeId y quantity son requeridos.', 400);
            return;
        }
        $this->model->upsert($data);
        Response::json(['message' => 'Stock actualizado.']);
    }
}
