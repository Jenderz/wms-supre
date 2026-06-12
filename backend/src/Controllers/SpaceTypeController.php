<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\SpaceType;
use App\Helpers\Response;

class SpaceTypeController
{
    private SpaceType $model;

    public function __construct()
    {
        $this->model = new SpaceType();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            Response::error('name es requerido.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            Response::error('name es requerido.', 400);
            return;
        }
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Tipo de espacio actualizado.']);
    }

    public function destroy(string $id): void
    {
        try {
            $this->model->delete((int) $id);
            Response::noContent();
        } catch (\PDOException $e) {
            // El restricto prevendrá que borre un tipo de espacio en uso
            if ($e->getCode() == '23000') {
               Response::error('No se puede eliminar porque este tipo de espacio está en uso.', 409);
            } else {
               Response::error('Error al intentar eliminar.', 500);
            }
        }
    }
}
