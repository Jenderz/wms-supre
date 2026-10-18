import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransferPickingApi, WarehouseApi, UserApi } from '../../services/api';
import { TransferPicking, Warehouse, User } from '../../types';
import {
  Search,
  ScanLine,
  Printer,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Boxes,
  ArrowRight,
  X,
  MapPin,
} from 'lucide-react';
import { StatusFloatingMenu, GeneralStatus } from '../../components/StatusFloatingMenu';
import { QRScannerModal } from '../../components/QRScannerModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const TransferPickingList: React.FC = () => {
  const navigate = useNavigate();
  const [pickings, setPickings] = useState<TransferPicking[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Modal Detalle
  const [detailItem, setDetailItem] = useState<TransferPicking | null>(null);

  const loadData = async (searchOverride?: string | any) => {
    const q = typeof searchOverride === 'string' ? searchOverride : search;
    setIsLoading(true);
    try {
      const [list, whs, usrs] = await Promise.all([
        TransferPickingApi.getAll({
          originWarehouseId: originWarehouseId || undefined,
          destinationWarehouseId: destinationWarehouseId || undefined,
          responsibleUserId: responsibleUserId || undefined,
          status: statusFilter || undefined,
          search: q || undefined,
        }),
        WarehouseApi.getAll(),
        UserApi.getAll(),
      ]);
      setPickings(list || []);
      setWarehouses(whs as Warehouse[]);
      setUsers(usrs as User[]);
    } catch (err) {
      console.error('Error cargando lista de transferencias:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [originWarehouseId, destinationWarehouseId, responsibleUserId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleStatusChange = async (id: string, newStatus: GeneralStatus) => {
    try {
      await TransferPickingApi.updateStatus(id, newStatus);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error actualizando estado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este picking de transferencia?')) return;
    try {
      await TransferPickingApi.delete(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error eliminando transferencia');
    }
  };

  const handlePrint = (item: TransferPicking) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`PICKING DE TRANSFERENCIA #${item.lotNumber}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha: ${format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}`, 14, 22);
    doc.text(`Origen: ${item.originWarehouseName || '—'}  ->  Destino: ${item.destinationWarehouseName || '—'}`, 14, 27);
    doc.text(`Responsable: ${item.responsibleUserName || '—'} | Estado: ${item.status}`, 14, 32);
    if (item.description) doc.text(`Descripción: ${item.description}`, 14, 37);

    const head = [['#', 'Código', 'Producto', 'Bultos', 'Cantidad', 'Espacios Asignados']];
    const data = (item.items || []).map((it, idx) => [
      idx + 1,
      it.productCode || '—',
      it.productName || '—',
      it.numberOfPackages || 1,
      `${it.quantity} u.`,
      (it.spacesDistribution || []).map(sp => `${sp.spaceName}: ${sp.quantity}`).join(', ') || 'Sin asignar',
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: item.description ? 42 : 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Transferencia_${item.lotNumber}.pdf`);
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
              placeholder="Buscar por lote, descripción..."
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
          {/* Almacén Origen */}
          <select
            value={originWarehouseId}
            onChange={e => setOriginWarehouseId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Origen (Todos)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Almacén Destino */}
          <select
            value={destinationWarehouseId}
            onChange={e => setDestinationWarehouseId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Destino (Todos)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Responsable */}
          <select
            value={responsibleUserId}
            onChange={e => setResponsibleUserId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Responsable (Todos)</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Estado (Todos)</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING">Pendiente</option>
            <option value="CONFORMED">Conformado</option>
          </select>

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

      {/* Tabla de Picking Transferencias */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Lote</th>
                <th className="py-3 px-4">Ruta Transferencia</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-center">Bultos</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Cargando pickings de transferencia...
                  </td>
                </tr>
              ) : pickings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay transferencias registradas con los filtros actuales
                  </td>
                </tr>
              ) : (
                pickings.map(item => {
                  const isConformed = item.status === 'CONFORMED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200/60">
                          {item.lotNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <span>{item.originWarehouseName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-blue-700 font-semibold">{item.destinationWarehouseName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{item.responsibleUserName}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{item.description || '—'}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{item.totalItems}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{item.totalPackages}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusFloatingMenu
                          status={item.status as GeneralStatus}
                          onChange={st => handleStatusChange(item.id, st)}
                        />
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const full = await TransferPickingApi.getById(item.id);
                              setDetailItem(full);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const full = await TransferPickingApi.getById(item.id);
                              handlePrint(full);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Imprimir PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {!isConformed && (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate(`/transfer-picking/new?edit=${item.id}`)}
                                className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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

      {/* Modal Detalle */}
      {detailItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl text-sm border border-blue-200">
                  {detailItem.lotNumber}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {detailItem.originWarehouseName} → {detailItem.destinationWarehouseName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  <strong>Responsable:</strong> {detailItem.responsibleUserName}
                </div>
                {detailItem.description && (
                  <div>
                    <strong>Descripción:</strong> {detailItem.description}
                  </div>
                )}
                <div>
                  <strong>Estado:</strong> {detailItem.status}
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pt-2 border-t">
                Productos ({detailItem.items?.length || 0})
              </h4>

              <div className="space-y-2">
                {(detailItem.items || []).map(it => (
                  <div
                    key={it.productId}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                          <Boxes className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        <div className="font-mono text-[10px] text-blue-600">{it.productCode}</div>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-bold text-slate-900">{it.quantity} unidades (1 bulto)</div>
                      <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {(it.spacesDistribution || []).map(sp => `${sp.spaceName}: ${sp.quantity}u`).join(', ') ||
                            'Sin espacio'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => handlePrint(detailItem)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
        title="Escanear Código de Lote o Transferencia"
      />
    </div>
  );
};

export default TransferPickingList;
