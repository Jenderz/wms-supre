/**
 * DispatchDetail.tsx
 * Sub-módulo: Orden Despacho
 * Muestra el detalle completo de una orden, permite cambiar estado y gestionar espacios.
 * Se llega aquí desde la lista pasando { orderId } en location.state.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock,
  Edit2, FileText, Package, Printer, Truck, X,
} from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/Table';
import { useDispatches, SpaceOption } from '../../features/dispatches/hooks/useDispatches';
import { useAuth } from '../../context/AuthContext';
import { DispatchOrder, DispatchOrderStatus } from '../../types';
import { DispatchPrintPreviewModal } from './DispatchPrintPreviewModal';

// ── Meta de estados ───────────────────────────────────────────────────────────
const STATUS_META: Partial<Record<DispatchOrderStatus, {
  label: string; color: string; icon: React.FC<{ className?: string }>; description: string;
}>> = {
  PENDIENTE:  { label: 'PENDIENTE',  color: 'bg-amber-100 text-amber-800 border border-amber-200',     icon: Clock,        description: 'Estado predeterminado.'            },
  EN_PROCESO: { label: 'EN PROCESO', color: 'bg-blue-100 text-blue-800 border border-blue-200',       icon: AlertCircle,  description: 'El pedido está en proceso.'        },
  CONFIRMADO: { label: 'CONFIRMADO', color: 'bg-purple-100 text-purple-800 border border-purple-200', icon: CheckCircle2, description: 'Descuenta stock. Requiere admin.'   },
  DESPACHADO: { label: 'DESPACHADO', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: Truck,     description: 'Entregado. Sin más cambios.'        },
};
const STATUS_FLOW: DispatchOrderStatus[] = ['PENDIENTE', 'EN_PROCESO', 'CONFIRMADO', 'DESPACHADO'];

const StatusBadge: React.FC<{ status?: DispatchOrderStatus }> = ({ status }) => {
  const m    = status && STATUS_META[status] ? STATUS_META[status] : STATUS_META.PENDIENTE;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const DispatchDetail: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const {
    dispatches, warehouseSpaces, stock, isLoading,
    saveDispatch, saveDispatchSilent, updateStatus, getProduct, getWarehouse,
    getCategoryName, getSubcategoryName,
    getAvailableSpacesForProduct, evaluateSpacePreselection, getProductStock,
  } = useDispatches();

  const orderId: string | undefined   = (location.state as any)?.orderId;
  const isReadOnly: boolean            = (location.state as any)?.readOnly === true;

  const [currentOrder, setCurrentOrder] = useState<DispatchOrder | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [spaceModal, setSpaceModal] = useState<{
    itemId: string; productId: string; spaces: SpaceOption[];
  } | null>(null);

  // Sincronizar la orden cuando los datos cargan o cuando cambia el orderId
  // NOTA: currentOrder NO debe estar en las deps para evitar ciclo de re-render
  // con actualizaciones optimistas locales.
  useEffect(() => {
    if (!dispatches.length) return;
    if (orderId) {
      const found = dispatches.find(d => d.id === orderId);
      if (found) setCurrentOrder(found);
    }
    // Sin orderId no hacemos fallback automático: el estado vacío guiará al usuario
    // a la lista de órdenes, evitando mostrar datos de otra orden por error.
  }, [dispatches, orderId]);

  // ── Botón CONFIRMAR al finalizar la lista de productos ──
  const handleConfirmOrder = async () => {
    if (!currentOrder) return;
    if (user?.role !== 'ADMIN') {
      alert('Requiere permiso de Administrador para confirmar la orden.');
      return;
    }

    // Validar consistencia de asignaciones antes de confirmar
    const inconsistentItems = currentOrder.items.filter(it => {
      if (it.productId.startsWith('manual-')) return false;
      const totalAssigned = (it.warehouseSpaceAssignments || []).reduce((acc, a) => acc + a.quantity, 0);
      return totalAssigned > (Number(it.quantityRequired) || 0) + 0.0001;
    });

    if (inconsistentItems.length > 0) {
      alert(
        `No se puede confirmar: los siguientes productos tienen cantidades asignadas que superan lo requerido:\n` +
        inconsistentItems.map(it => `• Producto #${it.productId}: asignado ${(it.warehouseSpaceAssignments || []).reduce((a, x) => a + x.quantity, 0)} / requerido ${it.quantityRequired}`).join('\n') +
        '\n\nCorrige las cantidades antes de confirmar.'
      );
      return;
    }

    if (!window.confirm(`¿Confirmar orden ${currentOrder.code}?\n\nSe guardarán todas las cantidades modificadas y la orden pasará a estado CONFIRMADO, descontando el stock del inventario.`)) {
      return;
    }

    setIsSubmittingConfirm(true);
    try {
      await saveDispatch(currentOrder);
      await updateStatus(currentOrder.id, 'CONFIRMADO');
    } catch (err: any) {
      console.error('Error al confirmar orden:', err);
      alert(`Error al confirmar la orden: ${err?.message || 'Ocurrió un error inesperado.'}`);
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // ── Cambio de estado ──────────────────────────────────────────────────────
  const handleChangeStatus = useCallback(async (order: DispatchOrder, next: DispatchOrderStatus) => {
    if (order.status === next) return;
    if (next === 'CONFIRMADO' && user?.role !== 'ADMIN') {
      alert('Requiere permiso de administrador para confirmar.'); return;
    }

    // ── P0-E: Validar consistencia de asignaciones antes de avanzar a estado que descuenta stock ──
    if (next === 'CONFIRMADO' || next === 'DESPACHADO') {
      const inconsistentItems = order.items.filter(it => {
        // Ignorar ítems manuales (sin productId real)
        if (it.productId.startsWith('manual-')) return false;
        const totalAssigned = (it.warehouseSpaceAssignments || []).reduce((acc, a) => acc + a.quantity, 0);
        return totalAssigned > (Number(it.quantityRequired) || 0) + 0.0001; // tolerancia float
      });
      if (inconsistentItems.length > 0) {
        alert(
          `No se puede avanzar a ${next}: los siguientes productos tienen cantidades asignadas que superan lo requerido:\n` +
          inconsistentItems.map(it => `• Producto #${it.productId}: asignado ${(it.warehouseSpaceAssignments || []).reduce((a, x) => a + x.quantity, 0)} / requerido ${it.quantityRequired}`).join('\n') +
          '\n\nCorrige las cantidades antes de continuar.'
        );
        return;
      }
    }

    if (next === 'DESPACHADO' && !window.confirm('Al marcar como DESPACHADO no se pueden hacer más cambios. ¿Continuar?')) return;
    if (order.status === 'CONFIRMADO' && next === 'EN_PROCESO' && !window.confirm('Al revertir a EN PROCESO el stock descontado se devolverá al inventario y se reactivará la edición. ¿Desea continuar?')) return;
    
    if (next === 'CONFIRMADO' || next === 'DESPACHADO') {
      try {
        await saveDispatch(order);
      } catch (err: any) {
        console.error('Error al guardar asignaciones previas:', err);
        alert(`No se pudo guardar la asignación de espacios: ${err?.message || err}. Corrige los datos antes de cambiar el estado.`);
        return;
      }
    }

    await updateStatus(order.id, next);
  }, [user, updateStatus, saveDispatch]);

  // ── Asignación de espacio y persistencia en segundo plano ────────────────
  const toggleItemSpaceSelectionType = useCallback(async (itemId: string, newType: 'AUTO' | 'MANUAL') => {
    if (!currentOrder) return;
    const updated: DispatchOrder = {
      ...currentOrder,
      items: currentOrder.items.map(it =>
        it.id !== itemId ? it : {
          ...it,
          spaceSelectionType: newType,
        }
      ),
    };
    setCurrentOrder(updated);
    await saveDispatchSilent(updated);
  }, [currentOrder, saveDispatchSilent]);

  const assignSpace = useCallback(async (itemId: string, spaceId: string) => {
    if (!currentOrder) return;
    const updated: DispatchOrder = {
      ...currentOrder,
      items: currentOrder.items.map(it =>
        it.id !== itemId ? it : {
          ...it,
          warehouseSpaceAssignments: [{ warehouseSpaceId: spaceId, quantity: it.quantityRequired }],
        }
      ),
    };
    setCurrentOrder(updated);
    await saveDispatchSilent(updated);
    setSpaceModal(null);
  }, [currentOrder, saveDispatchSilent]);

  const assignDetailSpaceQty = useCallback(async (itemId: string, spaceId: string, qty: number) => {
    if (!currentOrder) return;
    const updated: DispatchOrder = {
      ...currentOrder,
      items: currentOrder.items.map(it => {
        if (it.id !== itemId) return it;
        const otherAssigned = (it.warehouseSpaceAssignments || [])
          .filter(a => a.warehouseSpaceId !== spaceId)
          .reduce((acc, a) => acc + a.quantity, 0);
        const remainingRequired = Math.max(0, it.quantityRequired - otherAssigned);
        const targetStock = stock.find(s => String(s.warehouseSpaceId) === spaceId && String(s.productId) === it.productId);
        const spaceStock = targetStock ? Number(targetStock.quantity) : 999999;
        const cappedQty = Math.min(Math.max(0, qty), remainingRequired, spaceStock);

        const filtered = (it.warehouseSpaceAssignments || []).filter(a => a.warehouseSpaceId !== spaceId);
        if (cappedQty > 0) filtered.push({ warehouseSpaceId: spaceId, quantity: cappedQty });
        return { ...it, warehouseSpaceAssignments: filtered };
      }),
    };
    setCurrentOrder(updated);
    try {
      await saveDispatchSilent(updated);
    } catch (e) {
      console.error('Error al guardar asignación de espacio:', e);
    }
  }, [currentOrder, saveDispatchSilent, stock]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Sin orden seleccionada ────────────────────────────────────────────────
  if (!currentOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-6">
        <div className="bg-slate-100 p-6 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-700 mb-1">Ninguna orden seleccionada</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            Ve a la lista de órdenes y haz clic en <strong>Ver</strong> para abrir el detalle de una orden.
          </p>
        </div>
        <button
          onClick={() => navigate('/dispatches/list')}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Ir a la Lista
        </button>
      </div>
    );
  }

  const order   = currentOrder;
  const wh      = getWarehouse(order.warehouseId);
  const isConfirmed = order.status === 'CONFIRMADO';
  const isFinal     = order.status === 'DESPACHADO';
  const isConfirmedOrFinal = isConfirmed || isFinal;
  const isEditLocked       = isConfirmedOrFinal || isReadOnly; // modo solo lectura o estado final
  const orderStatusNormalized = order.status === 'PROCESANDO' ? 'EN_PROCESO' : (order.status || 'PENDIENTE');
  const curIdx  = Math.max(0, STATUS_FLOW.indexOf(orderStatusNormalized as DispatchOrderStatus));
  const nextStatus = curIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[curIdx + 1] : null;
  const nextMeta   = nextStatus ? STATUS_META[nextStatus] : null;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dispatches/list')}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <span className="font-mono text-blue-700">{order.code}</span>
              <StatusBadge status={order.status} />
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Creada el {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isReadOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
              👁️ Solo Lectura
            </span>
          )}
          {isConfirmed && !isReadOnly && (
            <button
              type="button"
              onClick={() => handleChangeStatus(order, 'EN_PROCESO')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm shadow-md transition-all hover:scale-[1.02]"
            >
              <Clock className="w-4 h-4" />
              Revertir a En Proceso
            </button>
          )}
          {!isEditLocked && nextStatus && (
            <button
              onClick={() => handleChangeStatus(order, nextStatus)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              Avanzar Estado a: {nextMeta?.label}
            </button>
          )}
          {order.status === 'PENDIENTE' && (order.origin === 'DIRECT' || !order.origin) && (
            <button
              onClick={() => navigate(`/dispatches/new?edit=${order.id}`, { state: { editOrderId: order.id } })}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              title="Editar productos y cantidades de la orden directa"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          )}
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Orden
          </button>
          <button
            onClick={() => navigate('/dispatches/print-note', { state: { orderId: order.id } })}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700"
          >
            <FileText className="w-4 h-4" />
            Nota de Entrega
          </button>
        </div>
      </header>

      {/* ── Info general + Stepper ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Código Despacho', value: order.code,        mono: true  },
            { label: 'Almacén',         value: wh?.name ?? order.warehouseId  },
            { label: 'Quien Solicita',  value: order.requestedBy              },
            { label: 'Cliente',         value: order.clientName               },
            { label: 'Tipo Entrega',    value: order.deliveryType             },
            { label: 'Notas / Uso',     value: order.notes || '—'             },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="block text-[11px] font-bold text-slate-400 uppercase mb-0.5">{label}</span>
              <span className={`font-semibold text-slate-800 truncate block ${mono ? 'font-mono text-blue-700' : ''}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Stepper */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Flujo de la Orden</h3>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-medium">
              💡 Las asignaciones de espacios se guardan automáticamente al seleccionarlas.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {STATUS_FLOW.map((s, idx) => {
              const m        = STATUS_META[s];
              const Icon     = m.icon;
              const isCur    = s === orderStatusNormalized;
              const isPast   = idx < curIdx;
              const canClick = !isEditLocked && idx <= curIdx + 1 && s !== orderStatusNormalized;

              return (
                <div
                  key={s}
                  onClick={() => canClick && handleChangeStatus(order, s)}
                  className={[
                    'p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3',
                    canClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : '',
                    isCur
                      ? 'bg-blue-50/80 border-2 border-blue-400 shadow-sm'
                      : isPast
                      ? 'bg-slate-50 border-slate-200'
                      : canClick
                      ? 'bg-white border-blue-200 hover:bg-blue-50/50'
                      : 'bg-slate-50/50 border-dashed border-slate-200 opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 ${m.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isCur ? 'text-blue-900' : isPast ? 'text-slate-700' : 'text-slate-500'}`}>
                        {m.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{m.description}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[10px]">
                    {isCur && (
                      <span className="font-bold text-blue-700 flex items-center gap-1.5 bg-blue-100/60 px-2 py-0.5 rounded-md">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span> Estado Actual
                      </span>
                    )}
                    {isPast && (
                      <span className="font-semibold text-slate-500 flex items-center gap-1">
                        ✓ Completado
                      </span>
                    )}
                    {canClick && !isCur && (
                      <button
                        type="button"
                        className="w-full text-center py-1.5 px-2 font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-[10px] uppercase tracking-wider"
                      >
                        Cambiar a {m.label} ➔
                      </button>
                    )}
                    {!canClick && !isCur && !isPast && (
                      <span className="text-slate-400 font-medium">Bloqueado</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banner de Estado Bloqueado / Solo Lectura */}
      {isEditLocked && (
        <div className={`border rounded-2xl p-4 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
          isReadOnly
            ? 'bg-slate-50 border-slate-200 text-slate-700'
            : isConfirmed
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-5 h-5 shrink-0 ${isReadOnly ? 'text-slate-500' : isConfirmed ? 'text-amber-600' : 'text-red-500'}`} />
            <span>
              {isReadOnly
                ? '👁️ Estás en modo Solo Lectura. No se pueden realizar modificaciones en esta vista.'
                : isConfirmed
                ? 'El pedido está CONFIRMADO y el stock fue descontado del inventario general. Las cantidades y espacios están bloqueados.'
                : 'El pedido está DESPACHADO y finalizado. No se permiten más modificaciones.'}
            </span>
          </div>
          {isConfirmed && !isReadOnly && (
            <button
              type="button"
              onClick={() => handleChangeStatus(order, 'EN_PROCESO')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shrink-0 transition-colors shadow-sm"
            >
              Revertir a En Proceso
            </button>
          )}
        </div>
      )}

      {/* ── Tabla de productos SI/NO ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Productos — Asignación de Espacios ({order.items.length})</h3>
          <p className="text-xs text-slate-400">
            <span className="font-bold text-emerald-600">SÍ</span> = stock en Despachos · <span className="font-bold text-amber-600">NO</span> = asignación manual
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs font-bold text-slate-700 uppercase">
              <TableHead>Código</TableHead>
              <TableHead>Imagen</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Sub Cat.</TableHead>
              <TableHead>Espacio Almacén</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Cercanía</TableHead>
              <TableHead className="text-center">Tipo Uso</TableHead>
              <TableHead className="text-center">Cant. a Tomar</TableHead>
              <TableHead className="text-center">Cant. Req.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-slate-400">Sin productos en esta orden.</TableCell>
              </TableRow>
            ) : (
              <>
                {/* SÍ */}
                <TableRow className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider">
                  <TableCell colSpan={11} className="py-2.5 px-4">SÍ — Stock suficiente en espacios tipo &ldquo;Despachos&rdquo; (&ge; Cantidad Requerida)</TableCell>
                </TableRow>
                {(() => {
                  const siItems = order.items.filter(item => {
                    if (item.productId.startsWith('manual-')) return false;
                    if (item.spaceSelectionType === 'MANUAL') return false;
                    if (isEditLocked) {
                      if (item.warehouseSpaceAssignments && item.warehouseSpaceAssignments.length > 1) {
                        return false;
                      }
                      const assignedSid = item.warehouseSpaceAssignments?.[0]?.warehouseSpaceId ?? item.warehouseSpaceId;
                      if (assignedSid) {
                        const ws = warehouseSpaces.find(w => String(w.id) === String(assignedSid));
                        if (ws && ws.spaceUsageType !== 'Despachos') {
                          return false;
                        }
                      }
                      return true;
                    }
                    const ev = evaluateSpacePreselection(item.productId, order.warehouseId, item.quantityRequired);
                    return ev && ev.isAutoSelected;
                  });
                  if (siItems.length === 0) return (
                    <TableRow><TableCell colSpan={11} className="text-center py-4 text-xs text-slate-400 bg-slate-50/50">Ningún producto cumple con stock suficiente en espacios de Despachos</TableCell></TableRow>
                  );
                  return siItems.map(item => {
                    const p   = getProduct(item.productId);
                    const cat = getCategoryName(p?.categoryId ?? '');
                    const sub = getSubcategoryName(p?.categoryId ?? '', p?.subcategoryId);
                    const ev  = evaluateSpacePreselection(item.productId, order.warehouseId, item.quantityRequired);
                    const allSpaces  = getAvailableSpacesForProduct(item.productId, order.warehouseId);
                    const assignedSid = item.warehouseSpaceAssignments?.[0]?.warehouseSpaceId ?? item.warehouseSpaceId ?? ev?.autoPreselectedSpaceId ?? '';
                    const bestSp  = allSpaces.find(s => String(s.warehouseSpaceId) === String(assignedSid)) || allSpaces[0];
                    const fallbackSp = warehouseSpaces.find(w => String(w.id) === String(assignedSid));
                    const spaceName  = fallbackSp?.name ?? bestSp?.spaceName ?? ev?.autoPreselectedSpaceName ?? '—';
                    const prox = Math.round(Number((bestSp?.proximity != null && bestSp.proximity !== 999) ? bestSp.proximity : (fallbackSp?.proximity ?? 1)));
                    const spaceStockQty = isEditLocked
                      ? item.quantityRequired
                      : (bestSp
                        ? bestSp.quantity
                        : (stock.find(s => String(s.productId) === item.productId && String(s.warehouseId) === order.warehouseId && String(s.warehouseSpaceId) === String(assignedSid))?.quantity ?? getProductStock(item.productId, order.warehouseId)));
                    return (
                      <TableRow key={item.id} className="hover:bg-emerald-50/30 text-xs text-slate-800 border-l-4 border-emerald-400">
                        <TableCell className="font-mono font-bold text-slate-600">{p?.code ?? item.productId}</TableCell>
                        <TableCell>
                          {p?.imageUrl
                            ? <img src={p.imageUrl} alt={p?.name ?? ''} className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200" />
                            : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-300" /></div>}
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px]"><span className="line-clamp-2">{p?.name ?? item.notes ?? '—'}</span></TableCell>
                        <TableCell>{cat}</TableCell>
                        <TableCell>{sub}</TableCell>
                        <TableCell>
                          <span className="font-bold text-emerald-700 text-sm">{spaceName}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700">{spaceStockQty}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-xs">{prox}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">DESPACHOS</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-200 text-xs">
                            {item.quantityRequired}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="font-bold text-sm">{item.quantityRequired}</span>
                            {!isEditLocked && (
                              <button
                                type="button"
                                title="Mover a sección NO"
                                onClick={() => toggleItemSpaceSelectionType(item.id, 'MANUAL')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-amber-500 text-white font-bold border-amber-600 hover:bg-amber-600 text-[10px] shadow-sm tracking-wider whitespace-nowrap"
                              >
                                Bajar a NO ↓
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}

                {/* NO */}
                <TableRow className="bg-amber-600 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider">
                  <TableCell colSpan={11} className="py-2.5 px-4">NO — Asignación manual requerida (Stock insuficiente en Despachos o selección personalizada)</TableCell>
                </TableRow>
                {(() => {
                  const noItems = order.items.filter(item => {
                    if (item.productId.startsWith('manual-')) return true;
                    if (item.spaceSelectionType === 'MANUAL') return true;
                    if (isEditLocked) {
                      if (item.warehouseSpaceAssignments && item.warehouseSpaceAssignments.length > 1) {
                        return true;
                      }
                      const assignedSid = item.warehouseSpaceAssignments?.[0]?.warehouseSpaceId ?? item.warehouseSpaceId;
                      if (assignedSid) {
                        const ws = warehouseSpaces.find(w => String(w.id) === String(assignedSid));
                        if (ws && ws.spaceUsageType !== 'Despachos') {
                          return true;
                        }
                      }
                      return false;
                    }
                    const ev = evaluateSpacePreselection(item.productId, order.warehouseId, item.quantityRequired);
                    return !ev || !ev.isAutoSelected;
                  });
                  if (noItems.length === 0) return (
                    <TableRow><TableCell colSpan={11} className="text-center py-4 text-xs text-slate-400 bg-slate-50/50">Ningún producto califica en la sección NO</TableCell></TableRow>
                  );
                  return noItems.map(item => {
                    const isManual   = item.productId.startsWith('manual-');
                    const isManualSel = item.spaceSelectionType === 'MANUAL';
                    const p       = isManual ? null : getProduct(item.productId);
                    const code    = isManual ? 'MANUAL' : (p?.code ?? item.productId);
                    const name    = isManual ? (item.notes ?? '-') : (p?.name ?? '-');
                    const cat     = isManual ? '-' : getCategoryName(p?.categoryId ?? '');
                    const sub     = isManual ? '-' : getSubcategoryName(p?.categoryId ?? '', p?.subcategoryId);
                    const ev      = !isManual ? evaluateSpacePreselection(item.productId, order.warehouseId, item.quantityRequired) : null;
                    const canGoBackToSi = isManualSel && !isManual && ev && ev.isAutoSelected;
                    
                    // Espacios disponibles base
                    let availSpaces = (!isManual && order.warehouseId) ? getAvailableSpacesForProduct(item.productId, order.warehouseId) : [];

                    // Integridad histórica / persistencia: asegurar que cualquier espacio con asignación aparezca
                    if (item.warehouseSpaceAssignments && item.warehouseSpaceAssignments.length > 0) {
                      item.warehouseSpaceAssignments.forEach(asgn => {
                        if (asgn.quantity > 0 && !availSpaces.some(sp => String(sp.warehouseSpaceId) === String(asgn.warehouseSpaceId))) {
                          const ws = warehouseSpaces.find(w => String(w.id) === String(asgn.warehouseSpaceId));
                          const currentStockEntry = stock.find(s =>
                            String(s.productId) === item.productId &&
                            String(s.warehouseId) === order.warehouseId &&
                            String(s.warehouseSpaceId) === String(asgn.warehouseSpaceId)
                          );
                          availSpaces.push({
                            stockId: currentStockEntry ? currentStockEntry.id : 0,
                            warehouseSpaceId: String(asgn.warehouseSpaceId),
                            spaceName: ws ? ws.name : `Espacio #${asgn.warehouseSpaceId}`,
                            spaceUsageType: (ws?.spaceUsageType as any) ?? 'Almacenamiento',
                            proximity: ws?.proximity ?? 1,
                            quantity: currentStockEntry ? Number(currentStockEntry.quantity) : 0,
                            needsRestock: false,
                          });
                        }
                      });
                    }

                    // En modo bloqueado/histórico, si hay asignaciones guardadas, filtramos para mostrar únicamente los espacios despachados
                    if (isEditLocked && item.warehouseSpaceAssignments && item.warehouseSpaceAssignments.length > 0) {
                      const assignedIds = new Set(
                        item.warehouseSpaceAssignments.filter(a => a.quantity > 0).map(a => String(a.warehouseSpaceId))
                      );
                      if (assignedIds.size > 0) {
                        availSpaces = availSpaces.filter(sp => assignedIds.has(String(sp.warehouseSpaceId)));
                      }
                    }

                    const totalAssigned = (item.warehouseSpaceAssignments || []).reduce((acc, a) => acc + a.quantity, 0);
                    return (
                      <TableRow key={item.id} className="hover:bg-amber-50/30 text-xs text-slate-800 border-l-4 border-amber-400 align-top">
                        <TableCell className="font-mono font-bold text-slate-600 py-3">
                          <div className="flex flex-col gap-1">
                            <span>{code}</span>
                            {!isEditLocked && (
                              <button
                                type="button"
                                onClick={() => toggleItemSpaceSelectionType(item.id, 'AUTO')}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-[9px] font-bold w-fit"
                              >
                                ↑ Volver a SÍ
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {p?.imageUrl
                            ? <img src={p.imageUrl} alt={name} className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200" />
                            : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-300" /></div>}
                        </TableCell>
                        <TableCell className="font-medium max-w-[150px] py-3"><span className="line-clamp-2">{name}</span></TableCell>
                        <TableCell className="py-3">{cat}</TableCell>
                        <TableCell className="py-3">{sub}</TableCell>

                        {/* Espacio Almacén — Simetría visual mediante h-10 en sub-filas */}
                        <TableCell className="p-0">
                          <div className="flex flex-col">
                            {availSpaces.map(sp => (
                              <div key={sp.warehouseSpaceId} className="h-10 flex items-center justify-between gap-2 px-3 border-b last:border-0 border-slate-100">
                                <span className="font-semibold text-blue-700 font-mono text-xs">{sp.spaceName}</span>
                                {!isManual && !isEditLocked && (
                                  <button
                                    type="button"
                                    onClick={() => setSpaceModal({ itemId: item.id, productId: item.productId, spaces: [sp] })}
                                    className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap"
                                  >
                                    Seleccionar
                                  </button>
                                )}
                              </div>
                            ))}
                            {availSpaces.length === 0 && <div className="h-10 flex items-center px-3 text-slate-400 text-xs">Sin stock disponible</div>}
                          </div>
                        </TableCell>

                        {/* Stock */}
                        <TableCell className="p-0">
                          <div className="flex flex-col">
                            {availSpaces.map(sp => {
                              const assigned = item.warehouseSpaceAssignments?.find(a => a.warehouseSpaceId === sp.warehouseSpaceId);
                              const val = assigned?.quantity ?? 0;
                              const displayStock = isEditLocked ? (sp.quantity + val) : sp.quantity;
                              return (
                                <div key={sp.warehouseSpaceId} className="h-10 flex items-center justify-center font-bold text-slate-700 text-xs border-b last:border-0 border-slate-100">
                                  {displayStock}
                                </div>
                              );
                            })}
                            {availSpaces.length === 0 && <div className="h-10 flex items-center justify-center text-slate-300 text-xs">—</div>}
                          </div>
                        </TableCell>

                        {/* Cercanía */}
                        <TableCell className="p-0">
                          <div className="flex flex-col">
                            {availSpaces.map(sp => (
                              <div key={sp.warehouseSpaceId} className="h-10 flex items-center justify-center border-b last:border-0 border-slate-100 text-xs">
                                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-xs">
                                  {Math.round(Number((sp.proximity != null && sp.proximity !== 999) ? sp.proximity : 1))}
                                </span>
                              </div>
                            ))}
                            {availSpaces.length === 0 && <div className="h-10 flex items-center justify-center text-slate-300 text-xs">—</div>}
                          </div>
                        </TableCell>

                        {/* Tipo Uso */}
                        <TableCell className="p-0">
                          <div className="flex flex-col">
                            {availSpaces.map(sp => (
                              <div key={sp.warehouseSpaceId} className="h-10 flex items-center justify-center text-xs text-slate-600 font-medium border-b last:border-0 border-slate-100">
                                {sp.spaceUsageType}
                              </div>
                            ))}
                            {availSpaces.length === 0 && <div className="h-10 flex items-center justify-center text-slate-300 text-xs">—</div>}
                          </div>
                        </TableCell>

                        {/* Cantidad a Tomar */}
                        <TableCell className="p-0">
                          <div className="flex flex-col">
                            {availSpaces.map(sp => {
                              const assigned = item.warehouseSpaceAssignments?.find(a => a.warehouseSpaceId === sp.warehouseSpaceId);
                              const val = assigned?.quantity ?? 0;
                              const otherAssigned = (item.warehouseSpaceAssignments || [])
                                .filter(a => a.warehouseSpaceId !== sp.warehouseSpaceId)
                                .reduce((acc, a) => acc + a.quantity, 0);
                              const maxForThisSpace = Math.min(
                                sp.quantity,
                                Math.max(0, item.quantityRequired - otherAssigned)
                              );

                              return (
                                <div key={sp.warehouseSpaceId} className="h-10 flex items-center justify-center border-b last:border-0 border-slate-100 px-2">
                                  {sp.needsRestock ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 border border-orange-300 text-orange-700 text-[10px] font-bold">
                                      ⚠️ Reabastecer
                                    </span>
                                  ) : !isEditLocked ? (
                                    <input
                                      type="number" min={0} max={maxForThisSpace} value={val || ''} placeholder="0"
                                      onChange={e => assignDetailSpaceQty(item.id, sp.warehouseSpaceId, parseInt(e.target.value) || 0)}
                                      className="w-16 text-center border border-amber-300 rounded-lg py-0.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 bg-amber-50"
                                    />
                                  ) : (
                                    <span className="inline-flex items-center justify-center font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                                      {val || 0}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {availSpaces.length === 0 && <div className="h-10 flex items-center justify-center text-slate-300 text-xs">—</div>}
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-center">
                          <div className="font-bold text-sm text-slate-800">{item.quantityRequired}</div>
                          <span className={`text-[10px] font-bold block mt-1 ${totalAssigned === item.quantityRequired ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {totalAssigned} / {item.quantityRequired} asig.
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Botón CONFIRMAR al finalizar la lista ── */}
      {!isEditLocked && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Confirmar Cantidades y Despachar</h4>
              <p className="text-xs text-slate-500">
                Al presionar <strong>CONFIRMAR</strong> se guardarán todas las cantidades modificadas y la orden pasará a estado <strong>CONFIRMADO</strong>, descontando el stock del inventario.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSubmittingConfirm}
              onClick={handleConfirmOrder}
              className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              {isSubmittingConfirm ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <span>CONFIRMAR</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal cambio espacio */}
      {spaceModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSpaceModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase">Seleccionar Espacio</h3>
              <button onClick={() => setSpaceModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {spaceModal.spaces.length === 0
                ? <p className="text-center text-sm text-slate-400 py-4">No hay espacios con stock disponible.</p>
                : spaceModal.spaces.map(sp => (
                  <button
                    key={sp.warehouseSpaceId}
                    onClick={() => assignSpace(spaceModal.itemId, sp.warehouseSpaceId)}
                    className="w-full text-left p-3 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">{sp.spaceName}</span>
                      <span className="text-xs text-slate-500">Uso: {sp.spaceUsageType} · Cercanía: {sp.proximity}</span>
                    </div>
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${sp.spaceUsageType === 'Despachos' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {sp.quantity} uds
                    </span>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Modal de Previsualización de Impresión */}
      <DispatchPrintPreviewModal
        order={showPrintModal ? order : null}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
};

export default DispatchDetail;
