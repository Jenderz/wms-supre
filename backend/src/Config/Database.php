<?php
declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    private function __construct() {}
    private function __clone() {}

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $host     = $_ENV['DB_HOST']     ?? '127.0.0.1';
            $port     = $_ENV['DB_PORT']     ?? '3306';
            $database = $_ENV['DB_DATABASE'] ?? 'supre_wms';
            $username = $_ENV['DB_USERNAME'] ?? 'root';
            $password = $_ENV['DB_PASSWORD'] ?? '';

            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

            $options = [
                // Lanzar excepciones en errores (esencial para try/catch en el API)
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                // Retornar resultados como arrays asociativos para serializar a JSON
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Preparación nativa del servidor: protección real contra SQL Injection
                PDO::ATTR_EMULATE_PREPARES   => false,
                // Retorna enteros de PHP como enteros, no como strings
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ];

            try {
                self::$instance = new PDO($dsn, $username, $password, $options);
            } catch (PDOException $e) {
                error_log('Database connection error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['error' => 'No se pudo conectar a la base de datos.']);
                exit;
            }
        }

        return self::$instance;
    }
}
