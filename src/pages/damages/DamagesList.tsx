import React, { useState, useEffect } from 'react';
import { DamageApi, WarehouseApi } from '../../services/api';
import { DamageRecord, Warehouse } from '../../types';
import {
  Search,
  ScanLine,
  Printer,
  Trash2,
  RefreshCw,
  Boxes,
  MapPin,
  Flame,
} from 'lucide-react';
import { StatusFloatingMenu, GeneralStatus } from '../../components/StatusFloatingMenu';
import { QRScannerModal } from '../../components/QRScannerModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const DamagesList: React.FC = () => {
  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [invCorrFilter, setInvCorrFilter] = useState<'all' | 'true' | 'false'>('all');
  const [warehouseId, setWarehouseId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = async (searchOverride?: string | any) => {
    const q = typeof searchOverride === 'string' ? searchOverride : search;
    setIsLoading(true);
    try {
      const invCorrBool =
        invCorrFilter === 'true' ? true : invCorrFilter === 'false' ? false : undefined;

      const [list, whs] = await Promise.all([
        DamageApi.getAll({
          inventoryCorrection: invCorrBool,
          warehouseId: warehouseId || undefined,
          status: statusFilter || undefined,
          search: q || undefined,
        }),
        WarehouseApi.getAll(),
      ]);
      setRecords(list || []);
      setWarehouses(whs as Warehouse[]);
    } catch (err) {
      console.error('Error cargando lista de averías:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [invCorrFilter, warehouseId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleStatusChange = async (id: string, newStatus: GeneralStatus) => {
    try {
      await DamageApi.updateStatus(id, newStatus);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error actualizando estado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este registro de avería?')) return;
    try {
      await DamageApi.delete(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error eliminando avería');
    }
  };

  // Imprimir seleccionados
  const handlePrintSelected = () => {
    const selectedRecords = records.filter(r => selectedIds.has(r.id));
    const target = selectedRecords.length > 0 ? selectedRecords : records;

    if (target.length === 0) {
      alert('No hay registros para imprimir.');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('Registros de Averías y Bajas', 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Registros: ${target.length}`, 14, 22);

    const head = [['Código', 'Producto', 'Avería (Cant)', 'Corrección Inv.', 'Almacén', 'Espacio Almacén', 'Estado', 'Responsable', 'Fecha']];
    const data = target.map(r => [
      r.code,
      r.productName || '—',
      `${r.quantity} u.`,
      r.inventoryCorrection ? 'Sí' : 'No',
      r.warehouseName || '—',
      r.inventoryCorrection
        ? (r.spacesDistribution || []).map(sp => `${sp.spaceName} (${sp.quantity}u)`).join(', ') || 'Sin espacio'
        : 'No aplica',
      r.status,
      r.responsibleUserName || '—',
      format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm'),
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 26,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Registros_Averias_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, producto..."
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              title="Escanear"
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
          {/* Corrección Inventario */}
          <select
            value={invCorrFilter}
            onChange={e => setInvCorrFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          >
            <option value="all">Corrección Inv. (Todos)</option>
            <option value="true">Sí (Descuenta)</option>
            <option value="false">No (Solo Auditoría)</option>
          </select>

          {/* Almacén */}
          <select
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          >
            <option value="">Almacén (Todos)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          >
            <option value="">Estado (Todos)</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING">Pendiente</option>
            <option value="CONFORMED">Conformado</option>
          </select>

          <button
            type="button"
            onClick={handlePrintSelected}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir ({selectedIds.size || records.length})</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabla Registros Averías */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === records.length && records.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                </th>
                <th className="py-3 px-4">Cod-Registro</th>
                <th className="py-3 px-4 w-12">Imagen</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4 text-center">Stock Averías</th>
                <th className="py-3 px-4 text-center">Corrección Inv.</th>
                <th className="py-3 px-4">Almacén</th>
                <th className="py-3 px-4">Espacio Almacén</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                    Cargando registros de averías...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 italic">
                    <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay registros de averías registrados
                  </td>
                </tr>
              ) : (
                records.map(item => {
                  const isSelected = selectedIds.has(item.id);
                  const isConformed = item.status === 'CONFORMED';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-rose-800 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-9 h-9 object-cover rounded-xl border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <Boxes className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="font-mono text-[10px] text-blue-600">{item.productCode}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-rose-700 bg-rose-50">
                          {item.quantity} u.
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.inventoryCorrection
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.inventoryCorrection ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{item.warehouseName}</td>
                      <td className="py-3 px-4">
                        {item.inventoryCorrection ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {(item.spacesDistribution || []).map(sp => `${sp.spaceName} (${sp.quantity}u)`).join(', ') ||
                                'Sin espacio'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusFloatingMenu
                          status={item.status as GeneralStatus}
                          onChange={st => handleStatusChange(item.id, st)}
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{item.responsibleUserName}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{item.description || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isConformed && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escáner QR */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={code => {
          setSearch(code);
          setIsScannerOpen(false);
          loadData(code);
        }}
        title="Escanear Código de Avería o Producto"
      />
    </div>
  );
};

export default DamagesList;
