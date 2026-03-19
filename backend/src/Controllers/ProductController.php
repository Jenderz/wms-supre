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
        if (empty($data['code']) || empty($data['name']) || empty($data['categoryId'])) {
            Response::error('code, name y categoryId son requeridos.', 400);
            return;
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
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Producto actualizado.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }
}
