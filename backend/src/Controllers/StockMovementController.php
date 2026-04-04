<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\StockMovement;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

class StockMovementController
{
    private StockMovement $model;

    public function __construct()
    {
        $this->model = new StockMovement();
    }

    /**
     * GET /movements
     * Requiere rol ADMIN o permiso VIEW_STOCK_MOVEMENTS
     */
    public function index(object $authUser): void
    {
        // Verificar acceso: ADMIN siempre puede, otros necesitan el permiso explícito
        $hasPermission = $authUser->role === 'ADMIN'
            || in_array('VIEW_STOCK_MOVEMENTS', (array) ($authUser->permissions ?? []), true);

        if (!$hasPermission) {
            Response::json(['error' => 'No tienes permiso para ver el historial de movimientos.'], 403);
            return;
        }

        Response::success($this->model->getAll());
    }
}
