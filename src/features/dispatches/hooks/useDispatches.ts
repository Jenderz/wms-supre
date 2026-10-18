import { useState, useEffect, useCallback } from 'react';
import {
  DispatchApi, ProductApi, WarehouseApi,
  StockApi, CategoryApi, WarehouseSpaceApi,
} from '../../../services/api';
import {
  DispatchOrder, Product, Warehouse,
  Stock, Category, WarehouseSpace,
} from '../../../types';

export interface SpaceOption {
  stockId: string;
  warehouseSpaceId: string;
  spaceName: string;
  spaceUsageType: string;
  proximity: number;
  quantity: number;
  needsRestock?: boolean; // true cuando es espacio tipo 'Despachos' con quantity=0 (OBS 1.4)
}

export interface SpacePreselection {
  autoPreselectedSpaceId: string;
  autoPreselectedSpaceName: string;
  isAutoSelected: boolean;     // true = espacio Despachos encontrado con stock suficiente
  hasDespachoStock: boolean;   // true = hay al menos un espacio en Despachos con stock > 0
  despachoStockTotal: number;  // suma total de stock en espacios de Despachos
  availableSpaces: SpaceOption[];
}

export const useDispatches = () => {
  const [dispatches, setDispatches]         = useState<DispatchOrder[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [warehouses, setWarehouses]         = useState<Warehouse[]>([]);
  const [stock, setStock]                   = useState<Stock[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [warehouseSpaces, setWarehouseSpaces] = useState<WarehouseSpace[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // ── Carga inicial desde Backend REST API ─────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [p, w, s, c, ws, d] = await Promise.all([
        ProductApi.getAll(),
        WarehouseApi.getAll(),
        StockApi.getAll(),
        CategoryApi.getAll(),
        WarehouseSpaceApi.getAll(),
        DispatchApi.getAll(),
      ]);
      setProducts(p as Product[]);
      setWarehouses(w as Warehouse[]);
      setStock(s as Stock[]);
      setCategories(c as Category[]);
      setWarehouseSpaces(ws as WarehouseSpace[]);

      // Normalizar ítems devueltos por la API
      setDispatches(normalizeDispatches(d));
    } catch (err: any) {
      console.error('[useDispatches] carga fallida:', err);
      setError(err?.message || 'Error al cargar datos de despachos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const normalizeDispatches = (d: any[]): DispatchOrder[] => {
    return (Array.isArray(d) ? d : []).map((ord: any) => ({
      ...ord,
      id: String(ord.id),
      warehouseId: String(ord.warehouseId),
      status: ord.status === 'PROCESANDO' ? 'EN_PROCESO' : (ord.status || 'PENDIENTE'),
      items: (Array.isArray(ord.items) ? ord.items : []).map((item: any) => ({
        ...item,
        id: String(item.id),
        productId: String(item.productId),
        requestedQuantity: Number(item.requestedQuantity ?? item.quantityRequired ?? 0),
        quantityRequired: Number(item.requestedQuantity ?? item.quantityRequired ?? 0),
        warehouseSpaceId: item.warehouseSpaceId ? String(item.warehouseSpaceId) : null,
        warehouseSpaceAssignments: (Array.isArray(item.warehouseSpaceAssignments) ? item.warehouseSpaceAssignments : []).map((a: any) => ({
          ...a,
          warehouseSpaceId: String(a.warehouseSpaceId),
          quantity: Number(a.quantity ?? 0),
        })),
      })),
    }));
  };

  const reloadDispatchesAndStock = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        StockApi.getAll(),
        DispatchApi.getAll(),
      ]);
      setStock(s as Stock[]);
      setDispatches(normalizeDispatches(d));
    } catch (err: any) {
      console.error('[useDispatches] error al recargar despachos y stock:', err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Guardar (crear o actualizar) en Backend ──────────────────────────────────
  const saveDispatch = useCallback(
    async (order: Partial<DispatchOrder>): Promise<DispatchOrder> => {
      setError(null);
      try {
        const payload = {
          ...order,
          items: (order.items || []).map(item => ({
            productId: item.productId,
            requestedQuantity: item.requestedQuantity ?? item.quantityRequired ?? 0,
            warehouseSpaceId: item.warehouseSpaceId ?? null,
            spaceSelectionType: item.spaceSelectionType ?? 'AUTO',
            warehouseSpaceAssignments: item.warehouseSpaceAssignments ?? [],
            notes: item.notes ?? '',
          })),
        };

        if (order.id) {
          const updated = await DispatchApi.update(order.id, payload);
          await reloadDispatchesAndStock();
          return (updated as unknown) as DispatchOrder;
        } else {
          const created = await DispatchApi.create(payload);
          await reloadDispatchesAndStock();
          return (created as unknown) as DispatchOrder;
        }
      } catch (err: any) {
        console.error('[useDispatches] error al guardar:', err);
        setError(err?.message || 'Error al guardar la orden de despacho.');
        throw err;
      }
    },
    [reloadDispatchesAndStock],
  );

  // Guardado en segundo plano sin activar spinner global (sin llamar load())
  const saveDispatchSilent = useCallback(
    async (order: Partial<DispatchOrder>): Promise<DispatchOrder> => {
      try {
        const payload = {
          ...order,
          items: (order.items || []).map(item => ({
            productId: item.productId,
            requestedQuantity: item.requestedQuantity ?? item.quantityRequired ?? 0,
            warehouseSpaceId: item.warehouseSpaceId ?? null,
            spaceSelectionType: item.spaceSelectionType ?? 'AUTO',
            warehouseSpaceAssignments: item.warehouseSpaceAssignments ?? [],
            notes: item.notes ?? '',
          })),
        };

        if (order.id) {
          const updated = await DispatchApi.update(order.id, payload);
          setDispatches(prev =>
            prev.map(d => (d.id === order.id ? ({ ...d, ...order } as DispatchOrder) : d)),
          );
          return (updated as unknown) as DispatchOrder;
        }
        return order as DispatchOrder;
      } catch (err: any) {
        console.error('[useDispatches] error al guardar en segundo plano:', err);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // setDispatches es un setter estable de useState (React garantiza que nunca cambia
    // de referencia), por lo que no necesita declararse como dependencia explícita.
    [],
  );

  // ── Eliminar en Backend ──────────────────────────────────────────────────────
  const deleteDispatch = useCallback(async (id: string) => {
    setError(null);
    try {
      await DispatchApi.remove(id);
      await reloadDispatchesAndStock();
    } catch (err: any) {
      console.error('[useDispatches] error al eliminar:', err);
      setError(err?.message || 'Error al eliminar la orden de despacho.');
      throw err;
    }
  }, [reloadDispatchesAndStock]);

  // ── Cambiar estado en Backend ────────────────────────────────────────────────
  const updateStatus = useCallback(
    async (id: string, status: DispatchOrder['status']) => {
      setError(null);
      try {
        await DispatchApi.updateStatus(id, status);
        await reloadDispatchesAndStock(); // Recarga stock y movimientos actualizados si fue DESPACHADO
      } catch (err: any) {
        console.error('[useDispatches] error al cambiar estado:', err);
        setError(err?.message || 'Error al actualizar el estado de despacho.');
        throw err;
      }
    },
    [reloadDispatchesAndStock],
  );

  // ── Lookups ─────────────────────────────────────────────────────────────────
  const getProduct   = (id: string) => products.find(p => String(p.id) === id);
  const getWarehouse = (id: string) => warehouses.find(w => String(w.id) === id);

  /** 
   * Stock disponible de un producto en un almacén (suma de todos los espacios restando reservas).
   * Si se provee excludeOrderId, reintegra la cantidad reservada por esa orden (útil en modo edición).
   */
  const getProductStock = (productId: string, warehouseId: string, excludeOrderId?: string) => {
    let available = stock
      .filter(s => String(s.productId) === productId && String(s.warehouseId) === warehouseId)
      .reduce((sum, s) => sum + Math.max(0, Number(s.quantity) - Number(s.reservedQuantity || 0)), 0);

    if (excludeOrderId) {
      const order = dispatches.find(d => String(d.id) === String(excludeOrderId));
      if (order && order.status === 'PENDIENTE' && String(order.warehouseId) === String(warehouseId)) {
        const item = order.items.find(i => String(i.productId) === String(productId));
        if (item) {
          available += Number(item.requestedQuantity ?? item.quantityRequired ?? 0);
        }
      }
    }
    return available;
  };

  const getCategoryName = (categoryId: string) =>
    categories.find(c => String(c.id) === categoryId)?.name ?? '-';

  const getSubcategoryName = (categoryId: string, subcategoryId?: string | null) => {
    if (!subcategoryId) return '-';
    const cat = categories.find(c => String(c.id) === categoryId);
    return cat?.subcategories?.find(s => String(s.id) === subcategoryId)?.name ?? '-';
  };

  /**
   * Devuelve los espacios disponibles para un producto en el almacén:
   * 1. Máximo UN (1) espacio de tipo 'Despachos' (el asignado de forma fija).
   *    Si su stock es 0, se marca con needsRestock=true (badge ⚠️ Reabastecer).
   * 2. Espacios de tipo 'Almacenamiento' EXCLUSIVAMENTE si tienen stock positivo (quantity > 0).
   *    Los espacios de almacenamiento con stock 0 quedan estrictamente excluidos.
   * Ordenados por cercanía (menor primero).
   */
  const getAvailableSpacesForProduct = (
    productId: string,
    warehouseId: string,
  ): SpaceOption[] => {
    const productWhStock = stock.filter(
      s => String(s.productId) === productId && String(s.warehouseId) === warehouseId,
    );

    const result: SpaceOption[] = [];

    // 1. Espacios de Almacenamiento con stock estrictamente > 0
    const almacenamientoSpaces = productWhStock
      .filter(s => {
        if (!s.warehouseSpaceId || Number(s.quantity) <= 0) return false;
        const ws = warehouseSpaces.find(w => String(w.id) === String(s.warehouseSpaceId));
        return ws && ws.spaceUsageType === 'Almacenamiento';
      })
      .map(s => {
        const ws = warehouseSpaces.find(w => String(w.id) === String(s.warehouseSpaceId))!;
        return {
          stockId:          s.id,
          warehouseSpaceId: String(s.warehouseSpaceId),
          spaceName:        ws.name,
          spaceUsageType:   'Almacenamiento',
          proximity:        ws.proximity ?? 999,
          quantity:         Number(s.quantity),
          needsRestock:     false,
        } as SpaceOption;
      });

    result.push(...almacenamientoSpaces);

    // 2. Único espacio fijo de tipo 'Despachos'
    const despachosStockEntries = productWhStock.filter(s => {
      if (!s.warehouseSpaceId) return false;
      const ws = warehouseSpaces.find(w => String(w.id) === String(s.warehouseSpaceId));
      return ws && ws.spaceUsageType === 'Despachos';
    });

    if (despachosStockEntries.length > 0) {
      // Si existiese más de un registro por inconsistencia residual, tomar el que tiene más stock o el primero
      const bestDespachoStock = despachosStockEntries.reduce((prev, curr) =>
        Number(curr.quantity) > Number(prev.quantity) ? curr : prev,
      );
      const ws = warehouseSpaces.find(w => String(w.id) === String(bestDespachoStock.warehouseSpaceId))!;
      const qty = Math.max(0, Number(bestDespachoStock.quantity));

      result.push({
        stockId:          bestDespachoStock.id,
        warehouseSpaceId: String(bestDespachoStock.warehouseSpaceId),
        spaceName:        ws.name,
        spaceUsageType:   'Despachos',
        proximity:        ws.proximity ?? 999,
        quantity:         qty,
        needsRestock:     qty <= 0,
      });
    }

    return result.sort((a, b) => {
      // Priorizar Despachos primero si ambos están disponibles, luego por proximidad
      if (a.spaceUsageType === 'Despachos' && b.spaceUsageType !== 'Despachos') return -1;
      if (b.spaceUsageType === 'Despachos' && a.spaceUsageType !== 'Despachos') return 1;
      return a.proximity - b.proximity;
    });
  };

  /**
   * Evaluación del diagrama de flujo:
   *  - SI hay espacio de tipo "Despachos" con stock >= cantidad requerida → pre-selección automática.
   *  - NO → habilitar selección manual (devuelve isAutoSelected = false).
   */
  const evaluateSpacePreselection = (
    productId: string,
    warehouseId: string,
    qtyRequired: number,
  ): SpacePreselection => {
    const spaces = getAvailableSpacesForProduct(productId, warehouseId);
    const dispatchSpaces = spaces.filter(sp => sp.spaceUsageType === 'Despachos');
    const match = dispatchSpaces.find(sp => sp.quantity >= qtyRequired);
    
    const despachoStockTotal = dispatchSpaces.reduce((acc, s) => acc + s.quantity, 0);
    const hasDespachoStock = despachoStockTotal > 0;

    if (match) {
      return {
        autoPreselectedSpaceId:   match.warehouseSpaceId,
        autoPreselectedSpaceName: match.spaceName,
        isAutoSelected:           true,
        hasDespachoStock,
        despachoStockTotal,
        availableSpaces:          spaces,
      };
    }
    return {
      autoPreselectedSpaceId:   '',
      autoPreselectedSpaceName: '',
      isAutoSelected:           false,
      hasDespachoStock,
      despachoStockTotal,
      availableSpaces:          spaces,
    };
  };

  /**
   * Productos con stock en un almacén determinado.
   * Une por `enabledWarehouses` O por existencia de registro de stock.
   */
  const getProductsForWarehouse = (warehouseId: string): Product[] => {
    if (!warehouseId) return products;
    const stockProductIds = new Set(
      stock
        .filter(s => String(s.warehouseId) === warehouseId && Number(s.quantity) > 0)
        .map(s => String(s.productId)),
    );
    return products.filter(
      p =>
        stockProductIds.has(String(p.id)) ||
        (Array.isArray(p.enabledWarehouses) && p.enabledWarehouses.map(String).includes(String(warehouseId))),
    );
  };

  return {
    // data
    dispatches, products, warehouses, stock, categories, warehouseSpaces,
    isLoading, error,
    // mutations
    saveDispatch, saveDispatchSilent, deleteDispatch, updateStatus,
    reload: load,
    // lookups
    getProduct, getWarehouse, getProductStock,
    getCategoryName, getSubcategoryName,
    getProductsForWarehouse,
    getAvailableSpacesForProduct, evaluateSpacePreselection,
  };
};
