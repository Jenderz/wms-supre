<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\StockMovement;
use App\Helpers\Response;

class StockMovementController
{
    private StockMovement $model;

    public function __construct()
    {
        $this->model = new StockMovement();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }
}
