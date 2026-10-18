<?php
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/src/Config/Database.php';

use Dotenv\Dotenv;

if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

try {
    $db = \App\Config\Database::getConnection();

    // Create subcategories table if not exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS subcategories (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            category_id INT NOT NULL,
            name        VARCHAR(100) NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            UNIQUE KEY uk_subcategory_name (category_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE subcategories ADD UNIQUE KEY uk_subcategory_name (category_id, name);");
    } catch (\PDOException $e) {
        // Ignorar si ya existe
    }

    try {
        $db->exec("ALTER TABLE products ADD COLUMN subcategory_id INT NULL;");
        $db->exec("ALTER TABLE products ADD FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL;");
    } catch (\PDOException $e) {
        // Ignorar si ya existe
    }

    $db->exec("
        CREATE TABLE IF NOT EXISTS product_providers (
            product_id INT NOT NULL,
            provider_id   INT NOT NULL,
            PRIMARY KEY (product_id, provider_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (provider_id)   REFERENCES providers(id)   ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Ejecutar todas las migraciones SQL en backend/database/migrations/
    $migrationsDir = __DIR__ . '/database/migrations';
    if (is_dir($migrationsDir)) {
        $files = glob($migrationsDir . '/*.sql');
        sort($files);
        foreach ($files as $file) {
            $sql = file_get_contents($file);
            if (!empty(trim($sql))) {
                // Separar por sentencias evitando dejar result sets abiertos
                // Limpiar comentarios de bloque y de línea antes de separar
                $cleanSql = preg_replace('/--[^\r\n]*/', '', $sql);
                $statements = array_filter(array_map('trim', explode(';', $cleanSql)));
                
                $hasError = false;
                foreach ($statements as $stmtSql) {
                    if (empty($stmtSql)) continue;
                    try {
                        $stmt = $db->query($stmtSql);
                        if ($stmt instanceof \PDOStatement) {
                            $stmt->closeCursor();
                        }
                    } catch (\PDOException $e) {
                        // Ignorar errores comunes de idempotencia (columna/índice ya existente o DROP que no existe)
                        $msg = $e->getMessage();
                        if (
                            str_contains($msg, 'Duplicate') || 
                            str_contains($msg, 'already exists') || 
                            str_contains($msg, "Can't DROP") ||
                            str_contains($msg, 'Unknown column')
                        ) {
                            // Ignorable
                        } else {
                            echo "Aviso en " . basename($file) . ": " . $msg . "\n";
                            $hasError = true;
                        }
                    }
                }
                if (!$hasError) {
                    echo "Ejecutada migración: " . basename($file) . "\n";
                }
            }
        }
    }

    echo "Migration completed successfully.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

