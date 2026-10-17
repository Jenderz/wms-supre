<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class StockMovement
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        return $this->db->query(
            "SELECT id, product_id as productId, warehouse_id as warehouseId, warehouse_space_id as warehouseSpaceId,
                    type, reason, quantity, reference_id as referenceId,
                    notes, created_at as createdAt, created_by as createdBy
             FROM stock_movements ORDER BY created_at DESC"
        )->fetchAll();
    }

    public function getPaginated(
        int $page = 1,
        int $limit = 50,
        ?string $type = null,
        ?int $warehouseId = null,
        ?int $productId = null,
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(200, $limit));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if ($type !== null && $type !== '' && $type !== 'ALL') {
            $where[] = "type = :type";
            $params[':type'] = $type;
        }

        if ($warehouseId !== null) {
            $where[] = "warehouse_id = :warehouse_id";
            $params[':warehouse_id'] = $warehouseId;
        }

        if ($productId !== null) {
            $where[] = "product_id = :product_id";
            $params[':product_id'] = $productId;
        }

        if ($dateFrom !== null && $dateFrom !== '') {
            $where[] = "created_at >= :date_from";
            $params[':date_from'] = $dateFrom . ' 00:00:00';
        }

        if ($dateTo !== null && $dateTo !== '') {
            $where[] = "created_at <= :date_to";
            $params[':date_to'] = $dateTo . ' 23:59:59';
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Total
        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM stock_movements {$whereClause}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Paginated rows
        $sql = "SELECT id, product_id as productId, warehouse_id as warehouseId, warehouse_space_id as warehouseSpaceId,
                       type, reason, quantity, reference_id as referenceId,
                       notes, created_at as createdAt, created_by as createdBy
                FROM stock_movements
                {$whereClause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        return [
            'items' => $rows,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO stock_movements (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, reference_id, notes, created_by)
             VALUES (:product_id, :warehouse_id, :warehouse_space_id, :type, :reason, :quantity, :reference_id, :notes, :created_by)"
        );
        $stmt->execute([
            ':product_id'         => $data['productId'],
            ':warehouse_id'       => $data['warehouseId'],
            ':warehouse_space_id' => $data['warehouseSpaceId'] ?? null,
            ':type'               => $data['type'],
            ':reason'             => $data['reason'],
            ':quantity'           => $data['quantity'],
            ':reference_id'       => $data['referenceId'] ?? null,
            ':notes'              => $data['notes'] ?? null,
            ':created_by'         => $data['createdBy'],
        ]);
        return (int) $this->db->lastInsertId();
    }
}
