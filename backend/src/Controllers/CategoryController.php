<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Category;
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
            Response::error('name y code son requeridos.', 400);
            return;
        }
        $id = $this->model->create($data);
        Response::created(['id' => $id]);
    }

    public function update(string $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $this->model->update((int) $id, $data);
        Response::json(['message' => 'Categoría actualizada.']);
    }

    public function destroy(string $id): void
    {
        $this->model->delete((int) $id);
        Response::noContent();
    }

    public function export(): void
    {
        $categories = $this->model->getAll();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=categorias.csv');
        $output = fopen('php://output', 'w');
        
        // UTF-8 BOM para compatibilidad con Excel
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        
        fputcsv($output, ['Nombre', 'Codigo', 'Descripcion', 'CodigoQR', 'EsFraccionable', 'TipoFraccion', 'Subcategorias']);
        
        foreach ($categories as $cat) {
            $subNames = array_column($cat['subcategories'] ?? [], 'name');
            fputcsv($output, [
                $cat['name'],
                $cat['code'],
                $cat['description'] ?? '',
                $cat['qrCode'] ?? '',
                $cat['isFractional'] ? '1' : '0',
                $cat['fractionType'] ?? '',
                implode(';', $subNames)
            ]);
        }
        fclose($output);
        exit;
    }

    public function import(): void
    {
        if (!isset($_FILES['file'])) {
            Response::error('No se recibió ningún archivo.');
            return;
        }

        $file = $_FILES['file']['tmp_name'];
        if (!$file) {
            Response::error('Error al cargar el archivo.');
            return;
        }

        $handle = fopen($file, 'r');
        
        // Detectar y saltar BOM si existe
        $bom = fread($handle, 3);
        if ($bom !== chr(0xEF) . chr(0xBB) . chr(0xBF)) {
            rewind($handle);
        }

        $headers = fgetcsv($handle); // Saltar cabeceras
        
        $count = 0;
        try {
            while (($row = fgetcsv($handle)) !== false) {
                if (empty($row[0]) || empty($row[1])) continue;
                
                $data = [
                    'name'          => $row[0],
                    'code'          => $row[1],
                    'description'   => $row[2] ?? '',
                    'qrCode'        => $row[3] ?? '',
                    'isFractional'  => ($row[4] ?? '0') === '1',
                    'fractionType'  => $row[5] ?? '',
                    'subcategories' => []
                ];
                
                if (!empty($row[6])) {
                    $subs = explode(';', $row[6]);
                    foreach ($subs as $sName) {
                        $sName = trim($sName);
                        if ($sName !== '') {
                            $data['subcategories'][] = ['name' => $sName];
                        }
                    }
                }
                
                $existing = $this->model->findByCode($data['code']);
                if ($existing) {
                    // Si existe, actualizamos. Nota: el update requiere 'id' separado.
                    $this->model->update((int)$existing['id'], $data);
                } else {
                    $this->model->create($data);
                }
                $count++;
            }
            fclose($handle);
            Response::json(['message' => "Se procesaron $count categorías con éxito."]);
        } catch (\Exception $e) {
            if ($handle) fclose($handle);
            Response::error('Error al importar: ' . $e->getMessage());
        }
    }
}
