import React, { useState } from 'react';
import { Stock, User, Warehouse, Product, WarehouseSpace, Provider } from '../../../types';
import {
  Search, Printer, MapPin, Box, ScanLine, Edit2, Check, X,
  Package, Eye, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, Ruler, Users, Download,
  Settings2, Layers, Save, Loader2, QrCode, Warehouse as WarehouseIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { QRScannerModal } from '../../../components/QRScannerModal';
import { useLockedAction } from '../../../hooks/useLockedAction';
import { LockModal } from '../../../components/LockModal';

interface InventoryTabProps {
  stock: Stock[];
  products: Product[];
  warehouses: Warehouse[];
  warehouseSpaces: WarehouseSpace[];
  providers: Provider[];
  getProduct: (id: string) => any;
  getCategory: (id: string) => any;
  getLocation: (id: string) => any;
  getStore: (id: string) => any;
  getProvider?: (id: string) => any;
  user: User | null;
  updateMinStock: (productId: string, warehouseId: string, newMinStock: number) => void;
  updateStockQuantity: (stockId: string, newQuantity: number) => void;
  updateProduct: (productId: string, data: unknown) => Promise<void>;
  assignSpace: (stockId: string, newSpaceId: string | null) => Promise<void>;
  upsertStock: (payload: {
    productId: string;
    warehouseId: string;
    warehouseSpaceId: string | null;
    quantity: number;
    minStock: number;
  }) => Promise<void>;
  initialSpaceFilter?: string;
}

// ── Fila etiqueta + valor para el modal de detalles ────────────────────────────
const DetailRow: React.FC<{
  label: string;
  value?: string | number | null;
  mono?: boolean;
  empty?: boolean;
}> = ({ label, value, mono = false, empty = false }) => (
  <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
    <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] flex-shrink-0 border-r border-slate-200">
      {label}
    </div>
    <div className={`flex-1 px-3 py-2 text-sm ${mono ? 'font-mono text-blue-600 font-medium' : ''} ${empty ? 'text-slate-400 italic' : 'text-slate-900 font-medium'}`}>
      {empty ? 'Sin datos' : (value ?? '—')}
    </div>
  </div>
);

// ── Bloque Stock N ─────────────────────────────────────────────────────────────
const StockBlock: React.FC<{
  index: number;
  spaceName: string | null;
  qty: number;
  pending?: boolean;
}> = ({ index, spaceName, qty, pending = false }) => (
  <div className={`border rounded-xl overflow-hidden ${pending ? 'border-amber-200' : 'border-slate-200'}`}>
    <div className={`px-3 py-1.5 flex items-center justify-between border-b ${pending ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`text-xs font-semibold uppercase tracking-wide ${pending ? 'text-amber-700' : 'text-slate-600'}`}>
        {pending ? 'Pendiente' : `Stock ${index}`}
      </span>
      <span className={`text-lg font-bold ${pending ? 'text-amber-700' : 'text-blue-600'}`}>
        {qty}
      </span>
    </div>
    <div className="px-3 py-2 bg-white">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className={spaceName ? 'text-slate-700' : 'text-slate-400 italic'}>
          {spaceName ?? 'Sin espacio asignado'}
        </span>
      </div>
    </div>
  </div>
);

export const InventoryTab: React.FC<InventoryTabProps> = ({
  stock,
  products,
  warehouses,
  warehouseSpaces,
  providers,
  getProduct,
  getCategory,
  getLocation,
  getStore,
  getProvider,
  user,
  updateMinStock,
  updateStockQuantity,
  updateProduct,
  assignSpace,
  upsertStock,
  initialSpaceFilter = '',
}) => {
  const lockEdit   = useLockedAction('INVENTORY', 'EDIT');
  const lockView   = useLockedAction('INVENTORY', 'VIEW');
  const lockDelete = useLockedAction('INVENTORY', 'DELETE');
  const lockExport = useLockedAction('INVENTORY', 'EXPORT');

  const [inventorySearch, setInventorySearch]                 = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('');
  const [inventoryStoreFilter, setInventoryStoreFilter]       = useState('');
  const [inventorySpaceFilter]                                = useState(initialSpaceFilter);
  const [isScannerOpen, setIsScannerOpen]                     = useState(false);
  const [editingMinStock, setEditingMinStock]                 = useState<{ productId: string; warehouseId: string } | null>(null);
  const [minStockValue, setMinStockValue]                     = useState('');
  const [editingStockQty, setEditingStockQty]                 = useState<{ stockId: string; value: string } | null>(null);
  const [detailProduct, setDetailProduct]                     = useState<string | null>(null);
  const [expandedStock, setExpandedStock]                     = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]                         = useState(false);

  // ── Ordenamiento de la tabla de inventario ────────────────────────────────
  type InventorySortKey = 'name' | 'code' | 'category' | 'subcategory' | 'totalQty' | 'pendingQty' | 'warehouse';
  const [sortKey, setSortKey] = useState<InventorySortKey | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: InventorySortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Estado modales adicionales ────────────────────────────────────────────────
  const [adminEditProduct, setAdminEditProduct]               = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm]                     = useState<Record<string, any>>({});
  const [adminEditSaving, setAdminEditSaving]                 = useState(false);
  const [adminEditError, setAdminEditError]                   = useState<string | null>(null);

  // New admin modal specific state variables
  const [adminSelectedWarehouseId, setAdminSelectedWarehouseId] = useState<string>('');
  const [adminPendingQty, setAdminPendingQty]                 = useState<number>(0);
  const [adminTotalInput, setAdminTotalInput]                 = useState<number>(0);
  const [adminMinStockVal, setAdminMinStockVal]               = useState<string>('0');
  const [adminSlots, setAdminSlots]                           = useState<{ spaceId: string | null; qty: number | string }[]>([
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
  ]);
  const [adminOriginalStock, setAdminOriginalStock]           = useState<Stock[]>([]);
  const [activeSlotIndexForSpacePicker, setActiveSlotIndexForSpacePicker] = useState<number | null>(null);
  const [spacePickerSearch, setSpacePickerSearch]             = useState('');
  const [isSpacePickerScannerOpen, setIsSpacePickerScannerOpen] = useState(false);

  const [spaceEditProduct, setSpaceEditProduct]               = useState<string | null>(null);
  const [spaceEditQty, setSpaceEditQty]                       = useState<Record<string, string>>({});
  const [spaceEditSaving, setSpaceEditSaving]                 = useState<string | null>(null);
  const [spaceEditActiveStockId, setSpaceEditActiveStockId]   = useState<string | null>(null);
  const [spaceEditPickerSearch, setSpaceEditPickerSearch]     = useState('');
  const [isSpaceEditPickerScannerOpen, setIsSpaceEditPickerScannerOpen] = useState(false);
  const [spaceEditTotalOriginal, setSpaceEditTotalOriginal]   = useState<number>(0);
  const [spaceEditError, setSpaceEditError]                   = useState<string | null>(null);

  const canEditMinStock = user?.role === 'ADMIN' || user?.permissions?.includes('EDIT_MIN_STOCK');

  const toggleStockExpand = (productId: string) => {
    setExpandedStock(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  // Agrupar stock existente
  const stockGrouped = stock.reduce((acc, item) => {
    const key = String(item.productId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Stock[]>);

  // Filtrado sobre todos los productos
  const filteredInventory = products.filter(p => {
    const productId = String(p.id);
    const matchesSearch   = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || p.code.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === '' || String(p.categoryId) === String(inventoryCategoryFilter);
    const matchesStore    = inventoryStoreFilter === '' || (stockGrouped[productId]?.some(s => String(s.warehouseId) === String(inventoryStoreFilter)) ?? false);
    // Si hay filtro por espacio, solo incluir productos que tienen stock en ese espacio
    const matchesSpace    = inventorySpaceFilter === '' || (stockGrouped[productId]?.some(s => String(s.warehouseSpaceId) === String(inventorySpaceFilter)) ?? false);
    return matchesSearch && matchesCategory && matchesStore && matchesSpace;
  });

  const uniqueCategories = Array.from(
    new Set(products.map(p => p.categoryId).filter(Boolean))
  ).map(catId => getCategory(catId)).filter(Boolean);

  // Ordenar la lista filtrada antes de agrupar
  const sortedInventory = sortKey
    ? [...filteredInventory].sort((a, b) => {
        let valA: any, valB: any;
        const aItems = stockGrouped[String(a.id)] ?? [];
        const bItems = stockGrouped[String(b.id)] ?? [];
        switch (sortKey) {
          case 'name':
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
            break;
          case 'code':
            valA = (a.code || '').toLowerCase();
            valB = (b.code || '').toLowerCase();
            break;
          case 'category': {
            const catA = getCategory(a.categoryId);
            const catB = getCategory(b.categoryId);
            valA = (catA?.name || '').toLowerCase();
            valB = (catB?.name || '').toLowerCase();
            break;
          }
          case 'subcategory': {
            const catA = getCategory(a.categoryId);
            const catB = getCategory(b.categoryId);
            valA = (catA?.subcategories?.find((s: any) => String(s.id) === String(a.subcategoryId))?.name || '').toLowerCase();
            valB = (catB?.subcategories?.find((s: any) => String(s.id) === String(b.subcategoryId))?.name || '').toLowerCase();
            break;
          }
          case 'totalQty':
            valA = aItems.reduce((s, i) => s + Number(i.quantity), 0);
            valB = bItems.reduce((s, i) => s + Number(i.quantity), 0);
            break;
          case 'pendingQty':
            valA = aItems.filter(i => !i.warehouseSpaceId).reduce((s, i) => s + Number(i.quantity), 0);
            valB = bItems.filter(i => !i.warehouseSpaceId).reduce((s, i) => s + Number(i.quantity), 0);
            break;
          default: return 0;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredInventory;

  // groupedInventory: mapa productId → Stock[] (se mantiene para compatibilidad con modales/detalles)
  const groupedInventory = sortedInventory.reduce((acc, p) => {
    const key = String(p.id);
    acc[key] = stockGrouped[key] ?? [];
    return acc;
  }, {} as Record<string, Stock[]>);

  // ── Filas de la tabla: 1 fila por (productId × warehouseId) ─────────────────
  // Si un producto no tiene stock, aparece 1 fila con warehouseId vacío.
  // Si tiene stock en N almacenes, aparece N filas, una por almacén.
  // Si hay filtro de almacén activo, solo se genera la fila del almacén seleccionado.
  type InventoryRow = { productId: string; warehouseId: string; items: Stock[] };
  const inventoryRows: InventoryRow[] = sortedInventory.flatMap(p => {
    const pid = String(p.id);
    const allItems = stockGrouped[pid] ?? [];
    let warehouseIds = [...new Set(allItems.map(s => String(s.warehouseId)).filter(Boolean))];
    // Respetar el filtro de almacén: solo mostrar la fila del almacén seleccionado
    if (inventoryStoreFilter) {
      warehouseIds = warehouseIds.filter(wid => wid === String(inventoryStoreFilter));
    }
    if (warehouseIds.length === 0) {
      return [{ productId: pid, warehouseId: '', items: [] }];
    }
    return warehouseIds.map(wid => ({
      productId: pid,
      warehouseId: wid,
      items: allItems.filter(s => String(s.warehouseId) === wid),
    }));
  });

  if (sortKey === 'warehouse') {
    inventoryRows.sort((a, b) => {
      const nameA = (a.warehouseId ? getStore(a.warehouseId)?.name : '') || '';
      const nameB = (b.warehouseId ? getStore(b.warehouseId)?.name : '') || '';
      if (nameA < nameB) return sortDir === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Cantidad de productos únicos (para el header)
  const uniqueProductCount = new Set(inventoryRows.map(r => r.productId)).size;

  const activeFiltersCount = [inventoryCategoryFilter, inventoryStoreFilter].filter(Boolean).length;

  const pickerFilteredSpaces = warehouseSpaces.filter(space => {
    const matchesWarehouse = String(space.warehouseId) === String(adminSelectedWarehouseId);
    const matchesSearch = space.name.toLowerCase().includes(spacePickerSearch.toLowerCase()) ||
                          space.qrCode.toLowerCase().includes(spacePickerSearch.toLowerCase()) ||
                          (space.spaceTypeName || '').toLowerCase().includes(spacePickerSearch.toLowerCase());
    return matchesWarehouse && matchesSearch;
  });

  const spaceEditOriginalItem = spaceEditActiveStockId ? stock.find(s => String(s.id) === String(spaceEditActiveStockId)) : null;
  const spaceEditSelectedWarehouseId = spaceEditOriginalItem ? spaceEditOriginalItem.warehouseId : '';

  const spaceEditPickerFilteredSpaces = warehouseSpaces.filter(space => {
    const matchesWarehouse = String(space.warehouseId) === String(spaceEditSelectedWarehouseId);
    const matchesSearch = space.name.toLowerCase().includes(spaceEditPickerSearch.toLowerCase()) ||
                          space.qrCode.toLowerCase().includes(spaceEditPickerSearch.toLowerCase()) ||
                          (space.spaceTypeName || '').toLowerCase().includes(spaceEditPickerSearch.toLowerCase());
    return matchesWarehouse && matchesSearch;
  });

  // ── Min-stock y Stock Físico ──────────────────────────────────────────────────
  const handleSaveMinStock = (productId: string, warehouseId: string) => {
    const value = parseFloat(minStockValue);
    if (!isNaN(value) && value >= 0) updateMinStock(productId, warehouseId, value);
    setEditingMinStock(null);
  };

  const handleSaveStockQty = (stockId: string, valueStr: string) => {
    const value = parseFloat(valueStr);
    if (!isNaN(value) && value >= 0) updateStockQuantity(stockId, value);
    setEditingStockQty(null);
  };

  // ── Handlers modal Editar Admin ───────────────────────────────────────────────
  const openAdminEdit = (productId: string) => {
    const p = getProduct(productId);
    if (!p) return;

    // Load initial warehouse
    const initialWarehouseId = inventoryStoreFilter || stock.find(s => String(s.productId) === String(productId))?.warehouseId || warehouses[0]?.id || '';

    // Load stock items for this product and selected warehouse
    const whStock = stock.filter(s => String(s.productId) === String(productId) && String(s.warehouseId) === String(initialWarehouseId));

    // Pending stock (sin ubicación asignada)
    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pendingQty = pendingItem ? Number(pendingItem.quantity) : 0;

    // Min stock
    const minSt = whStock.reduce((a, c) => Math.max(a, c.minStock), 0);

    // Slots (only show spaces with quantity > 0 to avoid empty references hanging on screen)
    const spaceItems = whStock.filter(s => s.warehouseSpaceId && Number(s.quantity) > 0);
    const slots = [0, 1, 2, 3].map(i => {
      const item = spaceItems[i];
      return {
        spaceId: item?.warehouseSpaceId || null,
        qty: item ? Number(item.quantity) : '',
      };
    });

    // Stock total = pendiente + suma de todos los slots asignados
    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const totalQty = pendingQty + assignedQty;

    setAdminSelectedWarehouseId(initialWarehouseId);
    setAdminPendingQty(pendingQty);
    setAdminTotalInput(totalQty);
    setAdminMinStockVal(String(minSt));
    setAdminSlots(slots);
    setAdminOriginalStock(whStock);
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');

    setAdminEditForm({
      name: p.name ?? '',
      code: p.code ?? '',
      categoryId: p.categoryId ?? '',
      subcategoryId: p.subcategoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      height: p.dimensions?.height ?? 0,
      width:  p.dimensions?.width  ?? 0,
      depth:  p.dimensions?.depth  ?? 0,
      cost0: p.costs?.[0] ?? '',
      cost1: p.costs?.[1] ?? '',
      price0: p.prices?.[0] ?? '',
      price1: p.prices?.[1] ?? '',
      price2: p.prices?.[2] ?? '',
      price3: p.prices?.[3] ?? '',
      price4: p.prices?.[4] ?? '',
      providerId: p.providers?.[0] ?? '',
    });
    setAdminEditError(null);
    setAdminEditProduct(productId);
  };

  const handleAdminWarehouseChange = (newWarehouseId: string) => {
    if (!adminEditProduct) return;
    setAdminSelectedWarehouseId(newWarehouseId);

    // Load stock for this warehouse
    const whStock = stock.filter(s => String(s.productId) === String(adminEditProduct) && String(s.warehouseId) === String(newWarehouseId));

    // Pending stock (sin ubicación asignada)
    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pendingQty = pendingItem ? Number(pendingItem.quantity) : 0;

    // Min stock
    const minSt = whStock.reduce((a, c) => Math.max(a, c.minStock), 0);

    // 4 Slots (only show spaces with quantity > 0)
    const spaceItems = whStock.filter(s => s.warehouseSpaceId && Number(s.quantity) > 0);
    const slots = [0, 1, 2, 3].map(i => {
      const item = spaceItems[i];
      return {
        spaceId: item?.warehouseSpaceId || null,
        qty: item ? Number(item.quantity) : '',
      };
    });

    // Stock total = pendiente + suma de todos los slots asignados
    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const totalQty = pendingQty + assignedQty;

    setAdminPendingQty(pendingQty);
    setAdminTotalInput(totalQty);
    setAdminMinStockVal(String(minSt));
    setAdminSlots(slots);
    setAdminOriginalStock(whStock);
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');
  };

  const handleSaveAdminEdit = async () => {
    if (!adminEditProduct) return;
    setAdminEditSaving(true);
    setAdminEditError(null);
    try {
      const p = getProduct(adminEditProduct);
      const costs  = [adminEditForm.cost0, adminEditForm.cost1].map(Number).filter((v, i) => i === 0 || adminEditForm[`cost${i}`] !== '');
      const prices = [adminEditForm.price0, adminEditForm.price1, adminEditForm.price2, adminEditForm.price3, adminEditForm.price4]
        .map(Number)
        .filter((_, i) => adminEditForm[`price${i}`] !== '');
      
      const providersList = adminEditForm.providerId ? [adminEditForm.providerId] : [];
      const minStock = Number(adminMinStockVal || 0);

      // Save/update stock records for the selected warehouse.
      // El pendiente real = adminTotalInput - suma de todos los slots asignados
      // (no usar adminPendingQty directamente para evitar desincronías)
      const slotsTotal = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
      const realPendingQty = Math.max(0, adminTotalInput - slotsTotal);

      const newStockMap = new Map<string | null, number>();

      // Stock sin ubicación asignada (pendiente real derivado del total)
      newStockMap.set(null, realPendingQty);

      // Slots de espacios — sin acumulación: el último valor por spaceId prevalece
      adminSlots.forEach(slot => {
        const qtyNum = Number(slot.qty) || 0;
        if (slot.spaceId && qtyNum >= 0) {
          // Si el mismo spaceId aparece en dos slots, tomar el mayor (caso de error de usuario)
          const existing = newStockMap.get(slot.spaceId) ?? 0;
          newStockMap.set(slot.spaceId, Math.max(existing, qtyNum));
        }
      });

      // Find original stock records that are no longer present in our map
      // and set their quantity to 0
      const spacesToZero = new Set<string | null>();
      adminOriginalStock.forEach(orig => {
        const spaceKey = orig.warehouseSpaceId || null;
        if (!newStockMap.has(spaceKey)) {
          spacesToZero.add(spaceKey);
        }
      });

      // Execute stock updates
      const updatePromises: Promise<any>[] = [];

      newStockMap.forEach((qty, spaceId) => {
        updatePromises.push(
          upsertStock({
            productId: adminEditProduct,
            warehouseId: adminSelectedWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: qty,
            minStock: minStock,
          })
        );
      });

      spacesToZero.forEach(spaceId => {
        updatePromises.push(
          upsertStock({
            productId: adminEditProduct,
            warehouseId: adminSelectedWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: 0,
            minStock: minStock,
          })
        );
      });

      // Wait for all upserts to finish
      await Promise.all(updatePromises);

      // Save product and reload data via hook
      await updateProduct(adminEditProduct, {
        name:       adminEditForm.name,
        code:       adminEditForm.code,
        categoryId: adminEditForm.categoryId,
        subcategoryId: adminEditForm.subcategoryId || null,
        imageUrl:   adminEditForm.imageUrl,
        dimensions: {
          height: Number(adminEditForm.height),
          width:  Number(adminEditForm.width),
          depth:  Number(adminEditForm.depth),
        },
        costs,
        prices,
        providers:        providersList,
        enabledWarehouses: p?.enabledWarehouses ?? [],
        footerUrl:        p?.footerUrl ?? '',
      });

      setAdminEditProduct(null);
    } catch (err: any) {
      setAdminEditError(err?.message ?? 'Error al guardar');
    } finally {
      setAdminEditSaving(false);
    }
  };

  // Asignar un espacio a un item de stock desde el picker
  const handlePickSpace = (spaceId: string) => {
    if (activeSlotIndexForSpacePicker === null) return;
    setAdminSlots(prev => {
      const next = [...prev];
      next[activeSlotIndexForSpacePicker] = {
        ...next[activeSlotIndexForSpacePicker],
        spaceId: spaceId,
      };
      return next;
    });
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');
  };

  // ── Handlers modal Editar Espacios ────────────────────────────────────────────
  const openSpaceEdit = (productId: string) => {
    const items = groupedInventory[productId] ?? [];
    const initial: Record<string, string> = {};
    const total = items.reduce((a, c) => a + Number(c.quantity), 0);
    items.forEach(item => { initial[item.id] = String(item.quantity); });
    setSpaceEditQty(initial);
    setSpaceEditTotalOriginal(total);
    setSpaceEditError(null);
    setSpaceEditProduct(productId);
    setSpaceEditActiveStockId(null);
    setSpaceEditPickerSearch('');
  };

  const handleSaveSpaceQty = async (stockId: string) => {
    const val = parseFloat(spaceEditQty[stockId] ?? '');
    if (isNaN(val) || val < 0) return;

    // Calcular la suma total si se aplica este cambio
    const items = spaceEditProduct ? (groupedInventory[spaceEditProduct] ?? []) : [];
    const newTotal = items.reduce((sum, item) => {
      const qty = item.id === stockId ? val : parseFloat(spaceEditQty[item.id] ?? String(item.quantity));
      return sum + (isNaN(qty) ? Number(item.quantity) : qty);
    }, 0);

    if (Math.round(newTotal * 10000) !== Math.round(spaceEditTotalOriginal * 10000)) {
      setSpaceEditError(
        `La cantidad total debe ser siempre ${spaceEditTotalOriginal} unidades (ingresadas desde administrador). ` +
        `Con este cambio el total quedaría en ${newTotal}. Ajusta las cantidades para que sumen exactamente ${spaceEditTotalOriginal}.`
      );
      return;
    }

    setSpaceEditError(null);
    setSpaceEditSaving(stockId);
    try {
      await updateStockQuantity(stockId, val);
    } finally {
      setSpaceEditSaving(null);
    }
  };

  const handleSpaceEditPickSpace = async (spaceId: string) => {
    if (!spaceEditActiveStockId) return;
    setSpaceEditSaving(spaceEditActiveStockId);
    try {
      await assignSpace(spaceEditActiveStockId, spaceId);
    } finally {
      setSpaceEditSaving(null);
      setSpaceEditActiveStockId(null);
      setSpaceEditPickerSearch('');
    }
  };

  // ── Exportar a CSV ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const data = inventoryRows.map(({ productId, warehouseId, items }) => {
      const product = getProduct(productId);
      const category = product ? getCategory(product.categoryId) : null;
      const subcategoryName = product?.subcategoryId && category?.subcategories
        ? category.subcategories.find((s: any) => String(s.id) === String(product.subcategoryId))?.name ?? ''
        : '';
      const warehouse = warehouseId ? getStore(warehouseId) : null;

      const totalQty = items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const minStock = items.reduce((max, item) => Math.max(max, item.minStock), 0);

      const assigned = items.filter(i => i.warehouseSpaceId);
      const pending  = items.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);

      const spacesText = assigned.map(item => {
        const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
        return `${space?.name ?? 'Espacio'}: ${item.quantity}`;
      }).concat(pending.map(item => `Sin asignar: ${item.quantity}`)).join(' | ');

      return {
        'Producto': product?.name ?? '—',
        'Categoría': category?.name ?? 'Sin Categoría',
        'Sub-Categoría': subcategoryName ?? '—',
        'Código': product?.code ?? '—',
        'Almacén': warehouse?.name ?? 'Sin stock',
        'Distribución de Stock': spacesText || 'Sin existencias',
        'Stock Total': totalQty,
        'Stock Mínimo': minStock,
      };
    });

    const csvHeaders = ['Producto', 'Categoría', 'Sub-Categoría', 'Código', 'Almacén', 'Distribución de Stock', 'Stock Total', 'Stock Mínimo'];
    const csvRows = data.map(row =>
      csvHeaders.map(header => {
        const val = row[header as keyof typeof row];
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    );

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `inventario_${fecha}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const renderMinStockCell = (productId: string, warehouseId: string, minStock: number, isLowStock: boolean) => {
    const isEditing = editingMinStock?.productId === productId && editingMinStock?.warehouseId === warehouseId;
    if (isEditing) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Input type="number" min="0" value={minStockValue} onChange={e => setMinStockValue(e.target.value)}
            className="w-16 h-8 text-center px-1" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') lockEdit.execute(() => handleSaveMinStock(productId, warehouseId)); if (e.key === 'Escape') setEditingMinStock(null); }}
          />
          <button onClick={() => lockEdit.execute(() => handleSaveMinStock(productId, warehouseId))} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditingMinStock(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 group/minstock">
        <span className={`font-mono text-sm ${isLowStock ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{minStock}</span>
        {canEditMinStock && (
          <button onClick={() => { setEditingMinStock({ productId, warehouseId }); setMinStockValue(minStock.toString()); }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/minstock:opacity-100 transition-opacity" title="Editar Stock Mínimo"
          ><Edit2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    );
  };

  // ── Datos del modal de detalles ───────────────────────────────────────────────
  const detailItems       = detailProduct ? groupedInventory[detailProduct] || [] : [];
  const detailProd        = detailProduct ? getProduct(detailProduct) : null;
  const detailCat         = detailProd ? getCategory(detailProd.categoryId) : null;
  const detailMinSt       = detailItems.reduce((a, c) => Math.max(a, c.minStock), 0);
  const detailTotal       = detailItems.reduce((a, c) => a + Number(c.quantity), 0);
  const detailLow         = detailTotal <= detailMinSt && detailMinSt > 0;
  const detailWarehouseId = detailItems[0]?.warehouseId ?? '';
  const detailWarehouse   = detailWarehouseId ? getStore(detailWarehouseId) : null;
  const assignedItems     = detailItems.filter(i => i.warehouseSpaceId);
  const pendingItems      = detailItems.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);
  const dims              = detailProd?.dimensions ?? { height: 0, width: 0, depth: 0 };
  const cbm               = dims.height && dims.width && dims.depth ? ((dims.height * dims.width * dims.depth) / 1000000).toFixed(4) : '0.0000';
  const subcatName        = detailProd?.subcategoryId && detailCat?.subcategories
    ? detailCat.subcategories.find((s: any) => String(s.id) === String(detailProd.subcategoryId))?.name ?? null
    : null;
  const providerList: string[] = (detailProd?.providers ?? [])
    .filter(Boolean)
    .map((pid: string) => getProvider ? (getProvider(pid)?.name ?? `ID ${pid}`) : `ID ${pid}`);

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Inventario</h1>
          <p className="text-slate-500 mt-2">
            {uniqueProductCount} producto{uniqueProductCount !== 1 ? 's' : ''} en catálogo ·{' '}
            {inventoryRows.reduce((a, r) => a + r.items.reduce((s, c) => s + Number(c.quantity), 0), 0)} unidades en stock.
          </p>
        </div>
        <Button variant="secondary" onClick={() => lockExport.execute(handleExport)} className="gap-2 no-print w-full sm:w-auto">
          <Download className="w-5 h-5" />
          Exportar
        </Button>
      </header>

      {/* ── Tabla + filtros (mismo patrón que CatalogPage) ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">

        {/* Barra de búsqueda + filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            {/* Buscador texto */}
            <div className="flex-1">
              <Input
                icon={<Search className="w-5 h-5" />}
                placeholder="Buscar por código o nombre..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
              />
            </div>
            {/* Botón QR scanner */}
            <Button
              variant="secondary"
              className="px-3"
              onClick={() => setIsScannerOpen(true)}
              title="Escanear QR"
            >
              <ScanLine className="w-5 h-5" />
            </Button>
          </div>

          {/* Botón Filtros */}
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full sm:w-auto gap-2 ${showFilters ? 'bg-slate-200' : ''}`}
          >
            Filtros
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Panel de filtros (colapsable) */}
        {showFilters && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Filtro Almacén */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Almacén</label>
                <select
                  value={inventoryStoreFilter}
                  onChange={e => setInventoryStoreFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Categoría */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                <select
                  value={inventoryCategoryFilter}
                  onChange={e => setInventoryCategoryFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Todas las categorías</option>
                  {uniqueCategories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => { setInventoryCategoryFilter(''); setInventoryStoreFilter(''); }}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors underline underline-offset-2"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[800px] px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {([
                    { key: 'name',        label: 'Producto',      align: 'left',   sortable: true  },
                    { key: 'category',    label: 'Categoría',     align: 'left',   sortable: true  },
                    { key: 'subcategory', label: 'Sub-Categoría', align: 'left',   sortable: true  },
                    { key: 'code',        label: 'Código',        align: 'left',   sortable: true  },
                    { key: 'totalQty',    label: 'Stock',         align: 'center', sortable: true  },
                    { key: 'pendingQty',  label: 'Sin Ubicación', align: 'center', sortable: true  },
                    { key: 'warehouse',   label: 'Almacén',       align: 'left',   sortable: true  },
                  ] as { key: InventorySortKey; label: string; align: 'left' | 'center'; sortable: boolean }[]).map(col => {
                    const isActive = sortKey === col.key;
                    const Icon = isActive
                      ? (sortDir === 'asc' ? ChevronUp : ChevronDown)
                      : ChevronsUpDown;
                    return (
                      <TableHead key={col.key} className={col.align === 'center' ? 'text-center' : ''}>
                        <button
                          onClick={() => handleSort(col.key)}
                          className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-blue-600 ${
                            col.align === 'center' ? 'justify-center w-full' : ''
                          } ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                          title={`Ordenar por ${col.label}`}
                        >
                          {col.key === 'warehouse' && <WarehouseIcon className="w-3.5 h-3.5 opacity-60 mr-0.5" />}
                          {col.label}
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'opacity-40'}`} />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryRows.map(({ productId, warehouseId, items }, rowIdx) => {
                  const product  = getProduct(productId);
                  const category = getCategory(product?.categoryId || '');
                  const subcatId   = product?.subcategoryId;
                  const subcatName = subcatId && category?.subcategories
                    ? category.subcategories.find((s: any) => String(s.id) === String(subcatId))?.name
                    : null;
                  const warehouse = warehouseId ? getStore(warehouseId) : null;
                  const assigned  = items.filter(i => i.warehouseSpaceId);
                  const pending   = items.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);
                  const totalQty  = items.reduce((a, c) => a + Number(c.quantity), 0);
                  const minStock  = items.reduce((a, c) => Math.max(a, c.minStock), 0);
                  const hasStock  = items.length > 0;
                  const isLow     = hasStock && totalQty <= minStock && minStock > 0;
                  const isZero    = totalQty === 0;
                  const isExp     = expandedStock.has(`${productId}_${warehouseId}`);
                  // Clave única por producto+almacén para el acordeón
                  const rowKey    = `${productId}_${warehouseId}_${rowIdx}`;

                  return (
                    <TableRow key={rowKey} className={isLow ? 'border-l-4 border-l-red-400' : isZero ? 'border-l-4 border-l-slate-300 opacity-75' : ''}>

                      {/* Producto */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 flex-shrink-0">
                            {product?.imageUrl
                              ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                              : <Package className="w-5 h-5 text-slate-400" />
                            }
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 block truncate">{product?.name ?? '—'}</span>
                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Stock bajo
                              </span>
                            )}
                            {isZero && !isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5">
                                <Package className="w-3 h-3" /> Sin stock
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Categoría */}
                      <TableCell>
                        <Badge variant="default">{category?.name || 'Sin Categoría'}</Badge>
                      </TableCell>

                      {/* Sub-Categoría */}
                      <TableCell>
                        {subcatName
                          ? <Badge variant="default">{subcatName}</Badge>
                          : <span className="text-slate-400 text-sm">—</span>
                        }
                      </TableCell>

                      {/* Código */}
                      <TableCell>
                        <span className="font-mono text-sm text-blue-600 font-medium">{product?.code ?? '—'}</span>
                      </TableCell>

                      {/* ── Stock acordeón ──────────────────────────────────────── */}
                      <TableCell className="text-center">
                        {isZero ? (
                          // Producto sin stock: mostrar badge gris simple sin acordeón
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border bg-slate-100 text-slate-400 border-slate-200">
                            0
                          </span>
                        ) : (
                          <button
                            id={`stock-accordion-${productId}-${warehouseId}`}
                            onClick={() => toggleStockExpand(`${productId}_${warehouseId}`)}
                            className="inline-flex flex-col items-center gap-1 group/acc w-full"
                          >
                            {/* Total + flecha */}
                            <div className="flex items-center gap-2 justify-center">
                              <span className={`inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border ${
                                isLow
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {totalQty}
                              </span>
                              <span className="text-slate-400 group-hover/acc:text-blue-600 transition-colors">
                                {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {assigned.length} espacio{assigned.length !== 1 ? 's' : ''}
                              {pending.length > 0 && ` · +${pending.reduce((a, c) => a + Number(c.quantity), 0)} pend.`}
                            </span>
                          </button>
                        )}

                        {/* Lista expandida */}
                        {isExp && (
                          <div className="mt-2 space-y-1 text-left">
                            {assigned.map((item, idx) => {
                              const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
                              const isEditingQty = editingStockQty?.stockId === item.id;
                              return (
                                <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex-shrink-0">{idx + 1}</span>
                                    <span className="text-slate-700 truncate">{space?.name ?? 'Sin asignar'}</span>
                                  </div>
                                  {isEditingQty ? (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingStockQty.value}
                                        onChange={e => setEditingStockQty({ ...editingStockQty, value: e.target.value })}
                                        className="w-12 h-6 text-center border border-slate-300 rounded px-1"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value));
                                          if (e.key === 'Escape') setEditingStockQty(null);
                                        }}
                                      />
                                      <button onClick={() => lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value))} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingStockQty(null)} className="p-0.5 text-red-600 hover:bg-red-50 rounded">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-shrink-0 group/qty">
                                      <span className="font-bold text-slate-800">{Number(item.quantity)}</span>
                                      {canEditMinStock && (
                                        <button
                                          onClick={() => setEditingStockQty({ stockId: item.id, value: item.quantity.toString() })}
                                          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/qty:opacity-100 transition-opacity"
                                          title="Editar Stock"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {pending.map(item => {
                              const isEditingQty = editingStockQty?.stockId === item.id;
                              return Number(item.quantity) > 0 && (
                                <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs gap-2">
                                  <span className="text-amber-700 italic flex-1 truncate">Sin asignar</span>
                                  {isEditingQty ? (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingStockQty.value}
                                        onChange={e => setEditingStockQty({ ...editingStockQty, value: e.target.value })}
                                        className="w-12 h-6 text-center border border-amber-300 rounded px-1"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value));
                                          if (e.key === 'Escape') setEditingStockQty(null);
                                        }}
                                      />
                                      <button onClick={() => lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value))} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingStockQty(null)} className="p-0.5 text-red-600 hover:bg-red-50 rounded">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-shrink-0 group/qty">
                                      <span className="font-bold text-amber-700">{Number(item.quantity)}</span>
                                      {canEditMinStock && (
                                        <button
                                          onClick={() => setEditingStockQty({ stockId: item.id, value: item.quantity.toString() })}
                                          className="p-0.5 text-amber-500 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/qty:opacity-100 transition-opacity"
                                          title="Editar Stock"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>

                      {/* ── Sin Ubicación ─────────────────────────────────── */}
                      <TableCell className="text-center">
                        {(() => {
                          const pendingQty = pending.reduce((a, c) => a + Number(c.quantity), 0);
                          if (pendingQty === 0) {
                            return (
                              <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border bg-slate-50 text-slate-300 border-slate-200">
                                —
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 justify-center min-w-[2.5rem] h-7 px-2.5 rounded-full text-sm font-bold border bg-amber-50 text-amber-700 border-amber-300">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {pendingQty}
                            </span>
                          );
                        })()}
                      </TableCell>

                      {/* ── Almacén ───────────────────────────────────────── */}
                      <TableCell>
                        {warehouse ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                            <WarehouseIcon className="w-3 h-3 flex-shrink-0" />
                            {warehouse.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver Detalles */}
                          <button
                            id={`inventory-detail-${productId}-${warehouseId}`}
                            onClick={() => lockView.execute(() => setDetailProduct(productId))}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Ver Detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Editar Administrador */}
                          <button
                            id={`inventory-admin-edit-${productId}-${warehouseId}`}
                            onClick={() => lockEdit.execute(() => openAdminEdit(productId))}
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            title="Editar Administrador"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          {/* Editar Espacios */}
                          <button
                            id={`inventory-space-edit-${productId}-${warehouseId}`}
                            onClick={() => lockEdit.execute(() => openSpaceEdit(productId))}
                            className={`p-2 rounded-lg transition-all ${
                              isZero
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isZero ? 'Sin espacios con stock' : 'Editar Stock por Espacios'}
                            disabled={isZero}
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {inventoryRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                      No se encontraron registros en el inventario.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL VER DETALLES
      ════════════════════════════════════════════════════════════════════════ */}
      {detailProduct && detailProd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-xl border border-slate-200 my-8">

            {/* Header del modal */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Ver Detalles</h2>
              <button onClick={() => setDetailProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido: 2 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Columna izquierda: datos */}
              <div className="space-y-2">
                <DetailRow label="Código"        value={detailProd.code}       mono />
                <DetailRow label="Nombre"        value={detailProd.name}       />
                <DetailRow label="Categoría"     value={detailCat?.name}       empty={!detailCat} />
                <DetailRow label="Sub-Categoría" value={subcatName}            empty={!subcatName} />
                <DetailRow label="Almacén"       value={detailWarehouse?.name} empty={!detailWarehouse} />
              </div>

              {/* Columna derecha: imagen + dimensiones */}
              <div className="space-y-3">
                {/* Imagen */}
                <div className="border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden" style={{ minHeight: '130px' }}>
                  {detailProd.imageUrl ? (
                    <img src={detailProd.imageUrl} alt={detailProd.name} className="w-full max-h-36 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300 py-8">
                      <Package className="w-10 h-10" />
                      <span className="text-xs">Sin imagen</span>
                    </div>
                  )}
                </div>

                {/* Dimensiones */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Alto', value: dims.height ? `${dims.height} cm` : null },
                    { label: 'Ancho', value: dims.width ? `${dims.width} cm` : null },
                    { label: 'Profundidad', value: dims.depth ? `${dims.depth} cm` : null },
                    { label: 'CBM (m³)', value: cbm },
                  ].map(d => (
                    <div key={d.label} className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-500 flex items-center min-w-[80px] border-r border-slate-200">
                        {d.label}
                      </div>
                      <div className="flex-1 px-2 py-1.5 text-sm font-mono font-medium text-slate-800">
                        {d.value ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Espacios de almacén (grid de stocks) */}
            {(assignedItems.length > 0 || pendingItems.length > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Espacios de Almacén</h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {assignedItems.map((item, idx) => {
                    const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
                    return (
                      <StockBlock
                        key={item.id}
                        index={idx + 1}
                        spaceName={space?.name ?? null}
                        qty={Number(item.quantity)}
                      />
                    );
                  })}
                  {pendingItems.map(item => (
                    <StockBlock
                      key={item.id}
                      index={0}
                      spaceName={null}
                      qty={Number(item.quantity)}
                      pending
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stock Total + Stock Mínimo */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 flex items-center border-r border-slate-200 min-w-[110px]">
                  Stock Total
                </div>
                <div className="flex-1 px-4 py-3 text-2xl font-bold text-blue-600 flex items-center">
                  {detailTotal}
                </div>
              </div>
              <div className={`flex items-stretch border rounded-xl overflow-hidden ${detailLow ? 'border-red-200' : 'border-slate-200'}`}>
                <div className={`px-4 py-3 text-xs font-medium flex items-center gap-1 border-r min-w-[110px] ${detailLow ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {detailLow && <AlertTriangle className="w-3.5 h-3.5" />}
                  Stock Mínimo
                </div>
                <div className="flex-1 px-4 py-3 flex items-center gap-3">
                  <span className={`text-2xl font-bold ${detailLow ? 'text-red-600' : 'text-slate-700'}`}>{detailMinSt}</span>
                  {renderMinStockCell(detailProduct, detailWarehouseId, detailMinSt, detailLow)}
                </div>
              </div>
            </div>

            {/* Proveedores */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Proveedores
              </h3>
              <div className="space-y-2">
                {providerList.length > 0 ? (
                  providerList.map((name, idx) => (
                    <div key={idx} className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] border-r border-slate-200">
                        Proveedor {idx + 1}
                      </div>
                      <div className="flex-1 px-3 py-2 text-sm font-medium text-slate-900">{name}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden opacity-60">
                    <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] border-r border-slate-200">
                      Proveedor 1
                    </div>
                    <div className="flex-1 px-3 py-2 text-sm text-slate-400 italic">Sin proveedor asignado</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer del modal */}
            <div className="flex justify-end mt-6 pt-6 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setDetailProduct(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner QR */}
      {isScannerOpen && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={code => { setInventorySearch(code); setIsScannerOpen(false); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL EDITAR ADMINISTRADOR
      ════════════════════════════════════════════════════════════════════════ */}
      {adminEditProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-3xl w-full ${activeSlotIndexForSpacePicker !== null ? 'max-w-5xl h-[85vh]' : 'max-w-2xl max-h-[90vh]'} shadow-xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300`}>

            {/* Header principal común */}
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Editar Administrador</h2>
                  <p className="text-xs text-slate-500">Modificar todos los campos del producto</p>
                </div>
              </div>
              <button onClick={() => setAdminEditProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {adminEditError && (
              <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {adminEditError}
              </div>
            )}

            {/* Cuerpo del modal */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Formulario (Principal) */}
                <div className={`${activeSlotIndexForSpacePicker !== null ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5 pr-2`}>
                  {/* Campos Principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna Izquierda */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Código</label>
                        <input
                          type="text"
                          value={adminEditForm.code}
                          onChange={e => setAdminEditForm(f => ({ ...f, code: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-blue-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={adminEditForm.name}
                          onChange={e => setAdminEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
                          <select
                            value={adminEditForm.categoryId}
                            onChange={e => setAdminEditForm(f => ({ ...f, categoryId: e.target.value, subcategoryId: '' }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          >
                            <option value="">Sin categoría</option>
                            {uniqueCategories.map((cat: any) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sub Cat.</label>
                          <select
                            value={adminEditForm.subcategoryId ?? ''}
                            onChange={e => setAdminEditForm(f => ({ ...f, subcategoryId: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          >
                            <option value="">Sin sub-cat.</option>
                            {(getCategory(adminEditForm.categoryId)?.subcategories ?? []).map((sc: any) => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Almacén</label>
                        <select
                          value={adminSelectedWarehouseId}
                          onChange={e => handleAdminWarehouseChange(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        >
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Columna Derecha (Imagen y Dimensiones) */}
                    <div className="space-y-4">
                      <div className="border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden h-32 relative">
                        {adminEditForm.imageUrl ? (
                          <img src={adminEditForm.imageUrl} alt="Producto" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-300">
                            <Package className="w-8 h-8" />
                            <span className="text-[10px]">Sin imagen</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">URL de imagen</label>
                        <input
                          type="text"
                          value={adminEditForm.imageUrl}
                          onChange={e => setAdminEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Alto</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.height}
                            onChange={e => setAdminEditForm(f => ({ ...f, height: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Ancho</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.width}
                            onChange={e => setAdminEditForm(f => ({ ...f, width: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Prof</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.depth}
                            onChange={e => setAdminEditForm(f => ({ ...f, depth: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">CBM</label>
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1 text-xs text-center font-mono text-slate-600">
                            {(Number(adminEditForm.height || 0) * Number(adminEditForm.width || 0) * Number(adminEditForm.depth || 0) / 1000000).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stock Pendiente, Total y Mínimo */}
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Distribución de Stock</h3>

                    {/* Campo: Cantidad Total a Ingresar */}
                    <div className="flex items-stretch border border-violet-200 rounded-xl overflow-hidden bg-violet-50/30">
                      <div className="bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 flex items-center border-r border-violet-200 flex-1">
                        Cantidad Total a Ingresar
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={adminTotalInput}
                        onChange={e => {
                          const newTotal = Math.max(0, Number(e.target.value));
                          // adminTotalInput es la fuente de verdad: el pendiente = total - suma de slots asignados
                          const assignedQty = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                          const newPending = Math.max(0, newTotal - assignedQty);
                          setAdminTotalInput(newTotal);
                          setAdminPendingQty(newPending);
                        }}
                        className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-violet-700 bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>

                    {/* Advertencia: stock pendiente de asignación */}
                    {adminPendingQty > 0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>{adminPendingQty} unidad{adminPendingQty !== 1 ? 'es' : ''}</strong> quedarán
                          pendientes de asignación de espacio. Asígnalas a un espacio de almacén o ajusta las cantidades.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Stock Pendiente por Asignación — editable directamente */}
                      <div className="flex items-stretch border border-amber-200 rounded-xl overflow-hidden">
                        <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 flex items-center border-r border-amber-200 flex-1">
                          Pend. por Asignar
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={adminPendingQty}
                          onChange={e => {
                            const newPending = Math.max(0, Number(e.target.value));
                            // Al editar pendiente, recalcular el total = pendiente + slots asignados
                            const assignedQty = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                            setAdminPendingQty(newPending);
                            setAdminTotalInput(newPending + assignedQty);
                          }}
                          className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-amber-700 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>

                      {/* Stock Total — solo lectura, siempre = pendiente + asignados */}
                      <div className="flex items-stretch border border-blue-200 rounded-xl overflow-hidden">
                        <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 flex items-center border-r border-blue-200 flex-1">
                          Stock Total
                        </div>
                        <div className="w-20 flex items-center justify-center text-sm font-mono font-bold text-blue-700 bg-blue-50">
                          {adminPendingQty + adminSlots.reduce((a, c) => a + Number(c.qty || 0), 0)}
                        </div>
                      </div>

                      {/* Stock Mínimo */}
                      <div className="flex items-stretch border border-red-200 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex items-center border-r border-red-200 flex-1">
                          Stock Mínimo
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={adminMinStockVal}
                          onChange={e => setAdminMinStockVal(e.target.value)}
                          className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-red-700 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        />
                      </div>
                    </div>

                    {/* Indicador visual cuando se están asignando slots */}
                    {adminSlots.some(s => s.spaceId) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
                        Al asignar una ubicación, la cantidad se descuenta automáticamente del pendiente.
                      </div>
                    )}
                  </div>

                  {/* 4 slots de stock de espacios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adminSlots.map((slot, index) => {
                      const assignedSpace = slot.spaceId ? getLocation(slot.spaceId) : null;
                      const isActiveForPick = activeSlotIndexForSpacePicker === index;
                      return (
                        <div key={index} className={`p-3 border rounded-xl flex items-center gap-3 bg-slate-50 transition-all ${isActiveForPick ? 'ring-2 ring-violet-500 border-transparent bg-violet-50/10' : 'border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Espacio {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => setActiveSlotIndexForSpacePicker(index)}
                              className={`mt-1 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all truncate w-full ${
                                assignedSpace
                                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                  : 'bg-dashed border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400'
                              }`}
                            >
                               <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                               <span className="truncate flex-1 text-left">{assignedSpace?.name ?? 'Seleccionar Espacio'}</span>
                               <span className="text-[10px] text-slate-400 font-normal">▼</span>
                            </button>
                          </div>
                          
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              value={slot.qty}
                              disabled={!slot.spaceId}
                              onChange={e => {
                                const valStr = e.target.value;
                                const newQty = valStr === '' ? '' : Math.max(0, Number(valStr));
                                setAdminSlots(prev => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], qty: newQty };
                                  // Si el campo se borra, quitar también el espacio asignado
                                  if (newQty === '') {
                                    next[index].spaceId = null;
                                  }
                                  // Recalcular pendiente como: total - nueva suma de slots
                                  // Esto garantiza coherencia sin diffs incrementales
                                  const newSlotsTotal = next.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                                  const newPending = Math.max(0, adminTotalInput - newSlotsTotal);
                                  setAdminPendingQty(newPending);
                                  return next;
                                });
                              }}
                              className={`mt-1 w-full border rounded-lg py-1 px-1.5 text-center text-xs font-mono font-bold focus:outline-none ${
                                slot.spaceId
                                  ? 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-violet-500/40'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            />
                          </div>

                          {slot.spaceId && (
                            <button
                              type="button"
                              onClick={() => {
                                // Al quitar un slot, recalcular el pendiente usando adminTotalInput como fuente de verdad
                                setAdminSlots(prev => {
                                  const next = [...prev];
                                  next[index] = { spaceId: null, qty: '' };
                                  const newSlotsTotal = next.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                                  const newPending = Math.max(0, adminTotalInput - newSlotsTotal);
                                  setAdminPendingQty(newPending);
                                  return next;
                                });
                              }}
                              className="mt-4 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Quitar espacio"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Proveedor y Costos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Proveedor</label>
                      <select
                        value={adminEditForm.providerId ?? ''}
                        onChange={e => setAdminEditForm(f => ({ ...f, providerId: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        <option value="">Sin proveedor</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Costos (máx 2)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map(i => (
                          <div key={i} className="relative">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-mono">C{i+1}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Costo"
                              value={adminEditForm[`cost${i}`]}
                              onChange={e => setAdminEditForm(f => ({ ...f, [`cost${i}`]: e.target.value }))}
                              className="w-full border border-slate-300 rounded-xl pl-8 pr-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Precios */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Precios de Venta (máx 5)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="relative">
                          <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-mono">P{i+1}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Precio"
                            value={adminEditForm[`price${i}`]}
                            onChange={e => setAdminEditForm(f => ({ ...f, [`price${i}`]: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel de Selección de Espacio (Lado Derecho) */}
                {activeSlotIndexForSpacePicker !== null && (
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-[400px] lg:h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Selección Espacio de Almacén</h3>
                        <p className="text-[10px] text-slate-500">Asignar a Slot {activeSlotIndexForSpacePicker + 1}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setActiveSlotIndexForSpacePicker(null); setSpacePickerSearch(''); }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Búsqueda */}
                    <div className="flex gap-1.5 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar espacio..."
                          value={spacePickerSearch}
                          onChange={e => setSpacePickerSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSpacePickerScannerOpen(true)}
                        className="px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                        title="Escanear QR"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tabla de Espacios */}
                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="p-2 font-semibold text-slate-600">Nombre</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Cercanía</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Productos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pickerFilteredSpaces.map(space => {
                            const spaceType = space.spaceTypeName || 'Estante';
                            return (
                              <tr
                                key={space.id}
                                onClick={() => handlePickSpace(space.id)}
                                className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                              >
                                <td className="p-2 font-medium text-slate-800">{space.name}</td>
                                <td className="p-2 text-center text-slate-500">{spaceType}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.proximity ?? 0))}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.productCount ?? 0))}</td>
                              </tr>
                            );
                          })}
                          {pickerFilteredSpaces.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                No se encontraron espacios
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer principal común */}
            <div className="p-6 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={() => setAdminEditProduct(null)} disabled={adminEditSaving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAdminEdit}
                disabled={adminEditSaving}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white border-0"
              >
                {adminEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {adminEditSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>

          </div>
        </div>
      )}

      {isSpacePickerScannerOpen && (
        <QRScannerModal
          isOpen={isSpacePickerScannerOpen}
          onClose={() => setIsSpacePickerScannerOpen(false)}
          onScan={code => { setSpacePickerSearch(code); setIsSpacePickerScannerOpen(false); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL EDITAR STOCK POR ESPACIOS
      ════════════════════════════════════════════════════════════════════════ */}
      {spaceEditProduct && (() => {
        const spProd    = getProduct(spaceEditProduct);
        const spItems   = groupedInventory[spaceEditProduct] ?? [];
        const assigned  = spItems.filter(i => i.warehouseSpaceId);
        const pending   = spItems.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);
        const isPickerOpen = spaceEditActiveStockId !== null;
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className={`bg-white rounded-3xl p-6 w-full ${isPickerOpen ? 'max-w-4xl' : 'max-w-lg'} shadow-xl border border-slate-200 my-8 transition-all duration-300`}>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panel Izquierdo: Lista de stocks */}
                <div className={isPickerOpen ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Editar Stock por Espacios</h2>
                        <p className="text-xs text-slate-500 truncate max-w-[220px]">{spProd?.name ?? '—'}</p>
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          Total fijo: <span className="font-mono">{spaceEditTotalOriginal}</span> unidades
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSpaceEditProduct(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {assigned.map((item, idx) => {
                      const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
                      const isSavingThis = spaceEditSaving === item.id;
                      const isActiveForPick = spaceEditActiveStockId === item.id;
                      return (
                        <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-xl bg-slate-50 transition-all ${isActiveForPick ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50/10' : 'border-slate-200'}`}>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ubicación</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSpaceEditActiveStockId(item.id);
                                setSpaceEditPickerSearch('');
                              }}
                              className="mt-1 text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white border-slate-200 text-slate-700 hover:border-slate-300 w-full truncate"
                            >
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate flex-1 text-left">{space?.name ?? 'Sin asignar'}</span>
                              <span className="text-[10px] text-slate-400 font-normal">▼</span>
                            </button>
                          </div>
                          
                          <div className="w-20">
                            <span className="block text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              value={spaceEditQty[item.id] ?? item.quantity}
                              onChange={e => setSpaceEditQty(q => ({ ...q, [item.id]: e.target.value }))}
                              className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            />
                          </div>

                          <button
                            onClick={() => handleSaveSpaceQty(item.id)}
                            disabled={isSavingThis}
                            className="mt-4 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            title="Guardar Cantidad"
                          >
                            {isSavingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}

                    {pending.map(item => {
                      const isSavingThis = spaceEditSaving === item.id;
                      const isActiveForPick = spaceEditActiveStockId === item.id;
                      return (
                        <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-xl bg-amber-50/50 transition-all ${isActiveForPick ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50/10' : 'border-amber-200'}`}>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex-shrink-0">!</span>
                          <div className="flex-1 min-w-0">
                            <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">Ubicación Pendiente</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSpaceEditActiveStockId(item.id);
                                setSpaceEditPickerSearch('');
                              }}
                              className="mt-1 text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white border-amber-200 text-amber-700 hover:border-amber-300 w-full truncate"
                            >
                              <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span className="truncate flex-1 text-left text-amber-600 italic">Asignar espacio...</span>
                              <span className="text-[10px] text-amber-400 font-normal">▼</span>
                            </button>
                          </div>

                          <div className="w-20">
                            <span className="block text-[10px] font-bold text-amber-700 text-center uppercase tracking-wider">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              value={spaceEditQty[item.id] ?? item.quantity}
                              onChange={e => setSpaceEditQty(q => ({ ...q, [item.id]: e.target.value }))}
                              className="mt-1 w-full border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            />
                          </div>

                          <button
                            onClick={() => handleSaveSpaceQty(item.id)}
                            disabled={isSavingThis}
                            className="mt-4 p-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
                            title="Guardar Cantidad"
                          >
                            {isSavingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}

                    {assigned.length === 0 && pending.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        Este producto no tiene stock en ningún espacio.
                      </div>
                    )}
                  </div>

                  {/* Mensaje de error */}
                  {spaceEditError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{spaceEditError}</span>
                    </div>
                  )}

                  {/* Nota informativa */}
                  <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                    Usa ▼ para cambiar o asignar una ubicación en caliente. Modifica cantidades y confirma cada cambio individualmente con ✓.
                    {' '}La suma de todas las ubicaciones debe ser siempre <strong>{spaceEditTotalOriginal}</strong> unidades.
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <Button variant="secondary" onClick={() => setSpaceEditProduct(null)}>
                      Cerrar
                    </Button>
                  </div>
                </div>

                {/* Panel de Selección de Espacio (Lado Derecho) */}
                {isPickerOpen && (
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-[400px] lg:h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Selección Espacio</h3>
                        <p className="text-[10px] text-slate-500">Mover stock a esta ubicación</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSpaceEditActiveStockId(null); setSpaceEditPickerSearch(''); }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Búsqueda */}
                    <div className="flex gap-1.5 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar espacio..."
                          value={spaceEditPickerSearch}
                          onChange={e => setSpaceEditPickerSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSpaceEditPickerScannerOpen(true)}
                        className="px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                        title="Escanear QR"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tabla de Espacios */}
                    <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="p-2 font-semibold text-slate-600">Nombre</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Cercanía</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Productos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {spaceEditPickerFilteredSpaces.map(space => {
                            const spaceType = space.spaceTypeName || 'Estante';
                            return (
                              <tr
                                key={space.id}
                                onClick={() => handleSpaceEditPickSpace(space.id)}
                                className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                              >
                                <td className="p-2 font-medium text-slate-800">{space.name}</td>
                                <td className="p-2 text-center text-slate-500">{spaceType}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.proximity ?? 0))}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.productCount ?? 0))}</td>
                              </tr>
                            );
                          })}
                          {spaceEditPickerFilteredSpaces.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                No se encontraron espacios
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {isSpaceEditPickerScannerOpen && (
        <QRScannerModal
          isOpen={isSpaceEditPickerScannerOpen}
          onClose={() => setIsSpaceEditPickerScannerOpen(false)}
          onScan={code => { setSpaceEditPickerSearch(code); setIsSpaceEditPickerScannerOpen(false); }}
        />
      )}

      <LockModal {...lockEdit.lockModalProps} />
      <LockModal {...lockView.lockModalProps} />
      <LockModal {...lockDelete.lockModalProps} />
      <LockModal {...lockExport.lockModalProps} />
    </div>
  );
};
