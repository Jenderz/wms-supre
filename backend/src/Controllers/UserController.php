<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Exceptions\UnauthorizedException;

class UserController
{
    private User $model;

    public function __construct()
    {
        $this->model = new User();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name']) || empty($data['username']) || empty($data['password']) || empty($data['role'])) {
            Response::error('name, username, password y role son requeridos.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Usuario actualizado.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
