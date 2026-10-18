import React, { useState, useEffect } from 'react';
import { useWarehouse } from '../hooks/useWarehouse';
import {
  Layers,
  X,
  AlertTriangle,
  Loader2,
  MapPin,
  Save,
  Search,
  ScanLine,
} from 'lucide-react';
import { QRScannerModal } from '../../../components/QRScannerModal';

interface SpaceStockEditModalProps {
  productId: string | null;
  warehouseId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SpaceStockEditModal: React.FC<SpaceStockEditModalProps> = ({
  productId,
  warehouseId,
  onClose,
  onSuccess,
}) => {
  const {
    products,
    warehouses,
    warehouseSpaces,
    stock,
    upsertStock,
    assignSpace,
    getLocation,
  } = useWarehouse();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [pendingQty, setPendingQty] = useState<number>(0);
  const [minStockVal, setMinStockVal] = useState<number>(0);
  const [minStockDispatch, setMinStockDispatch] = useState<string>('0');
  const [totalOriginal, setTotalOriginal] = useState<number>(0);
  const [originalStock, setOriginalStock] = useState<any[]>([]);
  const [slots, setSlots] = useState<{ spaceId: string | null; qty: number | string }[]>([
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
  ]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [spaceSearch, setSpaceSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find(p => String(p.id) === String(productId));

  useEffect(() => {
    if (!productId) return;

    const wid = warehouseId || (warehouses[0]?.id ? String(warehouses[0].id) : '');
    setSelectedWarehouseId(wid);

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

    const assigned = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const total = pend + assigned;

    setPendingQty(pend);
    setMinStockVal(minSt);
    setMinStockDispatch(String(minStDisp));
    setTotalOriginal(total);
    setOriginalStock(whStock);
    setSlots(newSlots);
    setActiveSlotIndex(null);
  }, [productId, warehouseId, stock, warehouses]);

  if (!productId || !product) return null;

  const availableSpaces = warehouseSpaces.filter(
    ws => String(ws.warehouseId) === String(selectedWarehouseId)
  );

  const filteredSpaces = availableSpaces.filter(sp => {
    if (!spaceSearch.trim()) return true;
    const term = spaceSearch.toLowerCase();
    return sp.name.toLowerCase().includes(term);
  });

  const assignedSum = slots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
  const currentTotal = pendingQty + assignedSum;
  const isDiff = Math.abs(currentTotal - totalOriginal) > 0.0001;

  const handleSave = async () => {
    if (isDiff) {
      setError(`La suma total (${currentTotal}) debe coincidir exactamente con el total original (${totalOriginal}).`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // 0. Poner en 0 espacios que antes tenían stock y fueron quitados o reemplazados
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
          minStock: minStockVal,
          minStockDispatch: Number(minStockDispatch) || 0,
        });
      }

      // 1. Guardar pendiente
      await upsertStock({
        productId,
        warehouseId: selectedWarehouseId,
        warehouseSpaceId: null,
        quantity: pendingQty,
        minStock: minStockVal,
        minStockDispatch: Number(minStockDispatch) || 0,
      });

      // 2. Guardar cada slot asignado
      for (const slot of slots) {
        if (slot.spaceId) {
          await upsertStock({
            productId,
            warehouseId: selectedWarehouseId,
            warehouseSpaceId: slot.spaceId,
            quantity: Number(slot.qty) || 0,
            minStock: minStockVal,
            minStockDispatch: Number(minStockDispatch) || 0,
          });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar stock por espacios');
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
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Editar Stock por Espacios</h2>
              <p className="text-xs text-slate-500 truncate max-w-[260px]">{product.name}</p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Total fijo: <span className="font-mono">{totalOriginal}</span> unidades
              </p>
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
            <div className={`${activeSlotIndex !== null ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
              {/* Pendiente por asignar */}
              <div className="flex items-stretch border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 flex items-center border-r border-amber-200 flex-1">
                  Pendiente por Asignar
                </div>
                <input
                  type="number"
                  min="0"
                  value={pendingQty}
                  onChange={e => setPendingQty(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2 py-2 text-center text-sm font-mono font-bold text-amber-700 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Stock mínimo espacio despacho si aplica */}
              {availableSpaces.some(s => s.spaceUsageType === 'Despachos') && (
                <div className="flex items-stretch border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 flex items-center border-r border-orange-200 flex-1">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-orange-600" />
                    Stock Mín. Despachos
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={minStockDispatch}
                    onChange={e => setMinStockDispatch(e.target.value)}
                    className="w-24 px-2 py-2 text-center text-sm font-mono font-bold text-orange-700 bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
              )}

              {/* Slots de asignación */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Espacios del Almacén
                </h4>
                <div className="space-y-2">
                  {slots.map((slot, index) => {
                    const sp = slot.spaceId ? getLocation(slot.spaceId) : null;
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          activeSlotIndex === index
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
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
                            {sp ? sp.name : `Slot ${index + 1} (Sin asignar)`}
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
                          className="w-20 px-2 py-1 text-xs text-right font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Barra de balance total */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between font-semibold ${
                  isDiff
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span>Total asignado + pendiente: {currentTotal} u.</span>
                <span>Objetivo: {totalOriginal} u.</span>
              </div>
            </div>

            {/* Selector lateral de espacios */}
            {activeSlotIndex !== null && (
              <div className="lg:col-span-5 border-l border-slate-200 pl-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Elegir Espacio (Slot {activeSlotIndex + 1})
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
                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-emerald-50/70 border border-slate-100 hover:border-emerald-200 transition-colors text-left"
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
            disabled={isSaving || isDiff}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Distribución
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
