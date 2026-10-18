import React, { useState, useEffect } from 'react';
import { MinStockApi, WarehouseApi } from '../../services/api';
import { MinStockGeneralRow, Warehouse } from '../../types';
import {
  Search,
  ScanLine,
  Printer,
  Archive,
  Settings2,
  RefreshCw,
  AlertTriangle,
  Boxes,
  Calendar,
  X,
  Check,
} from 'lucide-react';
import { QRScannerModal } from '../../components/QRScannerModal';
import { AdminEditProductModal } from '../../features/warehouse/components/AdminEditProductModal';
import { SpaceStockEditModal } from '../../features/warehouse/components/SpaceStockEditModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const MinStockGeneral: React.FC = () => {
  const [items, setItems] = useState<MinStockGeneralRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'low'>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selección múltiple
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Modal archivar
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveDeadline, setArchiveDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [isArchiving, setIsArchiving] = useState(false);

  // Modal editar administrador
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editWarehouseId, setEditWarehouseId] = useState<string | null>(null);

  // Modal editar stock por espacios
  const [spaceProductId, setSpaceProductId] = useState<string | null>(null);
  const [spaceWarehouseId, setSpaceWarehouseId] = useState<string | null>(null);

  const loadData = async (searchOverride?: string | any) => {
    const q = typeof searchOverride === 'string' ? searchOverride : search;
    setIsLoading(true);
    try {
      const [data, whs] = await Promise.all([
        MinStockApi.getGeneral({
          warehouseId: selectedWarehouseId || undefined,
          stockFilter: stockFilter === 'all' ? undefined : stockFilter,
          search: q || undefined,
        }),
        WarehouseApi.getAll(),
      ]);
      setItems(data || []);
      setWarehouses(whs as Warehouse[]);
    } catch (err) {
      console.error('Error cargando stock mínimo general:', err);
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

  const getRowKey = (item: MinStockGeneralRow) => `${item.productId}-${item.warehouseId}`;

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
    doc.text('Reporte de Stock Mínimo General', 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Registros: ${targetItems.length}`, 14, 22);

    const head = [['Código', 'Producto', 'Categoría', 'Almacén', 'Stock Actual', 'Stock Mínimo', 'Último Movimiento']];
    const data = targetItems.map(it => [
      it.productCode,
      it.productName,
      it.categoryName || '—',
      it.warehouseName,
      `${it.currentStock} u.`,
      `${it.minStock} u.`,
      it.lastMovementAt ? format(new Date(it.lastMovementAt), 'dd/MM/yyyy HH:mm') : 'Sin registros',
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Stock_Minimo_General_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // Archivar seleccionados
  const handleArchiveSubmit = async () => {
    const selectedItems = items.filter(it => selectedKeys.has(getRowKey(it)));
    if (selectedItems.length === 0) return;

    setIsArchiving(true);
    try {
      const payload = selectedItems.map(it => ({
        productId: it.productId,
        warehouseId: it.warehouseId,
      }));
      await MinStockApi.archive(payload, `${archiveDeadline} 23:59:59`);
      setIsArchiveModalOpen(false);
      setSelectedKeys(new Set());
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error al archivar productos');
    } finally {
      setIsArchiving(false);
    }
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
              placeholder="Buscar por código, nombre..."
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
          {/* Selector de Almacén */}
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

          {/* Filtro de stock */}
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

          {/* Botones de Acción */}
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
            disabled={selectedKeys.size === 0}
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archivar ({selectedKeys.size})</span>
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

      {/* Tabla de Productos */}
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
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-center">Stock Mínimo</th>
                <th className="py-3 px-4">Último Movimiento</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Cargando productos con stock mínimo...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay productos bajo stock mínimo con los filtros seleccionados
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
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{item.minStock} u.</td>
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
                              setSpaceProductId(item.productId);
                              setSpaceWarehouseId(item.warehouseId);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
                            title="Editar stock por espacios"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>Espacios</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditProductId(item.productId);
                              setEditWarehouseId(item.warehouseId);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl border border-violet-200 transition-colors"
                            title="Editar umbrales de stock"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>Admin</span>
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

      {/* Modal Archivar con Fecha Límite */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Archive className="w-5 h-5 text-amber-600" />
                <span>Archivar Productos Seleccionados</span>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Se archivarán <strong>{selectedKeys.size}</strong> productos. No aparecerán en las alertas de Stock
              Mínimo General hasta cumplirse la fecha límite o hasta que se desarchiven manualmente.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fecha Límite de Archivado (Por defecto: 1 mes)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  value={archiveDeadline}
                  onChange={e => setArchiveDeadline(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={handleArchiveSubmit}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isArchiving ? 'Archivando...' : 'Confirmar Archivado'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Administrador */}
      {editProductId && (
        <AdminEditProductModal
          productId={editProductId}
          initialWarehouseId={editWarehouseId}
          onClose={() => {
            setEditProductId(null);
            setEditWarehouseId(null);
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
        title="Escanear Código de Producto"
      />
    </div>
  );
};

export default MinStockGeneral;
