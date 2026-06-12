<?php
require __DIR__ . '/src/Config/Database.php';

try {
    $db = \App\Config\Database::getConnection();

    // Create subcategories table
    $db->exec("
        CREATE TABLE IF NOT EXISTS subcategories (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            category_id INT NOT NULL,
            name        VARCHAR(100) NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            UNIQUE KEY uk_subcategory_name (category_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Agregar el UNIQUE KEY si la tabla ya existia sin el (idempotente)
    try {
        $db->exec("ALTER TABLE subcategories ADD UNIQUE KEY uk_subcategory_name (category_id, name);");
    } catch (\PDOException $e) {
        // Ignorar: el indice ya existe (codigo 1061)
    }

    // Add subcategory_id to products
    // We ignore error if column already exists
    try {
        $db->exec("ALTER TABLE products ADD COLUMN subcategory_id INT NULL;");
        $db->exec("ALTER TABLE products ADD FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL;");
    } catch (\PDOException $e) {
        // Ignore, probably already exists
    }

    // Create product_providers
    $db->exec("
        CREATE TABLE IF NOT EXISTS product_providers (
            product_id INT NOT NULL,
            provider_id   INT NOT NULL,
            PRIMARY KEY (product_id, provider_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (provider_id)   REFERENCES providers(id)   ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    echo "Migration completed successfully.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
