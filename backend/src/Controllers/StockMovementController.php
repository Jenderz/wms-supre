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

        $page = isset($_GET['page']) ? (int) $_GET['page'] : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;
        $type = isset($_GET['type']) ? trim((string) $_GET['type']) : null;
        $warehouseId = isset($_GET['warehouseId']) && $_GET['warehouseId'] !== '' ? (int) $_GET['warehouseId'] : null;
        $productId = isset($_GET['productId']) && $_GET['productId'] !== '' ? (int) $_GET['productId'] : null;
        $dateFrom = isset($_GET['dateFrom']) ? trim((string) $_GET['dateFrom']) : null;
        $dateTo = isset($_GET['dateTo']) ? trim((string) $_GET['dateTo']) : null;

        // Modo retrocompatible para llamadas sin parámetros
        if ($page === null && $limit === null && empty($type) && $warehouseId === null && $productId === null && empty($dateFrom) && empty($dateTo)) {
            Response::success($this->model->getAll());
            return;
        }

        $result = $this->model->getPaginated(
            $page ?? 1,
            $limit ?? 50,
            $type,
            $warehouseId,
            $productId,
            $dateFrom,
            $dateTo
        );
        Response::success($result);
    }
}
