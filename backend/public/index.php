<?php
declare(strict_types=1);

// ============================================================
// CARGA DEL AUTOLOADER Y VARIABLES DE ENTORNO
// ============================================================
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

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
use App\Controllers\StoreController;
use App\Controllers\LocationController;
use App\Controllers\StockController;
use App\Controllers\PickingLotController;
use App\Controllers\DisincorporationController;
use App\Controllers\StockMovementController;
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
    route('POST',   '/categories',      fn() => (new CategoryController())->store());
    route('PUT',    '/categories/{id}', fn($params) => (new CategoryController())->update($params['id']));
    route('DELETE', '/categories/{id}', fn($params) => (new CategoryController())->destroy($params['id']));

    // --- Providers ---
    route('GET',    '/providers',       fn() => (new ProviderController())->index());
    route('POST',   '/providers',       fn() => (new ProviderController())->store());
    route('PUT',    '/providers/{id}',  fn($params) => (new ProviderController())->update($params['id']));
    route('DELETE', '/providers/{id}',  fn($params) => (new ProviderController())->destroy($params['id']));

    // --- Products ---
    route('GET',    '/products',        fn() => (new ProductController())->index());
    route('GET',    '/products/{id}',   fn($params) => (new ProductController())->show($params['id']));
    route('POST',   '/products',        fn() => (new ProductController())->store());
    route('PUT',    '/products/{id}',   fn($params) => (new ProductController())->update($params['id']));
    route('DELETE', '/products/{id}',   fn($params) => (new ProductController())->destroy($params['id']));

    // --- Stores ---
    route('GET',    '/stores',          fn() => (new StoreController())->index());
    route('POST',   '/stores',          fn() => (new StoreController())->store());
    route('PUT',    '/stores/{id}',     fn($params) => (new StoreController())->update($params['id']));
    route('DELETE', '/stores/{id}',     fn($params) => (new StoreController())->destroy($params['id']));

    // --- Locations ---
    route('GET',    '/locations',       fn() => (new LocationController())->index());
    route('POST',   '/locations',       fn() => (new LocationController())->store());
    route('DELETE', '/locations/{id}',  fn($params) => (new LocationController())->destroy($params['id']));

    // --- Stock ---
    route('GET',    '/stock',           fn() => (new StockController())->index());
    route('POST',   '/stock',           fn() => (new StockController())->upsert());
    route('POST',   '/stock/move',      fn() => (new StockController())->move($user));

    // --- PickingLots ---
    route('GET',    '/picking-lots',           fn() => (new PickingLotController())->index());
    route('POST',   '/picking-lots',           fn() => (new PickingLotController())->store());
    route('GET',    '/picking-lots/{id}',      fn($params) => (new PickingLotController())->show($params['id']));
    route('PUT',    '/picking-lots/{id}',      fn($params) => (new PickingLotController())->update($params['id']));
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

    // Si ninguna ruta hizo match
    Response::json(['error' => 'Endpoint no encontrado.'], 404);

} catch (\App\Exceptions\UnauthorizedException $e) {
    Response::json(['error' => $e->getMessage()], 401);
} catch (\Throwable $e) {
    error_log($e->getMessage());
    Response::json(['error' => 'Error interno del servidor.'], 500);
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
