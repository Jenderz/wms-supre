<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Provider;
use App\Helpers\Response;
use Exception;

class ProviderController
{
    private Provider $providerModel;

    public function __construct()
    {
        $this->providerModel = new Provider();
    }

    public function index(): void
    {
        try {
            $providers = $this->providerModel->getAll();
            Response::json($providers);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void
    {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['code']) || empty($input['name'])) {
            Response::error('Código y nombre son requeridos.', 400);
            return;
        }

        try {
            $provider = $this->providerModel->create($input);
            Response::json($provider, 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function update(string $id): void
    {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['code']) || empty($input['name'])) {
            Response::error('Código y nombre son requeridos.', 400);
            return;
        }

        try {
            $provider = $this->providerModel->update((int) $id, $input);
            Response::json($provider);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function destroy(string $id): void
    {
        try {
            $this->providerModel->delete((int) $id);
            Response::json(['message' => 'Proveedor eliminado extiosamente.']);
        } catch (Exception $e) {
            Response::error('Error eliminando el proveedor. '. $e->getMessage(), 400);
        }
    }
}
