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
        $page = isset($_GET['page']) ? (int) $_GET['page'] : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;
        $search = isset($_GET['search']) ? trim((string) $_GET['search']) : null;
        $categoryId = isset($_GET['categoryId']) && $_GET['categoryId'] !== '' ? (int) $_GET['categoryId'] : null;

        // Si no se solicitan parámetros de paginación o búsqueda, mantenemos compatibilidad total
        // retornando la lista completa directamente en data: [...]
        if ($page === null && $limit === null && empty($search) && $categoryId === null) {
            Response::success($this->model->getAll());
            return;
        }

        $result = $this->model->getPaginated($page ?? 1, $limit ?? 50, $search, $categoryId);
        Response::success($result);
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

    public function batchAction(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        $action     = $data['action']     ?? '';
        $productIds = $data['productIds'] ?? [];
        $value      = $data['value']      ?? null;

        if (empty($productIds) || !is_array($productIds)) {
            Response::error('productIds debe ser un array no vacío.', 400);
            return;
        }

        $validActions = ['delete', 'setCategory', 'setSubcategory', 'setProvider', 'addWarehouse'];
        if (!in_array($action, $validActions, true)) {
            Response::error("Acción '{$action}' no reconocida.", 400);
            return;
        }

        try {
            switch ($action) {
                case 'delete':
                    $this->model->batchDelete($productIds);
                    break;

                case 'setCategory':
                    if (empty($value)) {
                        Response::error('Se requiere value (categoryId).', 400);
                        return;
                    }
                    $this->model->batchSetCategory($productIds, (int) $value);
                    break;

                case 'setSubcategory':
                    // value puede ser null para quitar subcategoría
                    $this->model->batchSetSubcategory($productIds, $value !== null ? (int) $value : null);
                    break;

                case 'setProvider':
                    if (empty($value)) {
                        Response::error('Se requiere value (providerId).', 400);
                        return;
                    }
                    $this->model->batchSetProvider($productIds, (int) $value);
                    break;

                case 'addWarehouse':
                    if (empty($value)) {
                        Response::error('Se requiere value (warehouseId).', 400);
                        return;
                    }
                    $this->model->batchAddWarehouse($productIds, (int) $value);
                    break;
            }

            Response::json(['message' => 'Operación completada.', 'affected' => count($productIds)]);
        } catch (\PDOException $e) {
            Response::error('Error de base de datos: ' . $e->getMessage(), 500);
        }
    }
}
