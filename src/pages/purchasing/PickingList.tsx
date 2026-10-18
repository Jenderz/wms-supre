import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchasing } from '../../features/purchasing/hooks/usePurchasing';
import { PickingLot } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  Search,
  Download,
  Package,
  Calendar,
  Warehouse as StoreIcon,
  User as UserIcon,
  Layers,
  Filter,
  CheckCircle,
  CheckCircle2,
  Clock,
  ArrowRightCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PickingList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    products,
    warehouses,
    pickingLots,
    isLoading,
    deletePickingLot,
    conformPickingLot,
    updatePickingLotStatus,
    getProduct,
    getCategory,
    getStore,
    getUser
  } = usePurchasing();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PENDING' | 'CONFORMED'>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [lotToConform, setLotToConform] = useState<PickingLot | null>(null);
  const [isConforming, setIsConforming] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const visibleLots = useMemo(() => {
    return pickingLots.filter(lot => {
      // Filtrado por almacenes asignados si es rol COMPRAS
      if (user?.role === 'COMPRAS' && user.assignedWarehouses && user.assignedWarehouses.length > 0) {
        if (!user.assignedWarehouses.includes(lot.warehouseId)) return false;
      }

      // Filtro por almacén seleccionado
      if (warehouseFilter !== 'ALL' && lot.warehouseId !== warehouseFilter) {
        return false;
      }

      // Filtro por estado
      if (statusFilter !== 'ALL' && lot.status !== statusFilter) {
        return false;
      }

      // Filtro por término de búsqueda (lote, descripción, creador)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const lotNum = (lot.lotNumber || '').toLowerCase();
        const desc = (lot.description || '').toLowerCase();
        const storeName = (getStore(lot.warehouseId)?.name || '').toLowerCase();
        const creatorName = (getUser(lot.createdBy)?.name || '').toLowerCase();
        return lotNum.includes(term) || desc.includes(term) || storeName.includes(term) || creatorName.includes(term);
      }

      return true;
    });
  }, [pickingLots, user, warehouseFilter, statusFilter, searchTerm, getStore, getUser]);

  const handleExportPDF = (lot: PickingLot) => {
    const doc = new jsPDF();
    const storeName = getStore(lot.warehouseId)?.name || 'Almacén Desconocido';
    const creatorName = getUser(lot.createdBy)?.name || 'Desconocido';
    const date = lot.createdAt ? format(new Date(lot.createdAt), 'dd/MM/yyyy HH:mm') : '-';

    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Azul Primario
    doc.text('SUPRE WMS', 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Orden de Picking / Abastecimiento', 14, 30);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Lote: ${lot.lotNumber}`, 135, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${date}`, 135, 30);

    // Info General
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(`Almacén Destino: ${storeName}`, 14, 45);
    doc.text(`Creado Por: ${creatorName}`, 14, 52);
    doc.text(
      `Estado: ${lot.status === 'DRAFT' ? 'Borrador' : lot.status === 'PENDING' ? 'Pendiente' : 'Conformado'}`,
      14,
      59
    );
    doc.text(`Descripción: ${lot.description || '-'}`, 14, 66);

    // Tabla de Items
    const tableData = (lot.items || []).map(item => {
      const product = products.find(p => String(p.id) === String(item.productId));
      const category = getCategory(product?.categoryId || '');
      const packagesStr = item.packagesConfig && item.packagesConfig.length > 0
        ? item.packagesConfig.map(p => `Bulto ${p.packageIndex}: ${p.quantity} pzas`).join('\n')
        : '-';

      return [
        product?.code || 'N/A',
        product?.name || 'Producto Desconocido',
        category?.code || '-',
        Math.round(Number(item.quantityToEnter) || 0).toString(),
        Math.round(Number(item.numberOfPackages) || 0).toString(),
        packagesStr,
        item.packageDescription || '-'
      ];
    });

    autoTable(doc, {
      startY: 74,
      head: [['Código', 'Producto', 'Cat.', 'Cant.', 'Bultos', 'Detalle Bultos', 'Desc. Bulto']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`Orden_Picking_${lot.lotNumber}.pdf`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este lote de picking?')) {
      deletePickingLot(id);
    }
  };

  const handlePromoteToPending = async (lot: PickingLot) => {
    if (window.confirm(`¿Pasar el lote #${lot.lotNumber} a estado PENDIENTE para habilitar su recepción y conformación en almacén?`)) {
      try {
        await updatePickingLotStatus(lot.id, 'PENDING');
        setActionSuccessMsg(`Lote #${lot.lotNumber} actualizado a PENDIENTE.`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } catch (e: any) {
        alert(`Error al actualizar estado: ${e?.message || e}`);
      }
    }
  };

  const handleConfirmConform = async () => {
    if (!lotToConform) return;
    setIsConforming(true);
    try {
      await conformPickingLot(lotToConform.id);
      const conformedNumber = lotToConform.lotNumber;
      setLotToConform(null);
      setActionSuccessMsg(`¡Lote #${conformedNumber} conformado exitosamente! La mercancía ha ingresado al inventario.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Error al conformar el lote: ${err?.message || err}`);
    } finally {
      setIsConforming(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Barra de Acciones y Filtros ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por lote, descripción o creador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="DRAFT">Borradores</option>
                <option value="PENDING">Pendientes</option>
                <option value="CONFORMED">Conformados</option>
              </select>
            </div>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="ALL">Todos los Almacenes</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            <Button
              onClick={() => navigate('/purchasing/new')}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nuevo Picking
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabla de Lotes ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[1000px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Almacén Destino</TableHead>
                    <TableHead>Creador</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-center">Bultos</TableHead>
                    <TableHead className="text-center">Piezas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLots.map(lot => {
                    const store = getStore(String(lot.warehouseId));
                    const creator = getUser(String(lot.createdBy));
                    const totalPackages = (lot.items || []).reduce((sum, i) => sum + (Number(i.numberOfPackages) || 0), 0);
                    const totalPieces = (lot.items || []).reduce((sum, i) => sum + (Number(i.quantityToEnter) || 0), 0);

                    return (
                      <TableRow key={lot.id} className="hover:bg-slate-50/70 transition-colors">
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600" />
                            <span className="font-mono text-sm font-semibold">{lot.lotNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <StoreIcon className="w-4 h-4 text-slate-400" />
                            <span>{store?.name || 'Almacén no asignado'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                            <span>{creator?.name || 'Desconocido'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-500 text-sm" title={lot.description}>
                          {lot.description || '-'}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-700">
                          {(lot.items || []).length}
                        </TableCell>
                        <TableCell className="text-center font-mono text-slate-600">
                          {Math.round(totalPackages)}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-blue-600">
                          {Math.round(totalPieces)}
                        </TableCell>
                        <TableCell>
                          {lot.status === 'CONFORMED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Conformado
                            </span>
                          )}
                          {lot.status === 'PENDING' && (
                            <button
                              onClick={() => setLotToConform(lot)}
                              title="Clic para conformar e ingresar stock"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 hover:bg-emerald-100 text-amber-800 hover:text-emerald-800 border border-amber-300 hover:border-emerald-300 transition-all cursor-pointer shadow-sm group"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600 group-hover:hidden" />
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 hidden group-hover:inline" />
                              <span className="group-hover:hidden">Pendiente</span>
                              <span className="hidden group-hover:inline font-bold">¡Conformar!</span>
                            </button>
                          )}
                          {lot.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePromoteToPending(lot)}
                              title="Clic para enviar a Pendiente"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 transition-all cursor-pointer shadow-sm group"
                            >
                              <span>Borrador</span>
                              <ArrowRightCircle className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100" />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {lot.createdAt ? format(new Date(lot.createdAt), 'dd/MM/yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleExportPDF(lot)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Exportar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {lot.status === 'PENDING' && (
                              <button
                                onClick={() => setLotToConform(lot)}
                                className="p-2 text-amber-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Conformar Lote e Ingresar Stock"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}

                            {lot.status === 'DRAFT' && (
                              <button
                                onClick={() => handlePromoteToPending(lot)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Pasar a Pendiente"
                              >
                                <ArrowRightCircle className="w-4 h-4" />
                              </button>
                            )}

                            {lot.status !== 'CONFORMED' && (
                              <>
                                <button
                                  onClick={() => navigate(`/purchasing/new?edit=${lot.id}`)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(lot.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleLots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-14 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-12 h-12 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-700">No se encontraron lotes de picking</p>
                          <p className="text-xs text-slate-400 mt-1">Crea un nuevo lote o ajusta los filtros de búsqueda.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de Confirmación para Conformar Lote ── */}
      {lotToConform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Conformar Lote de Picking</h3>
                  <p className="text-xs text-slate-500 font-mono">#{lotToConform.lotNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setLotToConform(null)}
                disabled={isConforming}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del Lote */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Almacén Destino</p>
                <p className="text-sm font-bold text-slate-800 truncate mt-0.5">
                  {getStore(lotToConform.warehouseId)?.name || 'Sin almacén'}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ítems</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{lotToConform.items.length}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Piezas</p>
                <p className="text-sm font-bold text-blue-600 mt-0.5">
                  {Math.round(lotToConform.items.reduce((acc, it) => acc + (Number(it.quantityToEnter) || 0), 0))}
                </p>
              </div>
            </div>

            {/* Detalle de Productos a Ingresar */}
            <div className="mb-5 max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
              {lotToConform.items.map((item, idx) => {
                const prod = getProduct(item.productId);
                return (
                  <div key={item.id || idx} className="p-2.5 flex items-center justify-between text-xs bg-white hover:bg-slate-50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{prod?.name || `Producto #${item.productId}`}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{prod?.code || item.productId}</span>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +{item.quantityToEnter} uds
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Alerta de Impacto */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 flex gap-3 text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Efecto en Inventario</p>
                <p className="mt-0.5 text-amber-700">
                  Al confirmar, las cantidades se incrementarán de inmediato en el inventario físico del almacén y se registrarán movimientos de recepción formal (IN/RECEPTION).
                </p>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setLotToConform(null)}
                disabled={isConforming}
                className="text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmConform}
                disabled={isConforming}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
              >
                {isConforming ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Conformando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Conformar e Ingresar Stock
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PickingList;
