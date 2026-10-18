<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;
use Exception;

class TransferPicking
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function generateNextLotNumber(): string
    {
        $stmt = $this->db->query("SELECT lot_number FROM transfer_pickings ORDER BY id DESC LIMIT 1");
        $last = $stmt->fetchColumn();
        if (!$last) {
            return 'TRANF-0001';
        }
        preg_match('/\d+/', (string) $last, $matches);
        $num = isset($matches[0]) ? (int) $matches[0] + 1 : 1;
        return 'TRANF-' . str_pad((string) $num, 4, '0', STR_PAD_LEFT);
    }

    public function getAll(
        ?int $originWarehouseId = null,
        ?int $destinationWarehouseId = null,
        ?int $responsibleUserId = null,
        ?string $status = null,
        ?string $search = null
    ): array {
        $where = ["1=1"];
        $params = [];

        if ($originWarehouseId !== null) {
            $where[] = "tp.origin_warehouse_id = :orig_wid";
            $params[':orig_wid'] = $originWarehouseId;
        }

        if ($destinationWarehouseId !== null) {
            $where[] = "tp.destination_warehouse_id = :dest_wid";
            $params[':dest_wid'] = $destinationWarehouseId;
        }

        if ($responsibleUserId !== null) {
            $where[] = "tp.responsible_user_id = :resp_uid";
            $params[':resp_uid'] = $responsibleUserId;
        }

        if ($status !== null && $status !== '' && $status !== 'ALL') {
            $where[] = "tp.status = :status";
            $params[':status'] = $status;
        }

        if ($search !== null && trim($search) !== '') {
            $where[] = "(tp.lot_number LIKE :search OR tp.description LIKE :search)";
            $params[':search'] = "%" . trim($search) . "%";
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $sql = "SELECT 
                    tp.id,
                    tp.lot_number               AS lotNumber,
                    tp.origin_warehouse_id      AS originWarehouseId,
                    ow.name                     AS originWarehouseName,
                    tp.destination_warehouse_id AS destinationWarehouseId,
                    dw.name                     AS destinationWarehouseName,
                    tp.responsible_user_id      AS responsibleUserId,
                    ru.name                     AS responsibleUserName,
                    tp.description,
                    tp.status,
                    tp.linked_picking_lot_id    AS linkedPickingLotId,
                    tp.stock_deducted           AS stockDeducted,
                    tp.created_by               AS createdBy,
                    cu.name                     AS createdByName,
                    tp.created_at               AS createdAt,
                    tp.conformed_at             AS conformedAt,
                    COUNT(tpi.id)               AS totalItems,
                    COALESCE(SUM(tpi.number_of_packages), 0) AS totalPackages,
                    COALESCE(SUM(tpi.quantity), 0) AS totalQuantity
                FROM transfer_pickings tp
                LEFT JOIN warehouses ow ON ow.id = tp.origin_warehouse_id
                LEFT JOIN warehouses dw ON dw.id = tp.destination_warehouse_id
                LEFT JOIN users ru ON ru.id = tp.responsible_user_id
                LEFT JOIN users cu ON cu.id = tp.created_by
                LEFT JOIN transfer_picking_items tpi ON tpi.transfer_picking_id = tp.id
                {$whereClause}
                GROUP BY tp.id, tp.lot_number, tp.origin_warehouse_id, ow.name,
                         tp.destination_warehouse_id, dw.name, tp.responsible_user_id, ru.name,
                         tp.description, tp.status, tp.linked_picking_lot_id, tp.stock_deducted,
                         tp.created_by, cu.name, tp.created_at, tp.conformed_at
                ORDER BY tp.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['id']                     = (string) $r['id'];
            $r['originWarehouseId']      = (string) $r['originWarehouseId'];
            $r['destinationWarehouseId'] = (string) $r['destinationWarehouseId'];
            $r['responsibleUserId']      = (string) $r['responsibleUserId'];
            $r['createdBy']              = (string) $r['createdBy'];
            $r['linkedPickingLotId']     = $r['linkedPickingLotId'] !== null ? (string) $r['linkedPickingLotId'] : null;
            $r['stockDeducted']          = (bool) $r['stockDeducted'];
            $r['totalItems']             = (int) $r['totalItems'];
            $r['totalPackages']          = (int) $r['totalPackages'];
            $r['totalQuantity']          = (float) $r['totalQuantity'];
        }

        return $rows;
    }

    public function findById(int $id): ?array
    {
        $sql = "SELECT 
                    tp.id,
                    tp.lot_number               AS lotNumber,
                    tp.origin_warehouse_id      AS originWarehouseId,
                    ow.name                     AS originWarehouseName,
                    tp.destination_warehouse_id AS destinationWarehouseId,
                    dw.name                     AS destinationWarehouseName,
                    tp.responsible_user_id      AS responsibleUserId,
                    ru.name                     AS responsibleUserName,
                    tp.description,
                    tp.status,
                    tp.linked_picking_lot_id    AS linkedPickingLotId,
                    tp.stock_deducted           AS stockDeducted,
                    tp.created_by               AS createdBy,
                    cu.name                     AS createdByName,
                    tp.created_at               AS createdAt,
                    tp.conformed_at             AS conformedAt
                FROM transfer_pickings tp
                LEFT JOIN warehouses ow ON ow.id = tp.origin_warehouse_id
                LEFT JOIN warehouses dw ON dw.id = tp.destination_warehouse_id
                LEFT JOIN users ru ON ru.id = tp.responsible_user_id
                LEFT JOIN users cu ON cu.id = tp.created_by
                WHERE tp.id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row['id']                     = (string) $row['id'];
        $row['originWarehouseId']      = (string) $row['originWarehouseId'];
        $row['destinationWarehouseId'] = (string) $row['destinationWarehouseId'];
        $row['responsibleUserId']      = (string) $row['responsibleUserId'];
        $row['createdBy']              = (string) $row['createdBy'];
        $row['linkedPickingLotId']     = $row['linkedPickingLotId'] !== null ? (string) $row['linkedPickingLotId'] : null;
        $row['stockDeducted']          = (bool) $row['stockDeducted'];
        $row['items']                  = $this->getItems($id);

        return $row;
    }

    public function getItems(int $transferId): array
    {
        $stmt = $this->db->prepare(
            "SELECT 
                tpi.id,
                tpi.transfer_picking_id AS transferPickingId,
                tpi.product_id          AS productId,
                p.code                  AS productCode,
                p.name                  AS productName,
                p.image_url             AS imageUrl,
                c.name                  AS categoryName,
                tpi.quantity,
                tpi.number_of_packages  AS numberOfPackages,
                tpi.spaces_distribution AS spacesDistribution
             FROM transfer_picking_items tpi
             JOIN products p ON p.id = tpi.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE tpi.transfer_picking_id = :id
             ORDER BY tpi.id ASC"
        );
        $stmt->execute([':id' => $transferId]);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['id']                = (string) $item['id'];
            $item['transferPickingId'] = (string) $item['transferPickingId'];
            $item['productId']         = (string) $item['productId'];
            $item['quantity']          = (float) $item['quantity'];
            $item['numberOfPackages']  = (int) $item['numberOfPackages'];
            $item['spacesDistribution']= is_string($item['spacesDistribution']) 
                ? json_decode($item['spacesDistribution'], true) 
                : ($item['spacesDistribution'] ?? []);
        }

        return $items;
    }

    public function create(array $data, int $userId): int
    {
        $this->db->beginTransaction();
        try {
            $lotNumber = !empty($data['lotNumber']) ? $data['lotNumber'] : $this->generateNextLotNumber();
            $status    = $data['status'] ?? 'DRAFT';

            $stmt = $this->db->prepare(
                "INSERT INTO transfer_pickings
                    (lot_number, origin_warehouse_id, destination_warehouse_id, responsible_user_id, description, status, created_by)
                 VALUES
                    (:lot_number, :orig_id, :dest_id, :resp_id, :description, :status, :created_by)"
            );
            $stmt->execute([
                ':lot_number'   => $lotNumber,
                ':orig_id'      => (int) $data['originWarehouseId'],
                ':dest_id'      => (int) $data['destinationWarehouseId'],
                ':resp_id'      => (int) $data['responsibleUserId'],
                ':description'  => $data['description'] ?? null,
                ':status'       => $status === 'PENDING' ? 'DRAFT' : $status, // Si es PENDING, lo iniciamos en DRAFT y sendTransfer() lo pasa a PENDING
                ':created_by'   => $userId,
            ]);
            $transferId = (int) $this->db->lastInsertId();

            $this->syncItems($transferId, $data['items'] ?? []);

            $this->db->commit();

            if ($status === 'PENDING') {
                $this->sendTransfer($transferId, $userId);
            }

            return $transferId;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function update(int $id, array $data, int $userId): void
    {
        $existing = $this->findById($id);
        if (!$existing) {
            throw new Exception("Picking de transferencia no encontrado.");
        }
        if ($existing['status'] === 'CONFORMED') {
            throw new Exception("No se puede editar una transferencia ya conformada.");
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "UPDATE transfer_pickings
                 SET origin_warehouse_id = :orig_id,
                     destination_warehouse_id = :dest_id,
                     responsible_user_id = :resp_id,
                     description = :description
                 WHERE id = :id"
            );
            $stmt->execute([
                ':id'          => $id,
                ':orig_id'     => (int) ($data['originWarehouseId'] ?? $existing['originWarehouseId']),
                ':dest_id'     => (int) ($data['destinationWarehouseId'] ?? $existing['destinationWarehouseId']),
                ':resp_id'     => (int) ($data['responsibleUserId'] ?? $existing['responsibleUserId']),
                ':description' => array_key_exists('description', $data) ? $data['description'] : $existing['description'],
            ]);

            if (isset($data['items']) && is_array($data['items'])) {
                $this->syncItems($id, $data['items']);
            }

            $this->db->commit();

            if (($data['status'] ?? '') === 'PENDING' && $existing['status'] === 'DRAFT') {
                $this->sendTransfer($id, $userId);
            }
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    private function syncItems(int $transferId, array $items): void
    {
        $this->db->prepare("DELETE FROM transfer_picking_items WHERE transfer_picking_id = :id")->execute([':id' => $transferId]);

        $stmt = $this->db->prepare(
            "INSERT INTO transfer_picking_items
                (transfer_picking_id, product_id, quantity, number_of_packages, spaces_distribution)
             VALUES
                (:tid, :pid, :qty, :pkgs, :spaces)"
        );

        foreach ($items as $item) {
            $qty = (float) ($item['quantity'] ?? 0);
            $pkgs = !empty($item['numberOfPackages']) ? (int) $item['numberOfPackages'] : 1; // 1 ítem = 1 bulto
            $spaces = is_array($item['spacesDistribution'] ?? null) 
                ? json_encode($item['spacesDistribution']) 
                : (is_string($item['spacesDistribution'] ?? null) ? $item['spacesDistribution'] : '[]');

            $stmt->execute([
                ':tid'    => $transferId,
                ':pid'    => (int) ($item['productId'] ?? 0),
                ':qty'    => $qty,
                ':pkgs'   => $pkgs,
                ':spaces' => $spaces,
            ]);
        }
    }

    /**
     * Enviar Picking Transferencia (pasa a PENDING):
     * - Descuenta las cantidades de los espacios del Almacén Origen.
     * - Registra movimientos tipo TRANSFER.
     * - Crea picking_lot vinculado en Almacén Destino en estado PENDING (1 ítem = 1 bulto).
     */
    public function sendTransfer(int $id, int $userId): void
    {
        $transfer = $this->findById($id);
        if (!$transfer) {
            throw new Exception("Transferencia no encontrada.");
        }
        if ($transfer['stockDeducted']) {
            // Ya descontado, solo asegurar estado
            $this->db->prepare("UPDATE transfer_pickings SET status = 'PENDING' WHERE id = :id")->execute([':id' => $id]);
            return;
        }

        $stockModel    = new Stock();
        $movementModel = new StockMovement();
        $originWid     = (int) $transfer['originWarehouseId'];
        $destWid       = (int) $transfer['destinationWarehouseId'];

        $this->db->beginTransaction();
        try {
            // 1. Descontar stock en almacén de origen
            foreach ($transfer['items'] as $item) {
                $pid = (int) $item['productId'];
                $spaces = $item['spacesDistribution'] ?? [];

                if (empty($spaces)) {
                    // Si no especificó espacio, descuenta de pendientes (space_key = 0)
                    $stockModel->adjustQuantity($pid, $originWid, null, -(float) $item['quantity']);
                    $movementModel->create([
                        'productId'        => $pid,
                        'warehouseId'      => $originWid,
                        'warehouseSpaceId' => null,
                        'type'             => 'TRANSFER',
                        'reason'           => 'RELOCATION',
                        'quantity'         => (float) $item['quantity'],
                        'referenceId'      => $id,
                        'notes'            => "Salida Transferencia {$transfer['lotNumber']}",
                        'createdBy'        => $userId,
                    ]);
                } else {
                    foreach ($spaces as $sp) {
                        $spId = isset($sp['warehouseSpaceId']) && $sp['warehouseSpaceId'] !== null ? (int) $sp['warehouseSpaceId'] : null;
                        $spQty = (float) ($sp['quantity'] ?? 0);
                        if ($spQty > 0) {
                            $stockModel->adjustQuantity($pid, $originWid, $spId, -$spQty);
                            $movementModel->create([
                                'productId'        => $pid,
                                'warehouseId'      => $originWid,
                                'warehouseSpaceId' => $spId,
                                'type'             => 'TRANSFER',
                                'reason'           => 'RELOCATION',
                                'quantity'         => $spQty,
                                'referenceId'      => $id,
                                'notes'            => "Salida Transferencia {$transfer['lotNumber']} (Espacio: " . ($sp['spaceName'] ?? '—') . ")",
                                'createdBy'        => $userId,
                            ]);
                        }
                    }
                }
            }

            // 2. Crear lote en destino en picking_lots
            $pickingLotModel = new PickingLot();
            $destLotNumber = "PL-" . $transfer['lotNumber'];

            $lotItems = [];
            foreach ($transfer['items'] as $item) {
                $lotItems[] = [
                    'productId'        => $item['productId'],
                    'quantityToEnter'  => (float) $item['quantity'],
                    'numberOfPackages' => 1,
                    'packageDescription' => "Transferencia desde {$transfer['originWarehouseName']}",
                    'packagesConfig'   => [
                        [
                            'packageIndex' => 1,
                            'quantity'     => (float) $item['quantity'],
                            'description'  => "Bulto transferencia {$transfer['lotNumber']}"
                        ]
                    ],
                    'minStockAlert'    => 0,
                ];
            }

            $destLotId = $pickingLotModel->create([
                'lotNumber'   => $destLotNumber,
                'warehouseId' => $destWid,
                'description' => "Transferencia automática desde {$transfer['originWarehouseName']} ({$transfer['lotNumber']})",
                'status'      => 'PENDING',
                'createdBy'   => $userId,
                'items'       => $lotItems,
            ]);

            // 3. Actualizar cabecera de transfer_pickings
            $this->db->prepare(
                "UPDATE transfer_pickings 
                 SET status = 'PENDING',
                     linked_picking_lot_id = :dest_lot_id,
                     stock_deducted = 1
                 WHERE id = :id"
            )->execute([
                ':dest_lot_id' => $destLotId,
                ':id'          => $id,
            ]);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Conformar Transferencia:
     * - Ingresa el stock al almacén destino.
     * - Marca picking_lots y transfer_pickings como CONFORMED.
     */
    public function conformTransfer(int $id, int $userId): void
    {
        $transfer = $this->findById($id);
        if (!$transfer) {
            throw new Exception("Transferencia no encontrada.");
        }
        if ($transfer['status'] === 'CONFORMED') {
            return; // Ya conformada
        }

        // Si aún no se había enviado/deducido origen, procesar descuento de origen primero
        if (!$transfer['stockDeducted']) {
            $this->sendTransfer($id, $userId);
            $transfer = $this->findById($id);
        }

        $this->db->beginTransaction();
        try {
            $stockModel    = new Stock();
            $movementModel = new StockMovement();
            $destWid       = (int) $transfer['destinationWarehouseId'];

            // Verificar si el picking_lot vinculado ya fue conformado en Abastecimiento para no duplicar ingreso
            $alreadyConformedInDest = false;
            if (!empty($transfer['linkedPickingLotId'])) {
                $lotCheck = $this->db->prepare("SELECT status FROM picking_lots WHERE id = :lot_id FOR UPDATE");
                $lotCheck->execute([':lot_id' => (int) $transfer['linkedPickingLotId']]);
                $linkedStatus = $lotCheck->fetchColumn();
                if ($linkedStatus === 'CONFORMED') {
                    $alreadyConformedInDest = true;
                }
            }

            // 1. Ingresar stock al almacén destino solo si no había sido conformado ya en Abastecimiento
            if (!$alreadyConformedInDest) {
                foreach ($transfer['items'] as $item) {
                    $pid = (int) $item['productId'];
                    $qty = (float) $item['quantity'];

                    $stockModel->upsert([
                        'productId'        => $pid,
                        'warehouseId'      => $destWid,
                        'warehouseSpaceId' => null,
                        'quantity'         => $qty,
                        'isAdditive'       => true,
                    ]);

                    $movementModel->create([
                        'productId'        => $pid,
                        'warehouseId'      => $destWid,
                        'warehouseSpaceId' => null,
                        'type'             => 'IN',
                        'reason'           => 'RECEPTION',
                        'quantity'         => $qty,
                        'referenceId'      => $id,
                        'notes'            => "Ingreso por Transferencia {$transfer['lotNumber']}",
                        'createdBy'        => $userId,
                    ]);
                }

                // 2. Conformar picking_lots vinculado si existe
                if (!empty($transfer['linkedPickingLotId'])) {
                    $this->db->prepare(
                        "UPDATE picking_lots SET status = 'CONFORMED', conformed_at = NOW() WHERE id = :lot_id"
                    )->execute([':lot_id' => (int) $transfer['linkedPickingLotId']]);
                }
            }

            // 3. Marcar transfer_pickings como CONFORMED
            $this->db->prepare(
                "UPDATE transfer_pickings SET status = 'CONFORMED', conformed_at = NOW() WHERE id = :id"
            )->execute([':id' => $id]);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function updateStatus(int $id, string $status, int $userId): void
    {
        $transfer = $this->findById($id);
        if (!$transfer) {
            throw new Exception("Transferencia no encontrada.");
        }

        if ($status === 'PENDING') {
            $this->sendTransfer($id, $userId);
        } elseif ($status === 'CONFORMED') {
            $this->conformTransfer($id, $userId);
        } else {
            if ($transfer['stockDeducted']) {
                throw new Exception("No se puede regresar a Borrador una transferencia que ya descontó stock.");
            }
            $this->db->prepare("UPDATE transfer_pickings SET status = :st WHERE id = :id")->execute([':st' => $status, ':id' => $id]);
        }
    }

    public function delete(int $id, object $authUser): void
    {
        $transfer = $this->findById($id);
        if (!$transfer) {
            throw new Exception("Transferencia no encontrada.");
        }

        if ($transfer['status'] === 'CONFORMED') {
            throw new Exception("No se puede eliminar una transferencia ya conformada.");
        }

        if ($transfer['status'] === 'PENDING') {
            \App\Middleware\AuthMiddleware::requireRole($authUser, 'ADMIN');
        }

        $this->db->beginTransaction();
        try {
            // Si el stock ya fue descontado y se elimina por ADMIN, revertir origen
            if ($transfer['stockDeducted']) {
                $stockModel = new Stock();
                $originWid  = (int) $transfer['originWarehouseId'];

                foreach ($transfer['items'] as $item) {
                    $pid = (int) $item['productId'];
                    $spaces = $item['spacesDistribution'] ?? [];

                    if (empty($spaces)) {
                        $stockModel->adjustQuantity($pid, $originWid, null, (float) $item['quantity']);
                    } else {
                        foreach ($spaces as $sp) {
                            $spId = isset($sp['warehouseSpaceId']) && $sp['warehouseSpaceId'] !== null ? (int) $sp['warehouseSpaceId'] : null;
                            $spQty = (float) ($sp['quantity'] ?? 0);
                            if ($spQty > 0) {
                                $stockModel->adjustQuantity($pid, $originWid, $spId, $spQty);
                            }
                        }
                    }
                }

                // Eliminar lote destino vinculado si existía en estado PENDING
                if (!empty($transfer['linkedPickingLotId'])) {
                    $this->db->prepare("DELETE FROM picking_lots WHERE id = :lot_id AND status = 'PENDING'")
                        ->execute([':lot_id' => (int) $transfer['linkedPickingLotId']]);
                }
            }

            $this->db->prepare("DELETE FROM transfer_pickings WHERE id = :id")->execute([':id' => $id]);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
