<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Location;
use App\Helpers\Response;

class LocationController
{
    private Location $model;

    public function __construct()
    {
        $this->model = new Location();
    }

    public function index(): void
    {
        $storeId = isset($_GET['storeId']) ? (int) $_GET['storeId'] : null;
        Response::success($this->model->getAll($storeId));
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['storeId']) || empty($data['room']) || empty($data['shelf']) || empty($data['cubicle'])) {
            Response::error('storeId, room, shelf y cubicle son requeridos.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
