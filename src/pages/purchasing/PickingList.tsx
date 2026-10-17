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
  Filter
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
    getCategory,
    getStore,
    getUser
  } = usePurchasing();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PENDING' | 'CONFORMED'>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');

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

  return (
    <div className="space-y-6">
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
                          <Badge
                            variant={
                              lot.status === 'CONFORMED'
                                ? 'success'
                                : lot.status === 'PENDING'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {lot.status === 'DRAFT'
                              ? 'Borrador'
                              : lot.status === 'PENDING'
                              ? 'Pendiente'
                              : 'Conformado'}
                          </Badge>
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
    </div>
  );
};

export default PickingList;
