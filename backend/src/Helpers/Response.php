<?php
declare(strict_types=1);

namespace App\Helpers;

class Response
{
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function success(mixed $data, int $status = 200): void
    {
        self::json(['data' => $data], $status);
    }

    public static function created(mixed $data): void
    {
        self::json(['data' => $data], 201);
    }

    public static function error(string $message, int $status = 400): void
    {
        self::json(['error' => $message], $status);
    }

    public static function noContent(): void
    {
        http_response_code(204);
    }
}
