import React, { useState } from 'react';
import { Stock, User, Warehouse, Product, WarehouseSpace, Provider } from '../../../types';
import {
  Search, Printer, MapPin, Box, ScanLine, Edit2, Check, X,
  Package, Eye, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, Ruler, Users, Download,
  Settings2, Layers, Save, Loader2, QrCode, Warehouse as WarehouseIcon,
  CheckSquare, Square, ListChecks, FileText
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { QRScannerModal } from '../../../components/QRScannerModal';
import { useLockedAction } from '../../../hooks/useLockedAction';
import { LockModal } from '../../../components/LockModal';
import { useSpaceGroups } from '../../infrastructure/hooks/useSpaceGroups';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface InventoryTabProps {
  stock: Stock[];
  products: Product[];
  warehouses: Warehouse[];
  warehouseSpaces: WarehouseSpace[];
  providers: Provider[];
  getProduct: (id: string) => any;
  getCategory: (id: string) => any;
  getLocation: (id: string) => any;
  getStore: (id: string) => any;
  getProvider?: (id: string) => any;
  user: User | null;
  updateMinStock: (productId: string, warehouseId: string, newMinStock: number) => void;
  updateStockQuantity: (stockId: string, newQuantity: number) => void;
  updateProduct: (productId: string, data: unknown) => Promise<void>;
  assignSpace: (stockId: string, newSpaceId: string | null) => Promise<void>;
  upsertStock: (payload: {
    productId: string;
    warehouseId: string;
    warehouseSpaceId: string | null;
    quantity: number;
    minStock: number;
    minStockDispatch?: number;
    deductFromUnassigned?: boolean;
  }) => Promise<void>;
  initialSpaceFilter?: string;
  initialWarehouseFilter?: string;
}

// ── Fila etiqueta + valor para el modal de detalles ────────────────────────────
const DetailRow: React.FC<{
  label: string;
  value?: string | number | null;
  mono?: boolean;
  empty?: boolean;
}> = ({ label, value, mono = false, empty = false }) => (
  <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
    <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] flex-shrink-0 border-r border-slate-200">
      {label}
    </div>
    <div className={`flex-1 px-3 py-2 text-sm ${mono ? 'font-mono text-blue-600 font-medium' : ''} ${empty ? 'text-slate-400 italic' : 'text-slate-900 font-medium'}`}>
      {empty ? 'Sin datos' : (value ?? '—')}
    </div>
  </div>
);

// ── Bloque Stock N ─────────────────────────────────────────────────────────────
const StockBlock: React.FC<{
  index: number;
  spaceName: string | null;
  qty: number;
  pending?: boolean;
}> = ({ index, spaceName, qty, pending = false }) => (
  <div className={`border rounded-xl overflow-hidden ${pending ? 'border-amber-200' : 'border-slate-200'}`}>
    <div className={`px-3 py-1.5 flex items-center justify-between border-b ${pending ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`text-xs font-semibold uppercase tracking-wide ${pending ? 'text-amber-700' : 'text-slate-600'}`}>
        {pending ? 'Pendiente' : `Stock ${index}`}
      </span>
      <span className={`text-lg font-bold ${pending ? 'text-amber-700' : 'text-blue-600'}`}>
        {qty}
      </span>
    </div>
    <div className="px-3 py-2 bg-white">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className={(spaceName && qty > 0) ? 'text-slate-700' : 'text-slate-400 italic'}>
          {(spaceName && qty > 0) ? spaceName : 'Sin espacio asignado'}
        </span>
      </div>
    </div>
  </div>
);

export const InventoryTab: React.FC<InventoryTabProps> = ({
  stock,
  products,
  warehouses,
  warehouseSpaces,
  providers,
  getProduct,
  getCategory,
  getLocation,
  getStore,
  getProvider,
  user,
  updateMinStock,
  updateStockQuantity,
  updateProduct,
  assignSpace,
  upsertStock,
  initialSpaceFilter = '',
  initialWarehouseFilter = '',
}) => {
  const lockEdit   = useLockedAction('INVENTORY', 'EDIT');
  const lockView   = useLockedAction('INVENTORY', 'VIEW');
  const lockDelete = useLockedAction('INVENTORY', 'DELETE');

  const [inventorySearch, setInventorySearch]                 = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('');
  const [inventoryStoreFilter, setInventoryStoreFilter]       = useState(initialWarehouseFilter || '');
  const [inventorySpaceFilter, setInventorySpaceFilter]       = useState(initialSpaceFilter || '');
  const [inventoryGroupFilter, setInventoryGroupFilter]       = useState('');
  const [isScannerOpen, setIsScannerOpen]                     = useState(false);
  const [editingMinStock, setEditingMinStock]                 = useState<{ productId: string; warehouseId: string } | null>(null);
  const [minStockValue, setMinStockValue]                     = useState('');
  const [editingStockQty, setEditingStockQty]                 = useState<{ stockId: string; value: string } | null>(null);
  const [detailProduct, setDetailProduct]                     = useState<string | null>(null);
  const [expandedStock, setExpandedStock]                     = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]                         = useState(!!initialSpaceFilter || !!initialWarehouseFilter);

  const { groups: spaceGroups } = useSpaceGroups();

  // ── Ordenamiento de la tabla de inventario ────────────────────────────────
  type InventorySortKey = 'name' | 'code' | 'category' | 'subcategory' | 'totalQty' | 'pendingQty' | 'warehouse';
  const [sortKey, setSortKey] = useState<InventorySortKey | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: InventorySortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Estado modales adicionales ────────────────────────────────────────────────
  const [adminEditProduct, setAdminEditProduct]               = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm]                     = useState<Record<string, any>>({});
  const [adminEditSaving, setAdminEditSaving]                 = useState(false);
  const [adminEditError, setAdminEditError]                   = useState<string | null>(null);

  // New admin modal specific state variables
  const [adminSelectedWarehouseId, setAdminSelectedWarehouseId] = useState<string>('');
  const [adminPendingQty, setAdminPendingQty]                 = useState<number>(0);
  const [adminTotalInput, setAdminTotalInput]                 = useState<number>(0);
  const [adminMinStockVal, setAdminMinStockVal]               = useState<string>('0');
  const [adminMinStockDispatch, setAdminMinStockDispatch]     = useState<string>('0');
  const [adminSlots, setAdminSlots]                           = useState<{ spaceId: string | null; qty: number | string }[]>([
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
  ]);
  const [adminOriginalStock, setAdminOriginalStock]           = useState<Stock[]>([]);
  const [activeSlotIndexForSpacePicker, setActiveSlotIndexForSpacePicker] = useState<number | null>(null);
  const [spacePickerSearch, setSpacePickerSearch]             = useState('');
  const [isSpacePickerScannerOpen, setIsSpacePickerScannerOpen] = useState(false);

  const [spaceEditProduct, setSpaceEditProduct]               = useState<string | null>(null);
  const [spaceEditSlots, setSpaceEditSlots]                   = useState<{ spaceId: string | null; qty: number | string }[]>([
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
    { spaceId: null, qty: '' },
  ]);
  const [spaceEditPendingQty, setSpaceEditPendingQty]         = useState<number>(0);
  const [spaceEditWarehouseId, setSpaceEditWarehouseId]       = useState<string>('');
  const [activeSlotIndexForSpaceEditPicker, setActiveSlotIndexForSpaceEditPicker] = useState<number | null>(null);
  const [spaceEditSaving, setSpaceEditSaving]                 = useState<boolean>(false);
  const [spaceEditPickerSearch, setSpaceEditPickerSearch]     = useState('');
  const [isSpaceEditPickerScannerOpen, setIsSpaceEditPickerScannerOpen] = useState(false);
  const [spaceEditTotalOriginal, setSpaceEditTotalOriginal]   = useState<number>(0);
  const [spaceEditError, setSpaceEditError]                   = useState<string | null>(null);
  const [spaceEditMinStockDispatch, setSpaceEditMinStockDispatch] = useState<string>('0');

  // ── EDICIÓN MÚLTIPLE de stock por lote ──────────────────────────────
  const [isBulkEditMode, setIsBulkEditMode]                   = useState(false);
  // key del row: `${productId}::${warehouseId}`
  const [bulkSelectedRows, setBulkSelectedRows]               = useState<Set<string>>(new Set());
  const [bulkEditModalOpen, setBulkEditModalOpen]             = useState(false);
  const [bulkEditWarehouseId, setBulkEditWarehouseId]         = useState('');
  const [bulkEditSpaceId, setBulkEditSpaceId]                 = useState<string | null>(null);
  const [bulkEditSpaceSearch, setBulkEditSpaceSearch]         = useState('');
  // map productId → nueva cantidad como string
  const [bulkEditQtyMap, setBulkEditQtyMap]                   = useState<Record<string, string>>({});
  const [bulkEditSaving, setBulkEditSaving]                   = useState(false);
  const [bulkEditError, setBulkEditError]                     = useState<string | null>(null);
  const [isBulkEditSpaceScannerOpen, setIsBulkEditSpaceScannerOpen] = useState(false);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const [isPdfModalOpen, setIsPdfModalOpen]     = useState(false);
  const [pdfWarehouseFilter, setPdfWarehouseFilter] = useState('');
  const [pdfGroupFilter, setPdfGroupFilter]     = useState('');
  const [pdfSpaceFilter, setPdfSpaceFilter]     = useState('');
  const [pdfColumns, setPdfColumns] = useState({
    name: true,
    category: true,
    subcategory: true,
    code: true,
    totalQty: true,
    pendingQty: true,
    warehouse: true,
    spaces: true,
  });

  const handleGeneratePDF = () => {
    const doc  = new jsPDF('landscape');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Paleta de colores
    const C_NAVY   : [number,number,number] = [15,  23,  42];
    const C_BLUE   : [number,number,number] = [37,  99, 235];
    const C_ACCENT : [number,number,number] = [99, 102, 241];
    const C_WHITE  : [number,number,number] = [255, 255, 255];
    const C_SLATE5 : [number,number,number] = [100, 116, 139];
    const C_SLATE2 : [number,number,number] = [226, 232, 240];
    const C_SLATE0 : [number,number,number] = [248, 250, 252];

    // ─ HEADER BAND ─────────────────────────────────────────────────
    doc.setFillColor(...C_BLUE);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setFillColor(...C_ACCENT);
    doc.triangle(pageW - 40, 0, pageW, 0, pageW, 40, 'F');
    doc.setFillColor(219, 234, 254);
    doc.rect(0, 24, pageW, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C_WHITE);
    doc.text('REPORTE DE INVENTARIO', 14, 15.5);

    // ─ FILTRAR FILAS PARA PDF ───────────────────────────────────────────
    // Filtrar el inventario completo por los filtros propios del PDF (almacén, grupo, espacio)
    const pdfTargetGroup = pdfGroupFilter ? spaceGroups.find(g => String(g.id) === pdfGroupFilter) : null;

    const filteredRowsForPDF = inventoryRows
      // 1) filtrar por almacén del PDF (independiente del filtro de la tabla)
      .filter(row => !pdfWarehouseFilter || String(row.warehouseId) === String(pdfWarehouseFilter))
      // 2) filtrar items por espacio o grupo
      .map(row => {
        let items = row.items;
        if (pdfSpaceFilter) {
          items = items.filter(i => String(i.warehouseSpaceId) === String(pdfSpaceFilter));
        } else if (pdfTargetGroup) {
          items = items.filter(i => i.warehouseSpaceId && pdfTargetGroup.spaceIds.includes(Number(i.warehouseSpaceId)));
        }
        return { ...row, items };
      })
      .filter(row => row.items.length > 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(196, 218, 255);
    doc.text('Sistema de Gestión de Almacenes · WMS', pageW - 14, 10, { align: 'right' });
    doc.text(format(new Date(), "dd/MM/yyyy, HH:mm"), pageW - 14, 17, { align: 'right' });

    // ─ TARJETAS DE ESTADÍSTICAS ─────────────────────────────────────
    const statsY      = 32;
    const totalProds  = new Set(filteredRowsForPDF.map(r => r.productId)).size;
    const totalUnits  = filteredRowsForPDF.reduce((a, r) => a + r.items.reduce((s, i) => s + Number(i.quantity), 0), 0);
    const totalPend   = filteredRowsForPDF.reduce((a, r) => a + r.items.filter(i => !i.warehouseSpaceId).reduce((s, i) => s + Number(i.quantity), 0), 0);
    const spaceName = pdfSpaceFilter
      ? (warehouseSpaces.find(s => String(s.id) === String(pdfSpaceFilter))?.name ?? 'Espacio')
      : pdfGroupFilter
        ? (spaceGroups.find(g => String(g.id) === String(pdfGroupFilter))?.name ?? 'Grupo')
        : 'Todos';
    const whName = pdfWarehouseFilter ? (getStore(pdfWarehouseFilter)?.name ?? 'Almacén') : 'Todos';

    const stats = [
      { label: 'PRODUCTOS',        value: totalProds.toString() },
      { label: 'UNIDADES TOTALES', value: totalUnits.toString() },
      { label: 'SIN UBICACIÓN',    value: totalPend.toString()  },
      { label: 'ESPACIO',          value: spaceName             },
      { label: 'ALMACÉN',          value: whName                },
    ];
    const cardW = (pageW - 28) / stats.length;
    const cardH = 16;
    stats.forEach((s, i) => {
      const x = 14 + i * cardW;
      doc.setFillColor(...C_SLATE0);
      doc.roundedRect(x, statsY, cardW - 3, cardH, 2, 2, 'F');
      doc.setFillColor(...C_BLUE);
      doc.rect(x, statsY, 2, cardH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C_SLATE5);
      doc.text(s.label, x + 5, statsY + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C_NAVY);
      const val = s.value.length > 18 ? s.value.substring(0, 16) + '…' : s.value;
      doc.text(val, x + 5, statsY + 13);
    });
    doc.setDrawColor(...C_SLATE2);
    doc.setLineWidth(0.3);
    doc.line(14, statsY + cardH + 4, pageW - 14, statsY + cardH + 4);

    // ─ CABECERA Y CUERPO DE TABLA ───────────────────────────────────
    const tableStartY = statsY + cardH + 8;

    const colBase: Record<string, number> = {
      name: 60, category: 32, subcategory: 32, code: 28,
      totalQty: 20, pendingQty: 20, warehouse: 35, spaces: 55,
    };
    const head: string[] = [];
    const rawWidths: number[] = [];
    if (pdfColumns.name)        { head.push('Producto');      rawWidths.push(colBase.name); }
    if (pdfColumns.category)    { head.push('Categoría');     rawWidths.push(colBase.category); }
    if (pdfColumns.subcategory) { head.push('Sub-Categoría'); rawWidths.push(colBase.subcategory); }
    if (pdfColumns.code)        { head.push('Código');        rawWidths.push(colBase.code); }
    if (pdfColumns.totalQty)    { head.push('Stock');         rawWidths.push(colBase.totalQty); }
    if (pdfColumns.pendingQty)  { head.push('Sin Ubic.');     rawWidths.push(colBase.pendingQty); }
    if (pdfColumns.warehouse)   { head.push('Almacén');       rawWidths.push(colBase.warehouse); }
    if (pdfColumns.spaces)      { head.push('Espacios');      rawWidths.push(colBase.spaces); }

    const totalRaw  = rawWidths.reduce((a, v) => a + v, 0);
    const availW    = pageW - 28;
    const normW     = rawWidths.map(w => (w / totalRaw) * availW);

    const body = filteredRowsForPDF.map(row => {
      const p       = getProduct(row.productId);
      const cat     = getCategory(p?.categoryId || '');
      const sub     = cat?.subcategories?.find((s: any) => String(s.id) === String(p?.subcategoryId))?.name || '—';
      const wh      = row.warehouseId ? getStore(row.warehouseId)?.name : '—';
      const assigned   = row.items.filter(i => i.warehouseSpaceId && Number(i.quantity) > 0);
      const pendingQty = row.items.filter(i => !i.warehouseSpaceId).reduce((a, c) => a + Number(c.quantity), 0);
      const totalQty   = row.items.reduce((a, c) => a + Number(c.quantity), 0);
      const spacesText = assigned.map(i => {
        const sp = getLocation(i.warehouseSpaceId!);
        return `${sp?.name || '?'}: ${Number(i.quantity)}`;
      }).join(' | ') || '—';

      const rd: string[] = [];
      if (pdfColumns.name)        rd.push(p?.name || '—');
      if (pdfColumns.category)    rd.push(cat?.name || '—');
      if (pdfColumns.subcategory) rd.push(sub);
      if (pdfColumns.code)        rd.push(p?.code || '—');
      if (pdfColumns.totalQty)    rd.push(totalQty.toString());
      if (pdfColumns.pendingQty)  rd.push(pendingQty > 0 ? pendingQty.toString() : '—');
      if (pdfColumns.warehouse)   rd.push(wh || '—');
      if (pdfColumns.spaces)      rd.push(spacesText);
      return rd;
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [head],
      body: body,
      theme: 'plain',
      columnStyles: Object.fromEntries(
        normW.map((w, i) => {
          const isNum = (pdfColumns.totalQty && head[i] === 'Stock') || (pdfColumns.pendingQty && head[i] === 'Sin Ubic.');
          return [i, { cellWidth: w, halign: isNum ? 'center' : 'left' }];
        })
      ),
      headStyles: {
        fillColor: C_NAVY,
        textColor: C_WHITE,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
        lineWidth: 0,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        textColor: C_NAVY,
        lineColor: C_SLATE2,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: C_SLATE0 },
      didDrawPage: (data: any) => {
        const pages = (doc.internal as any).getNumberOfPages();
        doc.setFillColor(...C_NAVY);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C_SLATE2);
        doc.text(`WMS · Reporte de Inventario · ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, pageH - 3.5);
        doc.text(`Página ${data.pageNumber} de ${pages}`, pageW - 14, pageH - 3.5, { align: 'right' });
      },
    });

    const fileSpaceName = pdfSpaceFilter
      ? (warehouseSpaces.find(s => String(s.id) === String(pdfSpaceFilter))?.name?.replace(/\s+/g, '_') ?? 'espacio')
      : pdfGroupFilter
        ? (spaceGroups.find(g => String(g.id) === String(pdfGroupFilter))?.name?.replace(/\s+/g, '_') ?? 'grupo')
        : 'general';
    doc.save(`Inventario_${fileSpaceName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    setIsPdfModalOpen(false);
  };

  const toggleBulkRow = (key: string) => {
    setBulkSelectedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleBulkAll = () => {
    if (bulkSelectedRows.size === inventoryRows.length && inventoryRows.length > 0) {
      setBulkSelectedRows(new Set());
    } else {
      setBulkSelectedRows(new Set(inventoryRows.map(r => `${r.productId}::${r.warehouseId}`)));
    }
  };

  const openBulkEditModal = () => {
    if (bulkSelectedRows.size === 0) return;
    // Inicializar el mapa de cantidades en '' para cada producto seleccionado
    const qtyMap: Record<string, string> = {};
    [...bulkSelectedRows].forEach(key => {
      const [productId] = key.split('::');
      qtyMap[productId] = '';
    });
    setBulkEditQtyMap(qtyMap);
    setBulkEditWarehouseId(inventoryStoreFilter || warehouses[0]?.id || '');
    setBulkEditSpaceId(null);
    setBulkEditSpaceSearch('');
    setBulkEditError(null);
    setBulkEditModalOpen(true);
  };

  const handleBulkEditSave = async () => {
    if (!bulkEditSpaceId || !bulkEditWarehouseId) {
      setBulkEditError('Debes seleccionar un almacén y una ubicación.');
      return;
    }
    setBulkEditSaving(true);
    setBulkEditError(null);
    try {
      await Promise.all(
        [...bulkSelectedRows].map(rowKey => {
          const [productId] = rowKey.split('::');
          const qty = Number(bulkEditQtyMap[productId] ?? 0);
          // Preservar el minStock actual del producto si ya tiene stock registrado
          const existingStockItem = stock.find(
            s => String(s.productId) === productId && String(s.warehouseId) === String(bulkEditWarehouseId)
          );
          return upsertStock({
            productId,
            warehouseId: bulkEditWarehouseId,
            warehouseSpaceId: bulkEditSpaceId,
            quantity: qty,
            minStock: existingStockItem?.minStock ?? 0,
            deductFromUnassigned: true,
          });
        })
      );

      // Sincronizar enabledWarehouses en cada producto afectado
      await Promise.all(
        [...bulkSelectedRows].map(rowKey => {
          const [productId] = rowKey.split('::');
          const p = getProduct(productId);
          if (!p) return Promise.resolve();
          const currentEnabled = (p.enabledWarehouses ?? []).map(String);
          if (!currentEnabled.includes(String(bulkEditWarehouseId))) {
            return updateProduct(productId, {
              ...p,
              enabledWarehouses: [...currentEnabled, String(bulkEditWarehouseId)],
            });
          }
          return Promise.resolve();
        })
      );

      setBulkEditModalOpen(false);
      setBulkSelectedRows(new Set());
      setIsBulkEditMode(false);
    } catch (err: any) {
      setBulkEditError(err?.message ?? 'Error al guardar');
    } finally {
      setBulkEditSaving(false);
    }
  };

  // Espacios del almacén seleccionado en el modal bulk (filtrados por búsqueda)
  const bulkEditAvailableSpaces = warehouseSpaces.filter(sp => {
    const matchesWh = String(sp.warehouseId) === String(bulkEditWarehouseId);
    const matchesSrch = sp.name.toLowerCase().includes(bulkEditSpaceSearch.toLowerCase()) ||
                        sp.qrCode.toLowerCase().includes(bulkEditSpaceSearch.toLowerCase()) ||
                        (sp.spaceTypeName || '').toLowerCase().includes(bulkEditSpaceSearch.toLowerCase());
    return matchesWh && matchesSrch;
  });

  const canEditMinStock = user?.role === 'ADMIN' || user?.permissions?.includes('EDIT_MIN_STOCK');

  const toggleStockExpand = (productId: string) => {
    setExpandedStock(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  // Agrupar stock existente
  const stockGrouped = stock.reduce((acc, item) => {
    const key = String(item.productId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Stock[]>);

  // Filtrado sobre todos los productos
  const filteredInventory = products.filter(p => {
    const productId = String(p.id);
    const matchesSearch   = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || p.code.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === '' || String(p.categoryId) === String(inventoryCategoryFilter);
    const matchesStore    = inventoryStoreFilter === '' || (stockGrouped[productId]?.some(s => String(s.warehouseId) === String(inventoryStoreFilter)) ?? false);
    // Si hay filtro por espacio, solo incluir productos que tienen stock en ese espacio
    const matchesSpace    = inventorySpaceFilter === '' || (stockGrouped[productId]?.some(s => String(s.warehouseSpaceId) === String(inventorySpaceFilter)) ?? false);
    // Si hay filtro por grupo, solo incluir productos con stock en espacios pertenecientes al grupo
    const matchesGroup = inventoryGroupFilter === '' || (() => {
      const targetGroup = spaceGroups.find(g => String(g.id) === inventoryGroupFilter);
      if (!targetGroup) return false;
      return stockGrouped[productId]?.some(s => s.warehouseSpaceId && targetGroup.spaceIds.includes(Number(s.warehouseSpaceId))) ?? false;
    })();

    return matchesSearch && matchesCategory && matchesStore && matchesSpace && matchesGroup;
  });

  const uniqueCategories = Array.from(
    new Set(products.map(p => p.categoryId).filter(Boolean))
  ).map(catId => getCategory(catId)).filter(Boolean);

  // Ordenar la lista filtrada antes de agrupar
  const sortedInventory = sortKey
    ? [...filteredInventory].sort((a, b) => {
        let valA: any, valB: any;
        const aItems = stockGrouped[String(a.id)] ?? [];
        const bItems = stockGrouped[String(b.id)] ?? [];
        switch (sortKey) {
          case 'name':
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
            break;
          case 'code':
            valA = (a.code || '').toLowerCase();
            valB = (b.code || '').toLowerCase();
            break;
          case 'category': {
            const catA = getCategory(a.categoryId);
            const catB = getCategory(b.categoryId);
            valA = (catA?.name || '').toLowerCase();
            valB = (catB?.name || '').toLowerCase();
            break;
          }
          case 'subcategory': {
            const catA = getCategory(a.categoryId);
            const catB = getCategory(b.categoryId);
            valA = (catA?.subcategories?.find((s: any) => String(s.id) === String(a.subcategoryId))?.name || '').toLowerCase();
            valB = (catB?.subcategories?.find((s: any) => String(s.id) === String(b.subcategoryId))?.name || '').toLowerCase();
            break;
          }
          case 'totalQty':
            valA = aItems.reduce((s, i) => s + Number(i.quantity), 0);
            valB = bItems.reduce((s, i) => s + Number(i.quantity), 0);
            break;
          case 'pendingQty':
            valA = aItems.filter(i => !i.warehouseSpaceId).reduce((s, i) => s + Number(i.quantity), 0);
            valB = bItems.filter(i => !i.warehouseSpaceId).reduce((s, i) => s + Number(i.quantity), 0);
            break;
          default: return 0;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredInventory;

  // groupedInventory: mapa productId → Stock[] (se mantiene para compatibilidad con modales/detalles)
  const groupedInventory = sortedInventory.reduce((acc, p) => {
    const key = String(p.id);
    acc[key] = stockGrouped[key] ?? [];
    return acc;
  }, {} as Record<string, Stock[]>);

  // ── Filas de la tabla: 1 fila por (productId × warehouseId) ─────────────────
  // Si un producto no tiene stock, aparece 1 fila con warehouseId vacío.
  // Si tiene stock en N almacenes, aparece N filas, una por almacén.
  // Si hay filtro de almacén activo, solo se genera la fila del almacén seleccionado.
  type InventoryRow = { productId: string; warehouseId: string; items: Stock[] };
  const inventoryRows: InventoryRow[] = sortedInventory.flatMap(p => {
    const pid = String(p.id);
    const allItems = stockGrouped[pid] ?? [];
    let warehouseIds = [...new Set(allItems.map(s => String(s.warehouseId)).filter(Boolean))];
    // Respetar el filtro de almacén: solo mostrar la fila del almacén seleccionado
    if (inventoryStoreFilter) {
      warehouseIds = warehouseIds.filter(wid => wid === String(inventoryStoreFilter));
    }
    if (warehouseIds.length === 0) {
      return [{ productId: pid, warehouseId: '', items: [] }];
    }
    return warehouseIds.map(wid => ({
      productId: pid,
      warehouseId: wid,
      items: allItems.filter(s => String(s.warehouseId) === wid),
    }));
  });

  if (sortKey === 'warehouse') {
    inventoryRows.sort((a, b) => {
      const nameA = (a.warehouseId ? getStore(a.warehouseId)?.name : '') || '';
      const nameB = (b.warehouseId ? getStore(b.warehouseId)?.name : '') || '';
      if (nameA < nameB) return sortDir === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Cantidad de productos únicos (para el header)
  const uniqueProductCount = new Set(inventoryRows.map(r => r.productId)).size;

  const activeFiltersCount = [inventoryCategoryFilter, inventoryStoreFilter, inventoryGroupFilter, inventorySpaceFilter].filter(Boolean).length;

  const selectedAdminSpaceIds = new Set(adminSlots.map(s => s.spaceId).filter(Boolean));
  const pickerFilteredSpaces = warehouseSpaces.filter(space => {
    if (selectedAdminSpaceIds.has(space.id)) return false;
    const matchesWarehouse = String(space.warehouseId) === String(adminSelectedWarehouseId);
    const matchesSearch = space.name.toLowerCase().includes(spacePickerSearch.toLowerCase()) ||
                          space.qrCode.toLowerCase().includes(spacePickerSearch.toLowerCase()) ||
                          (space.spaceTypeName || '').toLowerCase().includes(spacePickerSearch.toLowerCase());
    return matchesWarehouse && matchesSearch;
  });

  const selectedSpaceEditSpaceIds = new Set(spaceEditSlots.map(s => s.spaceId).filter(Boolean));
  const spaceEditPickerFilteredSpaces = warehouseSpaces.filter(space => {
    if (selectedSpaceEditSpaceIds.has(space.id)) return false;
    const matchesWarehouse = String(space.warehouseId) === String(spaceEditWarehouseId);
    const matchesSearch = space.name.toLowerCase().includes(spaceEditPickerSearch.toLowerCase()) ||
                          space.qrCode.toLowerCase().includes(spaceEditPickerSearch.toLowerCase()) ||
                          (space.spaceTypeName || '').toLowerCase().includes(spaceEditPickerSearch.toLowerCase());
    return matchesWarehouse && matchesSearch;
  });

  // ── Min-stock y Stock Físico ──────────────────────────────────────────────────
  const handleSaveMinStock = (productId: string, warehouseId: string) => {
    const value = parseFloat(minStockValue);
    if (!isNaN(value) && value >= 0) updateMinStock(productId, warehouseId, value);
    setEditingMinStock(null);
  };

  const handleSaveStockQty = (stockId: string, valueStr: string) => {
    const value = parseFloat(valueStr);
    if (!isNaN(value) && value >= 0) updateStockQuantity(stockId, value);
    setEditingStockQty(null);
  };

  // ── Handlers modal Editar Admin ───────────────────────────────────────────────
  const openAdminEdit = (productId: string) => {
    const p = getProduct(productId);
    if (!p) return;

    // Load initial warehouse
    const initialWarehouseId = inventoryStoreFilter || stock.find(s => String(s.productId) === String(productId))?.warehouseId || warehouses[0]?.id || '';

    // Load stock items for this product and selected warehouse
    const whStock = stock.filter(s => String(s.productId) === String(productId) && String(s.warehouseId) === String(initialWarehouseId));

    // Pending stock (sin ubicación asignada)
    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pendingQty = pendingItem ? Number(pendingItem.quantity) : 0;

    // Min stock
    const minSt = whStock.reduce((a, c) => Math.max(a, c.minStock), 0);
    const minStDispatch = whStock.reduce((a, c) => Math.max(a, Number(c.minStockDispatch ?? 0)), 0);

    // 1. Espacio de Despachos fijo (incluso con quantity = 0)
    const dispatchStock = whStock.find(s => {
      if (!s.warehouseSpaceId) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType === 'Despachos';
    });

    // 2. Espacios de Almacenamiento con quantity > 0
    const storageStocks = whStock.filter(s => {
      if (!s.warehouseSpaceId || Number(s.quantity) <= 0) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType !== 'Despachos';
    });

    // Combinar: Despachos primero (máx 1), luego Almacenamiento
    const spaceItems = dispatchStock
      ? [dispatchStock, ...storageStocks]
      : storageStocks;

    const slots = [0, 1, 2, 3].map(i => {
      const item = spaceItems[i];
      return {
        spaceId: item?.warehouseSpaceId || null,
        qty: item ? (Number(item.quantity) === 0 ? 0 : Number(item.quantity)) : '',
      };
    });

    // Stock total = pendiente + suma de todos los slots asignados
    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const totalQty = pendingQty + assignedQty;

    setAdminSelectedWarehouseId(initialWarehouseId);
    setAdminPendingQty(pendingQty);
    setAdminTotalInput(totalQty);
    setAdminMinStockVal(String(minSt));
    setAdminMinStockDispatch(String(minStDispatch));
    setAdminSlots(slots);
    setAdminOriginalStock(whStock);
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');

    setAdminEditForm({
      name: p.name ?? '',
      code: p.code ?? '',
      categoryId: p.categoryId ?? '',
      subcategoryId: p.subcategoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      height: p.dimensions?.height ?? 0,
      width:  p.dimensions?.width  ?? 0,
      depth:  p.dimensions?.depth  ?? 0,
      cost0: p.costs?.[0] ?? '',
      cost1: p.costs?.[1] ?? '',
      price0: p.prices?.[0] ?? '',
      price1: p.prices?.[1] ?? '',
      price2: p.prices?.[2] ?? '',
      price3: p.prices?.[3] ?? '',
      price4: p.prices?.[4] ?? '',
      providerId: p.providers?.[0] ?? '',
    });
    setAdminEditError(null);
    setAdminEditProduct(productId);
  };

  const handleAdminWarehouseChange = (newWarehouseId: string) => {
    if (!adminEditProduct) return;
    setAdminSelectedWarehouseId(newWarehouseId);

    // Load stock for this warehouse
    const whStock = stock.filter(s => String(s.productId) === String(adminEditProduct) && String(s.warehouseId) === String(newWarehouseId));

    // Pending stock (sin ubicación asignada)
    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pendingQty = pendingItem ? Number(pendingItem.quantity) : 0;

    // Min stock
    const minSt = whStock.reduce((a, c) => Math.max(a, c.minStock), 0);
    const minStDispatch = whStock.reduce((a, c) => Math.max(a, Number(c.minStockDispatch ?? 0)), 0);

    // 1. Espacio de Despachos fijo (incluso con quantity = 0)
    const dispatchStock = whStock.find(s => {
      if (!s.warehouseSpaceId) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType === 'Despachos';
    });

    // 2. Espacios de Almacenamiento con quantity > 0
    const storageStocks = whStock.filter(s => {
      if (!s.warehouseSpaceId || Number(s.quantity) <= 0) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType !== 'Despachos';
    });

    // Combinar: Despachos primero (máx 1), luego Almacenamiento
    const spaceItems = dispatchStock
      ? [dispatchStock, ...storageStocks]
      : storageStocks;

    const slots = [0, 1, 2, 3].map(i => {
      const item = spaceItems[i];
      return {
        spaceId: item?.warehouseSpaceId || null,
        qty: item ? (Number(item.quantity) === 0 ? 0 : Number(item.quantity)) : '',
      };
    });

    // Stock total = pendiente + suma de todos los slots asignados
    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const totalQty = pendingQty + assignedQty;

    setAdminPendingQty(pendingQty);
    setAdminTotalInput(totalQty);
    setAdminMinStockVal(String(minSt));
    setAdminMinStockDispatch(String(minStDispatch));
    setAdminSlots(slots);
    setAdminOriginalStock(whStock);
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');
  };

  const handleSaveAdminEdit = async () => {
    if (!adminEditProduct) return;
    setAdminEditSaving(true);
    setAdminEditError(null);
    try {
      const p = getProduct(adminEditProduct);
      const costs  = [adminEditForm.cost0, adminEditForm.cost1].map(Number).filter((v, i) => i === 0 || adminEditForm[`cost${i}`] !== '');
      const prices = [adminEditForm.price0, adminEditForm.price1, adminEditForm.price2, adminEditForm.price3, adminEditForm.price4]
        .map(Number)
        .filter((_, i) => adminEditForm[`price${i}`] !== '');
      
      const providersList = adminEditForm.providerId ? [adminEditForm.providerId] : [];
      const minStock = Number(adminMinStockVal || 0);

      // Save/update stock records for the selected warehouse.
      // El pendiente real = adminTotalInput - suma de todos los slots asignados
      // (no usar adminPendingQty directamente para evitar desincronías)
      const slotsTotal = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
      const realPendingQty = Math.max(0, adminTotalInput - slotsTotal);

      const newStockMap = new Map<string | null, number>();

      // Stock sin ubicación asignada (pendiente real derivado del total)
      newStockMap.set(null, realPendingQty);

      // Slots de espacios — sin acumulación: el último valor por spaceId prevalece
      adminSlots.forEach(slot => {
        const qtyNum = Number(slot.qty) || 0;
        if (slot.spaceId && qtyNum >= 0) {
          // Si el mismo spaceId aparece en dos slots, tomar el mayor (caso de error de usuario)
          const existing = newStockMap.get(slot.spaceId) ?? 0;
          newStockMap.set(slot.spaceId, Math.max(existing, qtyNum));
        }
      });

      // Find original stock records that are no longer present in our map
      // and set their quantity to 0
      const spacesToZero = new Set<string | null>();
      adminOriginalStock.forEach(orig => {
        const spaceKey = orig.warehouseSpaceId || null;
        if (!newStockMap.has(spaceKey)) {
          spacesToZero.add(spaceKey);
        }
      });

      // Execute stock updates
      const updatePromises: Promise<any>[] = [];

      const minStockDispatch = Number(adminMinStockDispatch || 0);

      newStockMap.forEach((qty, spaceId) => {
        updatePromises.push(
          upsertStock({
            productId: adminEditProduct,
            warehouseId: adminSelectedWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: qty,
            minStock: minStock,
            minStockDispatch: minStockDispatch,
          })
        );
      });

      spacesToZero.forEach(spaceId => {
        updatePromises.push(
          upsertStock({
            productId: adminEditProduct,
            warehouseId: adminSelectedWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: 0,
            minStock: minStock,
            minStockDispatch: minStockDispatch,
          })
        );
      });

      // Wait for all upserts to finish
      await Promise.all(updatePromises);

      // Sincronizar enabledWarehouses: asegurarse de que el almacén donde
      // se guardó el stock quede registrado en el producto.
      const currentEnabled = (p?.enabledWarehouses ?? []).map(String);
      const syncedWarehouses = currentEnabled.includes(String(adminSelectedWarehouseId))
        ? currentEnabled
        : [...currentEnabled, String(adminSelectedWarehouseId)];

      // Save product and reload data via hook
      await updateProduct(adminEditProduct, {
        name:       adminEditForm.name,
        code:       adminEditForm.code,
        categoryId: adminEditForm.categoryId,
        subcategoryId: adminEditForm.subcategoryId || null,
        imageUrl:   adminEditForm.imageUrl,
        dimensions: {
          height: Number(adminEditForm.height),
          width:  Number(adminEditForm.width),
          depth:  Number(adminEditForm.depth),
        },
        costs,
        prices,
        providers:        providersList,
        enabledWarehouses: syncedWarehouses,
        footerUrl:        p?.footerUrl ?? '',
      });

      setAdminEditProduct(null);
    } catch (err: any) {
      setAdminEditError(err?.message ?? 'Error al guardar');
    } finally {
      setAdminEditSaving(false);
    }
  };

  // Asignar un espacio a un item de stock desde el picker (Admin Edit)
  const handlePickSpace = (spaceId: string) => {
    if (activeSlotIndexForSpacePicker === null) return;
    setAdminEditError(null);
    const pickedSpace = getLocation(spaceId);
    if (pickedSpace?.spaceUsageType === 'Despachos') {
      const alreadyHasDespachos = adminSlots.some((slot, idx) => {
        if (idx === activeSlotIndexForSpacePicker || !slot.spaceId) return false;
        const s = getLocation(slot.spaceId);
        return s?.spaceUsageType === 'Despachos';
      });
      if (alreadyHasDespachos) {
        setAdminEditError('Un producto solo puede tener asignado como máximo 1 espacio del tipo "Despachos".');
        return;
      }
    }
    setAdminSlots(prev => {
      const next = [...prev];
      next[activeSlotIndexForSpacePicker] = {
        ...next[activeSlotIndexForSpacePicker],
        spaceId: spaceId,
      };
      return next;
    });
    setActiveSlotIndexForSpacePicker(null);
    setSpacePickerSearch('');
  };

  const handleSpaceEditPickSpace = (spaceId: string) => {
    if (activeSlotIndexForSpaceEditPicker === null) return;
    setSpaceEditError(null);
    const pickedSpace = getLocation(spaceId);
    if (pickedSpace?.spaceUsageType === 'Despachos') {
      const alreadyHasDespachos = spaceEditSlots.some((slot, idx) => {
        if (idx === activeSlotIndexForSpaceEditPicker || !slot.spaceId) return false;
        const s = getLocation(slot.spaceId);
        return s?.spaceUsageType === 'Despachos';
      });
      if (alreadyHasDespachos) {
        setSpaceEditError('Un producto solo puede tener asignado como máximo 1 espacio del tipo "Despachos".');
        return;
      }
    }
    setSpaceEditSlots(prev => {
      const next = [...prev];
      next[activeSlotIndexForSpaceEditPicker] = {
        ...next[activeSlotIndexForSpaceEditPicker],
        spaceId: spaceId,
      };
      return next;
    });
    setActiveSlotIndexForSpaceEditPicker(null);
    setSpaceEditPickerSearch('');
  };

  // ── Handlers modal Editar Espacios ────────────────────────────────────────────
  const openSpaceEdit = (productId: string, warehouseId: string) => {
    const whStock = stock.filter(s => String(s.productId) === String(productId) && String(s.warehouseId) === String(warehouseId));
    
    const pendingItem = whStock.find(s => !s.warehouseSpaceId);
    const pendingQty = pendingItem ? Number(pendingItem.quantity) : 0;

    // 1. Espacio de Despachos fijo (incluso con quantity = 0)
    const dispatchStock = whStock.find(s => {
      if (!s.warehouseSpaceId) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType === 'Despachos';
    });

    // 2. Espacios de Almacenamiento con quantity > 0
    const storageStocks = whStock.filter(s => {
      if (!s.warehouseSpaceId || Number(s.quantity) <= 0) return false;
      const sp = getLocation(s.warehouseSpaceId);
      return sp?.spaceUsageType !== 'Despachos';
    });

    // Combinar: Despachos primero (máx 1), luego Almacenamiento
    const spaceItems = dispatchStock
      ? [dispatchStock, ...storageStocks]
      : storageStocks;

    const slots = [0, 1, 2, 3].map(i => {
      const item = spaceItems[i];
      return {
        spaceId: item?.warehouseSpaceId || null,
        qty: item ? (Number(item.quantity) === 0 ? 0 : Number(item.quantity)) : '',
      };
    });

    const assignedQty = spaceItems.reduce((a, c) => a + Number(c.quantity), 0);
    const totalQty = pendingQty + assignedQty;

    // Leer el valor actual de minStockDispatch del stock del almacén
    const currentMinStockDispatch = whStock.reduce((a, c) => Math.max(a, Number(c.minStockDispatch ?? 0)), 0);

    setSpaceEditSlots(slots);
    setSpaceEditPendingQty(pendingQty);
    setSpaceEditWarehouseId(warehouseId);
    setSpaceEditTotalOriginal(totalQty);
    setSpaceEditMinStockDispatch(String(currentMinStockDispatch));
    
    setSpaceEditError(null);
    setSpaceEditProduct(productId);
    setActiveSlotIndexForSpaceEditPicker(null);
    setSpaceEditPickerSearch('');
  };

  const handleSaveSpaceEdits = async () => {
    if (!spaceEditProduct || !spaceEditWarehouseId) return;

    const slotsTotal = spaceEditSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
    const newTotal = spaceEditPendingQty + slotsTotal;

    if (Math.round(newTotal * 10000) !== Math.round(spaceEditTotalOriginal * 10000)) {
      setSpaceEditError(
        `La cantidad total debe ser siempre ${spaceEditTotalOriginal} unidades. ` +
        `Actualmente la suma es ${newTotal}. Ajusta las cantidades para que sumen exactamente ${spaceEditTotalOriginal}.`
      );
      return;
    }

    setSpaceEditError(null);
    setSpaceEditSaving(true);
    
    try {
      const whStock = stock.filter(s => String(s.productId) === String(spaceEditProduct) && String(s.warehouseId) === String(spaceEditWarehouseId));
      const minStock = whStock.reduce((a, c) => Math.max(a, c.minStock), 0);

      const newStockMap = new Map<string | null, number>();
      newStockMap.set(null, spaceEditPendingQty);

      spaceEditSlots.forEach(slot => {
        const qtyNum = Number(slot.qty) || 0;
        if (slot.spaceId && qtyNum >= 0) {
          const existing = newStockMap.get(slot.spaceId) ?? 0;
          newStockMap.set(slot.spaceId, Math.max(existing, qtyNum));
        }
      });

      const spacesToZero = new Set<string | null>();
      whStock.forEach(orig => {
        const spaceKey = orig.warehouseSpaceId || null;
        if (!newStockMap.has(spaceKey)) {
          spacesToZero.add(spaceKey);
        }
      });

      const updatePromises: Promise<any>[] = [];

      newStockMap.forEach((qty, spaceId) => {
        updatePromises.push(
          upsertStock({
            productId: spaceEditProduct,
            warehouseId: spaceEditWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: qty,
            minStock: minStock,
            minStockDispatch: Number(spaceEditMinStockDispatch),
          })
        );
      });

      spacesToZero.forEach(spaceId => {
        updatePromises.push(
          upsertStock({
            productId: spaceEditProduct,
            warehouseId: spaceEditWarehouseId,
            warehouseSpaceId: spaceId,
            quantity: 0,
            minStock: minStock,
            minStockDispatch: Number(spaceEditMinStockDispatch),
          })
        );
      });

      await Promise.all(updatePromises);
      setSpaceEditProduct(null);
    } catch (err: any) {
      setSpaceEditError(err?.message ?? 'Error al guardar');
    } finally {
      setSpaceEditSaving(false);
    }
  };

  const renderMinStockCell = (productId: string, warehouseId: string, minStock: number, isLowStock: boolean) => {
    const isEditing = editingMinStock?.productId === productId && editingMinStock?.warehouseId === warehouseId;
    if (isEditing) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Input type="number" min="0" value={minStockValue} onChange={e => setMinStockValue(e.target.value)}
            className="w-16 h-8 text-center px-1" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') lockEdit.execute(() => handleSaveMinStock(productId, warehouseId)); if (e.key === 'Escape') setEditingMinStock(null); }}
          />
          <button onClick={() => lockEdit.execute(() => handleSaveMinStock(productId, warehouseId))} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditingMinStock(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 group/minstock">
        <span className={`font-mono text-sm ${isLowStock ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{minStock}</span>
        {canEditMinStock && (
          <button onClick={() => { setEditingMinStock({ productId, warehouseId }); setMinStockValue(minStock.toString()); }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/minstock:opacity-100 transition-opacity" title="Editar Stock mínimo general"
          ><Edit2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    );
  };

  // ── Datos del modal de detalles ───────────────────────────────────────────────
  const detailItems       = detailProduct ? groupedInventory[detailProduct] || [] : [];
  const detailProd        = detailProduct ? getProduct(detailProduct) : null;
  const detailCat         = detailProd ? getCategory(detailProd.categoryId) : null;
  const detailMinSt       = detailItems.reduce((a, c) => Math.max(a, c.minStock), 0);
  const detailTotal       = detailItems.reduce((a, c) => a + Number(c.quantity), 0);
  const detailLow         = detailTotal <= detailMinSt && detailMinSt > 0;
  const detailWarehouseId = detailItems[0]?.warehouseId ?? '';
  const detailWarehouse   = detailWarehouseId ? getStore(detailWarehouseId) : null;
  const assignedItems     = detailItems.filter(i => i.warehouseSpaceId && Number(i.quantity) > 0);
  const pendingItems      = detailItems.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);
  const dims              = detailProd?.dimensions ?? { height: 0, width: 0, depth: 0 };
  const cbm               = dims.height && dims.width && dims.depth ? ((dims.height * dims.width * dims.depth) / 1000000).toFixed(4) : '0.0000';
  const subcatName        = detailProd?.subcategoryId && detailCat?.subcategories
    ? detailCat.subcategories.find((s: any) => String(s.id) === String(detailProd.subcategoryId))?.name ?? null
    : null;
  const providerList: string[] = (detailProd?.providers ?? [])
    .filter(Boolean)
    .map((pid: string) => getProvider ? (getProvider(pid)?.name ?? `ID ${pid}`) : `ID ${pid}`);

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Inventario</h1>
          <p className="text-slate-500 mt-2">
            {uniqueProductCount} producto{uniqueProductCount !== 1 ? 's' : ''} en catálogo ·{' '}
            {inventoryRows.reduce((a, r) => a + r.items.reduce((s, c) => s + Number(c.quantity), 0), 0)} unidades en stock.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setPdfWarehouseFilter(inventoryStoreFilter);
              setPdfGroupFilter(inventoryGroupFilter);
              setPdfSpaceFilter(inventorySpaceFilter);
              setIsPdfModalOpen(true);
            }}
            className="gap-2 no-print w-full sm:w-auto"
          >
            <FileText className="w-5 h-5" />
            PDF
          </Button>
          <Button
            variant={isBulkEditMode ? 'primary' : 'secondary'}
            onClick={() => {
              setIsBulkEditMode(v => !v);
              setBulkSelectedRows(new Set());
            }}
            className="gap-2 no-print w-full sm:w-auto"
          >
            <ListChecks className="w-5 h-5" />
            {isBulkEditMode ? 'Cancelar selección' : 'EDICIÓN MÚLTIPLE'}
          </Button>
        </div>
      </header>

      {/* ── Tabla + filtros (mismo patrón que CatalogPage) ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">

        {/* Barra de búsqueda + filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            {/* Buscador texto */}
            <div className="flex-1">
              <Input
                icon={<Search className="w-5 h-5" />}
                placeholder="Buscar por código o nombre..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
              />
            </div>
            {/* Botón QR scanner */}
            <Button
              variant="secondary"
              className="px-3"
              onClick={() => setIsScannerOpen(true)}
              title="Escanear QR"
            >
              <ScanLine className="w-5 h-5" />
            </Button>
          </div>

          {/* Botón Filtros */}
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full sm:w-auto gap-2 ${showFilters ? 'bg-slate-200' : ''}`}
          >
            Filtros
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Panel de filtros (colapsable) */}
        {showFilters && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Filtro Almacén */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Almacén</label>
                <select
                  value={inventoryStoreFilter}
                  onChange={e => {
                    setInventoryStoreFilter(e.target.value);
                    setInventoryGroupFilter(''); // Limpiar el filtro de grupo si cambia el almacén
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Categoría */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                <select
                  value={inventoryCategoryFilter}
                  onChange={e => setInventoryCategoryFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Todas las categorías</option>
                  {uniqueCategories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Grupo de Espacio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Grupo de Espacio</label>
                <select
                  value={inventoryGroupFilter}
                  onChange={e => {
                    setInventoryGroupFilter(e.target.value);
                    setInventorySpaceFilter(''); // Limpiar espacio si se cambia grupo
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={!inventoryStoreFilter}
                  title={!inventoryStoreFilter ? 'Selecciona un almacén primero' : ''}
                >
                  <option value="">Todos los grupos</option>
                  {spaceGroups
                    .filter(g => String(g.warehouseId) === inventoryStoreFilter)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              </div>

              {/* Filtro Espacio Individual */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Espacio</label>
                <select
                  value={inventorySpaceFilter}
                  onChange={e => setInventorySpaceFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={!inventoryStoreFilter}
                  title={!inventoryStoreFilter ? 'Selecciona un almacén primero' : ''}
                >
                  <option value="">Todos los espacios</option>
                  {warehouseSpaces
                    .filter(s => String(s.warehouseId) === inventoryStoreFilter)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => { setInventoryCategoryFilter(''); setInventoryStoreFilter(''); setInventoryGroupFilter(''); setInventorySpaceFilter(''); }}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors underline underline-offset-2"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[800px] px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Columna checkbox (solo en modo edición múltiple) */}
                  {isBulkEditMode && (
                    <TableHead className="w-10 pr-0">
                      <button
                        onClick={toggleBulkAll}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title={bulkSelectedRows.size === inventoryRows.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      >
                        {bulkSelectedRows.size === inventoryRows.length && inventoryRows.length > 0
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </TableHead>
                  )}
                  {([
                    { key: 'name',        label: 'Producto',      align: 'left',   sortable: true  },
                    { key: 'category',    label: 'Categoría',     align: 'left',   sortable: true  },
                    { key: 'subcategory', label: 'Sub-Categoría', align: 'left',   sortable: true  },
                    { key: 'code',        label: 'Código',        align: 'left',   sortable: true  },
                    { key: 'totalQty',    label: 'Stock',         align: 'center', sortable: true  },
                    { key: 'pendingQty',  label: 'Sin Ubicación', align: 'center', sortable: true  },
                    { key: 'warehouse',   label: 'Almacén',       align: 'left',   sortable: true  },
                  ] as { key: InventorySortKey; label: string; align: 'left' | 'center'; sortable: boolean }[]).map(col => {
                    const isActive = sortKey === col.key;
                    const Icon = isActive
                      ? (sortDir === 'asc' ? ChevronUp : ChevronDown)
                      : ChevronsUpDown;
                    return (
                      <TableHead key={col.key} className={col.align === 'center' ? 'text-center' : ''}>
                        <button
                          onClick={() => handleSort(col.key)}
                          className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-blue-600 ${
                            col.align === 'center' ? 'justify-center w-full' : ''
                          } ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                          title={`Ordenar por ${col.label}`}
                        >
                          {col.key === 'warehouse' && <WarehouseIcon className="w-3.5 h-3.5 opacity-60 mr-0.5" />}
                          {col.label}
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'opacity-40'}`} />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryRows.map(({ productId, warehouseId, items }, rowIdx) => {
                  const product  = getProduct(productId);
                  const category = getCategory(product?.categoryId || '');
                  const subcatId   = product?.subcategoryId;
                  const subcatName = subcatId && category?.subcategories
                    ? category.subcategories.find((s: any) => String(s.id) === String(subcatId))?.name
                    : null;
                  const warehouse = warehouseId ? getStore(warehouseId) : null;
                  const assigned  = items.filter(i => i.warehouseSpaceId && (Number(i.quantity) > 0 || getLocation(i.warehouseSpaceId)?.spaceUsageType === 'Despachos'));
                  const pending   = items.filter(i => !i.warehouseSpaceId && Number(i.quantity) > 0);
                  const totalQty  = items.reduce((a, c) => a + Number(c.quantity), 0);
                  const minStock  = items.reduce((a, c) => Math.max(a, c.minStock), 0);
                  const hasStock  = items.length > 0;
                  const isLow     = hasStock && totalQty <= minStock && minStock > 0;
                  const isZero    = totalQty === 0;

                  // ── Alerta Stock mínimo espacio despachos ─────────────────────
                  const dispatchSpaceIds = new Set(
                    warehouseSpaces
                      .filter(s => s.spaceUsageType === 'Despachos' && String(s.warehouseId) === String(warehouseId))
                      .map(s => String(s.id))
                  );
                  const dispatchQty      = items
                    .filter(i => i.warehouseSpaceId && dispatchSpaceIds.has(String(i.warehouseSpaceId)))
                    .reduce((a, c) => a + Number(c.quantity), 0);
                  const minStockDispatch = items.reduce((a, c) => Math.max(a, Number(c.minStockDispatch ?? 0)), 0);
                  const isLowDispatch    = dispatchSpaceIds.size > 0 && minStockDispatch > 0 && dispatchQty <= minStockDispatch;
                  // ───────────────────────────────────────────────────────────────

                  const isExp     = expandedStock.has(`${productId}_${warehouseId}`);
                  // Clave única por producto+almacén para el acordeón
                  const rowKey    = `${productId}_${warehouseId}_${rowIdx}`;

                  return (
                    <TableRow key={rowKey} className={isLow ? 'border-l-4 border-l-red-400' : isLowDispatch ? 'border-l-4 border-l-orange-400' : isZero ? 'border-l-4 border-l-slate-300 opacity-75' : ''}>

                      {/* Checkbox bulk (solo en modo edición múltiple) */}
                      {isBulkEditMode && (
                        <TableCell className="pr-0 w-10">
                          <button
                            onClick={() => toggleBulkRow(`${productId}::${warehouseId}`)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {bulkSelectedRows.has(`${productId}::${warehouseId}`)
                              ? <CheckSquare className="w-4 h-4 text-blue-600" />
                              : <Square className="w-4 h-4" />}
                          </button>
                        </TableCell>
                      )}

                      {/* Producto */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 flex-shrink-0">
                            {product?.imageUrl
                              ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                              : <Package className="w-5 h-5 text-slate-400" />
                            }
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 block truncate">{product?.name ?? '—'}</span>
                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Stock bajo
                              </span>
                            )}
                            {isLowDispatch && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-orange-500 font-medium mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Stock despacho bajo
                              </span>
                            )}
                            {isZero && !isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5">
                                <Package className="w-3 h-3" /> Sin stock
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Categoría */}
                      <TableCell>
                        <Badge variant="default">{category?.name || 'Sin Categoría'}</Badge>
                      </TableCell>

                      {/* Sub-Categoría */}
                      <TableCell>
                        {subcatName
                          ? <Badge variant="default">{subcatName}</Badge>
                          : <span className="text-slate-400 text-sm">—</span>
                        }
                      </TableCell>

                      {/* Código */}
                      <TableCell>
                        <span className="font-mono text-sm text-blue-600 font-medium">{product?.code ?? '—'}</span>
                      </TableCell>

                      {/* ── Stock acordeón ──────────────────────────────────────── */}
                      <TableCell className="text-center">
                        {isZero ? (
                          // Producto sin stock: mostrar badge gris simple sin acordeón
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border bg-slate-100 text-slate-400 border-slate-200">
                            0
                          </span>
                        ) : (
                          <button
                            id={`stock-accordion-${productId}-${warehouseId}`}
                            onClick={() => toggleStockExpand(`${productId}_${warehouseId}`)}
                            className="inline-flex flex-col items-center gap-1 group/acc w-full"
                          >
                            {/* Total + flecha */}
                            <div className="flex items-center gap-2 justify-center">
                              <span className={`inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border ${
                                isLow
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {totalQty}
                              </span>
                              <span className="text-slate-400 group-hover/acc:text-blue-600 transition-colors">
                                {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {assigned.length} espacio{assigned.length !== 1 ? 's' : ''}
                              {pending.length > 0 && ` · +${pending.reduce((a, c) => a + Number(c.quantity), 0)} pend.`}
                            </span>
                          </button>
                        )}

                        {/* Lista expandida */}
                        {isExp && (
                          <div className="mt-2 space-y-1 text-left">
                            {assigned.map((item, idx) => {
                              const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
                              const isEditingQty = editingStockQty?.stockId === item.id;
                              return (
                                <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex-shrink-0">{idx + 1}</span>
                                    <span className="text-slate-700 truncate">{space?.name ?? 'Sin asignar'}</span>
                                  </div>
                                  {isEditingQty ? (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingStockQty.value}
                                        onChange={e => setEditingStockQty({ ...editingStockQty, value: e.target.value })}
                                        className="w-12 h-6 text-center border border-slate-300 rounded px-1"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value));
                                          if (e.key === 'Escape') setEditingStockQty(null);
                                        }}
                                      />
                                      <button onClick={() => lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value))} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingStockQty(null)} className="p-0.5 text-red-600 hover:bg-red-50 rounded">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <span className="font-bold text-slate-800">{Number(item.quantity)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {pending.map(item => {
                              const isEditingQty = editingStockQty?.stockId === item.id;
                              return Number(item.quantity) > 0 && (
                                <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs gap-2">
                                  <span className="text-amber-700 italic flex-1 truncate">Sin asignar</span>
                                  {isEditingQty ? (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingStockQty.value}
                                        onChange={e => setEditingStockQty({ ...editingStockQty, value: e.target.value })}
                                        className="w-12 h-6 text-center border border-amber-300 rounded px-1"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value));
                                          if (e.key === 'Escape') setEditingStockQty(null);
                                        }}
                                      />
                                      <button onClick={() => lockEdit.execute(() => handleSaveStockQty(item.id, editingStockQty.value))} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingStockQty(null)} className="p-0.5 text-red-600 hover:bg-red-50 rounded">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <span className="font-bold text-amber-700">{Number(item.quantity)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>

                      {/* ── Sin Ubicación ─────────────────────────────────── */}
                      <TableCell className="text-center">
                        {(() => {
                          const pendingQty = pending.reduce((a, c) => a + Number(c.quantity), 0);
                          if (pendingQty === 0) {
                            return (
                              <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-full text-sm font-bold border bg-slate-50 text-slate-300 border-slate-200">
                                —
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 justify-center min-w-[2.5rem] h-7 px-2.5 rounded-full text-sm font-bold border bg-amber-50 text-amber-700 border-amber-300">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {pendingQty}
                            </span>
                          );
                        })()}
                      </TableCell>

                      {/* ── Almacén ───────────────────────────────────────── */}
                      <TableCell>
                        {warehouse ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                            <WarehouseIcon className="w-3 h-3 flex-shrink-0" />
                            {warehouse.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver Detalles */}
                          <button
                            id={`inventory-detail-${productId}-${warehouseId}`}
                            onClick={() => lockView.execute(() => setDetailProduct(productId))}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Ver Detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Editar Administrador */}
                          <button
                            id={`inventory-admin-edit-${productId}-${warehouseId}`}
                            onClick={() => lockEdit.execute(() => openAdminEdit(productId))}
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            title="Editar Administrador"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          {/* Editar Espacios */}
                          <button
                            id={`inventory-space-edit-${productId}-${warehouseId}`}
                            onClick={() => lockEdit.execute(() => openSpaceEdit(productId, warehouseId))}
                            className={`p-2 rounded-lg transition-all ${
                              isZero
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isZero ? 'Sin espacios con stock' : 'Editar Stock por Espacios'}
                            disabled={isZero}
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {inventoryRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                      No se encontraron registros en el inventario.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL VER DETALLES
      ════════════════════════════════════════════════════════════════════════ */}
      {detailProduct && detailProd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-xl border border-slate-200 my-8">

            {/* Header del modal */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Ver Detalles</h2>
              <button onClick={() => setDetailProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido: 2 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Columna izquierda: datos */}
              <div className="space-y-2">
                <DetailRow label="Código"        value={detailProd.code}       mono />
                <DetailRow label="Nombre"        value={detailProd.name}       />
                <DetailRow label="Categoría"     value={detailCat?.name}       empty={!detailCat} />
                <DetailRow label="Sub-Categoría" value={subcatName}            empty={!subcatName} />
                <DetailRow label="Almacén"       value={detailWarehouse?.name} empty={!detailWarehouse} />
              </div>

              {/* Columna derecha: imagen + dimensiones */}
              <div className="space-y-3">
                {/* Imagen */}
                <div className="border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden" style={{ minHeight: '130px' }}>
                  {detailProd.imageUrl ? (
                    <img src={detailProd.imageUrl} alt={detailProd.name} className="w-full max-h-36 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300 py-8">
                      <Package className="w-10 h-10" />
                      <span className="text-xs">Sin imagen</span>
                    </div>
                  )}
                </div>

                {/* Dimensiones */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Alto', value: dims.height ? `${dims.height} cm` : null },
                    { label: 'Ancho', value: dims.width ? `${dims.width} cm` : null },
                    { label: 'Profundidad', value: dims.depth ? `${dims.depth} cm` : null },
                    { label: 'CBM (m³)', value: cbm },
                  ].map(d => (
                    <div key={d.label} className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-500 flex items-center min-w-[80px] border-r border-slate-200">
                        {d.label}
                      </div>
                      <div className="flex-1 px-2 py-1.5 text-sm font-mono font-medium text-slate-800">
                        {d.value ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Espacios de almacén (grid de stocks) */}
            {(assignedItems.length > 0 || pendingItems.length > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Espacios de Almacén</h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {assignedItems
                    .filter(item => Number(item.quantity) > 0)
                    .map((item, idx) => {
                      const space = item.warehouseSpaceId ? getLocation(item.warehouseSpaceId) : null;
                      return (
                        <StockBlock
                          key={item.id}
                          index={idx + 1}
                          spaceName={space?.name ?? null}
                          qty={Number(item.quantity)}
                        />
                      );
                    })}
                  {pendingItems.map(item => (
                    <StockBlock
                      key={item.id}
                      index={0}
                      spaceName={null}
                      qty={Number(item.quantity)}
                      pending
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stock Total + Stock Mínimo */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 flex items-center border-r border-slate-200 min-w-[110px]">
                  Stock Total
                </div>
                <div className="flex-1 px-4 py-3 text-2xl font-bold text-blue-600 flex items-center">
                  {detailTotal}
                </div>
              </div>
              <div className={`flex items-stretch border rounded-xl overflow-hidden ${detailLow ? 'border-red-200' : 'border-slate-200'}`}>
                <div className={`px-4 py-3 text-xs font-medium flex items-center gap-1 border-r min-w-[110px] ${detailLow ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {detailLow && <AlertTriangle className="w-3.5 h-3.5" />}
                  Stock mínimo general
                </div>
                <div className="flex-1 px-4 py-3 flex items-center gap-3">
                  <span className={`text-2xl font-bold ${detailLow ? 'text-red-600' : 'text-slate-700'}`}>{detailMinSt}</span>
                  {renderMinStockCell(detailProduct, detailWarehouseId, detailMinSt, detailLow)}
                </div>
              </div>
            </div>

            {/* Proveedores */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Proveedores
              </h3>
              <div className="space-y-2">
                {providerList.length > 0 ? (
                  providerList.map((name, idx) => (
                    <div key={idx} className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] border-r border-slate-200">
                        Proveedor {idx + 1}
                      </div>
                      <div className="flex-1 px-3 py-2 text-sm font-medium text-slate-900">{name}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden opacity-60">
                    <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 flex items-center min-w-[120px] border-r border-slate-200">
                      Proveedor 1
                    </div>
                    <div className="flex-1 px-3 py-2 text-sm text-slate-400 italic">Sin proveedor asignado</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer del modal */}
            <div className="flex justify-end mt-6 pt-6 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setDetailProduct(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner QR */}
      {isScannerOpen && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={code => { setInventorySearch(code); setIsScannerOpen(false); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL EDITAR ADMINISTRADOR
      ════════════════════════════════════════════════════════════════════════ */}
      {adminEditProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-3xl w-full ${activeSlotIndexForSpacePicker !== null ? 'max-w-5xl h-[85vh]' : 'max-w-2xl max-h-[90vh]'} shadow-xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300`}>

            {/* Header principal común */}
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Editar Administrador</h2>
                  <p className="text-xs text-slate-500">Modificar todos los campos del producto</p>
                </div>
              </div>
              <button onClick={() => setAdminEditProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {adminEditError && (
              <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {adminEditError}
              </div>
            )}

            {/* Cuerpo del modal */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Formulario (Principal) */}
                <div className={`${activeSlotIndexForSpacePicker !== null ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5 pr-2`}>
                  {/* Campos Principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna Izquierda */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Código</label>
                        <input
                          type="text"
                          value={adminEditForm.code}
                          onChange={e => setAdminEditForm(f => ({ ...f, code: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-blue-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={adminEditForm.name}
                          onChange={e => setAdminEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
                          <select
                            value={adminEditForm.categoryId}
                            onChange={e => setAdminEditForm(f => ({ ...f, categoryId: e.target.value, subcategoryId: '' }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          >
                            <option value="">Sin categoría</option>
                            {uniqueCategories.map((cat: any) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sub Cat.</label>
                          <select
                            value={adminEditForm.subcategoryId ?? ''}
                            onChange={e => setAdminEditForm(f => ({ ...f, subcategoryId: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          >
                            <option value="">Sin sub-cat.</option>
                            {(getCategory(adminEditForm.categoryId)?.subcategories ?? []).map((sc: any) => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Almacén</label>
                        <select
                          value={adminSelectedWarehouseId}
                          onChange={e => handleAdminWarehouseChange(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        >
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Columna Derecha (Imagen y Dimensiones) */}
                    <div className="space-y-4">
                      <div className="border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden h-32 relative">
                        {adminEditForm.imageUrl ? (
                          <img src={adminEditForm.imageUrl} alt="Producto" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-300">
                            <Package className="w-8 h-8" />
                            <span className="text-[10px]">Sin imagen</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">URL de imagen</label>
                        <input
                          type="text"
                          value={adminEditForm.imageUrl}
                          onChange={e => setAdminEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Alto</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.height}
                            onChange={e => setAdminEditForm(f => ({ ...f, height: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Ancho</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.width}
                            onChange={e => setAdminEditForm(f => ({ ...f, width: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Prof</label>
                          <input
                            type="number"
                            min="0"
                            value={adminEditForm.depth}
                            onChange={e => setAdminEditForm(f => ({ ...f, depth: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl px-2 py-1 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">CBM</label>
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1 text-xs text-center font-mono text-slate-600">
                            {(Number(adminEditForm.height || 0) * Number(adminEditForm.width || 0) * Number(adminEditForm.depth || 0) / 1000000).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stock Pendiente, Total y Mínimo */}
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Distribución de Stock</h3>

                    {/* Campo: Cantidad Total a Ingresar */}
                    <div className="flex items-stretch border border-violet-200 rounded-xl overflow-hidden bg-violet-50/30">
                      <div className="bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 flex items-center border-r border-violet-200 flex-1">
                        Cantidad Total a Ingresar
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={adminTotalInput}
                        onChange={e => {
                          const newTotal = Math.max(0, Number(e.target.value));
                          // adminTotalInput es la fuente de verdad: el pendiente = total - suma de slots asignados
                          const assignedQty = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                          const newPending = Math.max(0, newTotal - assignedQty);
                          setAdminTotalInput(newTotal);
                          setAdminPendingQty(newPending);
                        }}
                        className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-violet-700 bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>

                    {/* Advertencia: stock pendiente de asignación */}
                    {adminPendingQty > 0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>{adminPendingQty} unidad{adminPendingQty !== 1 ? 'es' : ''}</strong> quedarán
                          pendientes de asignación de espacio. Asígnalas a un espacio de almacén o ajusta las cantidades.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Stock Pendiente por Asignación — editable directamente */}
                      <div className="flex items-stretch border border-amber-200 rounded-xl overflow-hidden">
                        <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 flex items-center border-r border-amber-200 flex-1">
                          Pend. por Asignar
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={adminPendingQty}
                          onChange={e => {
                            const newPending = Math.max(0, Number(e.target.value));
                            // Al editar pendiente, recalcular el total = pendiente + slots asignados
                            const assignedQty = adminSlots.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                            setAdminPendingQty(newPending);
                            setAdminTotalInput(newPending + assignedQty);
                          }}
                          className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-amber-700 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>

                      {/* Stock Total — solo lectura, siempre = pendiente + asignados */}
                      <div className="flex items-stretch border border-blue-200 rounded-xl overflow-hidden">
                        <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 flex items-center border-r border-blue-200 flex-1">
                          Stock Total
                        </div>
                        <div className="w-20 flex items-center justify-center text-sm font-mono font-bold text-blue-700 bg-blue-50">
                          {adminPendingQty + adminSlots.reduce((a, c) => a + Number(c.qty || 0), 0)}
                        </div>
                      </div>

                      {/* Stock Mínimo General */}
                      <div className="flex items-stretch border border-red-200 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex items-center border-r border-red-200 flex-1">
                          Stock mínimo general
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={adminMinStockVal}
                          onChange={e => setAdminMinStockVal(e.target.value)}
                          className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-red-700 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        />
                      </div>
                    </div>

                    {/* Stock Mínimo Espacio Despachos */}
                    <div className="flex items-stretch border border-orange-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-2 border-r border-orange-200 flex-1">
                        <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-orange-700">Stock mínimo espacio despachos</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={adminMinStockDispatch}
                        onChange={e => setAdminMinStockDispatch(e.target.value)}
                        className="w-20 px-2 py-2 text-center text-sm font-mono font-bold text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      />
                    </div>

                    {/* Indicador visual cuando se están asignando slots */}
                    {adminSlots.some(s => s.spaceId) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
                        Al asignar una ubicación, la cantidad se descuenta automáticamente del pendiente.
                      </div>
                    )}
                  </div>

                  {/* 4 slots de stock de espacios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adminSlots.map((slot, index) => {
                      const assignedSpace = slot.spaceId ? getLocation(slot.spaceId) : null;
                      const isActiveForPick = activeSlotIndexForSpacePicker === index;
                      return (
                        <div key={index} className={`p-3 border rounded-xl flex items-center gap-3 bg-slate-50 transition-all ${isActiveForPick ? 'ring-2 ring-violet-500 border-transparent bg-violet-50/10' : 'border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Espacio {index + 1}</span>
                              {assignedSpace?.spaceUsageType && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  assignedSpace.spaceUsageType === 'Despachos' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {assignedSpace.spaceUsageType}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSlotIndexForSpacePicker(index)}
                              className={`mt-1 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all truncate w-full ${
                                assignedSpace
                                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                  : 'bg-dashed border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400'
                              }`}
                            >
                               <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                               <span className="truncate flex-1 text-left">{assignedSpace?.name ?? 'Seleccionar Espacio'}</span>
                               <span className="text-[10px] text-slate-400 font-normal">▼</span>
                            </button>
                          </div>
                          
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              value={slot.qty}
                              disabled={!slot.spaceId}
                              onChange={e => {
                                const valStr = e.target.value;
                                const newQty = valStr === '' ? '' : Math.max(0, Number(valStr));
                                setAdminSlots(prev => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], qty: newQty };
                                  // Si el campo se borra, quitar también el espacio asignado
                                  if (newQty === '') {
                                    next[index].spaceId = null;
                                  }
                                  // Recalcular pendiente como: total - nueva suma de slots
                                  // Esto garantiza coherencia sin diffs incrementales
                                  const newSlotsTotal = next.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                                  const newPending = Math.max(0, adminTotalInput - newSlotsTotal);
                                  setAdminPendingQty(newPending);
                                  return next;
                                });
                              }}
                              className={`mt-1 w-full border rounded-lg py-1 px-1.5 text-center text-xs font-mono font-bold focus:outline-none ${
                                slot.spaceId
                                  ? 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-violet-500/40'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            />
                          </div>

                          {slot.spaceId && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('¿Está seguro de que desea eliminar este espacio de almacén?')) {
                                  // Al quitar un slot, recalcular el pendiente usando adminTotalInput como fuente de verdad
                                  setAdminSlots(prev => {
                                    const next = [...prev];
                                    next[index] = { spaceId: null, qty: '' };
                                    const newSlotsTotal = next.reduce((a, c) => a + (Number(c.qty) || 0), 0);
                                    const newPending = Math.max(0, adminTotalInput - newSlotsTotal);
                                    setAdminPendingQty(newPending);
                                    return next;
                                  });
                                  // Notificación al usuario
                                  alert('Se ha eliminado un espacio de almacén. El stock del producto quedará en Pend. por Asignar.');
                                }
                              }}
                              className="mt-4 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Quitar espacio"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Proveedor y Costos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Proveedor</label>
                      <select
                        value={adminEditForm.providerId ?? ''}
                        onChange={e => setAdminEditForm(f => ({ ...f, providerId: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        <option value="">Sin proveedor</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Costos (máx 2)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map(i => (
                          <div key={i} className="relative">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-mono">C{i+1}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Costo"
                              value={adminEditForm[`cost${i}`]}
                              onChange={e => setAdminEditForm(f => ({ ...f, [`cost${i}`]: e.target.value }))}
                              className="w-full border border-slate-300 rounded-xl pl-8 pr-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Precios */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">Precios de Venta (máx 5)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="relative">
                          <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-mono">P{i+1}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Precio"
                            value={adminEditForm[`price${i}`]}
                            onChange={e => setAdminEditForm(f => ({ ...f, [`price${i}`]: e.target.value }))}
                            className="w-full border border-slate-300 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel de Selección de Espacio (Lado Derecho) */}
                {activeSlotIndexForSpacePicker !== null && (
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-[400px] lg:h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Selección Espacio de Almacén</h3>
                        <p className="text-[10px] text-slate-500">Asignar a Slot {activeSlotIndexForSpacePicker + 1}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setActiveSlotIndexForSpacePicker(null); setSpacePickerSearch(''); }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Búsqueda */}
                    <div className="flex gap-1.5 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar espacio..."
                          value={spacePickerSearch}
                          onChange={e => setSpacePickerSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSpacePickerScannerOpen(true)}
                        className="px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                        title="Escanear QR"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tabla de Espacios */}
                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="p-2 font-semibold text-slate-600">Nombre</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo Uso</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Cercanía</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Productos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pickerFilteredSpaces.map(space => {
                            const spaceType = space.spaceTypeName || 'Estante';
                            const usageType = space.spaceUsageType || 'Almacenamiento';
                            return (
                              <tr
                                key={space.id}
                                onClick={() => handlePickSpace(space.id)}
                                className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                              >
                                <td className="p-2 font-medium text-slate-800">{space.name}</td>
                                <td className="p-2 text-center text-slate-500">{spaceType}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    usageType === 'Despachos' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {usageType}
                                  </span>
                                </td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.proximity ?? 0))}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.productCount ?? 0))}</td>
                              </tr>
                            );
                          })}
                          {pickerFilteredSpaces.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                No se encontraron espacios
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer principal común */}
            <div className="p-6 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={() => setAdminEditProduct(null)} disabled={adminEditSaving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAdminEdit}
                disabled={adminEditSaving}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white border-0"
              >
                {adminEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {adminEditSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>

          </div>
        </div>
      )}

      {isSpacePickerScannerOpen && (
        <QRScannerModal
          isOpen={isSpacePickerScannerOpen}
          onClose={() => setIsSpacePickerScannerOpen(false)}
          onScan={code => { setSpacePickerSearch(code); setIsSpacePickerScannerOpen(false); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL EDITAR STOCK POR ESPACIOS
      ════════════════════════════════════════════════════════════════════════ */}
      {spaceEditProduct && (() => {
        const spProd    = getProduct(spaceEditProduct);
        const isPickerOpen = activeSlotIndexForSpaceEditPicker !== null;
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className={`bg-white rounded-3xl p-6 w-full ${isPickerOpen ? 'max-w-5xl h-[85vh]' : 'max-w-2xl'} shadow-xl border border-slate-200 my-8 transition-all duration-300 flex flex-col`}>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Panel Izquierdo: Lista de stocks */}
                <div className={`${isPickerOpen ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col min-h-0`}>
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Editar Stock por Espacios</h2>
                        <p className="text-xs text-slate-500 truncate max-w-[220px]">{spProd?.name ?? '—'}</p>
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          Total fijo: <span className="font-mono">{spaceEditTotalOriginal}</span> unidades
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSpaceEditProduct(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {/* Mensaje de error */}
                  {spaceEditError && (
                    <div className="px-4 py-3 mb-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 flex items-start gap-2 flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{spaceEditError}</span>
                    </div>
                  )}

                  <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Distribución de Stock</h3>

                      {/* Stock Pendiente por Asignación */}
                      <div className="flex items-stretch border border-amber-200 rounded-xl overflow-hidden mb-3">
                        <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 flex items-center border-r border-amber-200 flex-1">
                          Pend. por Asignar
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={spaceEditPendingQty}
                          onChange={e => {
                            const newPending = Math.max(0, Number(e.target.value));
                            setSpaceEditPendingQty(newPending);
                          }}
                          className="w-24 px-2 py-2 text-center text-sm font-mono font-bold text-amber-700 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>

                      {/* Stock mínimo espacio despachos — solo si el almacén tiene espacios de tipo Despachos */}
                      {warehouseSpaces.some(s =>
                        String(s.warehouseId) === String(spaceEditWarehouseId) &&
                        s.spaceUsageType === 'Despachos'
                      ) && (
                        <div className="flex items-stretch border border-orange-200 rounded-xl overflow-hidden mb-3">
                          <div className="bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 flex items-center border-r border-orange-200 flex-1">
                            <AlertTriangle className="w-3 h-3 mr-1.5 flex-shrink-0" />
                            Stock mín. despachos
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={spaceEditMinStockDispatch}
                            onChange={e => setSpaceEditMinStockDispatch(e.target.value)}
                            className="w-24 px-2 py-2 text-center text-sm font-mono font-bold text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                            title="Umbral de alerta de stock mínimo para espacios de tipo Despachos"
                          />
                        </div>
                      )}
                      
                      {/* Indicador visual */}
                      {spaceEditSlots.some(s => s.spaceId) && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 mb-3">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                          Modifica las cantidades. Recuerda que la suma total debe ser {spaceEditTotalOriginal}.
                        </div>
                      )}
                    </div>

                    {/* 4 slots de stock de espacios */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {spaceEditSlots.map((slot, index) => {
                        const assignedSpace = slot.spaceId ? getLocation(slot.spaceId) : null;
                        const isActiveForPick = activeSlotIndexForSpaceEditPicker === index;
                        return (
                          <div key={index} className={`p-3 border rounded-xl flex items-center gap-3 bg-slate-50 transition-all ${isActiveForPick ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50/10' : 'border-slate-200'}`}>
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Espacio {index + 1}</span>
                              {assignedSpace?.spaceUsageType && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  assignedSpace.spaceUsageType === 'Despachos' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {assignedSpace.spaceUsageType}
                                </span>
                              )}
                            </div>
                              <button
                                type="button"
                                onClick={() => setActiveSlotIndexForSpaceEditPicker(index)}
                                className={`mt-1 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all truncate w-full ${
                                  assignedSpace
                                    ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                    : 'bg-dashed border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400'
                                }`}
                              >
                                 <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                 <span className="truncate flex-1 text-left">{assignedSpace?.name ?? 'Seleccionar Espacio'}</span>
                                 <span className="text-[10px] text-slate-400 font-normal">▼</span>
                              </button>
                            </div>
                            
                            <div className="w-16">
                              <span className="block text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">Cantidad</span>
                              <input
                                type="number"
                                min="0"
                                value={slot.qty}
                                disabled={!slot.spaceId}
                                onChange={e => {
                                  const valStr = e.target.value;
                                  const newQty = valStr === '' ? '' : Math.max(0, Number(valStr));
                                  setSpaceEditSlots(prev => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], qty: newQty };
                                    if (newQty === '') {
                                      next[index].spaceId = null;
                                    }
                                    return next;
                                  });
                                }}
                                className={`mt-1 w-full border rounded-lg py-1 px-1.5 text-center text-xs font-mono font-bold focus:outline-none ${
                                  slot.spaceId
                                    ? 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500/40'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              />
                            </div>

                            {slot.spaceId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSpaceEditSlots(prev => {
                                    const next = [...prev];
                                    next[index] = { spaceId: null, qty: '' };
                                    return next;
                                  });
                                }}
                                className="mt-4 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Quitar espacio"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 flex-shrink-0 mt-4">
                    <Button variant="secondary" onClick={() => setSpaceEditProduct(null)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveSpaceEdits}
                      disabled={spaceEditSaving}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    >
                      {spaceEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {spaceEditSaving ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </div>
                </div>

                {/* Panel de Selección de Espacio (Lado Derecho) */}
                {isPickerOpen && (
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-[400px] lg:h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Selección Espacio</h3>
                        <p className="text-[10px] text-slate-500">Mover stock a esta ubicación</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setActiveSlotIndexForSpaceEditPicker(null); setSpaceEditPickerSearch(''); }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Búsqueda */}
                    <div className="flex gap-1.5 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar espacio..."
                          value={spaceEditPickerSearch}
                          onChange={e => setSpaceEditPickerSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSpaceEditPickerScannerOpen(true)}
                        className="px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                        title="Escanear QR"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tabla de Espacios */}
                    <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="p-2 font-semibold text-slate-600">Nombre</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Tipo Uso</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Cercanía</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Productos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {spaceEditPickerFilteredSpaces.map(space => {
                            const spaceType = space.spaceTypeName || 'Estante';
                            const usageType = space.spaceUsageType || 'Almacenamiento';
                            return (
                              <tr
                                key={space.id}
                                onClick={() => handleSpaceEditPickSpace(space.id)}
                                className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                              >
                                <td className="p-2 font-medium text-slate-800">{space.name}</td>
                                <td className="p-2 text-center text-slate-500">{spaceType}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    usageType === 'Despachos' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {usageType}
                                  </span>
                                </td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.proximity ?? 0))}</td>
                                <td className="p-2 text-center text-slate-500 font-mono">{Math.round(Number(space.productCount ?? 0))}</td>
                              </tr>
                            );
                          })}
                          {spaceEditPickerFilteredSpaces.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                No se encontraron espacios
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {isSpaceEditPickerScannerOpen && (
        <QRScannerModal
          isOpen={isSpaceEditPickerScannerOpen}
          onClose={() => setIsSpaceEditPickerScannerOpen(false)}
          onScan={code => { setSpaceEditPickerSearch(code); setIsSpaceEditPickerScannerOpen(false); }}
        />
      )}

      {isBulkEditSpaceScannerOpen && (
        <QRScannerModal
          isOpen={isBulkEditSpaceScannerOpen}
          onClose={() => setIsBulkEditSpaceScannerOpen(false)}
          onScan={code => { setBulkEditSpaceSearch(code); setIsBulkEditSpaceScannerOpen(false); }}
        />
      )}

      <LockModal {...lockEdit.lockModalProps} />
      <LockModal {...lockView.lockModalProps} />
      <LockModal {...lockDelete.lockModalProps} />

      {/* ─── Barra de acción flotante (EDICIÓN MÚLTIPLE) ─────────────────────── */}
      {isBulkEditMode && bulkSelectedRows.size > 0 && (
        <div className="sticky bottom-4 mt-4 mx-2 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-3 flex flex-col sm:flex-row items-center gap-3 z-30 animate-in slide-in-from-bottom-4 duration-200 no-print">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 font-bold">{bulkSelectedRows.size}</span>
            <span className="text-slate-300">producto{bulkSelectedRows.size !== 1 ? 's' : ''} seleccionado{bulkSelectedRows.size !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setBulkSelectedRows(new Set())}
              className="ml-2 text-slate-400 hover:text-white transition-colors text-xs underline underline-offset-2"
            >Deseleccionar todo</button>
          </div>
          <div className="sm:ml-auto">
            <button
              onClick={openBulkEditModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-900/30"
            >
              <Layers className="w-4 h-4" />
              Asignar Ubicación y Cantidad en Lote
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal EDICIÓN MÚLTIPLE ──────────────────────────────────────────── */}
      {bulkEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-0 w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header del modal */}
            <div className="flex items-center gap-3 p-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                <ListChecks className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">Edición Múltiple de Stock</h2>
                <p className="text-sm text-slate-500">{bulkSelectedRows.size} producto{bulkSelectedRows.size !== 1 ? 's' : ''} seleccionado{bulkSelectedRows.size !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setBulkEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {/* Paso 1: Almacén */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="inline-flex w-5 h-5 rounded-full bg-blue-600 text-white text-xs items-center justify-center font-bold shrink-0">1</span>
                  Seleccionar Almacén
                </label>
                <select
                  value={bulkEditWarehouseId}
                  onChange={e => { setBulkEditWarehouseId(e.target.value); setBulkEditSpaceId(null); setBulkEditSpaceSearch(''); }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">-- Selecciona un almacén --</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>

              {/* Paso 2: Ubicación */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="inline-flex w-5 h-5 rounded-full bg-blue-600 text-white text-xs items-center justify-center font-bold shrink-0">2</span>
                  Seleccionar Ubicación
                  {bulkEditSpaceId && <span className="ml-2 text-xs text-emerald-600 font-medium">✓ {bulkEditAvailableSpaces.find(s => s.id === bulkEditSpaceId)?.name}</span>}
                </label>
                {!bulkEditWarehouseId ? (
                  <p className="text-sm text-slate-400 italic">Selecciona un almacén primero.</p>
                ) : (
                  <>
                    <div className="flex gap-1.5 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar ubicación por nombre, código QR o tipo..."
                          value={bulkEditSpaceSearch}
                          onChange={e => setBulkEditSpaceSearch(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBulkEditSpaceScannerOpen(true)}
                        className="px-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        title="Escanear código QR de espacio"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-slate-600">Nombre</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 text-center">Tipo</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 text-center">Productos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bulkEditAvailableSpaces.length === 0 ? (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">Sin espacios disponibles</td></tr>
                          ) : bulkEditAvailableSpaces.map(sp => (
                            <tr
                              key={sp.id}
                              onClick={() => setBulkEditSpaceId(sp.id)}
                              className={`cursor-pointer transition-colors ${bulkEditSpaceId === sp.id ? 'bg-blue-50 font-medium' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-3 py-2 text-slate-800 flex items-center gap-1.5">
                                {bulkEditSpaceId === sp.id && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                                {sp.name}
                              </td>
                              <td className="px-3 py-2 text-center text-slate-500">{sp.spaceTypeName || '—'}</td>
                              <td className="px-3 py-2 text-center font-mono text-slate-500">{sp.productCount ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Paso 3: Cantidades por producto */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="inline-flex w-5 h-5 rounded-full bg-blue-600 text-white text-xs items-center justify-center font-bold shrink-0">3</span>
                  Asignar Cantidades por Producto
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Producto</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600 text-center w-32">Stock actual</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600 text-center w-36">Nueva cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...bulkSelectedRows].map(rowKey => {
                        const [productId] = rowKey.split('::');
                        const product = getProduct(productId);
                        const row = inventoryRows.find(r => r.productId === productId);
                        const currentQty = row ? row.items.reduce((a, c) => a + Number(c.quantity), 0) : 0;
                        // Stock sin asignar (pendiente) disponible para este producto
                        const unassignedQty = row
                          ? row.items.filter(i => !i.warehouseSpaceId).reduce((a, c) => a + Number(c.quantity), 0)
                          : 0;
                        const newQtyVal = Number(bulkEditQtyMap[productId] ?? 0);
                        const exceedsUnassigned = newQtyVal > unassignedQty;
                        return (
                          <tr key={rowKey}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                  {product?.imageUrl
                                    ? <img src={product.imageUrl} className="w-full h-full object-cover rounded" alt="" />
                                    : <Package className="w-3.5 h-3.5 text-slate-400" />}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900 text-xs leading-tight">{product?.name || '—'}</p>
                                  <p className="font-mono text-[10px] text-blue-500">{product?.code || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                {currentQty}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={unassignedQty}
                                  value={bulkEditQtyMap[productId] ?? ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? '' : String(Math.min(Number(e.target.value), unassignedQty));
                                    setBulkEditQtyMap(prev => ({ ...prev, [productId]: val }));
                                  }}
                                  placeholder="0"
                                  className={`w-24 border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                                    exceedsUnassigned
                                      ? 'border-amber-400 text-amber-700 bg-amber-50'
                                      : 'border-slate-300 text-slate-900'
                                  }`}
                                />
                                <span className="text-[10px] text-slate-400">
                                  Máx: <span className={`font-semibold ${unassignedQty === 0 ? 'text-red-500' : 'text-amber-600'}`}>{unassignedQty}</span> sin asignar
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  ⚠ Las cantidades se asignan en la ubicación seleccionada. Si ya existe stock en esa ubicación, se sobrescribirá.
                </p>
              </div>

            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              {bulkEditError && <p className="text-sm text-red-600 mb-3">{bulkEditError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setBulkEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkEditSave}
                  disabled={bulkEditSaving || !bulkEditSpaceId || !bulkEditWarehouseId}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {bulkEditSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><Save className="w-4 h-4" /> Guardar {bulkSelectedRows.size} producto{bulkSelectedRows.size !== 1 ? 's' : ''}</>}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL EXPORTAR PDF
      ════════════════════════════════════════════════════════════════════════ */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Exportar PDF</h2>
                  <p className="text-xs text-slate-500">Selecciona los datos a incluir</p>
                </div>
              </div>
              <button onClick={() => setIsPdfModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">

              {/* ─ Filtros de PDF ─────────────────────────────────────────── */}
              <div className="mb-5 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filtros del Reporte</p>

                {/* Almacén */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Almacén</label>
                  <select
                    value={pdfWarehouseFilter}
                    onChange={e => {
                      setPdfWarehouseFilter(e.target.value);
                      setPdfGroupFilter('');
                      setPdfSpaceFilter('');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Todos los almacenes</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Grupo de Espacio */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grupo de Espacio</label>
                  <select
                    value={pdfGroupFilter}
                    onChange={e => {
                      setPdfGroupFilter(e.target.value);
                      setPdfSpaceFilter(''); // limpiar espacio al cambiar grupo
                    }}
                    disabled={!pdfWarehouseFilter}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Todos los grupos</option>
                    {spaceGroups
                      .filter(g => String(g.warehouseId) === String(pdfWarehouseFilter))
                      .map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                  </select>
                  {!pdfWarehouseFilter && (
                    <p className="text-xs text-slate-400 mt-1">Selecciona un almacén primero</p>
                  )}
                </div>

                {/* Espacio Individual */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Espacio Individual
                    {pdfGroupFilter && !pdfSpaceFilter && (
                      <span className="ml-2 text-xs text-blue-500 font-normal">(se usa el grupo seleccionado)</span>
                    )}
                  </label>
                  <select
                    value={pdfSpaceFilter}
                    onChange={e => setPdfSpaceFilter(e.target.value)}
                    disabled={!pdfWarehouseFilter}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Todos los espacios</option>
                    {warehouseSpaces
                      .filter(s => {
                        if (!pdfWarehouseFilter) return false;
                        const matchWh = String(s.warehouseId) === String(pdfWarehouseFilter);
                        if (!pdfGroupFilter) return matchWh;
                        const grp = spaceGroups.find(g => String(g.id) === String(pdfGroupFilter));
                        return matchWh && (grp ? grp.spaceIds.includes(Number(s.id)) : true);
                      })
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                  {!pdfWarehouseFilter && (
                    <p className="text-xs text-slate-400 mt-1">Selecciona un almacén primero</p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 mb-5" />

              {/* ─ Columnas a incluir ─────────────────────────────────────── */}
              <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Columnas a incluir</p>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.name} onChange={e => setPdfColumns(p => ({...p, name: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Nombre del Producto</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.category} onChange={e => setPdfColumns(p => ({...p, category: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Categoría</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.subcategory} onChange={e => setPdfColumns(p => ({...p, subcategory: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Sub-Categoría</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.code} onChange={e => setPdfColumns(p => ({...p, code: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Código</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.totalQty} onChange={e => setPdfColumns(p => ({...p, totalQty: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Stock Total</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.pendingQty} onChange={e => setPdfColumns(p => ({...p, pendingQty: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Stock Sin Ubicación</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.warehouse} onChange={e => setPdfColumns(p => ({...p, warehouse: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Almacén</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={pdfColumns.spaces} onChange={e => setPdfColumns(p => ({...p, spaces: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Espacios Asignados</span>
                </label>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleGeneratePDF}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
