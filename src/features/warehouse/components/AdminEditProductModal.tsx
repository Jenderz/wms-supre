import React, { useState, useEffect } from 'react';
import { useWarehouse } from '../hooks/useWarehouse';
import { useSpaceGroups } from '../../infrastructure/hooks/useSpaceGroups';
import {
  Settings2,
  X,
  AlertTriangle,
  Loader2,
  MapPin,
  Save,
  Search,
  ScanLine,
} from 'lucide-react';
import { QRScannerModal } from '../../../components/QRScannerModal';

interface AdminEditProductModalProps {
  productId: string | null;
  initialWarehouseId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminEditProductModal: React.FC<AdminEditProductModalProps> = ({
  productId,
  initialWarehouseId,
  onClose,
  onSuccess,
}) => {
  const {
    products,
    warehouses,
    warehouseSpaces,
    categories,
    providers,
    stock,
    updateProduct,
    upsertStock,
    getLocation,
  } = useWarehouse();

  const { groups: spaceGroups } = useSpaceGroups();

  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [pendingQty, setPendingQty] = useState<number>(0);
  const [totalInput, setTotalInput] = useState<number>(0);
  const [minStockVal, setMinStockVal] = useState<string>('0');
  const [minStockDispatch, setMinStockDispatch] = useState<string>('0');
  const [slots, setSlots] = useState<{ spaceId: string | null; qty: number | string }[]>([
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
  ]);
  const [originalStock, setOriginalStock] = useState<any[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [spaceSearch, setSpaceSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find(p => String(p.id) === String(productId));

  useEffect(() => {
    if (!product) return;

    setForm({
      code: product.code ?? '',
      codeType: product.codeType ?? 'qr',
      name: product.name ?? '',
      categoryId: product.categoryId ?? '',
      subcategoryId: product.subcategoryId ?? '',
      imageUrl: product.imageUrl ?? '',
      footerUrl: product.footerUrl ?? '',
      height: product.dimensions?.height ?? '',
      width: product.dimensions?.width ?? '',
      depth: product.dimensions?.depth ?? '',
      cost0: product.costs?.[0] ?? '',
      cost1: product.costs?.[1] ?? '',
      price0: product.prices?.[0] ?? '',
      price1: product.prices?.[1] ?? '',
      price2: product.prices?.[2] ?? '',
      price3: product.prices?.[3] ?? '',
      price4: product.prices?.[4] ?? '',
      providerId: product.providers?.[0] ?? '',
    });

    const initWid =
      initialWarehouseId && warehouses.some(w => String(w.id) === String(initialWarehouseId))
        ? String(initialWarehouseId)
        : warehouses[0]?.id
        ? String(warehouses[0].id)
        : '';

    if (initWid) {
      loadWarehouseStock(initWid);
    }
  }, [productId, product, warehouses]);

  const loadWarehouseStock = (wid: string) => {
    setSelectedWarehouseId(wid);
    if (!productId) return;

    const whStock = stock.filter(
      s => String(s.productId) === String(productId) && String(s.warehouseId) === String(wid)
    );

    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pend = pendingItem ? Number(pendingItem.quantity) : 0;

    const minSt = whStock.reduce((a, c) => Math.max(a, Number(c.minStock) || 0), 0);
    const minStDisp = whStock.reduce((a, c) => Math.max(a, Number(c.minStockDispatch) || 0), 0);

    const dispatchStock = whStock.find(s => {
      if (!s.warehouseSpaceId) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType === 'Despachos';
    });

    const storageStocks = whStock.filter(s => {
      if (!s.warehouseSpaceId || Number(s.quantity) <= 0) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType !== 'Despachos';
    });

    const spaceItems = dispatchStock ? [dispatchStock, ...storageStocks] : storageStocks;

    const newSlots = [0, 1, 2, 3].map(i => {
      const it = spaceItems[i];
      return {
        spaceId: it?.warehouseSpaceId || null,
        qty: it ? (Number(it.quantity) === 0 ? 0 : Number(it.quantity)) : '',
      };
    });

    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const total = pend + assignedQty;

    setPendingQty(pend);
    setTotalInput(total);
    setMinStockVal(String(minSt));
    setMinStockDispatch(String(minStDisp));
    setSlots(newSlots);
    setOriginalStock(whStock);
    setActiveSlotIndex(null);
  };

  if (!productId || !product) return null;

  const currentCategory = categories.find(c => String(c.id) === String(form.categoryId));
  const subcategories = currentCategory?.subcategories ?? [];

  const availableSpaces = warehouseSpaces.filter(
    ws => String(ws.warehouseId) === String(selectedWarehouseId)
  );

  const filteredSpaces = availableSpaces.filter(sp => {
    if (!spaceSearch.trim()) return true;
    const term = spaceSearch.toLowerCase();
    return sp.name.toLowerCase().includes(term);
  });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const costs = [form.cost0, form.cost1]
        .map(Number)
        .filter((v, i) => i === 0 || form[`cost${i}`] !== '');
      const prices = [form.price0, form.price1, form.price2, form.price3, form.price4]
        .map(Number)
        .filter((v, i) => i === 0 || form[`price${i}`] !== '');

      const assignedSpaces = slots.filter(s => s.spaceId && Number(s.qty) > 0);
      const sumAssigned = assignedSpaces.reduce((a, c) => a + Number(c.qty), 0);
      const computedPending = Math.max(0, totalInput - sumAssigned);

      const enabledWarehouses = Array.from(
        new Set([...(product.enabledWarehouses || []).map(String), ...(selectedWarehouseId ? [String(selectedWarehouseId)] : [])])
      );

      await updateProduct(productId, {
        name: form.name,
        code: form.code,
        codeType: form.codeType,
        categoryId: form.categoryId || null,
        subcategoryId: form.subcategoryId || null,
        imageUrl: form.imageUrl,
        footerUrl: form.footerUrl,
        dimensions: {
          height: Number(form.height) || 0,
          width: Number(form.width) || 0,
          depth: Number(form.depth) || 0,
        },
        costs,
        prices,
        providers: form.providerId ? [form.providerId] : [],
        enabledWarehouses,
      });

      if (selectedWarehouseId) {
        // 1. Poner en 0 espacios que antes tenían stock y fueron quitados o reemplazados
        const currentSpaceIds = new Set(slots.map(s => s.spaceId).filter(Boolean).map(String));
        const spacesToZero = originalStock.filter(
          s => s.warehouseSpaceId && !currentSpaceIds.has(String(s.warehouseSpaceId)) && Number(s.quantity) > 0
        );
        for (const old of spacesToZero) {
          await upsertStock({
            productId,
            warehouseId: selectedWarehouseId,
            warehouseSpaceId: String(old.warehouseSpaceId),
            quantity: 0,
            minStock: Number(minStockVal) || 0,
            minStockDispatch: Number(minStockDispatch) || 0,
          });
        }

        // 2. Upsert pending
        await upsertStock({
          productId,
          warehouseId: selectedWarehouseId,
          warehouseSpaceId: null,
          quantity: computedPending,
          minStock: Number(minStockVal) || 0,
          minStockDispatch: Number(minStockDispatch) || 0,
        });

        // 3. Upsert slots
        for (const slot of slots) {
          if (slot.spaceId) {
            await upsertStock({
              productId,
              warehouseId: selectedWarehouseId,
              warehouseSpaceId: slot.spaceId,
              quantity: Number(slot.qty) || 0,
              minStock: Number(minStockVal) || 0,
              minStockDispatch: Number(minStockDispatch) || 0,
            });
          }
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className={`bg-white rounded-3xl w-full ${
          activeSlotIndex !== null ? 'max-w-5xl h-[85vh]' : 'max-w-2xl max-h-[90vh]'
        } shadow-xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Editar Administrador</h2>
              <p className="text-xs text-slate-500">Modificar todos los campos del producto e inventario</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Principal */}
            <div className={`${activeSlotIndex !== null ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5 pr-2`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Código</label>
                    <input
                      type="text"
                      value={form.code || ''}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-blue-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={form.name || ''}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
                      <select
                        value={form.categoryId || ''}
                        onChange={e => setForm(f => ({ ...f, categoryId: e.target.value, subcategoryId: '' }))}
                        className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        <option value="">Sin categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sub Cat.</label>
                      <select
                        value={form.subcategoryId || ''}
                        onChange={e => setForm(f => ({ ...f, subcategoryId: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        <option value="">Sin subcategoría</option>
                        {subcategories.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Almacén a Configurar</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={e => loadWarehouseStock(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Stock Total</label>
                      <input
                        type="number"
                        min="0"
                        value={totalInput}
                        onChange={e => setTotalInput(Math.max(0, Number(e.target.value)))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Stock Mínimo</label>
                      <input
                        type="number"
                        min="0"
                        value={minStockVal}
                        onChange={e => setMinStockVal(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Stock Mínimo Despacho</label>
                    <input
                      type="number"
                      min="0"
                      value={minStockDispatch}
                      onChange={e => setMinStockDispatch(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                </div>
              </div>

              {/* Slots de Espacios */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Distribución por Espacio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slots.map((slot, index) => {
                    const sp = slot.spaceId ? getLocation(slot.spaceId) : null;
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          activeSlotIndex === index
                            ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/30'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSlotIndex(activeSlotIndex === index ? null : index)}
                          className="flex items-center gap-2 truncate text-left flex-1"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className={`text-xs font-medium truncate ${sp ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                            {sp ? sp.name : `Espacio ${index + 1} (Sin asignar)`}
                          </span>
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={slot.qty}
                          onChange={e => {
                            const val = e.target.value;
                            setSlots(prev => {
                              const next = [...prev];
                              next[index] = { ...next[index], qty: val };
                              return next;
                            });
                          }}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-xs text-right font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna Selector de Espacio si está abierto */}
            {activeSlotIndex !== null && (
              <div className="lg:col-span-5 border-l border-slate-200 pl-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Seleccionar Espacio ({activeSlotIndex + 1})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveSlotIndex(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={spaceSearch}
                    onChange={e => setSpaceSearch(e.target.value)}
                    placeholder="Buscar espacio..."
                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSlots(prev => {
                        const next = [...prev];
                        next[activeSlotIndex] = { ...next[activeSlotIndex], spaceId: null };
                        return next;
                      });
                      setActiveSlotIndex(null);
                    }}
                    className="w-full text-left p-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 border border-dashed border-slate-200"
                  >
                    Sin espacio (limpiar)
                  </button>
                  {filteredSpaces.map(sp => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => {
                        setSlots(prev => {
                          const next = [...prev];
                          next[activeSlotIndex] = { ...next[activeSlotIndex], spaceId: sp.id };
                          return next;
                        });
                        setActiveSlotIndex(null);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-violet-50/70 border border-slate-100 hover:border-violet-200 transition-colors text-left"
                    >
                      <span className="font-semibold text-slate-800">{sp.name}</span>
                      {sp.spaceUsageType === 'Despachos' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          DESPACHO
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={code => {
          setSpaceSearch(code);
          setIsScannerOpen(false);
        }}
        title="Escanear Espacio"
      />
    </div>
  );
};
