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
            'iat'      => time(),
            'exp'      => time() + $expiration,
            'user_id'  => $user['id'],
            'username' => $user['username'],
            'name'     => $user['name'],
            'role'     => $user['role'],
        ];

        $token = JWT::encode($payload, $secret, 'HS256');

        unset($user['password_hash']);
        Response::json([
            'token' => $token,
            'user'  => $user,
        ]);
    }
}
