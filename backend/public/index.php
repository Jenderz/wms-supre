<?php
declare(strict_types=1);

// ============================================================
// CARGA DEL AUTOLOADER Y VARIABLES DE ENTORNO
// ============================================================
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
}

// ============================================================
// CORS — Debe ejecutarse ANTES de cualquier otra lógica
// ============================================================
$allowedOrigin = $_ENV['CORS_ORIGIN'] ?? '*';

header("Access-Control-Allow-Origin: {$allowedOrigin}");
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400'); // Cache preflight por 24h
header('Content-Type: application/json; charset=UTF-8');

// Petición Preflight — El navegador verifica los permisos antes de la real
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================================
// ENRUTADOR MANUAL
// ============================================================
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Con subdominio propio (api.supreparts.com) no hay prefijo /api.
// Las rutas llegan directamente como: /auth/login, /products, etc.
// Si en el futuro usas una subcarpeta, descomenta y ajusta:
// $basePath = '';
// if ($basePath !== '' && str_starts_with($uri, $basePath)) {
//     $uri = substr($uri, strlen($basePath));
// }

// Inicializar controladores (lazy si se necesitan)
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Controllers\CategoryController;
use App\Controllers\ProviderController;
use App\Controllers\ProductController;
use App\Controllers\WarehouseController;
use App\Controllers\WarehouseSpaceController;
use App\Controllers\SpaceGroupController;
use App\Controllers\SpaceTypeController;
use App\Controllers\StockController;
use App\Controllers\PickingLotController;
use App\Controllers\DisincorporationController;
use App\Controllers\AccessKeyController;
use App\Controllers\StockMovementController;
use App\Controllers\DispatchController;
use App\Controllers\MinStockController;
use App\Controllers\TransferPickingController;
use App\Controllers\RdiRecordController;
use App\Controllers\DamageRecordController;
use App\Middleware\AuthMiddleware;
use App\Helpers\Response;

// ============================================================
// DEFINICIÓN DE RUTAS
// ============================================================
try {
    // --- Auth (pública) ---
    if ($uri === '/auth/login' && $method === 'POST') {
        (new AuthController())->login();
        exit;
    }

    // --- Rutas protegidas (requieren JWT válido) ---
    $user = AuthMiddleware::verify(); // Lanza excepción si el token es inválido

    if ($uri === '/auth/verify-password' && $method === 'POST') {
        (new AuthController())->verifyPassword($user);
        exit;
    }

    // --- Users ---
    route('GET',    '/users',           fn() => (new UserController())->index());
    route('POST',   '/users',           fn() => (new UserController())->store());
    route('PUT',    '/users/{id}',      fn($params) => (new UserController())->update($params['id']));
    route('DELETE', '/users/{id}',      fn($params) => (new UserController())->destroy($params['id']));

    // --- Categories ---
    route('GET',    '/categories',      fn() => (new CategoryController())->index());
    route('GET',    '/categories/export', fn() => (new CategoryController())->export());
    route('POST',   '/categories/import', fn() => (new CategoryController())->import());
    route('POST',   '/categories',      fn() => (new CategoryController())->store());
    route('PUT',    '/categories/{id}', fn($params) => (new CategoryController())->update($params['id']));
    route('DELETE', '/categories/{id}', fn($params) => (new CategoryController())->destroy($params['id']));

    // --- Providers ---
    route('GET',    '/providers',       fn() => (new ProviderController())->index());
    route('POST',   '/providers',       fn() => (new ProviderController())->store());
    route('PUT',    '/providers/{id}',  fn($params) => (new ProviderController())->update($params['id']));
    route('DELETE', '/providers/{id}',  fn($params) => (new ProviderController())->destroy($params['id']));

    // --- Products ---
    route('GET',    '/products',              fn() => (new ProductController())->index());
    route('GET',    '/products/{id}',         fn($params) => (new ProductController())->show($params['id']));
    route('POST',   '/products/batch',        fn() => (new ProductController())->batchAction());
    route('POST',   '/products',              fn() => (new ProductController())->store());
    route('PUT',    '/products/{id}',         fn($params) => (new ProductController())->update($params['id']));
    route('DELETE', '/products/{id}',         fn($params) => (new ProductController())->destroy($params['id']));

    // --- Warehouses ---
    route('GET',    '/warehouses',          fn() => (new WarehouseController())->index());
    route('POST',   '/warehouses',          fn() => (new WarehouseController())->store());
    route('PUT',    '/warehouses/{id}',     fn($params) => (new WarehouseController())->update($params['id']));
    route('DELETE', '/warehouses/{id}',     fn($params) => (new WarehouseController())->destroy($params['id']));

    // --- Space Types ---
    route('GET',    '/space-types',         fn() => (new SpaceTypeController())->index());
    route('POST',   '/space-types',         fn() => (new SpaceTypeController())->store());
    route('PUT',    '/space-types/{id}',    fn($params) => (new SpaceTypeController())->update($params['id']));
    route('DELETE', '/space-types/{id}',    fn($params) => (new SpaceTypeController())->destroy($params['id']));

    // --- Warehouse Spaces ---
    route('GET',    '/warehouse-spaces',       fn() => (new WarehouseSpaceController())->index());
    route('POST',   '/warehouse-spaces',       fn() => (new WarehouseSpaceController())->store());
    route('PUT',    '/warehouse-spaces/{id}',  fn($params) => (new WarehouseSpaceController())->update($params['id']));
    route('DELETE', '/warehouse-spaces/{id}',  fn($params) => (new WarehouseSpaceController())->destroy($params['id']));

    // --- Space Groups ---
    route('GET',    '/space-groups',           fn() => (new SpaceGroupController())->index());
    route('POST',   '/space-groups',           fn() => (new SpaceGroupController())->store());
    route('PUT',    '/space-groups/{id}',      fn($params) => (new SpaceGroupController())->update($params['id']));
    route('DELETE', '/space-groups/{id}',      fn($params) => (new SpaceGroupController())->destroy($params['id']));

    // --- Stock ---
    route('GET',    '/stock',           fn() => (new StockController())->index());
    route('POST',   '/stock',           fn() => (new StockController())->upsert());
    route('POST',   '/stock/move',      fn() => (new StockController())->move($user));

    // --- PickingLots ---
    route('GET',    '/picking-lots',           fn() => (new PickingLotController())->index());
    route('POST',   '/picking-lots',           fn() => (new PickingLotController())->store());
    route('GET',    '/picking-lots/{id}',      fn($params) => (new PickingLotController())->show($params['id']));
    route('PUT',    '/picking-lots/{id}',      fn($params) => (new PickingLotController())->update($params['id']));
    route('PATCH',  '/picking-lots/{id}/status',  fn($params) => (new PickingLotController())->updateStatus($params['id']));
    route('PATCH',  '/picking-lots/{id}/conform', fn($params) => (new PickingLotController())->conform($params['id'], $user));
    route('DELETE', '/picking-lots/{id}',      fn($params) => (new PickingLotController())->destroy($params['id'], $user));

    // --- Disincorporations ---
    route('GET',    '/disincorporations',           fn() => (new DisincorporationController())->index());
    route('POST',   '/disincorporations',           fn() => (new DisincorporationController())->store($user));
    route('GET',    '/disincorporations/{id}',      fn($params) => (new DisincorporationController())->show($params['id']));
    route('PATCH',  '/disincorporations/{id}/approve', fn($params) => (new DisincorporationController())->approve($params['id'], $user));
    route('PATCH',  '/disincorporations/{id}/reject',  fn($params) => (new DisincorporationController())->reject($params['id'], $user));

    // --- Stock Movements ---
    route('GET',    '/movements',       fn() => (new StockMovementController())->index($user));

    // --- Access Keys (Llaves) ---
    route('GET',    '/locks',                fn() => (new AccessKeyController())->index());
    route('GET',    '/locks/status',         fn() => (new AccessKeyController())->status());
    route('POST',   '/locks',                fn() => (new AccessKeyController())->store());
    route('PUT',    '/locks/{id}',           fn($params) => (new AccessKeyController())->update($params['id']));
    route('DELETE', '/locks/{id}',           fn($params) => (new AccessKeyController())->destroy($params['id']));
    route('POST',   '/locks/verify',         fn() => (new AccessKeyController())->verify());

    // --- Dispatches ---
    route('GET',    '/dispatches/sync-stock', fn() => (new DispatchController())->syncStock());
    route('POST',   '/dispatches/sync-stock', fn() => (new DispatchController())->syncStock());
    route('GET',    '/dispatches',           fn() => (new DispatchController())->index());
    route('POST',   '/dispatches',           fn() => (new DispatchController())->store($user));
    route('GET',    '/dispatches/{id}',      fn($params) => (new DispatchController())->show($params['id']));
    route('PUT',    '/dispatches/{id}',      fn($params) => (new DispatchController())->update($params['id']));
    route('PATCH',  '/dispatches/{id}/status', fn($params) => (new DispatchController())->updateStatus($params['id'], $user));
    route('DELETE', '/dispatches/{id}',      fn($params) => (new DispatchController())->destroy($params['id']));

    // --- Min Stock ---
    route('GET',    '/min-stock/general',    fn() => (new MinStockController())->general());
    route('GET',    '/min-stock/dispatch',   fn() => (new MinStockController())->dispatch());
    route('GET',    '/min-stock/archived',   fn() => (new MinStockController())->archived());
    route('POST',   '/min-stock/archive',    fn() => (new MinStockController())->archive($user));
    route('POST',   '/min-stock/unarchive',  fn() => (new MinStockController())->unarchive());

    // --- Transfer Pickings ---
    route('GET',    '/transfer-pickings',           fn() => (new TransferPickingController())->index());
    route('POST',   '/transfer-pickings',           fn() => (new TransferPickingController())->store($user));
    route('GET',    '/transfer-pickings/{id}',      fn($params) => (new TransferPickingController())->show($params['id']));
    route('PUT',    '/transfer-pickings/{id}',      fn($params) => (new TransferPickingController())->update($params['id'], $user));
    route('PATCH',  '/transfer-pickings/{id}/status', fn($params) => (new TransferPickingController())->updateStatus($params['id'], $user));
    route('DELETE', '/transfer-pickings/{id}',      fn($params) => (new TransferPickingController())->destroy($params['id'], $user));

    // --- RDI Records ---
    route('GET',    '/rdi-records',           fn() => (new RdiRecordController())->index());
    route('POST',   '/rdi-records',           fn() => (new RdiRecordController())->store($user));
    route('GET',    '/rdi-records/{id}',      fn($params) => (new RdiRecordController())->show($params['id']));
    route('PATCH',  '/rdi-records/{id}/status', fn($params) => (new RdiRecordController())->updateStatus($params['id'], $user));
    route('DELETE', '/rdi-records/{id}',      fn($params) => (new RdiRecordController())->destroy($params['id'], $user));

    // --- Damage Records ---
    route('GET',    '/damage-records',           fn() => (new DamageRecordController())->index());
    route('POST',   '/damage-records',           fn() => (new DamageRecordController())->store($user));
    route('GET',    '/damage-records/{id}',      fn($params) => (new DamageRecordController())->show($params['id']));
    route('PATCH',  '/damage-records/{id}/status', fn($params) => (new DamageRecordController())->updateStatus($params['id'], $user));
    route('DELETE', '/damage-records/{id}',      fn($params) => (new DamageRecordController())->destroy($params['id'], $user));

    // Si ninguna ruta hizo match
    Response::json(['error' => 'Endpoint no encontrado.'], 404);

} catch (\App\Exceptions\UnauthorizedException $e) {
    Response::json(['error' => $e->getMessage()], 401);
} catch (\Throwable $e) {
    error_log($e->getMessage());
    Response::json([
        'error' => 'Error interno del servidor.',
        'debug_message' => $e->getMessage(),
        'debug_file' => $e->getFile(),
        'debug_line' => $e->getLine()
    ], 500);
}

// ============================================================
// FUNCIÓN AUXILIAR DE ENRUTAMIENTO
// ============================================================
/**
 * Compara la URI actual con un patrón de ruta, incluyendo segmentos dinámicos {param}.
 * Ejecuta el callback si hay coincidencia.
 */
function route(string $routeMethod, string $pattern, callable $callback): void
{
    global $uri, $method;

    if ($method !== $routeMethod) return;

    $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';

    if (preg_match($regex, $uri, $matches)) {
        $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        $callback($params);
        exit;
    }
}
