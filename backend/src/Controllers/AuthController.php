<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Helpers\Response;
use Firebase\JWT\JWT;

class AuthController
{
    public function login(): void
    {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['username']) || empty($input['password'])) {
            Response::error('Usuario y contraseña son requeridos.', 400);
            return;
        }

        $userModel = new User();
        $user = $userModel->findByUsername($input['username']);

        if (!$user || !password_verify($input['password'], $user['password_hash'])) {
            Response::error('Credenciales inválidas.', 401);
            return;
        }

        $secret     = $_ENV['JWT_SECRET'] ?? 'secret';
        $expiration = (int) ($_ENV['JWT_EXPIRATION'] ?? 86400);

        $payload = [
            'iat'            => time(),
            'exp'            => time() + $expiration,
            'user_id'        => $user['id'],
            'username'       => $user['username'],
            'name'           => $user['name'],
            'role'           => $user['role'],
            'permissions'    => $user['permissions'] ?? [],    // Requerido por el Sidebar para chequear VIEW_STOCK_MOVEMENTS, etc.
            'assignedStores' => $user['assignedStores'] ?? [], // Requerido por el filtro de tiendas del Depósito
        ];

        $token = JWT::encode($payload, $secret, 'HS256');

        unset($user['password_hash']);
        Response::json([
            'token' => $token,
            'user'  => $user,
        ]);
    }

    public function verifyPassword(object $authUser): void
    {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['password'])) {
            Response::error('La contraseña es requerida.', 400);
            return;
        }

        // Permitimos que solo administradores puedan verificar
        if ($authUser->role !== 'ADMIN') {
            Response::error('Acceso denegado: Se requiere rol de Administrador.', 403);
            return;
        }

        $userModel = new User();
        $user = $userModel->findByUsername($authUser->username);

        if (!$user || !password_verify($input['password'], $user['password_hash'])) {
            Response::error('Contraseña incorrecta.', 401);
            return;
        }

        Response::json(['message' => 'Contraseña verificada correctamente.', 'success' => true]);
    }
}
