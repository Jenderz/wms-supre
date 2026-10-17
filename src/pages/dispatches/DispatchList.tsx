/**
 * DispatchList.tsx
 * Sub-módulo: Lista de Orden Despacho
 * Muestra todas las órdenes con filtros por estado y texto.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertCircle, CheckCircle2, Clock, Edit2, Eye, Package,
  Printer, Search, Trash2, Truck,
} from 'lucide-react';
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from '../../components/ui/Table';
import { useDispatches } from '../../features/dispatches/hooks/useDispatches';
import { DispatchOrder, DispatchOrderStatus } from '../../types';
import { DispatchPrintPreviewModal } from './DispatchPrintPreviewModal';

// ── Estado meta compartido ────────────────────────────────────────────────────
const STATUS_META: Partial<Record<DispatchOrderStatus, {
  label: string; color: string; icon: React.FC<{ className?: string }>;
}>> = {
  PENDIENTE:   { label: 'PENDIENTE',   color: 'bg-amber-100 text-amber-800 border border-amber-200',     icon: Clock         },
  EN_PROCESO:  { label: 'EN PROCESO',  color: 'bg-blue-100 text-blue-800 border border-blue-200',       icon: AlertCircle   },
  CONFIRMADO:  { label: 'CONFIRMADO',  color: 'bg-purple-100 text-purple-800 border border-purple-200', icon: CheckCircle2  },
  DESPACHADO:  { label: 'DESPACHADO',  color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: Truck      },
};
const STATUS_FLOW: DispatchOrderStatus[] = ['PENDIENTE', 'EN_PROCESO', 'CONFIRMADO', 'DESPACHADO'];

const StatusSelectBadge: React.FC<{
  order: DispatchOrder;
  onStatusChange: (order: DispatchOrder, nextStatus: DispatchOrderStatus) => void;
}> = ({ order, onStatusChange }) => {
  const m = STATUS_META[order.status] ?? STATUS_META.PENDIENTE;
  const Icon = m.icon;
  const isFinal = order.status === 'DESPACHADO';

  return (
    <div className="relative inline-block">
      <select
        value={order.status}
        disabled={isFinal}
        onChange={(e) => onStatusChange(order, e.target.value as DispatchOrderStatus)}
        className={[
          'appearance-none pl-7 pr-7 py-1 rounded-full text-xs font-bold cursor-pointer transition-all border outline-none shadow-sm',
          m.color,
          isFinal ? 'opacity-85 cursor-not-allowed' : 'hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-blue-400',
        ].join(' ')}
      >
        {STATUS_FLOW.map((s) => (
          <option key={s} value={s} className="bg-white text-slate-800 font-medium py-1">
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      <Icon className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      {!isFinal && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] opacity-70">
          ▼
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const DispatchList: React.FC = () => {
  const navigate = useNavigate();
  const { dispatches, isLoading, error, deleteDispatch, updateStatus } = useDispatches();

  const [listQuery,     setListQuery]     = useState('');
  const [listStatus,    setListStatus]    = useState<DispatchOrderStatus | 'ALL'>('ALL');
  const [previewOrder,  setPreviewOrder]  = useState<DispatchOrder | null>(null);

  const handleStatusChange = async (order: DispatchOrder, newStatus: DispatchOrderStatus) => {
    if (newStatus === order.status) return;
    if (order.status === 'DESPACHADO') {
      alert('No se puede cambiar el estado de una orden que ya está DESPACHADA.');
      return;
    }

    const confirmMessage = newStatus === 'DESPACHADO'
      ? `¿Estás seguro de marcar la orden ${order.code} como DESPACHADA?\n\nAl marcarla como despachada se descontará el stock y la orden no se podrá modificar posteriormente.`
      : `¿Deseas cambiar el estado de la orden ${order.code} a "${STATUS_META[newStatus].label}"?`;

    if (window.confirm(confirmMessage)) {
      await updateStatus(order.id, newStatus);
    }
  };

  const filtered = dispatches.filter(d => {
    const byStatus = listStatus === 'ALL' || d.status === listStatus;
    const lower    = listQuery.toLowerCase();
    const byText   = !listQuery ||
      d.code.toLowerCase().includes(lower) ||
      d.requestedBy.toLowerCase().includes(lower) ||
      d.clientName.toLowerCase().includes(lower) ||
      d.deliveryType.toLowerCase().includes(lower);
    return byStatus && byText;
  });

  const counts = STATUS_FLOW.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: dispatches.filter(d => d.status === s).length }),
    {},
  );

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return;
    deleteDispatch(id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Tarjetas resumen por estado ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_FLOW.map(s => {
          const m    = STATUS_META[s];
          const Icon = m.icon;
          return (
            <button
              key={s}
              onClick={() => setListStatus(prev => (prev === s ? 'ALL' : s))}
              className={[
                'rounded-2xl p-4 flex items-center gap-3 border transition-all shadow-sm text-left',
                listStatus === s
                  ? 'ring-2 ring-blue-500 bg-white border-blue-300'
                  : 'bg-white border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <div className={`p-2.5 rounded-xl ${m.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{m.label}</p>
                <p className="text-2xl font-bold text-slate-900">{counts[s] ?? 0}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="dispatch-list-search"
            type="text"
            placeholder="Buscar por código, cliente, quien solicita…"
            value={listQuery}
            onChange={e => setListQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={listStatus}
          onChange={e => setListStatus(e.target.value as DispatchOrderStatus | 'ALL')}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Todos los estados</option>
          {STATUS_FLOW.map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs font-bold text-slate-700 uppercase">
              <TableHead>Código Orden</TableHead>
              <TableHead>Quien Solicita</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo Entrega</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">Sin órdenes de despacho</p>
                  <p className="text-sm mt-1">
                    Usa{' '}
                    <button
                      onClick={() => navigate('/dispatches/new')}
                      className="text-blue-600 underline font-semibold"
                    >
                      Crear Directo
                    </button>{' '}
                    para agregar la primera.
                  </p>
                </TableCell>
              </TableRow>
            ) : filtered.map(order => (
              <TableRow key={order.id} className="hover:bg-slate-50 transition-colors">
                <TableCell>
                  <span className="font-mono font-bold text-blue-700">{order.code}</span>
                </TableCell>
                <TableCell className="font-medium text-slate-800">{order.requestedBy}</TableCell>
                <TableCell className="text-slate-700">{order.clientName}</TableCell>
                <TableCell>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                    {order.deliveryType}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy') : '—'}
                </TableCell>
                <TableCell>
                  <StatusSelectBadge order={order} onStatusChange={handleStatusChange} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1.5">
                    {/* → Ver Detalle (solo lectura) */}
                    <button
                      type="button"
                      title="Ver Detalle de la Orden"
                      onClick={() => navigate('/dispatches/detail', { state: { orderId: order.id, readOnly: true } })}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors border border-blue-100 shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {/* → Editar Orden / Cantidades */}
                    {order.status !== 'DESPACHADO' && (
                      <button
                        type="button"
                        title={
                          order.status === 'PENDIENTE' && (order.origin === 'DIRECT' || !order.origin)
                            ? 'Editar Creación de Orden Directa (Productos y Datos)'
                            : 'Editar Cantidades y Espacios de la Orden'
                        }
                        onClick={() => {
                          if (order.status === 'PENDIENTE' && (order.origin === 'DIRECT' || !order.origin)) {
                            navigate(`/dispatches/new?edit=${order.id}`, { state: { editOrderId: order.id } });
                          } else {
                            navigate('/dispatches/detail', { state: { orderId: order.id, readOnly: false } });
                          }
                        }}
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors border border-amber-100 shadow-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* → Imprimir */}
                    <button
                      type="button"
                      title="Previsualizar e Imprimir Orden"
                      onClick={() => setPreviewOrder(order)}
                      className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors border border-emerald-100 shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {/* → Eliminar */}
                    <button
                      type="button"
                      title="Eliminar Orden"
                      onClick={() => handleDelete(order.id)}
                      className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors border border-rose-100 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Mostrando {filtered.length} de {dispatches.length} órdenes
        </p>
      )}

      {/* Modal de Previsualización e Impresión */}
      <DispatchPrintPreviewModal
        order={previewOrder}
        onClose={() => setPreviewOrder(null)}
      />
    </div>
  );
};

export default DispatchList;
