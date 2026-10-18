<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class MinStockModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Purga automáticamente los registros archivados cuya fecha límite ya venció.
     */
    public function purgeExpiredArchives(): void
    {
        $this->db->exec("DELETE FROM min_stock_archived WHERE archive_deadline_at <= NOW()");
    }

    /**
     * Stock Mínimo General:
     * Productos con min_stock > 0 cuyo stock total en el almacén es <= min_stock
     * y no están en min_stock_archived.
     */
    public function getGeneralMinStock(?int $warehouseId = null, ?string $stockFilter = null, ?string $search = null): array
    {
        $this->purgeExpiredArchives();

        $where = [
            "NOT EXISTS (
                SELECT 1 FROM min_stock_archived msa 
                WHERE msa.product_id = p.id AND msa.warehouse_id = w.id
            )"
        ];
        $params = [];

        if ($warehouseId !== null) {
            $where[] = "w.id = :wid";
            $params[':wid'] = $warehouseId;
        }

        if ($search !== null && trim($search) !== '') {
            $where[] = "(p.name LIKE :search_name OR p.code LIKE :search_code)";
            $params[':search_name'] = "%" . trim($search) . "%";
            $params[':search_code'] = "%" . trim($search) . "%";
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $having = ["MAX(COALESCE(s.min_stock, 0)) > 0", "COALESCE(SUM(s.quantity), 0) <= MAX(COALESCE(s.min_stock, 0))"];
        if ($stockFilter === 'zero') {
            $having[] = "COALESCE(SUM(s.quantity), 0) = 0";
        } elseif ($stockFilter === 'low') {
            $having[] = "COALESCE(SUM(s.quantity), 0) > 0";
        }

        $havingClause = 'HAVING ' . implode(' AND ', $having);

        $sql = "SELECT 
                    p.id AS productId,
                    p.code AS productCode,
                    p.name AS productName,
                    p.image_url AS imageUrl,
                    p.category_id AS categoryId,
                    c.name AS categoryName,
                    w.id AS warehouseId,
                    w.name AS warehouseName,
                    COALESCE(SUM(s.quantity), 0) AS currentStock,
                    MAX(COALESCE(s.min_stock, 0)) AS minStock,
                    (
                        SELECT MAX(sm.created_at)
                        FROM stock_movements sm
                        WHERE sm.product_id = p.id AND sm.warehouse_id = w.id
                    ) AS lastMovementAt,
                    0 AS isArchived
                FROM products p
                JOIN product_warehouses pw ON pw.product_id = p.id
                JOIN warehouses w ON w.id = pw.warehouse_id
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = w.id
                {$whereClause}
                GROUP BY p.id, p.code, p.name, p.image_url, p.category_id, c.name, w.id, w.name
                {$havingClause}
                ORDER BY w.name ASC, p.name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['productId']    = (string) $r['productId'];
            $r['warehouseId']  = (string) $r['warehouseId'];
            $r['categoryId']   = $r['categoryId'] !== null ? (string) $r['categoryId'] : null;
            $r['currentStock'] = (float) $r['currentStock'];
            $r['minStock']     = (float) $r['minStock'];
            $r['isArchived']   = false;
        }

        return $rows;
    }

    /**
     * Stock Mínimo Espacio Despacho:
     * Filas de stock con espacio de tipo 'Despachos' donde min_stock_dispatch > 0
     * y quantity <= min_stock_dispatch.
     */
    public function getDispatchSpaceMinStock(?int $warehouseId = null, ?string $stockFilter = null, ?string $search = null): array
    {
        $where = [
            "ws.space_usage_type = 'Despachos'",
            "s.min_stock_dispatch > 0",
            "s.quantity <= s.min_stock_dispatch"
        ];
        $params = [];

        if ($warehouseId !== null) {
            $where[] = "s.warehouse_id = :wid";
            $params[':wid'] = $warehouseId;
        }

        if ($stockFilter === 'zero') {
            $where[] = "s.quantity = 0";
        } elseif ($stockFilter === 'low') {
            $where[] = "s.quantity > 0";
        }

        if ($search !== null && trim($search) !== '') {
            $where[] = "(p.name LIKE :search_name OR p.code LIKE :search_code OR ws.name LIKE :search_space)";
            $params[':search_name']  = "%" . trim($search) . "%";
            $params[':search_code']  = "%" . trim($search) . "%";
            $params[':search_space'] = "%" . trim($search) . "%";
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $sql = "SELECT 
                    s.id AS stockId,
                    p.id AS productId,
                    p.code AS productCode,
                    p.name AS productName,
                    p.image_url AS imageUrl,
                    p.category_id AS categoryId,
                    c.name AS categoryName,
                    w.id AS warehouseId,
                    w.name AS warehouseName,
                    ws.id AS warehouseSpaceId,
                    ws.name AS warehouseSpaceName,
                    s.quantity AS currentStock,
                    s.min_stock_dispatch AS minStockDispatch,
                    (
                        SELECT MAX(sm.created_at)
                        FROM stock_movements sm
                        WHERE sm.product_id = p.id AND sm.warehouse_id = w.id AND sm.warehouse_space_id = ws.id
                    ) AS lastMovementAt
                FROM stock s
                JOIN products p ON p.id = s.product_id
                JOIN warehouses w ON w.id = s.warehouse_id
                JOIN warehouse_spaces ws ON ws.id = s.warehouse_space_id
                LEFT JOIN categories c ON c.id = p.category_id
                {$whereClause}
                ORDER BY w.name ASC, ws.name ASC, p.name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['stockId']          = (string) $r['stockId'];
            $r['productId']        = (string) $r['productId'];
            $r['warehouseId']      = (string) $r['warehouseId'];
            $r['warehouseSpaceId'] = (string) $r['warehouseSpaceId'];
            $r['categoryId']       = $r['categoryId'] !== null ? (string) $r['categoryId'] : null;
            $r['currentStock']     = (float) $r['currentStock'];
            $r['minStockDispatch'] = (float) $r['minStockDispatch'];
        }

        return $rows;
    }

    /**
     * Stock Mínimo Archivado:
     * Lista de registros archivados con fecha de vencimiento activa.
     */
    public function getArchivedMinStock(?int $warehouseId = null, ?string $search = null): array
    {
        $this->purgeExpiredArchives();

        $where = ["1=1"];
        $params = [];

        if ($warehouseId !== null) {
            $where[] = "msa.warehouse_id = :wid";
            $params[':wid'] = $warehouseId;
        }

        if ($search !== null && trim($search) !== '') {
            $where[] = "(p.name LIKE :search_name OR p.code LIKE :search_code)";
            $params[':search_name'] = "%" . trim($search) . "%";
            $params[':search_code'] = "%" . trim($search) . "%";
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $sql = "SELECT 
                    msa.id AS archiveId,
                    p.id AS productId,
                    p.code AS productCode,
                    p.name AS productName,
                    p.image_url AS imageUrl,
                    p.category_id AS categoryId,
                    c.name AS categoryName,
                    w.id AS warehouseId,
                    w.name AS warehouseName,
                    COALESCE(SUM(s.quantity), 0) AS currentStock,
                    MAX(COALESCE(s.min_stock, 0)) AS minStock,
                    msa.archived_at AS archivedAt,
                    msa.archive_deadline_at AS archiveDeadlineAt,
                    msa.archived_by AS archivedBy,
                    u.name AS archivedByName,
                    1 AS isArchived
                FROM min_stock_archived msa
                JOIN products p ON p.id = msa.product_id
                JOIN warehouses w ON w.id = msa.warehouse_id
                LEFT JOIN users u ON u.id = msa.archived_by
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = w.id
                {$whereClause}
                GROUP BY msa.id, p.id, p.code, p.name, p.image_url, p.category_id, c.name, w.id, w.name, msa.archived_at, msa.archive_deadline_at, msa.archived_by, u.name
                ORDER BY msa.archived_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['archiveId']    = (string) $r['archiveId'];
            $r['productId']    = (string) $r['productId'];
            $r['warehouseId']  = (string) $r['warehouseId'];
            $r['categoryId']   = $r['categoryId'] !== null ? (string) $r['categoryId'] : null;
            $r['currentStock'] = (float) $r['currentStock'];
            $r['minStock']     = (float) $r['minStock'];
            $r['isArchived']   = true;
        }

        return $rows;
    }

    /**
     * Archiva un conjunto de productos en sus respectivos almacenes.
     */
    public function archiveItems(array $items, string $deadlineAt, int $userId): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO min_stock_archived (product_id, warehouse_id, archive_deadline_at, archived_by, archived_at)
             VALUES (:product_id, :warehouse_id, :deadline_at, :user_id, NOW())
             ON DUPLICATE KEY UPDATE 
                archive_deadline_at = VALUES(archive_deadline_at),
                archived_by = VALUES(archived_by),
                archived_at = NOW()"
        );

        foreach ($items as $item) {
            $pid = (int) ($item['productId'] ?? 0);
            $wid = (int) ($item['warehouseId'] ?? 0);
            if ($pid > 0 && $wid > 0) {
                $stmt->execute([
                    ':product_id'   => $pid,
                    ':warehouse_id' => $wid,
                    ':deadline_at'  => $deadlineAt,
                    ':user_id'      => $userId,
                ]);
            }
        }
    }

    /**
     * Desarchiva un conjunto de productos.
     */
    public function unarchiveItems(array $items): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM min_stock_archived WHERE product_id = :product_id AND warehouse_id = :warehouse_id"
        );

        foreach ($items as $item) {
            $pid = (int) ($item['productId'] ?? 0);
            $wid = (int) ($item['warehouseId'] ?? 0);
            if ($pid > 0 && $wid > 0) {
                $stmt->execute([
                    ':product_id'   => $pid,
                    ':warehouse_id' => $wid,
                ]);
            }
        }
    }
}
