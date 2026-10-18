<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;
use Exception;

class DamageRecord
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function generateNextCode(): string
    {
        $stmt = $this->db->query("SELECT code FROM damage_records ORDER BY id DESC LIMIT 1");
        $last = $stmt->fetchColumn();
        if (!$last) {
            return 'AVE-0001';
        }
        preg_match('/\d+/', (string) $last, $matches);
        $num = isset($matches[0]) ? (int) $matches[0] + 1 : 1;
        return 'AVE-' . str_pad((string) $num, 4, '0', STR_PAD_LEFT);
    }

    public function getAll(
        ?bool $inventoryCorrection = null,
        ?int $warehouseId = null,
        ?string $status = null,
        ?string $search = null
    ): array {
        $where = ["1=1"];
        $params = [];

        if ($inventoryCorrection !== null) {
            $where[] = "d.inventory_correction = :inv_corr";
            $params[':inv_corr'] = $inventoryCorrection ? 1 : 0;
        }

        if ($warehouseId !== null) {
            $where[] = "d.warehouse_id = :wid";
            $params[':wid'] = $warehouseId;
        }

        if ($status !== null && $status !== '' && $status !== 'ALL') {
            $where[] = "d.status = :status";
            $params[':status'] = $status;
        }

        if ($search !== null && trim($search) !== '') {
            $where[] = "(d.code LIKE :search OR p.name LIKE :search OR p.code LIKE :search OR d.description LIKE :search)";
            $params[':search'] = "%" . trim($search) . "%";
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $sql = "SELECT 
                    d.id,
                    d.code,
                    d.warehouse_id          AS warehouseId,
                    w.name                  AS warehouseName,
                    d.product_id            AS productId,
                    p.code                  AS productCode,
                    p.name                  AS productName,
                    p.image_url             AS imageUrl,
                    d.inventory_correction  AS inventoryCorrection,
                    d.quantity,
                    d.spaces_distribution   AS spacesDistribution,
                    d.status,
                    d.stock_applied         AS stockApplied,
                    d.responsible_user_id   AS responsibleUserId,
                    ru.name                 AS responsibleUserName,
                    d.description,
                    d.created_by            AS createdBy,
                    cu.name                 AS createdByName,
                    d.created_at            AS createdAt,
                    d.conformed_at          AS conformedAt,
                    (
                        SELECT COALESCE(SUM(s.quantity), 0)
                        FROM stock s
                        WHERE s.product_id = d.product_id AND s.warehouse_id = d.warehouse_id
                    ) AS currentStock
                FROM damage_records d
                JOIN products p ON p.id = d.product_id
                JOIN warehouses w ON w.id = d.warehouse_id
                JOIN users ru ON ru.id = d.responsible_user_id
                JOIN users cu ON cu.id = d.created_by
                {$whereClause}
                ORDER BY d.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['id']                  = (string) $r['id'];
            $r['warehouseId']         = (string) $r['warehouseId'];
            $r['productId']           = (string) $r['productId'];
            $r['responsibleUserId']   = (string) $r['responsibleUserId'];
            $r['createdBy']           = (string) $r['createdBy'];
            $r['quantity']            = (float) $r['quantity'];
            $r['currentStock']        = (float) $r['currentStock'];
            $r['inventoryCorrection'] = (bool) $r['inventoryCorrection'];
            $r['stockApplied']        = (bool) $r['stockApplied'];
            $r['spacesDistribution']  = is_string($r['spacesDistribution'])
                ? json_decode($r['spacesDistribution'], true)
                : ($r['spacesDistribution'] ?? []);
        }

        return $rows;
    }

    public function findById(int $id): ?array
    {
        $sql = "SELECT 
                    d.id,
                    d.code,
                    d.warehouse_id          AS warehouseId,
                    w.name                  AS warehouseName,
                    d.product_id            AS productId,
                    p.code                  AS productCode,
                    p.name                  AS productName,
                    p.image_url             AS imageUrl,
                    d.inventory_correction  AS inventoryCorrection,
                    d.quantity,
                    d.spaces_distribution   AS spacesDistribution,
                    d.status,
                    d.stock_applied         AS stockApplied,
                    d.responsible_user_id   AS responsibleUserId,
                    ru.name                 AS responsibleUserName,
                    d.description,
                    d.created_by            AS createdBy,
                    cu.name                 AS createdByName,
                    d.created_at            AS createdAt,
                    d.conformed_at          AS conformedAt,
                    (
                        SELECT COALESCE(SUM(s.quantity), 0)
                        FROM stock s
                        WHERE s.product_id = d.product_id AND s.warehouse_id = d.warehouse_id
                    ) AS currentStock
                FROM damage_records d
                JOIN products p ON p.id = d.product_id
                JOIN warehouses w ON w.id = d.warehouse_id
                JOIN users ru ON ru.id = d.responsible_user_id
                JOIN users cu ON cu.id = d.created_by
                WHERE d.id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row['id']                  = (string) $row['id'];
        $row['warehouseId']         = (string) $row['warehouseId'];
        $row['productId']           = (string) $row['productId'];
        $row['responsibleUserId']   = (string) $row['responsibleUserId'];
        $row['createdBy']           = (string) $row['createdBy'];
        $row['quantity']            = (float) $row['quantity'];
        $row['currentStock']        = (float) $row['currentStock'];
        $row['inventoryCorrection'] = (bool) $row['inventoryCorrection'];
        $row['stockApplied']        = (bool) $row['stockApplied'];
        $row['spacesDistribution']  = is_string($row['spacesDistribution'])
            ? json_decode($row['spacesDistribution'], true)
            : ($row['spacesDistribution'] ?? []);

        return $row;
    }

    /**
     * Creación por lote (uno o más productos). Cada producto genera un AVE-XXXX individual.
     */
    public function createBatch(array $data, int $userId): array
    {
        $warehouseId         = (int) $data['warehouseId'];
        $responsibleUserId   = (int) $data['responsibleUserId'];
        $inventoryCorrection = !empty($data['inventoryCorrection']) ? 1 : 0;
        $status              = $data['status'] ?? 'DRAFT';
        $description         = $data['description'] ?? null;
        $items               = $data['items'] ?? [];

        if (empty($items)) {
            throw new Exception("Debe incluir al menos un producto.");
        }

        $createdIds = [];

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO damage_records
                    (code, warehouse_id, product_id, inventory_correction, quantity, spaces_distribution, status, stock_applied, responsible_user_id, description, created_by)
                 VALUES
                    (:code, :wid, :pid, :inv_corr, :qty, :spaces, :status, 0, :resp_id, :description, :created_by)"
            );

            foreach ($items as $item) {
                $code = $this->generateNextCode();
                $qty  = (float) ($item['quantity'] ?? 0);
                
                // Si inventoryCorrection = 0, spacesDistribution se guarda como NULL
                $spaces = null;
                if ($inventoryCorrection === 1) {
                    $spaces = is_array($item['spacesDistribution'] ?? null)
                        ? json_encode($item['spacesDistribution'])
                        : (is_string($item['spacesDistribution'] ?? null) ? $item['spacesDistribution'] : '[]');
                }

                $stmt->execute([
                    ':code'        => $code,
                    ':wid'         => $warehouseId,
                    ':pid'         => (int) ($item['productId'] ?? 0),
                    ':inv_corr'    => $inventoryCorrection,
                    ':qty'         => $qty,
                    ':spaces'      => $spaces,
                    ':status'      => $status,
                    ':resp_id'     => $responsibleUserId,
                    ':description' => $description,
                    ':created_by'  => $userId,
                ]);
                $createdId = (int) $this->db->lastInsertId();
                $createdIds[] = $createdId;
            }

            // Si el estado inicial es PENDING o CONFORMED, aplicar stock dentro de la misma transacción
            if (in_array($status, ['PENDING', 'CONFORMED'], true)) {
                $conformedStmt = $status === 'CONFORMED'
                    ? $this->db->prepare("UPDATE damage_records SET conformed_at = NOW() WHERE id = :id")
                    : null;
                foreach ($createdIds as $cid) {
                    $this->applyStockIfNeeded($cid, $userId);
                    if ($conformedStmt) {
                        $conformedStmt->execute([':id' => $cid]);
                    }
                }
            }

            $this->db->commit();

            return $createdIds;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Aplica el descuento de inventario por avería (solo si inventory_correction = 1).
     */
    public function applyStockIfNeeded(int $id, int $userId): void
    {
        $record = $this->findById($id);
        if (!$record || $record['stockApplied']) {
            return;
        }

        // Si corrección de inventario es 'No' (0), nunca se altera stock
        if (!$record['inventoryCorrection']) {
            return;
        }

        $stockModel    = new Stock();
        $movementModel = new StockMovement();
        $wid           = (int) $record['warehouseId'];
        $pid           = (int) $record['productId'];
        $qty           = (float) $record['quantity'];
        $spaces        = $record['spacesDistribution'] ?? [];

        $ownsTx = !$this->db->inTransaction();
        if ($ownsTx) {
            $this->db->beginTransaction();
        }
        try {
            if (empty($spaces)) {
                $stockModel->adjustQuantity($pid, $wid, null, -$qty);
                $movementModel->create([
                    'productId'        => $pid,
                    'warehouseId'      => $wid,
                    'warehouseSpaceId' => null,
                    'type'             => 'OUT',
                    'reason'           => 'DISINCORPORATION',
                    'quantity'         => $qty,
                    'referenceId'      => $id,
                    'notes'            => "Avería desincorporada {$record['code']}",
                    'createdBy'        => $userId,
                ]);
            } else {
                foreach ($spaces as $sp) {
                    $spId = isset($sp['warehouseSpaceId']) && $sp['warehouseSpaceId'] !== null ? (int) $sp['warehouseSpaceId'] : null;
                    $spQty = (float) ($sp['quantity'] ?? 0);
                    if ($spQty > 0) {
                        $stockModel->adjustQuantity($pid, $wid, $spId, -$spQty);
                        $movementModel->create([
                            'productId'        => $pid,
                            'warehouseId'      => $wid,
                            'warehouseSpaceId' => $spId,
                            'type'             => 'OUT',
                            'reason'           => 'DISINCORPORATION',
                            'quantity'         => $spQty,
                            'referenceId'      => $id,
                            'notes'            => "Avería {$record['code']} (Espacio: " . ($sp['spaceName'] ?? '—') . ")",
                            'createdBy'        => $userId,
                        ]);
                    }
                }
            }

            $this->db->prepare("UPDATE damage_records SET stock_applied = 1 WHERE id = :id")->execute([':id' => $id]);
            if ($ownsTx) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($ownsTx && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function updateStatus(int $id, string $status, int $userId): void
    {
        $record = $this->findById($id);
        if (!$record) {
            throw new Exception("Registro de avería no encontrado.");
        }

        if ($record['status'] === 'CONFORMED') {
            throw new Exception("No se puede cambiar el estado de un registro de avería ya conformado.");
        }

        if ($status === 'DRAFT' && $record['stockApplied']) {
            throw new Exception("No se puede regresar a Borrador un registro cuyo inventario ya fue descontado.");
        }

        if (in_array($status, ['PENDING', 'CONFORMED'], true)) {
            $this->applyStockIfNeeded($id, $userId);
        }

        $conformedSql = $status === 'CONFORMED' ? ", conformed_at = NOW()" : "";
        $this->db->prepare("UPDATE damage_records SET status = :st {$conformedSql} WHERE id = :id")->execute([
            ':st' => $status,
            ':id' => $id,
        ]);
    }

    public function delete(int $id, object $authUser): void
    {
        $record = $this->findById($id);
        if (!$record) {
            throw new Exception("Registro de avería no encontrado.");
        }

        if ($record['status'] === 'CONFORMED') {
            throw new Exception("No se puede eliminar un registro de avería conformado.");
        }

        if ($record['status'] === 'PENDING') {
            \App\Middleware\AuthMiddleware::requireRole($authUser, 'ADMIN');
        }

        $this->db->beginTransaction();
        try {
            // Revertir descuento de stock si fue aplicado
            if ($record['stockApplied'] && $record['inventoryCorrection']) {
                $stockModel = new Stock();
                $wid        = (int) $record['warehouseId'];
                $pid        = (int) $record['productId'];
                $qty        = (float) $record['quantity'];
                $spaces     = $record['spacesDistribution'] ?? [];

                if (empty($spaces)) {
                    $stockModel->adjustQuantity($pid, $wid, null, $qty);
                } else {
                    foreach ($spaces as $sp) {
                        $spId = isset($sp['warehouseSpaceId']) && $sp['warehouseSpaceId'] !== null ? (int) $sp['warehouseSpaceId'] : null;
                        $spQty = (float) ($sp['quantity'] ?? 0);
                        if ($spQty > 0) {
                            $stockModel->adjustQuantity($pid, $wid, $spId, $spQty);
                        }
                    }
                }
            }

            $this->db->prepare("DELETE FROM damage_records WHERE id = :id")->execute([':id' => $id]);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
