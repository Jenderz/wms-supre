<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Product;
use App\Helpers\Response;

class ProductController
{
    private Product $model;

    public function __construct()
    {
        $this->model = new Product();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function show(string $id): void
    {
        $product = $this->model->findById((int) $id);
        if (!$product) {
            Response::error('Producto no encontrado.', 404);
            return;
        }
        Response::success($product);
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['code']) || empty($data['name'])) {
            Response::error('code y name son requeridos.', 400);
            return;
        }
        // Si no viene categoryId, asignar automáticamente la categoría reservada del sistema
        if (empty($data['categoryId'])) {
            $data['categoryId'] = $this->model->getOrCreateDefaultCategoryId();
        }
        try {
            $id = $this->model->create($data);
            Response::created(['id' => $id]);
        } catch (\PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('El código de producto ya existe.', 409);
            } else {
                throw $e;
            }
        }
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        // Si no viene categoryId, asignar automáticamente la categoría reservada del sistema
        if (empty($data['categoryId'])) {
            $data['categoryId'] = $this->model->getOrCreateDefaultCategoryId();
        }
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Producto actualizado.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
