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
  assignedStores?: string[]; // IDs of stores this user can manage (e.g., for COMPRAS)
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  qrCode: string;
  isFractional: boolean;
  fractionType?: 'Litro' | 'Metro' | 'Kilo';
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
  code: string; // Auto-generated QR/Numeric
  name: string;
  imageUrl: string;
  footerUrl: string;
  categoryId: string;
  dimensions: {
    height: number;
    width: number;
    depth: number;
  };
  costs: number[]; // Max 2
  prices: number[]; // Max 5
  enabledStores: string[]; // Store IDs
}

export interface Store {
  id: string;
  name: string;
  description: string;
  qrCode: string;
}

export interface Location {
  id: string;
  storeId: string;
  room: string;
  shelf: string;
  cubicle: string;
}

export interface Stock {
  id: string;
  productId: string;
  storeId: string;
  locationId?: string; // Optional if it's raw stock not yet assigned
  quantity: number;
  minStock: number;
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
  storeId: string;
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
  locationId?: string;
  quantity: number;
  reason: DisincorporationReason;
  notes?: string;
}

export interface Disincorporation {
  id: string;
  storeId: string;
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
  storeId: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  locationId?: string;
  referenceId?: string; // e.g., lotId or disincorporationId
  createdAt: string;
  createdBy: string;
  notes?: string;
}
