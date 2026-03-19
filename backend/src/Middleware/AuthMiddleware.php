<?php
declare(strict_types=1);

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Exceptions\UnauthorizedException;

class AuthMiddleware
{
    /**
     * Verifica el JWT del header Authorization: Bearer <token>
     * Retorna el payload del token como objeto stdClass.
     * @throws UnauthorizedException si el token es inválido, expirado o ausente.
     */
    public static function verify(): object
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            throw new UnauthorizedException('Token de autenticación requerido.');
        }

        $token = substr($authHeader, 7);
        $secret = $_ENV['JWT_SECRET'] ?? 'fallback_secret';

        try {
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            return $decoded;
        } catch (\Exception $e) {
            throw new UnauthorizedException('Token inválido o expirado.');
        }
    }

    /**
     * Lanza excepción si el usuario no tiene el rol requerido.
     */
    public static function requireRole(object $user, string ...$roles): void
    {
        if (!in_array($user->role, $roles, true)) {
            throw new UnauthorizedException('No tienes permisos para realizar esta acción.');
        }
    }
}
