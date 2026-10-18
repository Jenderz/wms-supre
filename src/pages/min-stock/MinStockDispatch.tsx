import React, { useState, useEffect } from 'react';
import { MinStockApi, WarehouseApi } from '../../services/api';
import { MinStockDispatchRow, Warehouse } from '../../types';
import {
  Search,
  ScanLine,
  Printer,
  Settings2,
  Layers,
  RefreshCw,
  Boxes,
  MapPin,
} from 'lucide-react';
import { QRScannerModal } from '../../components/QRScannerModal';
import { AdminEditProductModal } from '../../features/warehouse/components/AdminEditProductModal';
import { SpaceStockEditModal } from '../../features/warehouse/components/SpaceStockEditModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const MinStockDispatch: React.FC = () => {
  const [items, setItems] = useState<MinStockDispatchRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'low'>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selección múltiple
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Modales
  const [adminProductId, setAdminProductId] = useState<string | null>(null);
  const [adminWarehouseId, setAdminWarehouseId] = useState<string | null>(null);

  const [spaceProductId, setSpaceProductId] = useState<string | null>(null);
  const [spaceWarehouseId, setSpaceWarehouseId] = useState<string | null>(null);

  const loadData = async (searchOverride?: string | any) => {
    const q = typeof searchOverride === 'string' ? searchOverride : search;
    setIsLoading(true);
    try {
      const [data, whs] = await Promise.all([
        MinStockApi.getDispatch({
          warehouseId: selectedWarehouseId || undefined,
          stockFilter: stockFilter === 'all' ? undefined : stockFilter,
          search: q || undefined,
        }),
        WarehouseApi.getAll(),
      ]);
      setItems(data || []);
      setWarehouses(whs as Warehouse[]);
    } catch (err) {
      console.error('Error cargando stock mínimo despacho:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId, stockFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getRowKey = (item: MinStockDispatchRow) => item.stockId;

  const toggleSelectAll = () => {
    if (selectedKeys.size === items.length && items.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(items.map(getRowKey)));
    }
  };

  const toggleSelectOne = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  // Imprimir PDF
  const handlePrintSelected = () => {
    const selectedItems = items.filter(it => selectedKeys.has(getRowKey(it)));
    const targetItems = selectedItems.length > 0 ? selectedItems : items;

    if (targetItems.length === 0) {
      alert('No hay elementos para imprimir.');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('Reporte de Stock Mínimo - Espacios de Despacho', 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Registros: ${targetItems.length}`, 14, 22);

    const head = [['Código', 'Producto', 'Categoría', 'Almacén', 'Espacio Despacho', 'Stock Actual', 'Mín. Despacho', 'Último Movimiento']];
    const data = targetItems.map(it => [
      it.productCode,
      it.productName,
      it.categoryName || '—',
      it.warehouseName,
      it.warehouseSpaceName,
      `${it.currentStock} u.`,
      `${it.minStockDispatch} u.`,
      it.lastMovementAt ? format(new Date(it.lastMovementAt), 'dd/MM/yyyy HH:mm') : 'Sin registros',
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Stock_Minimo_Despachos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Acciones */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, producto o espacio..."
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              title="Escanear código"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Todos los almacenes</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                stockFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('zero')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                stockFilter === 'zero'
                  ? 'bg-red-50 text-red-700 border border-red-200 shadow-sm'
                  : 'text-slate-600 hover:text-red-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Stock en 0
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('low')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                stockFilter === 'low'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Stock bajo
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintSelected}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir ({selectedKeys.size || items.length})</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabla de Despachos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedKeys.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-4 w-14">Foto</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Almacén</th>
                <th className="py-3 px-4">Espacio Almacén</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-center">Mín. Despacho</th>
                <th className="py-3 px-4">Último Movimiento</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Cargando stock de espacios de despacho...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay productos en espacios de despacho bajo stock mínimo
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const key = getRowKey(item);
                  const isSelected = selectedKeys.has(key);
                  const isZero = item.currentStock === 0;

                  return (
                    <tr
                      key={key}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(key)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <Boxes className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-blue-600 font-semibold">{item.productCode}</span>
                          {item.categoryName && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {item.categoryName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{item.warehouseName}</td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.warehouseSpaceName}</span>
                          <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded font-bold">
                            DESPACHO
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            isZero
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.currentStock} u.
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{item.minStockDispatch} u.</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {item.lastMovementAt ? (
                          format(new Date(item.lastMovementAt), 'dd/MM/yyyy HH:mm')
                        ) : (
                          <span className="text-slate-400 italic">Sin movimientos</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminProductId(item.productId);
                              setAdminWarehouseId(item.warehouseId);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl border border-violet-200 transition-colors"
                            title="Editar Administrador"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>Admin</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSpaceProductId(item.productId);
                              setSpaceWarehouseId(item.warehouseId);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
                            title="Editar Stock por Espacios"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Espacios</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Administrador */}
      {adminProductId && (
        <AdminEditProductModal
          productId={adminProductId}
          initialWarehouseId={adminWarehouseId}
          onClose={() => {
            setAdminProductId(null);
            setAdminWarehouseId(null);
          }}
          onSuccess={loadData}
        />
      )}

      {/* Modal Editar Stock por Espacios */}
      {spaceProductId && (
        <SpaceStockEditModal
          productId={spaceProductId}
          warehouseId={spaceWarehouseId}
          onClose={() => {
            setSpaceProductId(null);
            setSpaceWarehouseId(null);
          }}
          onSuccess={loadData}
        />
      )}

      {/* Escáner QR */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={code => {
          setSearch(code);
          setIsScannerOpen(false);
          loadData(code);
        }}
        title="Escanear Código de Producto o Espacio"
      />
    </div>
  );
};

export default MinStockDispatch;
