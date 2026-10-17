/**
 * DispatchPrintPreviewModal.tsx
 * Modal de Previsualización e Impresión de Orden de Despacho.
 * Permite visualizar el documento antes de imprimirlo o descargarlo en PDF.
 */
import React from 'react';
import { X, Printer, Download, Package, CheckCircle2, Clock, AlertCircle, Truck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { DispatchOrder, DispatchOrderStatus, DispatchOrderItem } from '../../types';
import { useDispatches } from '../../features/dispatches/hooks/useDispatches';
import { Button } from '../../components/ui/Button';

interface DispatchPrintPreviewModalProps {
  order: DispatchOrder | null;
  onClose: () => void;
}

const STATUS_META: Partial<Record<DispatchOrderStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }>> = {
  PENDIENTE:  { label: 'PENDIENTE',  color: 'bg-amber-100 text-amber-800 border border-amber-200',     icon: Clock       },
  EN_PROCESO: { label: 'EN PROCESO', color: 'bg-blue-100 text-blue-800 border border-blue-200',       icon: AlertCircle },
  CONFIRMADO: { label: 'CONFIRMADO', color: 'bg-purple-100 text-purple-800 border border-purple-200', icon: CheckCircle2},
  DESPACHADO: { label: 'DESPACHADO', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: Truck    },
};

export const DispatchPrintPreviewModal: React.FC<DispatchPrintPreviewModalProps> = ({ order, onClose }) => {
  const { getProduct, getWarehouse, warehouseSpaces, evaluateSpacePreselection } = useDispatches();

  if (!order) return null;

  const date = order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : '—';
  const warehouse = getWarehouse(order.warehouseId)?.name ?? order.warehouseId;
  const statusInfo = STATUS_META[order.status] ?? STATUS_META.PENDIENTE;
  const StatusIcon = statusInfo.icon;

  // ── Helper para resolver espacio de almacén (una sola asignación, fallback) ──
  const getItemSpaceName = (it: DispatchOrderItem): string => {
    const isManual = it.productId.startsWith('manual-');
    if (isManual) return '-';
    const assignedSid = it.warehouseSpaceAssignments?.[0]?.warehouseSpaceId ?? it.warehouseSpaceId;
    const ev = evaluateSpacePreselection(it.productId, order.warehouseId, it.quantityRequired);
    const sp = warehouseSpaces.find(w => String(w.id) === String(assignedSid));
    return sp?.name ?? ev?.autoPreselectedSpaceName ?? (assignedSid ? `Espacio #${assignedSid}` : '-');
  };

  // ── Helper para desglosar TODAS las asignaciones de espacios ─────────────────
  const getItemSpaceLines = (it: DispatchOrderItem): { spaceName: string; qty: number }[] => {
    const isManual = it.productId.startsWith('manual-');
    if (isManual) return [{ spaceName: '-', qty: it.quantityRequired }];

    const assignments = it.warehouseSpaceAssignments ?? [];
    if (assignments.length === 0) {
      // fallback: usar autoPreselección o campo legacy
      const fallbackSid = it.warehouseSpaceId;
      const ev = evaluateSpacePreselection(it.productId, order.warehouseId, it.quantityRequired);
      const fallbackName = fallbackSid
        ? (warehouseSpaces.find(w => String(w.id) === String(fallbackSid))?.name ?? `Espacio #${fallbackSid}`)
        : (ev?.autoPreselectedSpaceName ?? '-');
      return [{ spaceName: fallbackName, qty: it.quantityRequired }];
    }

    return assignments.map(a => {
      const sp = warehouseSpaces.find(w => String(w.id) === String(a.warehouseSpaceId));
      return {
        spaceName: sp?.name ?? `Espacio #${a.warehouseSpaceId}`,
        qty: a.quantity,
      };
    });
  };

  // ── Descargar PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();

      // Cabecera Empresa
      doc.setFontSize(16); doc.setTextColor(37, 99, 235);
      doc.text('SUPREPARTS - ORDEN DE DESPACHO', 14, 18);

      doc.setFontSize(9); doc.setTextColor(80);
      doc.text(`Código Orden: ${order.code}`, 14, 26);
      doc.text(`Fecha: ${format(new Date(order.createdAt), 'dd/MM/yyyy')}`, 14, 31);
      doc.text(`Estado: ${order.status}`, 14, 36);

      doc.text(`Cliente: ${order.clientName}`, 120, 26);
      doc.text(`Solicitado por: ${order.requestedBy}`, 120, 31);
      doc.text(`Almacén: ${warehouse}`, 120, 36);
      doc.text(`Tipo Entrega: ${order.deliveryType}`, 120, 41);

      doc.setDrawColor(200);
      doc.line(14, 46, 196, 46);

      // Tabla de productos — una fila por cada espacio asignado
      const tableBody: (string | number)[][] = [];
      order.items.forEach(it => {
        const isManual = it.productId.startsWith('manual-');
        const p        = isManual ? null : getProduct(it.productId);
        const code     = isManual ? 'MANUAL' : (p?.code ?? it.productId);
        const name     = isManual ? (it.notes ?? '-') : (p?.name ?? '-');
        const lines    = getItemSpaceLines(it);
        lines.forEach((line, idx) => {
          tableBody.push([
            idx === 0 ? code : '',
            idx === 0 ? name : '',
            line.spaceName,
            String(line.qty),
          ]);
        });
      });

      autoTable(doc, {
        startY: 50,
        head: [['CÓDIGO', 'PRODUCTO', 'ESPACIO ALMACÉN', 'CANT. TOMADA']],
        body: tableBody,
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 3: { halign: 'center' } },
      });

      const y = (doc as any).lastAutoTable?.finalY ?? 150;
      if (order.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8); doc.setTextColor(100);
        doc.text('NOTAS / OBSERVACIONES:', 14, y + 10);
        doc.text(order.notes, 14, y + 16, { maxWidth: 170 });
      }

      doc.save(`Orden_Despacho_${order.code}.pdf`);
    } catch (e) {
      console.error('Error al generar PDF:', e);
      alert('Error al generar la descarga del PDF.');
    }
  };

  // ── Imprimir Nativo ────────────────────────────────────────────────────────
  const handleNativePrint = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir.');
      return;
    }

    // Una fila por cada espacio asignado
    const itemsHtml = order.items.map(it => {
      const isManual  = it.productId.startsWith('manual-');
      const p         = isManual ? null : getProduct(it.productId);
      const code      = isManual ? 'MANUAL' : (p?.code ?? it.productId);
      const name      = isManual ? (it.notes ?? '-') : (p?.name ?? '-');
      const lines     = getItemSpaceLines(it);
      return lines.map((line, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;">${idx === 0 ? code : ''}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${idx === 0 ? name : ''}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #059669;">${line.spaceName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #1e293b;">${line.qty}</td>
        </tr>
      `).join('');
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden de Despacho ${order.code}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .brand { font-size: 22px; font-weight: bold; color: #2563eb; letter-spacing: -0.5px; }
            .doc-title { font-size: 16px; font-weight: bold; margin-top: 4px; color: #0f172a; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 25px; font-size: 13px; border: 1px solid #e2e8f0; }
            .meta-item { margin-bottom: 6px; }
            .meta-label { color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .meta-value { font-weight: 600; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
            th { background: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            th.center { text-align: center; }
            .notes { bg-color: #fffbe0; background: #fffbe0; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; font-size: 12px; color: #854d0e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">SUPREPARTS</div>
              <div class="doc-title">ORDEN DE DESPACHO</div>
            </div>
            <div style="text-align: right; font-size: 13px;">
              <div style="font-family: monospace; font-weight: bold; font-size: 18px; color: #2563eb;">${order.code}</div>
              <div style="color: #64748b; margin-top: 4px;">Fecha: ${date}</div>
              <div style="margin-top: 4px;">Estado: <strong>${order.status}</strong></div>
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <div class="meta-item"><span class="meta-label">Cliente:</span> <span class="meta-value">${order.clientName}</span></div>
              <div class="meta-item"><span class="meta-label">Quien Solicita:</span> <span class="meta-value">${order.requestedBy}</span></div>
            </div>
            <div>
              <div class="meta-item"><span class="meta-label">Almacén:</span> <span class="meta-value">${warehouse}</span></div>
              <div class="meta-item"><span class="meta-label">Tipo de Entrega:</span> <span class="meta-value">${order.deliveryType}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Espacio Almacén</th>
                <th class="center">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          ${order.notes ? `<div class="notes"><strong>Notas / Observaciones:</strong><br/>${order.notes}</div>` : ''}

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera modal */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Previsualización de Impresión</h3>
              <p className="text-xs text-slate-300">Orden de Despacho <span className="font-mono text-blue-300 font-bold">{order.code}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleNativePrint}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border-0"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PDF
            </Button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo modal */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-5 bg-white">
          <div className="border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 bg-white">
            {/* Header del documento previsualizado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h4 className="text-xl font-bold text-blue-600 tracking-tight">SUPREPARTS</h4>
                <p className="text-sm font-bold text-slate-700 mt-0.5">ORDEN DE DESPACHO</p>
              </div>
              <div className="text-left sm:text-right">
                <span className="font-mono text-xl font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 inline-block">
                  {order.code}
                </span>
                <p className="text-xs text-slate-500 mt-1 font-medium">Fecha: {date}</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Rejilla de metadatos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Cliente</span>
                <span className="font-semibold text-slate-800">{order.clientName}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Quien Solicita</span>
                <span className="font-semibold text-slate-800">{order.requestedBy}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Almacén</span>
                <span className="font-semibold text-slate-800">{warehouse}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Tipo Entrega</span>
                <span className="font-semibold text-slate-800">{order.deliveryType}</span>
              </div>
            </div>

            {/* Tabla de ítems */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-blue-600 text-white font-bold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-4 py-2.5">Espacio Almacén</th>
                    <th className="px-4 py-2.5 text-center">Cant. Tomada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.flatMap(it => {
                    const isManual  = it.productId.startsWith('manual-');
                    const p         = isManual ? null : getProduct(it.productId);
                    const code      = isManual ? 'MANUAL' : (p?.code ?? it.productId);
                    const name      = isManual ? (it.notes ?? '-') : (p?.name ?? '-');
                    const lines     = getItemSpaceLines(it);
                    return lines.map((line, idx) => (
                      <tr key={`${it.id}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{idx === 0 ? code : ''}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{idx === 0 ? name : ''}</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-700">{line.spaceName}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-900 text-sm">
                          {line.qty}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            {/* Notas finales */}
            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <strong className="block text-amber-800 font-bold mb-0.5">Notas / Observaciones:</strong>
                <p>{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
