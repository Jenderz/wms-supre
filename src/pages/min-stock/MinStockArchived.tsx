import React, { useState, useEffect } from 'react';
import { MinStockApi, WarehouseApi } from '../../services/api';
import { MinStockArchivedRow, Warehouse } from '../../types';
import {
  Search,
  ScanLine,
  Printer,
  ArchiveRestore,
  Settings2,
  RefreshCw,
  Boxes,
  Calendar,
} from 'lucide-react';
import { QRScannerModal } from '../../components/QRScannerModal';
import { AdminEditProductModal } from '../../features/warehouse/components/AdminEditProductModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const MinStockArchived: React.FC = () => {
  const [items, setItems] = useState<MinStockArchivedRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selección múltiple
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  // Modal Admin
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editWarehouseId, setEditWarehouseId] = useState<string | null>(null);

  const loadData = async (searchOverride?: string | any) => {
    const q = typeof searchOverride === 'string' ? searchOverride : search;
    setIsLoading(true);
    try {
      const [data, whs] = await Promise.all([
        MinStockApi.getArchived({
          warehouseId: selectedWarehouseId || undefined,
          search: q || undefined,
        }),
        WarehouseApi.getAll(),
      ]);
      setItems(data || []);
      setWarehouses(whs as Warehouse[]);
    } catch (err) {
      console.error('Error cargando stock mínimo archivado:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getRowKey = (item: MinStockArchivedRow) => item.archiveId;

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
    doc.text('Reporte de Stock Mínimo - Productos Archivados', 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Registros: ${targetItems.length}`, 14, 22);

    const head = [['Código', 'Producto', 'Categoría', 'Almacén', 'Stock Actual', 'Mínimo', 'Fecha Archivado', 'Límite Archivado', 'Archivado Por']];
    const data = targetItems.map(it => [
      it.productCode,
      it.productName,
      it.categoryName || '—',
      it.warehouseName,
      `${it.currentStock} u.`,
      `${it.minStock} u.`,
      format(new Date(it.archivedAt), 'dd/MM/yyyy HH:mm'),
      format(new Date(it.archiveDeadlineAt), 'dd/MM/yyyy'),
      it.archivedByName || '—',
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Stock_Minimo_Archivado_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // Desarchivar
  const handleUnarchive = async () => {
    const selectedItems = items.filter(it => selectedKeys.has(getRowKey(it)));
    if (selectedItems.length === 0) return;

    if (!confirm(`¿Desea desarchivar ${selectedItems.length} producto(s)? Regresarán a Stock Mínimo General.`)) {
      return;
    }

    setIsUnarchiving(true);
    try {
      const payload = selectedItems.map(it => ({
        productId: it.productId,
        warehouseId: it.warehouseId,
      }));
      await MinStockApi.unarchive(payload);
      setSelectedKeys(new Set());
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error al desarchivar productos');
    } finally {
      setIsUnarchiving(false);
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
              placeholder="Buscar por código, producto..."
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
            disabled={selectedKeys.size === 0 || isUnarchiving}
            onClick={handleUnarchive}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArchiveRestore className="w-3.5 h-3.5" />
            <span>Desarchivar ({selectedKeys.size})</span>
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

      {/* Tabla de Archivados */}
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
                <th className="py-3 px-4">Fecha Archivado</th>
                <th className="py-3 px-4">Fecha Límite</th>
                <th className="py-3 px-4">Archivado Por</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Cargando productos archivados...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay productos archivados activos
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const key = getRowKey(item);
                  const isSelected = selectedKeys.has(key);

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
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{item.currentStock} u.</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">{item.minStock} u.</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {format(new Date(item.archivedAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4 font-medium text-amber-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          <span>{format(new Date(item.archiveDeadlineAt), 'dd/MM/yyyy')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {item.archivedByName || 'Sistema'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditProductId(item.productId);
                            setEditWarehouseId(item.warehouseId);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl border border-violet-200 transition-colors"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Editar Admin</span>
                        </button>
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

export default MinStockArchived;
