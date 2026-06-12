<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Category;
use App\Exceptions\ValidationException;
use App\Helpers\Response;

class CategoryController
{
    private Category $model;

    public function __construct()
    {
        $this->model = new Category();
    }

    public function index(): void
    {
        Response::success($this->model->getAll());
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name']) || empty($data['code'])) {
            Response::error('Los campos "name" y "code" son requeridos.', 400);
            return;
        }

        try {
            $id = $this->model->create($data);
            Response::created(['id' => $id]);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name']) || empty($data['code'])) {
            Response::error('Los campos "name" y "code" son requeridos.', 400);
            return;
        }

        try {
            $this->model->update((int) $id, $data);
            Response::json(['message' => 'Categoría actualizada.']);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(string $id): void
    {
        $intId    = (int) $id;
        $category = $this->model->findById($intId);

        if (!$category) {
            Response::error('Categoría no encontrada.', 404);
            return;
        }

        // Protección 1: categoría reservada del sistema
        if (($category['code'] ?? '') === 'SIN-CAT') {
            Response::error(
                'La categoría "Sin Categoría" es una categoría reservada del sistema y no puede eliminarse.',
                403
            );
            return;
        }

        // Protección 2: no eliminar si tiene productos asociados
        if ($this->model->hasProducts($intId)) {
            Response::error(
                'No es posible eliminar esta categoría porque tiene productos asociados. ' .
                'Reasigna o elimina los productos antes de continuar.',
                409
            );
            return;
        }

        $this->model->delete($intId);
        Response::noContent();
    }

    // ----------------------------------------------------------------
    // EXPORT / IMPORT CSV
    // ----------------------------------------------------------------

    public function export(): void
    {
        $categories = $this->model->getAll();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=categorias.csv');
        $output = fopen('php://output', 'w');

        // UTF-8 BOM para compatibilidad con Excel
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

        fputcsv($output, ['Codigo', 'Categoria', 'SubCategorias']);

        foreach ($categories as $cat) {
            $subNames = array_column($cat['subcategories'] ?? [], 'name');
            fputcsv($output, [
                $cat['code'],
                $cat['name'],
                implode(';', $subNames),
            ]);
        }
        fclose($output);
        exit;
    }

    public function import(): void
    {
        if (!isset($_FILES['file'])) {
            Response::error('No se recibió ningún archivo.', 400);
            return;
        }

        $file = $_FILES['file']['tmp_name'];
        if (!$file) {
            Response::error('Error al cargar el archivo.', 400);
            return;
        }

        $handle = fopen($file, 'r');

        // Detectar y saltar BOM si existe
        $bom = fread($handle, 3);
        if ($bom !== chr(0xEF) . chr(0xBB) . chr(0xBF)) {
            rewind($handle);
        }

        fgetcsv($handle); // Saltar cabecera

        $count  = 0;
        $errors = [];

        try {
            while (($row = fgetcsv($handle)) !== false) {
                // Columnas: Codigo | Categoria | SubCategorias
                if (empty($row[0]) || empty($row[1])) {
                    continue;
                }

                $data = [
                    'code'          => trim($row[0]),
                    'name'          => trim($row[1]),
                    'description'   => '',
                    'qrCode'        => '',
                    'isFractional'  => false,
                    'fractionType'  => '',
                    'subcategories' => [],
                ];

                // Sub-categorías separadas por ";"
                if (!empty($row[2])) {
                    $seen = [];
                    foreach (explode(';', $row[2]) as $sName) {
                        $sName = trim($sName);
                        if ($sName === '') {
                            continue;
                        }
                        // Deduplicar durante la importación (case-insensitive)
                        $key = mb_strtolower($sName);
                        if (!isset($seen[$key])) {
                            $data['subcategories'][] = ['name' => $sName];
                            $seen[$key]              = true;
                        }
                    }
                }

                try {
                    $existing = $this->model->findByCode($data['code']);
                    if ($existing) {
                        $this->model->update((int) $existing['id'], $data);
                    } else {
                        $this->model->create($data);
                    }
                    $count++;
                } catch (ValidationException $e) {
                    $errors[] = "Fila [{$data['code']}]: " . $e->getMessage();
                }
            }

            fclose($handle);

            $response = ['message' => "Se procesaron {$count} categorías con éxito."];
            if (!empty($errors)) {
                $response['warnings'] = $errors;
            }
            Response::json($response);

        } catch (\Exception $e) {
            if ($handle) {
                fclose($handle);
            }
            Response::error('Error al importar: ' . $e->getMessage(), 500);
        }
    }
}
