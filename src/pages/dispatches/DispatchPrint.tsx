/**
 * DispatchPrint.tsx
 * Sub-módulo: Impresión – Orden Despacho
 * Permite seleccionar una orden y generar el PDF de la Orden de Despacho.
 */
import React, { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle, CheckCircle2, Clock, Download, FileDown, Package, Printer, Search, Truck,
} from 'lucide-react';
import { useDispatches } from '../../features/dispatches/hooks/useDispatches';
import { DispatchOrder, DispatchOrderStatus } from '../../types';

// ── Estado meta ───────────────────────────────────────────────────────────────
const STATUS_META: Partial<Record<DispatchOrderStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }>> = {
  PENDIENTE:  { label: 'PENDIENTE',  color: 'bg-amber-100 text-amber-800 border border-amber-200',     icon: Clock       },
  EN_PROCESO: { label: 'EN PROCESO', color: 'bg-blue-100 text-blue-800 border border-blue-200',       icon: AlertCircle },
  CONFIRMADO: { label: 'CONFIRMADO', color: 'bg-purple-100 text-purple-800 border border-purple-200', icon: CheckCircle2},
  DESPACHADO: { label: 'DESPACHADO', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: Truck    },
};

const StatusBadge: React.FC<{ status?: DispatchOrderStatus }> = ({ status }) => {
  const m = status && STATUS_META[status] ? STATUS_META[status] : STATUS_META.PENDIENTE;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const DispatchPrint: React.FC = () => {
  const location = useLocation();
  const {
    dispatches, warehouseSpaces, isLoading,
    getProduct, getWarehouse, getCategoryName,
  } = useDispatches();

  const preselectedId: string | undefined = (location.state as any)?.orderId;
  const [selected,   setSelected]   = useState<DispatchOrder | null>(
    preselectedId ? (dispatches.find(d => d.id === preselectedId) ?? null) : null,
  );
  const [query,      setQuery]      = useState('');
  const [generating, setGenerating] = useState(false);

  // ── Filtro de búsqueda ────────────────────────────────────────────────────
  const filtered = dispatches.filter(d => {
    if (!query) return true;
    const lower = query.toLowerCase();
    return d.code.toLowerCase().includes(lower) ||
           d.clientName.toLowerCase().includes(lower) ||
           d.requestedBy.toLowerCase().includes(lower);
  });

  // ── Helper: desglosar todas las asignaciones de un ítem (P1-A / OBS 1.3) ──────
  const getItemSpaceLines = useCallback(
    (it: DispatchOrder['items'][number]): { spaceName: string; qty: number }[] => {
      if (it.productId.startsWith('manual-')) return [{ spaceName: '-', qty: it.quantityRequired }];
      const assignments = it.warehouseSpaceAssignments ?? [];
      if (assignments.length === 0) {
        const sid = it.warehouseSpaceId;
        const sp  = sid ? warehouseSpaces.find(w => String(w.id) === String(sid)) : null;
        return [{ spaceName: sp?.name ?? (sid ? `Espacio #${sid}` : '-'), qty: it.quantityRequired }];
      }
      return assignments.map(a => {
        const sp = warehouseSpaces.find(w => String(w.id) === String(a.warehouseSpaceId));
        return { spaceName: sp?.name ?? `Espacio #${a.warehouseSpaceId}`, qty: a.quantity };
      });
    },
    [warehouseSpaces],
  );

  // ── Generar PDF ───────────────────────────────────────────────────────────
  const printOrder = useCallback((order: DispatchOrder) => {
    setGenerating(true);
    try {
      const doc  = new jsPDF();
      const wh   = getWarehouse(order.warehouseId);
      const date = format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm');

      // ── Encabezado ──
      doc.setFontSize(18); doc.setTextColor(37, 99, 235);
      doc.text('SUPRE WMS', 14, 18);
      doc.setFontSize(11); doc.setTextColor(100);
      doc.text('ORDEN DE DESPACHO', 14, 25);
      doc.setTextColor(0);
      doc.text(`C\u00f3digo: ${order.code}`, 140, 18);
      doc.text(`Fecha:  ${date}`,       140, 25);

      doc.setFontSize(10);
      doc.text(`Almac\u00e9n:        ${wh?.name ?? order.warehouseId}`, 14, 36);
      doc.text(`Quien solicita: ${order.requestedBy}`,             14, 43);
      doc.text(`Cliente:        ${order.clientName}`,              14, 50);
      doc.text(`Tipo entrega:   ${order.deliveryType}`,            14, 57);
      doc.text(`Estado:         ${STATUS_META[order.status]?.label || order.status || 'PENDIENTE'}`, 14, 64);

      if (order.notes) {
        doc.setFontSize(9); doc.setTextColor(80);
        doc.text(`Notas: ${order.notes}`, 14, 70);
        doc.setTextColor(0);
      }

      // ── Tabla: una fila por cada espacio asignado (OBS 1.3) ──
      const tableBody: (string | number)[][] = [];
      order.items.forEach(it => {
        const isManual = it.productId.startsWith('manual-');
        const p        = isManual ? null : getProduct(it.productId);
        const code     = isManual ? 'MANUAL' : (p?.code ?? it.productId);
        const name     = isManual ? (it.notes ?? '-') : (p?.name ?? '-');
        const lines    = getItemSpaceLines(it);
        // Cercan\u00eda: usar primer espacio asignado como referencia
        const bestSid  = it.warehouseSpaceAssignments?.[0]?.warehouseSpaceId ?? it.warehouseSpaceId;
        const bestSp   = warehouseSpaces.find(w => String(w.id) === String(bestSid));
        const prox     = bestSp?.proximity != null ? String(bestSp.proximity) : '-';

        lines.forEach((line, idx) => {
          tableBody.push([
            idx === 0 ? code : '',
            idx === 0 ? name : '',
            line.spaceName,
            String(line.qty),
            idx === 0 ? prox : '',
          ]);
        });
      });

      autoTable(doc, {
        startY: 75,
        head: [['C\u00d3DIGO', 'NOMBRE PRODUCTO', 'ESPACIO ALMAC\u00c9N', 'CANT. TOMADA', 'CERCAN\u00cdA']],
        body: tableBody,
        headStyles:          { fillColor: [71, 85, 105], textColor: 255 },
        styles:              { fontSize: 9, cellPadding: 3 },
        alternateRowStyles:  { fillColor: [241, 245, 249] },
        columnStyles:        { 3: { halign: 'center' }, 4: { halign: 'center' } },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 150;
      doc.setFontSize(8); doc.setTextColor(130);
      doc.text('Generado por SUPRE WMS \u2014 ' + format(new Date(), 'dd/MM/yyyy HH:mm'), 14, finalY + 12);

      doc.save(`OrdenDespacho_${order.code}.pdf`);
    } finally {
      setGenerating(false);
    }
  }, [getProduct, getWarehouse, warehouseSpaces, getItemSpaceLines]);


  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Encabezado ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-2.5 rounded-xl">
          <Printer className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Impresión – Orden de Despacho</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Selecciona una orden y genera el PDF oficial de la Orden de Despacho.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Panel izquierdo: Selección de orden ───────────────────── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Seleccionar Orden
            </h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por código o cliente…"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Sin órdenes disponibles</p>
              ) : filtered.map(order => (
                <button
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className={[
                    'w-full text-left p-3 rounded-xl border transition-all',
                    selected?.id === order.id
                      ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-blue-700 text-sm">{order.code}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{order.clientName}</p>
                  <p className="text-xs text-slate-400">{order.requestedBy}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Panel derecho: Vista previa + Generar PDF ─────────────── */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center gap-4">
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <FileDown className="w-10 h-10 text-slate-300 mx-auto" />
              </div>
              <div>
                <p className="font-semibold text-slate-600">Selecciona una orden</p>
                <p className="text-sm text-slate-400 mt-1">
                  Haz clic en una orden de la lista para ver la vista previa y generar el PDF.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* ── Cabecera preview ── */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">ORDEN DE DESPACHO</p>
                    <h3 className="text-2xl font-bold font-mono mt-1">{selected.code}</h3>
                  </div>
                  <div className="text-right text-sm text-blue-100">
                    <p>{format(new Date(selected.createdAt), 'dd/MM/yyyy')}</p>
                    <p className="mt-1"><StatusBadge status={selected.status} /></p>
                  </div>
                </div>
              </div>

              {/* ── Detalles ── */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Quien Solicita', value: selected.requestedBy },
                    { label: 'Cliente',         value: selected.clientName  },
                    { label: 'Tipo de Entrega', value: selected.deliveryType },
                    { label: 'Notas',           value: selected.notes || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase mb-0.5">{label}</span>
                      <span className="font-semibold text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Resumen de productos */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Productos ({selected.items.length})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Producto</th>
                          <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase">Cant.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selected.items.map(it => {
                          const p = getProduct(it.productId);
                          return (
                            <tr key={it.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <span className="font-mono text-slate-500 mr-2">{p?.code ?? '—'}</span>
                                <span className="font-medium text-slate-800">{p?.name ?? it.notes ?? it.productId}</span>
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-slate-700">{it.quantityRequired}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Botón principal */}
                <button
                  onClick={() => printOrder(selected)}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
                >
                  {generating ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Generando PDF…</>
                  ) : (
                    <><Download className="w-5 h-5" /> Descargar PDF – Orden de Despacho</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DispatchPrint;
