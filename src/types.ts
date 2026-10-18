export type Role = 'COMPRAS' | 'DEPOSITO' | 'DESINCORPORACION' | 'ADMIN';

export type Permission = 
  | 'MANAGE_USERS'
  | 'EDIT_MIN_STOCK'
  | 'MANAGE_CATALOG'
  | 'MANAGE_INFRASTRUCTURE'
  | 'APPROVE_PURCHASES'
  | 'MANAGE_DISINCORPORATION'
  | 'VIEW_REPORTS'
  | 'EXPORT_DATA'
  | 'VIEW_STOCK_MOVEMENTS';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string; // Optional for now to avoid breaking existing code if needed
  role: Role;
  permissions?: Permission[];
  assignedWarehouses?: string[]; // IDs of warehouses this user can manage (e.g., for COMPRAS)
}

export interface Subcategory {
  id?: string | number;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  qrCode: string;
  isFractional: boolean;
  fractionType?: 'Litro' | 'Metro' | 'Kilo';
  subcategories?: Subcategory[];
}

export interface Provider {
  id: string;
  code: string;
  name: string;
  contact_number?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  code: string;          // Código del producto (valor escaneado o escrito)
  codeType?: 'qr' | 'barcode'; // Tipo de representación visual: QR o código de barras (default: 'qr')
  name: string;
  imageUrl: string;
  footerUrl: string;
  categoryId: string;
  subcategoryId?: string | null;
  providers?: string[];
  dimensions: {
    height: number;
    width: number;
    depth: number;
  };
  costs: number[];
  prices: number[];
  enabledWarehouses: string[];
}

export interface Warehouse {
  id: string;
  name: string;
  description: string;
  qrCode: string;
}

export type SpaceUsageType = 'Despachos' | 'Almacenamiento';

export interface SpaceType {
  id: string;
  name: string;
}

export interface WarehouseSpace {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  spaceTypeId: string;
  spaceTypeName?: string;
  spaceUsageType: SpaceUsageType;
  name: string;
  proximity: number;
  qrCode: string;
  groupId?: string | number;
  productCount?: number;
  totalQuantity?: number;
}

export interface Stock {
  id: string;
  productId: string;
  warehouseId: string;
  warehouseSpaceId?: string; // Optional if it's raw stock not yet assigned
  quantity: number;
  reservedQuantity?: number;
  minStock: number;
  minStockDispatch: number;
}

export interface PickingLotItem {
  id: string;
  productId: string;
  quantityToEnter: number;
  numberOfPackages: number;
  packagesConfig: { packageIndex: number; quantity: number; description?: string }[];
  packageDimensions?: { height: number; width: number; depth: number }; // Opcional: legado
  packageDescription?: string; // Texto libre de descripción por bulto (nuevo)
  minStockAlert: number;
}

export type PickingLotStatus = 'DRAFT' | 'PENDING' | 'CONFORMED';

export interface PickingLot {
  id: string;
  lotNumber: string;
  warehouseId: string;
  description: string;
  items: PickingLotItem[];
  status: PickingLotStatus;
  createdAt: string; // ISO string
  conformedAt?: string;
  createdBy: string; // User ID
}

export type DisincorporationReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'THEFT' | 'OBSOLETE' | 'OTHER';
export type DisincorporationStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface DisincorporationItem {
  id: string;
  productId: string;
  warehouseSpaceId?: string;
  quantity: number;
  reason: DisincorporationReason;
  notes?: string;
}

export interface Disincorporation {
  id: string;
  warehouseId: string;
  items: DisincorporationItem[];
  status: DisincorporationStatus;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  description: string;
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER';
export type MovementReason = 'RECEPTION' | 'DISINCORPORATION' | 'MANUAL_ADJUSTMENT' | 'RELOCATION';

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  warehouseSpaceId?: string;
  referenceId?: string; // e.g., lotId or disincorporationId
  createdAt: string;
  createdBy: string;
  notes?: string;
}

// ============================================================
// LLAVES DE ACCESO
// ============================================================

export type LockModule =
  | 'CATALOG'
  | 'CATEGORIES'
  | 'PROVIDERS'
  | 'INFRASTRUCTURE'
  | 'PURCHASING'
  | 'WAREHOUSE'
  | 'DISINCORPORATION'
  | 'USERS'
  | 'SETTINGS'
  | 'INVENTORY'
  | 'DISPATCHES';

export type LockAction =
  | 'DELETE'
  | 'EDIT'
  | 'CREATE'
  | 'IMPORT'
  | 'EXPORT'
  | 'VIEW'
  | 'CONFORM'
  | 'APPROVE'
  | 'ADJUST_STOCK'
  | '*';

export interface LockKey {
  id: string;
  name: string;
  module: LockModule;
  action: LockAction;
  isActive: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// DESPACHOS
// ============================================================

export type DispatchOrderStatus = 'PENDIENTE' | 'PROCESANDO' | 'DESPACHADO' | 'CANCELADO' | 'EN_PROCESO' | 'CONFIRMADO';

export type DispatchDeliveryType =
  | 'TIENDA SUPREPARTS'
  | 'DELIVERY TIENDA'
  | 'DELIVERY VENDEDOR'
  | 'RETIRO EN TIENDA'
  | 'OTRO';

export interface DispatchOrderItem {
  id: string;
  productId: string;
  requestedQuantity: number;
  quantityRequired?: number;
  warehouseSpaceId?: string | null;
  spaceSelectionType?: 'AUTO' | 'MANUAL';
  dispatchStatus?: 'PENDIENTE' | 'DESPACHADO' | 'INSUFICIENTE';
  warehouseSpaceAssignments?: { warehouseSpaceId: string; quantity: number }[];
  notes?: string;
}

export interface DispatchOrder {
  id: string;
  code: string;              // Ej: D00001
  warehouseId: string;
  requestedBy: string;       // Quien solicita
  clientName: string;        // Nombre Cliente
  deliveryType: DispatchDeliveryType;
  origin?: 'DIRECT' | 'EXTERNAL' | string;
  items: DispatchOrderItem[];
  status: DispatchOrderStatus;
  notes?: string;
  createdAt: string;
  createdBy: string;
  dispatchedBy?: string;
  updatedAt?: string;
  dispatchedAt?: string;
}

// ============================================================
// 4 NUEVOS MÓDULOS: STOCK MÍNIMO, TRANSFERENCIA, RDI Y AVERÍAS
// ============================================================

export interface SpaceDistributionItem {
  warehouseSpaceId: string | null;
  spaceName: string;
  quantity: number;
}

export interface MinStockGeneralRow {
  productId: string;
  productCode: string;
  productName: string;
  imageUrl?: string;
  categoryId?: string | null;
  categoryName?: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  minStock: number;
  lastMovementAt?: string | null;
  isArchived?: boolean;
}

export interface MinStockDispatchRow {
  stockId: string;
  productId: string;
  productCode: string;
  productName: string;
  imageUrl?: string;
  categoryId?: string | null;
  categoryName?: string;
  warehouseId: string;
  warehouseName: string;
  warehouseSpaceId: string;
  warehouseSpaceName: string;
  currentStock: number;
  minStockDispatch: number;
  lastMovementAt?: string | null;
}

export interface MinStockArchivedRow {
  archiveId: string;
  productId: string;
  productCode: string;
  productName: string;
  imageUrl?: string;
  categoryId?: string | null;
  categoryName?: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  minStock: number;
  archivedAt: string;
  archiveDeadlineAt: string;
  archivedBy?: string | null;
  archivedByName?: string;
  isArchived: boolean;
}

export type TransferPickingStatus = 'DRAFT' | 'PENDING' | 'CONFORMED';

export interface TransferPickingItem {
  id?: string;
  transferPickingId?: string;
  productId: string;
  productCode?: string;
  productName?: string;
  imageUrl?: string;
  categoryName?: string;
  quantity: number;
  numberOfPackages?: number;
  spacesDistribution: SpaceDistributionItem[];
}

export interface TransferPicking {
  id: string;
  lotNumber: string;
  originWarehouseId: string;
  originWarehouseName?: string;
  destinationWarehouseId: string;
  destinationWarehouseName?: string;
  responsibleUserId: string;
  responsibleUserName?: string;
  description?: string;
  status: TransferPickingStatus;
  linkedPickingLotId?: string | null;
  stockDeducted: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  conformedAt?: string | null;
  totalItems?: number;
  totalPackages?: number;
  totalQuantity?: number;
  items?: TransferPickingItem[];
}

export type RdiType = 'FALTANTE' | 'SOBRANTE';
export type RdiStatus = 'DRAFT' | 'PENDING' | 'CONFORMED';

export interface RdiRecord {
  id: string;
  code: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productCode?: string;
  productName?: string;
  imageUrl?: string;
  rdiType: RdiType;
  quantity: number;
  spacesDistribution: SpaceDistributionItem[];
  status: RdiStatus;
  stockApplied: boolean;
  responsibleUserId: string;
  responsibleUserName?: string;
  description?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  conformedAt?: string | null;
  currentStock?: number;
}

export type DamageStatus = 'DRAFT' | 'PENDING' | 'CONFORMED';

export interface DamageRecord {
  id: string;
  code: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productCode?: string;
  productName?: string;
  imageUrl?: string;
  inventoryCorrection: boolean;
  quantity: number;
  spacesDistribution?: SpaceDistributionItem[] | null;
  status: DamageStatus;
  stockApplied: boolean;
  responsibleUserId: string;
  responsibleUserName?: string;
  description?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  conformedAt?: string | null;
  currentStock?: number;
}

