<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;
use Exception;

class DispatchOrder
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    private function isReservingStatus(string $status): bool
    {
        return in_array($status, ['PENDIENTE', 'PROCESANDO', 'EN_PROCESO'], true);
    }

    private function isDeductedStatus(string $status): bool
    {
        return in_array($status, ['CONFIRMADO', 'DESPACHADO'], true);
    }

    public function getAll(?int $warehouseId = null): array
    {
        // NOTA: recalculateStockReservations() se invoca EXCLUSIVAMENTE en mutaciones
        // (create, update, updateStatus, delete) para evitar race conditions en lecturas
        // concurrentes que resetearían reserved_quantity entre sí.

        $sql = "SELECT d.id,
                       d.code,
                       d.warehouse_id   AS warehouseId,
                       d.requested_by   AS requestedBy,
                       d.client_name    AS clientName,
                       d.delivery_type  AS deliveryType,
                       d.origin,
                       d.status,
                       d.notes,
                       d.created_by     AS createdBy,
                       d.dispatched_by  AS dispatchedBy,
                       d.created_at     AS createdAt,
                       d.updated_at     AS updatedAt,
                       d.dispatched_at  AS dispatchedAt
                FROM dispatch_orders d";
        
        $params = [];
        if ($warehouseId !== null) {
            $sql .= " WHERE d.warehouse_id = :warehouse_id";
            $params[':warehouse_id'] = $warehouseId;
        }
        $sql .= " ORDER BY d.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$order) {
            $order['id'] = (string) $order['id'];
            $order['warehouseId'] = (string) $order['warehouseId'];
            $order['items'] = $this->getItems((int) $order['id']);
        }
        return $orders;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT d.id,
                    d.code,
                    d.warehouse_id   AS warehouseId,
                    d.requested_by   AS requestedBy,
                    d.client_name    AS clientName,
                    d.delivery_type  AS deliveryType,
                    d.origin,
                    d.status,
                    d.notes,
                    d.created_by     AS createdBy,
                    d.dispatched_by  AS dispatchedBy,
                    d.created_at     AS createdAt,
                    d.updated_at     AS updatedAt,
                    d.dispatched_at  AS dispatchedAt
             FROM dispatch_orders d
             WHERE d.id = :id"
        );
        $stmt->execute([':id' => $id]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $order['id'] = (string) $order['id'];
        $order['warehouseId'] = (string) $order['warehouseId'];
        $order['items'] = $this->getItems($id);
        return $order;
    }

    public function getItems(int $orderId): array
    {
        $stmt = $this->db->prepare(
            "SELECT i.id,
                    i.dispatch_order_id    AS dispatchOrderId,
                    i.product_id           AS productId,
                    i.requested_quantity   AS requestedQuantity,
                    i.warehouse_space_id   AS warehouseSpaceId,
                    i.space_selection_type AS spaceSelectionType,
                    i.dispatch_status      AS dispatchStatus,
                    i.notes
             FROM dispatch_order_items i
             WHERE i.dispatch_order_id = :order_id"
        );
        $stmt->execute([':order_id' => $orderId]);
        $items = $stmt->fetchAll();
        foreach ($items as &$item) {
            $item['id'] = (string) $item['id'];
            $item['productId'] = (string) $item['productId'];
            $item['requestedQuantity'] = (float) $item['requestedQuantity'];
            $item['quantityRequired'] = (float) $item['requestedQuantity']; // Alias para compatibilidad con el frontend
            $item['warehouseSpaceId'] = $item['warehouseSpaceId'] !== null ? (string) $item['warehouseSpaceId'] : null;

            // Decodificar asignaciones detalladas de espacio si existen en notes
            if (!empty($item['notes']) && (str_starts_with(trim($item['notes']), '[') || str_starts_with(trim($item['notes']), '{'))) {
                $decoded = json_decode($item['notes'], true);
                if (is_array($decoded)) {
                    $item['warehouseSpaceAssignments'] = $decoded;
                }
            }
            if (empty($item['warehouseSpaceAssignments']) && !empty($item['warehouseSpaceId'])) {
                $item['warehouseSpaceAssignments'] = [
                    ['warehouseSpaceId' => (string) $item['warehouseSpaceId'], 'quantity' => (float) $item['requestedQuantity']]
                ];
            }
        }
        return $items;
    }

    public function generateNextCode(): string
    {
        $stmt = $this->db->query("SELECT code FROM dispatch_orders ORDER BY id DESC LIMIT 1");
        $lastCode = $stmt->fetchColumn();
        if (!$lastCode) {
            return 'D00001';
        }
        preg_match('/\d+/', (string) $lastCode, $matches);
        $num = isset($matches[0]) ? (int) $matches[0] + 1 : 1;
        return 'D' . str_pad((string) $num, 5, '0', STR_PAD_LEFT);
    }

    public function create(array $data, int $userId): int
    {
        $this->db->beginTransaction();
        try {
            $code = !empty($data['code']) ? $data['code'] : $this->generateNextCode();
            $status = $data['status'] ?? 'PENDIENTE';
            $origin = $data['origin'] ?? 'DIRECT';
            $warehouseId = (int) $data['warehouseId'];

            $stmt = $this->db->prepare(
                "INSERT INTO dispatch_orders
                    (code, warehouse_id, requested_by, client_name, delivery_type, origin, status, notes, created_by)
                 VALUES
                    (:code, :warehouse_id, :requested_by, :client_name, :delivery_type, :origin, :status, :notes, :created_by)"
            );
            $stmt->execute([
                ':code'          => $code,
                ':warehouse_id'  => $warehouseId,
                ':requested_by'  => $data['requestedBy'] ?? '',
                ':client_name'   => $data['clientName'] ?? '',
                ':delivery_type' => $data['deliveryType'] ?? 'TIENDA SUPREPARTS',
                ':origin'        => $origin,
                ':status'        => $status,
                ':notes'         => $data['notes'] ?? null,
                ':created_by'    => $userId,
            ]);
            $orderId = (int) $this->db->lastInsertId();

            $items = $data['items'] ?? [];
            $this->syncItems($orderId, $items);

            // Si el estado inicial fue CONFIRMADO o DESPACHADO, descontar stock físico de inmediato
            if ($this->isDeductedStatus($status)) {
                $stmtMov = $this->db->prepare(
                    "INSERT INTO stock_movements
                        (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, reference_id, notes, created_by)
                     VALUES
                        (:p_id, :w_id, :s_id, 'OUT', 'DESPACHO', :qty, :ref_id, :notes, :user_id)"
                );

                foreach ($items as $item) {
                    $this->processItemDeduction($warehouseId, $item);
                    
                    $productId = (int) ($item['productId'] ?? ($item['product_id'] ?? 0));
                    $qty = (float) ($item['requestedQuantity'] ?? ($item['quantityRequired'] ?? 0));
                    $spaceId = $item['warehouseSpaceId'] ?? ($item['warehouse_space_id'] ?? null);
                    
                    $stmtMov->execute([
                        ':p_id'    => $productId,
                        ':w_id'    => $warehouseId,
                        ':s_id'    => !empty($spaceId) ? (int) $spaceId : null,
                        ':qty'     => $qty,
                        ':ref_id'  => $orderId,
                        ':notes'   => "Despacho {$code} (Creación directa en estado: {$status}) a cliente {$data['clientName']}",
                        ':user_id' => $userId,
                    ]);
                }
            }

            // Recalcular y sincronizar reservas en la tabla stock
            $this->recalculateStockReservations($warehouseId);

            $this->db->commit();
            return $orderId;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): void
    {
        $this->db->beginTransaction();
        try {
            $existing = $this->findById($id);
            if (!$existing) {
                throw new Exception("Orden de despacho #{$id} no encontrada.");
            }

            // Regla de negocio: Solo se pueden editar órdenes en estado PENDIENTE creadas por 'crear directo'
            if ($existing['status'] !== 'PENDIENTE') {
                throw new Exception("Solo se pueden editar órdenes que se encuentren en estado PENDIENTE.");
            }

            if (!empty($existing['origin']) && $existing['origin'] !== 'DIRECT') {
                throw new Exception("No está permitido editar órdenes provenientes de otros módulos de entrada de pedidos.");
            }

            $oldWarehouseId = (int) $existing['warehouseId'];
            $warehouseId = (int) ($data['warehouseId'] ?? $existing['warehouseId']);

            $stmt = $this->db->prepare(
                "UPDATE dispatch_orders
                 SET warehouse_id = :warehouse_id,
                     requested_by = :requested_by,
                     client_name = :client_name,
                     delivery_type = :delivery_type,
                     notes = :notes
                 WHERE id = :id"
            );
            $stmt->execute([
                ':id'            => $id,
                ':warehouse_id'  => $warehouseId,
                ':requested_by'  => $data['requestedBy'] ?? $existing['requestedBy'],
                ':client_name'   => $data['clientName'] ?? $existing['clientName'],
                ':delivery_type' => $data['deliveryType'] ?? $existing['deliveryType'],
                ':notes'         => $data['notes'] ?? $existing['notes'],
            ]);

            $items = $data['items'] ?? $existing['items'];
            $this->syncItems($id, $items);

            // Recalcular y sincronizar reservas de stock atómicamente
            $this->recalculateStockReservations($warehouseId);
            if ($oldWarehouseId !== $warehouseId) {
                $this->recalculateStockReservations($oldWarehouseId);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function updateStatus(int $id, string $newStatus, int $userId): void
    {
        $order = $this->findById($id);
        if (!$order) {
            throw new Exception("Orden de despacho #{$id} no encontrada.");
        }

        $oldStatus = $order['status'];
        if ($oldStatus === $newStatus) {
            return;
        }

        $this->db->beginTransaction();
        try {
            $warehouseId = (int) $order['warehouseId'];
            $items = $this->getItems($id);

            $wasDeducted = $this->isDeductedStatus($oldStatus);
            $willDeduct = $this->isDeductedStatus($newStatus);

            // 1. Pasa A CONFIRMADO/DESPACHADO desde un estado no descontado (Descuenta stock físico real)
            if ($willDeduct && !$wasDeducted) {
                foreach ($items as $item) {
                    $productId = (int) $item['productId'];
                    $qty = (float) ($item['requestedQuantity'] ?? $item['quantityRequired'] ?? 0);
                    $spaceId = $item['warehouseSpaceId'] !== null ? (int) $item['warehouseSpaceId'] : null;

                    $this->processItemDeduction($warehouseId, $item);

                    // Registrar stock_movement OUT
                    $stmtMov = $this->db->prepare(
                        "INSERT INTO stock_movements
                            (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, reference_id, notes, created_by)
                         VALUES
                            (:p_id, :w_id, :s_id, 'OUT', 'DESPACHO', :qty, :ref_id, :notes, :user_id)"
                    );
                    $stmtMov->execute([
                        ':p_id'    => $productId,
                        ':w_id'    => $warehouseId,
                        ':s_id'    => $spaceId,
                        ':qty'     => $qty,
                        ':ref_id'  => $id,
                        ':notes'   => "Despacho {$order['code']} (Estado: {$newStatus}) a cliente {$order['clientName']}",
                        ':user_id' => $userId,
                    ]);

                    // Marcar renglón con el estado correspondiente
                    $stmtItemStatus = $this->db->prepare(
                        "UPDATE dispatch_order_items SET dispatch_status = :item_status WHERE id = :item_id"
                    );
                    $stmtItemStatus->execute([':item_status' => $newStatus, ':item_id' => (int) $item['id']]);
                }
            }
            // 2. Estaba en CONFIRMADO/DESPACHADO y se revierte a un estado no descontado (reintegra stock físico)
            else if ($wasDeducted && !$willDeduct) {
                foreach ($items as $item) {
                    $productId = (int) $item['productId'];
                    $qty = (float) ($item['requestedQuantity'] ?? $item['quantityRequired'] ?? 0);
                    $spaceId = $item['warehouseSpaceId'] !== null ? (int) $item['warehouseSpaceId'] : null;

                    $this->processItemRestore($warehouseId, $item);

                    // Registrar stock_movement IN
                    $stmtMov = $this->db->prepare(
                        "INSERT INTO stock_movements
                            (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, reference_id, notes, created_by)
                         VALUES
                            (:p_id, :w_id, :s_id, 'IN', 'RETIRO_CANCELADO', :qty, :ref_id, :notes, :user_id)"
                    );
                    $stmtMov->execute([
                        ':p_id'    => $productId,
                        ':w_id'    => $warehouseId,
                        ':s_id'    => $spaceId,
                        ':qty'     => $qty,
                        ':ref_id'  => $id,
                        ':notes'   => "Reversión de despacho {$order['code']} a {$newStatus}",
                        ':user_id' => $userId,
                    ]);

                    // Marcar renglón como PENDIENTE
                    $stmtItemStatus = $this->db->prepare(
                        "UPDATE dispatch_order_items SET dispatch_status = 'PENDIENTE' WHERE id = :item_id"
                    );
                    $stmtItemStatus->execute([':item_id' => (int) $item['id']]);
                }
            } else if ($willDeduct && $wasDeducted && $newStatus === 'DESPACHADO') {
                foreach ($items as $item) {
                    $stmtItemStatus = $this->db->prepare(
                        "UPDATE dispatch_order_items SET dispatch_status = 'DESPACHADO' WHERE id = :item_id"
                    );
                    $stmtItemStatus->execute([':item_id' => (int) $item['id']]);
                }
            }

            // Actualizar estado de la cabecera
            $stmtOrder = $this->db->prepare(
                "UPDATE dispatch_orders
                 SET status = :status,
                     updated_at = NOW()
                     " . ($newStatus === 'DESPACHADO' ? ", dispatched_at = NOW(), dispatched_by = :user_id" : "") . "
                 WHERE id = :id"
            );
            $params = [':status' => $newStatus, ':id' => $id];
            if ($newStatus === 'DESPACHADO') {
                $params[':user_id'] = $userId;
            }
            $stmtOrder->execute($params);

            // Recalcular y sincronizar reservas de stock
            $this->recalculateStockReservations($warehouseId);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function delete(int $id): void
    {
        $order = $this->findById($id);
        if (!$order) return;

        $this->db->beginTransaction();
        try {
            $warehouseId = (int) $order['warehouseId'];

            // Si la orden estaba en estado CONFIRMADO o DESPACHADO, los productos se descontaron físicamente del inventario.
            // Al eliminar la orden, devolvemos la mercancía físicamente a sus espacios correspondientes.
            if ($this->isDeductedStatus($order['status'])) {
                foreach ($order['items'] as $item) {
                    $this->processItemRestore($warehouseId, $item);

                    $productId = (int) $item['productId'];
                    $qty = (float) ($item['requestedQuantity'] ?? $item['quantityRequired'] ?? 0);
                    $spaceId = $item['warehouseSpaceId'] !== null ? (int) $item['warehouseSpaceId'] : null;

                    $stmtMov = $this->db->prepare(
                        "INSERT INTO stock_movements
                            (product_id, warehouse_id, warehouse_space_id, type, reason, quantity, reference_id, notes, created_by)
                         VALUES
                            (:p_id, :w_id, :s_id, 'IN', 'CANCELACION_DESPACHO', :qty, :ref_id, :notes, :user_id)"
                    );
                    $stmtMov->execute([
                        ':p_id'    => $productId,
                        ':w_id'    => $warehouseId,
                        ':s_id'    => $spaceId,
                        ':qty'     => $qty,
                        ':ref_id'  => $id,
                        ':notes'   => "Restauración por eliminación de despacho {$order['code']}",
                        ':user_id' => $order['createdBy'] ?? 1,
                    ]);
                }
            }

            // Eliminar renglones y orden
            $stmt = $this->db->prepare("DELETE FROM dispatch_orders WHERE id = :id");
            $stmt->execute([':id' => $id]);

            // Recalcular y sincronizar reservas de stock para limpiar cualquier residuo huérfano
            $this->recalculateStockReservations($warehouseId);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Sincroniza y recalcula todas las reservas de stock (reserved_quantity) basándose en las
     * órdenes activas en la BD (PENDIENTE, PROCESANDO, EN_PROCESO).
     * Si no existen órdenes activas, resetea reserved_quantity a 0.
     */
    public function recalculateStockReservations(?int $warehouseId = null): void
    {
        if ($warehouseId !== null) {
            $stmtReset = $this->db->prepare("UPDATE stock SET reserved_quantity = 0 WHERE warehouse_id = :w_id");
            $stmtReset->execute([':w_id' => $warehouseId]);
        } else {
            $this->db->exec("UPDATE stock SET reserved_quantity = 0");
        }

        $sql = "SELECT d.warehouse_id, i.product_id, i.warehouse_space_id, i.requested_quantity, i.notes
                FROM dispatch_orders d
                JOIN dispatch_order_items i ON d.id = i.dispatch_order_id
                WHERE d.status IN ('PENDIENTE', 'PROCESANDO', 'EN_PROCESO')";
        $params = [];
        if ($warehouseId !== null) {
            $sql .= " AND d.warehouse_id = :w_id";
            $params[':w_id'] = $warehouseId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $activeItems = $stmt->fetchAll();

        foreach ($activeItems as $item) {
            $wId = (int) $item['warehouse_id'];
            $pId = (int) $item['product_id'];
            $totalQty = (float) $item['requested_quantity'];
            
            $assignments = [];
            if (!empty($item['notes']) && (str_starts_with(trim($item['notes']), '[') || str_starts_with(trim($item['notes']), '{'))) {
                $decoded = json_decode($item['notes'], true);
                if (is_array($decoded)) {
                    $assignments = $decoded;
                }
            }

            $assignedTotal = 0.0;
            if (!empty($assignments)) {
                foreach ($assignments as $a) {
                    $sId = !empty($a['warehouseSpaceId']) ? (int) $a['warehouseSpaceId'] : null;
                    $q = (float) ($a['quantity'] ?? 0);
                    if ($q > 0) {
                        $this->addStockReservation($wId, $pId, $sId, $q);
                        $assignedTotal += $q;
                    }
                }
            }

            $remaining = $totalQty - $assignedTotal;
            if ($remaining > 0) {
                $sId = !empty($item['warehouse_space_id']) ? (int) $item['warehouse_space_id'] : null;
                $this->addStockReservation($wId, $pId, $sId, $remaining);
            }
        }
    }

    private function addStockReservation(int $warehouseId, int $productId, ?int $spaceId, float $qty): void
    {
        if ($qty <= 0) return;

        if ($spaceId !== null) {
            $stmt = $this->db->prepare(
                "UPDATE stock 
                 SET reserved_quantity = reserved_quantity + :qty 
                 WHERE product_id = :p_id AND warehouse_id = :w_id AND warehouse_space_id = :s_id"
            );
            $stmt->execute([':qty' => $qty, ':p_id' => $productId, ':w_id' => $warehouseId, ':s_id' => $spaceId]);
            if ($stmt->rowCount() === 0) {
                $stmtIns = $this->db->prepare(
                    "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, reserved_quantity, min_stock)
                     VALUES (:p_id, :w_id, :s_id, :s_key, 0, :qty, 0)
                     ON DUPLICATE KEY UPDATE reserved_quantity = reserved_quantity + VALUES(reserved_quantity)"
                );
                $stmtIns->execute([':p_id' => $productId, ':w_id' => $warehouseId, ':s_id' => $spaceId, ':s_key' => $spaceId, ':qty' => $qty]);
            }
        } else {
            $stmt = $this->db->prepare(
                "UPDATE stock 
                 SET reserved_quantity = reserved_quantity + :qty 
                 WHERE product_id = :p_id AND warehouse_id = :w_id AND space_key = 0"
            );
            $stmt->execute([':qty' => $qty, ':p_id' => $productId, ':w_id' => $warehouseId]);
            if ($stmt->rowCount() === 0) {
                $stmtIns = $this->db->prepare(
                    "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, reserved_quantity, min_stock)
                     VALUES (:p_id, :w_id, NULL, 0, 0, :qty, 0)
                     ON DUPLICATE KEY UPDATE reserved_quantity = reserved_quantity + VALUES(reserved_quantity)"
                );
                $stmtIns->execute([':p_id' => $productId, ':w_id' => $warehouseId, ':qty' => $qty]);
            }
        }
    }

    private function processItemRestore(int $warehouseId, array $item): void
    {
        $productId = (int) ($item['productId'] ?? ($item['product_id'] ?? 0));
        $totalQty = (float) ($item['requestedQuantity'] ?? ($item['quantityRequired'] ?? 0));
        $assignments = $item['warehouseSpaceAssignments'] ?? null;

        $assignedTotal = 0.0;
        if (is_array($assignments) && !empty($assignments)) {
            foreach ($assignments as $a) {
                $sId = !empty($a['warehouseSpaceId']) ? (int) $a['warehouseSpaceId'] : null;
                $q = (float) ($a['quantity'] ?? 0);
                if ($q > 0) {
                    $this->restorePhysicalStock($warehouseId, $productId, $sId, $q);
                    $assignedTotal += $q;
                }
            }
        }
        
        $remaining = $totalQty - $assignedTotal;
        if ($remaining > 0) {
            $spaceIdVal = $item['warehouseSpaceId'] ?? ($item['warehouse_space_id'] ?? null);
            $fallbackSpaceId = (is_array($assignments) && !empty($assignments)) ? null : (!empty($spaceIdVal) ? (int) $spaceIdVal : null);
            $this->restorePhysicalStock($warehouseId, $productId, $fallbackSpaceId, $remaining);
        }
    }

    private function restorePhysicalStock(int $warehouseId, int $productId, ?int $spaceId, float $qty): void
    {
        if ($qty <= 0) return;

        if ($spaceId !== null) {
            $stmt = $this->db->prepare(
                "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, reserved_quantity, min_stock)
                 VALUES (:p_id, :w_id, :s_id, :s_key, :qty, 0, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)"
            );
            $stmt->execute([
                ':p_id'  => $productId,
                ':w_id'  => $warehouseId,
                ':s_id'  => $spaceId,
                ':s_key' => $spaceId,
                ':qty'   => $qty,
            ]);
        } else {
            $stmt = $this->db->prepare(
                "INSERT INTO stock (product_id, warehouse_id, warehouse_space_id, space_key, quantity, reserved_quantity, min_stock)
                 VALUES (:p_id, :w_id, NULL, 0, :qty, 0, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)"
            );
            $stmt->execute([
                ':p_id' => $productId,
                ':w_id' => $warehouseId,
                ':qty'  => $qty,
            ]);
        }
    }


    private function processItemDeduction(int $warehouseId, array $item): void
    {
        $productId = (int) ($item['productId'] ?? ($item['product_id'] ?? 0));
        $totalQty = (float) ($item['requestedQuantity'] ?? ($item['quantityRequired'] ?? 0));
        $assignments = $item['warehouseSpaceAssignments'] ?? null;

        // ── Validación P0-D: la suma de asignaciones NO puede superar la cantidad requerida ──
        // Esto previene descuentos inflados por payloads maliciosos o race conditions.
        if (is_array($assignments) && !empty($assignments)) {
            $sumAssigned = array_sum(array_column($assignments, 'quantity'));
            if ($sumAssigned > $totalQty + 0.0001) { // tolerancia float
                throw new Exception(
                    "Las cantidades asignadas ({$sumAssigned}) superan la cantidad requerida ({$totalQty}) " .
                    "para el producto #{$productId}. Operación rechazada por seguridad."
                );
            }
        }

        $assignedTotal = 0.0;
        if (is_array($assignments) && !empty($assignments)) {
            foreach ($assignments as $a) {
                $sId = !empty($a['warehouseSpaceId']) ? (int) $a['warehouseSpaceId'] : null;
                $q = (float) ($a['quantity'] ?? 0);
                if ($q > 0) {
                    $this->deductPhysicalStock($warehouseId, $productId, $sId, $q);
                    $assignedTotal += $q;
                }
            }
        }
        
        $remaining = $totalQty - $assignedTotal;
        if ($remaining > 0) {
            $spaceIdVal = $item['warehouseSpaceId'] ?? ($item['warehouse_space_id'] ?? null);
            $fallbackSpaceId = (is_array($assignments) && !empty($assignments)) ? null : (!empty($spaceIdVal) ? (int) $spaceIdVal : null);
            $this->deductPhysicalStock($warehouseId, $productId, $fallbackSpaceId, $remaining);
        }
    }


    private function deductPhysicalStock(int $warehouseId, int $productId, ?int $spaceId, float $qty): void
    {
        if ($spaceId !== null) {
            $stmt = $this->db->prepare(
                "SELECT id, quantity, reserved_quantity FROM stock
                 WHERE product_id = :p_id AND warehouse_id = :w_id AND warehouse_space_id = :s_id
                 FOR UPDATE"
            );
            $stmt->execute([':p_id' => $productId, ':w_id' => $warehouseId, ':s_id' => $spaceId]);
            $row = $stmt->fetch();
            if (!$row || (float) $row['quantity'] < $qty) {
                $avail = $row ? (float) $row['quantity'] : 0;
                throw new Exception("Stock físico insuficiente en la ubicación para el producto #{$productId}. Disponible: {$avail}, Requerido: {$qty}");
            }
            $newQty = (float) $row['quantity'] - $qty;
            $newReserved = max(0, (float) $row['reserved_quantity'] - $qty);

            $stmtUpd = $this->db->prepare("UPDATE stock SET quantity = :q, reserved_quantity = :r WHERE id = :id");
            $stmtUpd->execute([':q' => $newQty, ':r' => $newReserved, ':id' => $row['id']]);
        } else {
            $stmtRows = $this->db->prepare(
                "SELECT id, quantity, reserved_quantity FROM stock
                 WHERE product_id = :p_id AND warehouse_id = :w_id AND quantity > 0
                 ORDER BY quantity DESC
                 FOR UPDATE"
            );
            $stmtRows->execute([':p_id' => $productId, ':w_id' => $warehouseId]);
            $rows = $stmtRows->fetchAll();

            $rem = $qty;
            foreach ($rows as $row) {
                if ($rem <= 0) break;
                $rowQty = (float) $row['quantity'];
                $deduct = min($rem, $rowQty);

                $newQ = $rowQty - $deduct;
                $newR = max(0, (float) $row['reserved_quantity'] - $deduct);

                $stmtUpd = $this->db->prepare("UPDATE stock SET quantity = :q, reserved_quantity = :r WHERE id = :id");
                $stmtUpd->execute([':q' => $newQ, ':r' => $newR, ':id' => $row['id']]);

                $rem -= $deduct;
            }

            if ($rem > 0) {
                throw new Exception("Stock físico insuficiente en el almacén para el producto #{$productId}. Faltaron {$rem} unidades por descontar.");
            }
        }
    }

    private function syncItems(int $orderId, array $items): void
    {
        $stmtDel = $this->db->prepare("DELETE FROM dispatch_order_items WHERE dispatch_order_id = :order_id");
        $stmtDel->execute([':order_id' => $orderId]);

        $stmtIns = $this->db->prepare(
            "INSERT INTO dispatch_order_items
                (dispatch_order_id, product_id, requested_quantity, warehouse_space_id, space_selection_type, dispatch_status, notes)
             VALUES
                (:order_id, :product_id, :requested_quantity, :warehouse_space_id, :space_selection_type, :dispatch_status, :notes)"
        );

        foreach ($items as $item) {
            $spaceIdVal = $item['warehouseSpaceId'] ?? ($item['warehouse_space_id'] ?? null);
            $assignments = $item['warehouseSpaceAssignments'] ?? ($item['warehouse_space_assignments'] ?? null);

            $notes = $item['notes'] ?? null;
            if (is_array($assignments) && !empty($assignments)) {
                $notes = json_encode($assignments);
                if (empty($spaceIdVal) && !empty($assignments[0]['warehouseSpaceId'])) {
                    $spaceIdVal = $assignments[0]['warehouseSpaceId'];
                }
            }

            $stmtIns->execute([
                ':order_id'             => $orderId,
                ':product_id'           => (int) ($item['productId'] ?? ($item['product_id'] ?? 0)),
                ':requested_quantity'   => (float) ($item['requestedQuantity'] ?? ($item['quantityRequired'] ?? 0)),
                ':warehouse_space_id'   => !empty($spaceIdVal) ? (int) $spaceIdVal : null,
                ':space_selection_type' => $item['spaceSelectionType'] ?? ($item['space_selection_type'] ?? 'AUTO'),
                ':dispatch_status'      => $item['dispatchStatus'] ?? ($item['dispatch_status'] ?? 'PENDIENTE'),
                ':notes'                => $notes,
            ]);
        }
    }
}
