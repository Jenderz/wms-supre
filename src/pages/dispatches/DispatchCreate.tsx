/**
 * DispatchCreate.tsx
 * Sub-módulo: Crear Directo – Orden de Despacho
 * Mismo diseño moderno, tabla reducida a 7 columnas.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertCircle, ArrowLeft, Package, Plus, Save, ScanLine, Search, Trash2, X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input }  from '../../components/ui/Input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/Table';
import { useDispatches } from '../../features/dispatches/hooks/useDispatches';
import { useAuth } from '../../context/AuthContext';
import { DispatchDeliveryType, DispatchOrderItem } from '../../types';

const DELIVERY_TYPES: DispatchDeliveryType[] = [
  'TIENDA SUPREPARTS', 'DELIVERY TIENDA', 'DELIVERY VENDEDOR', 'RETIRO EN TIENDA', 'OTRO',
];

// ─────────────────────────────────────────────────────────────────────────────
const DispatchCreate: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams] = useSearchParams();
  const { user }  = useAuth();
  const {
    dispatches, products, warehouses, isLoading,
    saveDispatch, getProduct, getProductStock,
    getCategoryName, getSubcategoryName,
    getProductsForWarehouse, evaluateSpacePreselection,
  } = useDispatches();

  // ── ¿Edición? ─────────────────────────────────────────────────────────────
  const editParam = searchParams.get('edit');
  const editOrderId: string | undefined = editParam || (location.state as any)?.editOrderId;
  const editOrder   = editOrderId ? dispatches.find(d => String(d.id) === String(editOrderId)) : undefined;

  // ── Campos del formulario ──────────────────────────────────────────────────
  const [fWarehouseId,  setFWarehouseId]  = useState(editOrder?.warehouseId ?? '');
  const [fRequestedBy,  setFRequestedBy]  = useState(editOrder?.requestedBy ?? user?.name ?? '');
  const [fClientName,   setFClientName]   = useState(editOrder?.clientName  ?? '');
  const [fDeliveryType, setFDeliveryType] = useState<DispatchDeliveryType>(editOrder?.deliveryType ?? 'TIENDA SUPREPARTS');
  const [fNotes,        setFNotes]        = useState(editOrder?.notes ?? '');
  const [fItems,        setFItems]        = useState<DispatchOrderItem[]>(
    editOrder?.items.map(i => ({ ...i })) ?? [],
  );

  // ── Buscador ───────────────────────────────────────────────────────────────
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<typeof products>([]);
  const [showDD,  setShowDD]  = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── UX ─────────────────────────────────────────────────────────────────────
  const [formError, setFormError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  // Hidratar formulario de forma reactiva cuando editOrder esté cargado
  useEffect(() => {
    if (editOrder) {
      if (editOrder.status !== 'PENDIENTE') {
        setFormError(`La orden ${editOrder.code} no se puede editar porque está en estado "${editOrder.status}". Solo se pueden editar órdenes en estado PENDIENTE.`);
        return;
      }
      if (editOrder.origin && editOrder.origin !== 'DIRECT') {
        setFormError(`La orden ${editOrder.code} no se puede editar porque fue generada desde otro módulo de entrada de pedidos.`);
        return;
      }
      setFWarehouseId(editOrder.warehouseId || '');
      setFRequestedBy(editOrder.requestedBy || '');
      setFClientName(editOrder.clientName || '');
      setFDeliveryType(editOrder.deliveryType || 'TIENDA SUPREPARTS');
      setFNotes(editOrder.notes || '');
      setFItems(
        editOrder.items.map(i => ({
          ...i,
          id: i.id || uuidv4(),
          productId: String(i.productId),
          quantityRequired: Number(i.requestedQuantity ?? i.quantityRequired ?? 1),
          requestedQuantity: Number(i.requestedQuantity ?? i.quantityRequired ?? 1),
          warehouseSpaceAssignments: i.warehouseSpaceAssignments || [],
        }))
      );
    }
  }, [editOrder]);

  // init primer almacén si es orden nueva
  useEffect(() => {
    if (!editOrderId && !fWarehouseId && warehouses.length > 0) {
      setFWarehouseId(String(warehouses[0].id));
    }
  }, [warehouses, editOrderId, fWarehouseId]);

  // ── Buscador ───────────────────────────────────────────────────────────────
  const handleQuery = useCallback((term: string) => {
    setQuery(term);
    if (term.trim().length < 2) { setResults([]); setShowDD(false); return; }
    const lower = term.toLowerCase();
    const pool  = getProductsForWarehouse(fWarehouseId);
    setResults(
      pool.filter(p =>
        p.name.toLowerCase().includes(lower) || p.code.toLowerCase().includes(lower),
      ).slice(0, 12),
    );
    setShowDD(true);
  }, [fWarehouseId, getProductsForWarehouse]);

  useEffect(() => {
    if (query.trim().length >= 2) handleQuery(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fWarehouseId]);

  const addProductToForm = useCallback((productId: string, name?: string) => {
    if (fItems.some(i => String(i.productId) === String(productId))) {
      setFormError('Este producto ya está en la lista.'); return;
    }
    const isManual = productId.startsWith('manual-');
    if (!isManual) {
      const currentStock = getProductStock(productId, fWarehouseId, editOrder?.id);
      if (currentStock <= 0) {
        const prod = getProduct(productId);
        setFormError(`No se puede agregar "${prod?.name || 'el producto'}": no cuenta con stock disponible en este almacén.`);
        return;
      }
    }
    // Asignación de espacio silenciosa (no se muestra en tabla)
    const spaceEval  = fWarehouseId ? evaluateSpacePreselection(productId, fWarehouseId, 1) : null;
    const despSpaces = spaceEval?.availableSpaces.filter(sp => sp.spaceUsageType === 'Despachos') ?? [];
    const firstDesp  = despSpaces.find(sp => sp.quantity >= 1);
    const initialAssignments =
      spaceEval?.isAutoSelected && spaceEval.autoPreselectedSpaceId
        ? [{ warehouseSpaceId: spaceEval.autoPreselectedSpaceId, quantity: 1 }]
        : firstDesp
        ? [{ warehouseSpaceId: firstDesp.warehouseSpaceId, quantity: 1 }]
        : [];

    setFItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        productId,
        quantityRequired: 1,
        requestedQuantity: 1,
        notes: name,
        warehouseSpaceAssignments: initialAssignments,
      },
    ]);
    setQuery(''); setResults([]); setShowDD(false); setFormError(null);
  }, [fItems, fWarehouseId, editOrder?.id, evaluateSpacePreselection, getProductStock, getProduct]);

  const addManualItem = useCallback(() => {
    const label = query.trim();
    if (!label) return;
    addProductToForm(`manual-${uuidv4().slice(0, 8)}`, label);
  }, [query, addProductToForm]);

  const updateItemQty = (itemId: string, qty: number) => {
    setFItems(prev =>
      prev.map(i => {
        if (i.id !== itemId) return i;
        const isManual = i.productId.startsWith('manual-');
        const maxQty   = isManual ? Infinity : getProductStock(i.productId, fWarehouseId, editOrder?.id);
        const nextQty  = Math.min(Math.max(1, qty), maxQty > 0 ? maxQty : Infinity);
        return { 
          ...i, 
          quantityRequired: nextQty,
          requestedQuantity: nextQty,
        };
      }),
    );
  };

  const removeItem = (id: string) => setFItems(prev => prev.filter(i => i.id !== id));

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (editOrder && editOrder.status !== 'PENDIENTE') {
      setFormError('Solo se pueden editar órdenes en estado PENDIENTE.');
      return;
    }
    if (editOrder && editOrder.origin && editOrder.origin !== 'DIRECT') {
      setFormError('No se permite editar órdenes originadas fuera del módulo de creación directa.');
      return;
    }
    if (!fWarehouseId)        { setFormError('Selecciona un almacén.');       return; }
    if (!fRequestedBy.trim()) { setFormError('Indica quién solicita.');        return; }
    if (!fClientName.trim())  { setFormError('Indica el nombre del cliente.'); return; }
    if (fItems.length === 0)  { setFormError('Agrega al menos un producto.');  return; }

    // Validar stock antes de generar o actualizar la orden
    const stockErrors: string[] = [];
    for (const item of fItems) {
      const isManual = item.productId.startsWith('manual-');
      if (!isManual) {
        const prod = getProduct(item.productId);
        const prodName = prod?.name ?? item.notes ?? item.productId;
        const availableStock = getProductStock(item.productId, fWarehouseId, editOrder?.id);
        const qtyReq = Number(item.quantityRequired ?? item.requestedQuantity ?? 1);

        if (availableStock <= 0) {
          stockErrors.push(`"${prodName}" no tiene stock disponible (Stock: 0).`);
        } else if (qtyReq > availableStock) {
          stockErrors.push(`"${prodName}" supera el stock disponible (Disponible: ${availableStock}, Requerido: ${qtyReq}).`);
        }
      }
    }

    if (stockErrors.length > 0) {
      setFormError(
        `No se puede guardar la orden porque hay productos sin stock suficiente:\n• ${stockErrors.join('\n• ')}`
      );
      return;
    }

    setSaving(true); setFormError(null);
    try {
      await saveDispatch({
        ...(editOrder || {}),
        id:           editOrder?.id,
        origin:       editOrder?.origin || 'DIRECT',
        warehouseId:  fWarehouseId,
        requestedBy:  fRequestedBy.trim(),
        clientName:   fClientName.trim(),
        deliveryType: fDeliveryType,
        notes:        fNotes.trim() || undefined,
        items:        fItems,
        createdBy:    editOrder?.createdBy ?? (user?.id ?? ''),
        status:       editOrder?.status || 'PENDIENTE',
      });
      navigate('/dispatches/list');
    } catch (e: any) {
      setFormError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }, [fWarehouseId, fRequestedBy, fClientName, fDeliveryType, fNotes, fItems, editOrder, user, saveDispatch, navigate, getProduct, getProductStock]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dispatches/list')}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {editOrder ? `Editar Orden ${editOrder.code}` : 'Crear Directo – Orden de Despacho'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {editOrder ? 'Modifique los datos o agregue/elimine productos de la orden pendiente.' : 'Complete los datos y agrega los productos del almacén.'}
          </p>
        </div>
      </header>

      {/* Error */}
      {formError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1 whitespace-pre-line">{formError}</span>
          <button onClick={() => setFormError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Datos de la orden ─────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {editOrder ? `Editando Orden: ${editOrder.code}` : 'Datos de la Orden de Despacho'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Completa los campos y agrega las mercancías en la tabla inferior
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || (editOrder && (editOrder.status !== 'PENDIENTE' || (editOrder.origin && editOrder.origin !== 'DIRECT')))}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm text-sm shrink-0"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : editOrder ? 'Guardar Cambios' : 'Guardar Orden'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Código */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Código Despacho</label>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-blue-700 text-sm truncate">
              {editOrder ? editOrder.code : 'Auto (al guardar)'}
            </div>
          </div>
          {/* Almacén */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Almacén *</label>
            <select
              value={fWarehouseId}
              onChange={e => setFWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar almacén…</option>
              {warehouses.map(w => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
          </div>
          {/* Quien solicita */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Quien Solicita *</label>
            <Input
              value={fRequestedBy}
              onChange={e => setFRequestedBy(e.target.value)}
              placeholder="Persona que solicita"
            />
          </div>
          {/* Cliente */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre Cliente *</label>
            <Input
              value={fClientName}
              onChange={e => setFClientName(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>
          {/* Tipo entrega */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Entrega *</label>
            <select
              value={fDeliveryType}
              onChange={e => setFDeliveryType(e.target.value as DispatchDeliveryType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notas / Uso</label>
            <input
              type="text"
              value={fNotes}
              onChange={e => setFNotes(e.target.value)}
              placeholder="Observaciones opcionales…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ── Buscador de productos ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Buscar Producto
          {fWarehouseId && (
            <span className="ml-2 text-blue-600 font-normal normal-case">
              — {warehouses.find(w => String(w.id) === fWarehouseId)?.name}
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setShowDD(false); }}
              placeholder={
                fWarehouseId
                  ? 'Buscar por código o nombre en el almacén…'
                  : 'Selecciona un almacén primero…'
              }
              disabled={!fWarehouseId}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              autoComplete="off"
            />

            {/* Dropdown de resultados */}
            {showDD && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {results.length > 0 ? results.map(p => {
                  const pStock = getProductStock(String(p.id), fWarehouseId);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addProductToForm(String(p.id))}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.code}</p>
                      </div>
                      <span className={`ml-auto text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-md ${
                        pStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                      }`}>
                        {pStock > 0 ? `Stock: ${pStock}` : 'Sin Stock (0)'}
                      </span>
                    </button>
                  );
                }) : (
                  <div className="px-4 py-3 text-xs text-slate-500 text-center">
                    No se encontraron productos en este almacén.
                  </div>
                )}
                {query.trim().length >= 2 && (
                  <button
                    onClick={addManualItem}
                    className="w-full text-left px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border-t border-amber-200 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    Agregar manualmente: &ldquo;{query}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            title="Escanear código QR o barras"
          >
            <ScanLine className="w-4 h-4" />
            Escanear
          </button>
        </div>
      </div>

      {/* ── Tabla de ítems — 7 columnas ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs font-bold text-slate-700 uppercase">
              <TableHead>Código Producto</TableHead>
              <TableHead>Imagen Producto</TableHead>
              <TableHead>Nombre Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Sub Categoría</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Cantidad Requerida</TableHead>
              <TableHead className="text-center">Quitar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Usa el buscador para agregar productos de este almacén.</p>
                </TableCell>
              </TableRow>
            ) : fItems.map(item => {
              const isManual = item.productId.startsWith('manual-');
              const p        = isManual ? null : getProduct(item.productId);
              const code     = isManual ? 'MANUAL' : (p?.code ?? item.productId);
              const name     = isManual ? (item.notes ?? '-') : (p?.name ?? '-');
              const cat      = isManual ? '-' : getCategoryName(p?.categoryId ?? '');
              const subcat   = isManual ? '-' : getSubcategoryName(p?.categoryId ?? '', p?.subcategoryId);
              const stock    = isManual ? null : getProductStock(item.productId, fWarehouseId);
              
              const isNoStock            = !isManual && stock !== null && stock <= 0;
              const isStockInsufficient  = !isManual && stock !== null && stock > 0 && stock < item.quantityRequired;

              return (
                <TableRow
                  key={item.id}
                  className={
                    isNoStock || isStockInsufficient
                      ? 'bg-red-50/40 hover:bg-red-50/70 transition-colors'
                      : 'hover:bg-slate-50 transition-colors'
                  }
                >
                  {/* Código */}
                  <TableCell className="font-mono text-xs font-bold text-slate-600">
                    {code}
                  </TableCell>

                  {/* Imagen */}
                  <TableCell>
                    {p?.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={name}
                        className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                  </TableCell>

                  {/* Nombre */}
                  <TableCell className="font-medium text-slate-800 max-w-[220px]">
                    <span className="line-clamp-2">{name}</span>
                  </TableCell>

                  {/* Categoría */}
                  <TableCell className="text-slate-600 text-sm">{cat}</TableCell>

                  {/* Sub Categoría */}
                  <TableCell className="text-slate-600 text-sm">{subcat}</TableCell>

                  {/* Stock */}
                  <TableCell className="text-center font-bold">
                    {isManual ? (
                      <span className="text-slate-400 font-normal">-</span>
                    ) : isNoStock ? (
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                        0 (Sin stock)
                      </span>
                    ) : isStockInsufficient ? (
                      <span
                        className="inline-block px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold"
                        title={`Requerido: ${item.quantityRequired}`}
                      >
                        {stock} (Insuficiente)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">{stock}</span>
                    )}
                  </TableCell>

                  {/* Cantidad Requerida */}
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateItemQty(item.id, item.quantityRequired - 1)}
                          disabled={item.quantityRequired <= 1}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-600"
                        >
                          –
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={isManual ? undefined : (stock !== null && stock > 0 ? stock : undefined)}
                          value={item.quantityRequired}
                          onChange={e => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                          className={`w-14 text-center border rounded-lg py-1 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 ${
                            isStockInsufficient
                              ? 'border-red-400 bg-red-50 text-red-700'
                              : 'border-slate-200'
                          }`}
                        />
                        <button
                          onClick={() => updateItemQty(item.id, item.quantityRequired + 1)}
                          disabled={!isManual && stock !== null && item.quantityRequired >= stock}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-600"
                          title={!isManual && stock !== null && item.quantityRequired >= stock ? `Máximo: ${stock} (stock disponible)` : undefined}
                        >
                          +
                        </button>
                      </div>
                      {!isManual && stock !== null && stock > 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Máx: {stock}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Quitar */}
                  <TableCell className="text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default DispatchCreate;
