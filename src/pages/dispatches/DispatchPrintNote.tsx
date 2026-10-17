/**
 * DispatchPrintNote.tsx
 * Sub-módulo: Impresión Nota Personalizada – Orden Despacho
 * Editor completo de Nota de Entrega con PDF personalizable e Historial de Notas Creadas.
 */
import React, { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle, ArrowLeft, Calendar, CheckCircle2, Clock, Download, Edit2,
  FileText, History, Plus, Search, Trash2, Truck,
} from 'lucide-react';
import { useDispatches } from '../../features/dispatches/hooks/useDispatches';
import { DispatchOrder, DispatchOrderStatus } from '../../types';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface NoteLineItem {
  id:       string;
  code:     string;
  name:     string;
  category: string;
  quantity: number;
  price:    number;
}
interface NoteEditorData {
  order:          DispatchOrder;
  companyName:    string;
  companyRif:     string;
  companyAddress: string;
  clientName:     string;
  clientRif:      string;
  clientAddress:  string;
  clientPhone:    string;
  lines:          NoteLineItem[];
  footerNotes:    string;
}

export interface SavedCustomNote {
  id:         string;
  orderId:    string;
  orderCode:  string;
  clientName: string;
  createdAt:  string; // ISO string
  total:      number;
  data:       NoteEditorData;
}

const LS_SAVED_NOTES_KEY = 'wms_custom_delivery_notes_v1';

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
const DispatchPrintNote: React.FC = () => {
  const location = useLocation();
  const { dispatches, isLoading, getProduct, getCategoryName } = useDispatches();

  const preselectedId: string | undefined = (location.state as any)?.orderId;
  const [selected,    setSelected]    = useState<DispatchOrder | null>(
    preselectedId ? (dispatches.find(d => d.id === preselectedId) ?? null) : null,
  );
  const [noteEditor,   setNoteEditor]   = useState<NoteEditorData | null>(null);
  const [activeTab,    setActiveTab]    = useState<'new' | 'history'>('new');
  const [query,        setQuery]        = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [generating,   setGenerating]   = useState(false);

  // ── Historial en LocalStorage ─────────────────────────────────────────────
  const [savedNotes, setSavedNotes] = useState<SavedCustomNote[]>(() => {
    try {
      const raw = localStorage.getItem(LS_SAVED_NOTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveNoteToHistory = useCallback((data: NoteEditorData) => {
    const total = data.lines.reduce((sum, ln) => sum + (Number(ln.price) || 0) * (Number(ln.quantity) || 0), 0);
    const newNote: SavedCustomNote = {
      id: uuidv4(),
      orderId: data.order.id,
      orderCode: data.order.code,
      clientName: data.clientName,
      createdAt: new Date().toISOString(),
      total,
      data,
    };
    setSavedNotes(prev => {
      const next = [newNote, ...prev];
      try {
        localStorage.setItem(LS_SAVED_NOTES_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Error al guardar nota personalizada:', e);
      }
      return next;
    });
  }, []);

  const deleteSavedNote = useCallback((id: string) => {
    if (!window.confirm('¿Eliminar esta nota del historial?')) return;
    setSavedNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      try {
        localStorage.setItem(LS_SAVED_NOTES_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Error al eliminar nota:', e);
      }
      return next;
    });
  }, []);

  // ── Filtro de órdenes disponibles ─────────────────────────────────────────
  const filteredDispatches = dispatches.filter(d => {
    if (!query) return true;
    const lower = query.toLowerCase();
    return d.code.toLowerCase().includes(lower) ||
           d.clientName.toLowerCase().includes(lower) ||
           d.requestedBy.toLowerCase().includes(lower);
  });

  // ── Filtro del historial ──────────────────────────────────────────────────
  const filteredHistory = savedNotes.filter(n => {
    if (!historyQuery) return true;
    const lower = historyQuery.toLowerCase();
    return n.orderCode.toLowerCase().includes(lower) ||
           n.clientName.toLowerCase().includes(lower) ||
           (n.data.companyName && n.data.companyName.toLowerCase().includes(lower));
  });

  // ── Helper para extraer el precio numérico de un producto ─────────────────
  const getProductPrice = useCallback((p: any): number => {
    if (!p || p.prices == null) return 0;
    if (Array.isArray(p.prices)) {
      const first = p.prices[0];
      if (typeof first === 'object' && first !== null) {
        return Number(first.price ?? first.value ?? 0) || 0;
      }
      return Number(first) || 0;
    }
    if (typeof p.prices === 'object') {
      const vals = Object.values(p.prices);
      if (vals.length > 0) {
        const first = vals[0] as any;
        if (typeof first === 'object' && first !== null) {
          return Number(first.price ?? first.value ?? 0) || 0;
        }
        return Number(first) || 0;
      }
    }
    return Number(p.prices) || 0;
  }, []);

  // ── Abrir editor para una orden ───────────────────────────────────────────
  const openEditor = useCallback((order: DispatchOrder) => {
    const lines: NoteLineItem[] = order.items.map(it => {
      const isManual = it.productId.startsWith('manual-');
      const p        = isManual ? null : getProduct(it.productId);
      return {
        id:       it.id,
        code:     p?.code ?? (it.notes ?? it.productId),
        name:     p?.name ?? (it.notes ?? '-'),
        category: isManual ? '-' : getCategoryName(p?.categoryId ?? ''),
        quantity: Number(it.quantityRequired) || 0,
        price:    getProductPrice(p),
      };
    });
    setNoteEditor({
      order,
      companyName:    'SUPREPARTS',
      companyRif:     'J-23432123',
      companyAddress: 'LA COROMOTO',
      clientName:     order.clientName,
      clientRif:      '',
      clientAddress:  '',
      clientPhone:    '',
      lines,
      footerNotes:    order.notes ?? '',
    });
  }, [getProduct, getCategoryName, getProductPrice]);

  // ── Generador PDF base ─────────────────────────────────────────────────────
  const generatePdfDoc = (data: NoteEditorData) => {
    const doc   = new jsPDF();
    const order = data.order;
    const rawDate = order?.createdAt ? new Date(order.createdAt) : new Date();
    const dateStr = !isNaN(rawDate.getTime()) ? format(rawDate, 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');

    // Empresa
    doc.setFontSize(16); doc.setTextColor(37, 99, 235);
    doc.text(data.companyName || 'SUPREPARTS', 14, 18);
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text(`RIF: ${data.companyRif || '—'}`,    14, 24);
    doc.text(`DIR: ${data.companyAddress || '—'}`, 14, 29);

    // Cliente
    doc.setFontSize(9); doc.setTextColor(0);
    doc.text(`Cliente:      ${data.clientName || '—'}`,     120, 18);
    doc.text(`RIF:          ${data.clientRif || '—'}`,    120, 23);
    doc.text(`Dirección:    ${data.clientAddress || '—'}`, 120, 28);
    doc.text(`Teléfono:     ${data.clientPhone || '—'}`,   120, 33);
    doc.text(`Orden:        ${order?.code || '—'}`,        14, 35);
    doc.text(`Tipo entrega: ${order?.deliveryType || '—'}`, 14, 40);
    doc.text(`Fecha:        ${dateStr}`,                  14, 45);

    doc.setDrawColor(200);
    doc.line(14, 49, 196, 49);

    let total = 0;
    const runAutoTable = typeof autoTable === 'function'
      ? autoTable
      : ((autoTable as any)?.default || (doc as any).autoTable);

    if (typeof runAutoTable === 'function') {
      runAutoTable(doc, {
        startY: 53,
        head: [['CÓDIGO', 'DESCRIPCIÓN', 'CATEGORÍA', 'CANT.', 'PRECIO', 'TOTAL']],
        body: (data.lines || []).map(ln => {
          const qty = Number(ln.quantity) || 0;
          const price = Number(ln.price) || 0;
          const sub = price * qty;
          total += sub;
          return [ln.code || '-', ln.name || '-', ln.category || '-', String(qty), `$${price.toFixed(2)}`, `$${sub.toFixed(2)}`];
        }),
        headStyles:  { fillColor: [37, 99, 235], textColor: 255 },
        styles:      { fontSize: 9, cellPadding: 3 },
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      });
    }

    const y = (doc as any).lastAutoTable?.finalY ?? 150;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: $${total.toFixed(2)}`, 150, y + 10);

    if (data.footerNotes && data.footerNotes.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8); doc.setTextColor(100);
      doc.text('OBSERVACIONES:', 14, y + 20);
      doc.text(data.footerNotes, 14, y + 26, { maxWidth: 170 });
    }

    return doc;
  };

  // ── Imprimir y guardar nota nueva ─────────────────────────────────────────
  const printNote = useCallback((data: NoteEditorData) => {
    setGenerating(true);
    try {
      const doc = generatePdfDoc(data);
      doc.save(`NotaEntrega_${data.order?.code || 'Orden'}.pdf`);

      // Guardar automáticamente en el historial
      saveNoteToHistory(data);
      alert('Nota de entrega personalizada generada y guardada con éxito.');
    } catch (e: any) {
      console.error('[DispatchPrintNote] Error al generar PDF:', e);
      alert(`Error al generar el PDF de la nota de entrega: ${e?.message || 'Error desconocido'}`);
    } finally {
      setGenerating(false);
    }
  }, [saveNoteToHistory]);

  // ── Volver a descargar una nota existente ─────────────────────────────────
  const redownloadSavedNote = useCallback((note: SavedCustomNote) => {
    try {
      const doc = generatePdfDoc(note.data);
      doc.save(`NotaEntrega_${note.orderCode || 'Orden'}.pdf`);
    } catch (e: any) {
      console.error('[DispatchPrintNote] Error al volver a generar PDF:', e);
      alert(`Error al volver a generar el PDF de la nota: ${e?.message || 'Error desconocido'}`);
    }
  }, []);

  // ── Helpers de edición del editor ─────────────────────────────────────────
  const setField = <K extends keyof NoteEditorData>(key: K, value: NoteEditorData[K]) =>
    setNoteEditor(prev => prev ? { ...prev, [key]: value } : prev);

  const updateLine = (id: string, field: keyof NoteLineItem, val: string | number) =>
    setNoteEditor(prev =>
      prev ? { ...prev, lines: prev.lines.map(ln => ln.id === id ? { ...ln, [field]: val } : ln) } : prev,
    );

  const removeLine = (id: string) =>
    setNoteEditor(prev => prev ? { ...prev, lines: prev.lines.filter(ln => ln.id !== id) } : prev);

  const addLine = () =>
    setNoteEditor(prev =>
      prev ? {
        ...prev,
        lines: [...prev.lines, { id: uuidv4(), code: '', name: 'Producto manual', category: '-', quantity: 1, price: 0 }],
      } : prev,
    );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const grandTotal = noteEditor?.lines.reduce((sum, ln) => sum + (Number(ln.price) || 0) * (Number(ln.quantity) || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Encabezado ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-rose-100 p-2.5 rounded-xl">
            <FileText className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Impresión Nota Personalizada</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Crea notas de entrega personalizadas y descarga copias del historial en cualquier momento.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs de Navegación ───────────────────────────────────────── */}
      {!noteEditor && (
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
              activeTab === 'new'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            Crear Nueva Nota
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Notas Creadas
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
              {savedNotes.length}
            </span>
          </button>
        </div>
      )}

      {/* ── Pestaña 1: Crear Nueva Nota (Selector + Preview) ────────── */}
      {!noteEditor && activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selector de Orden */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Seleccionar Orden</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por código o cliente…"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {filteredDispatches.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">Sin órdenes disponibles</p>
                ) : filteredDispatches.map(order => (
                  <button
                    key={order.id}
                    onClick={() => setSelected(order)}
                    className={[
                      'w-full text-left p-3 rounded-xl border transition-all',
                      selected?.id === order.id
                        ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-300'
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

          {/* Preview / CTA */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                </div>
                <div>
                  <p className="font-semibold text-slate-600">Selecciona una orden</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Luego haz clic en <strong>"Abrir Editor"</strong> para personalizar la nota.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Cabecera preview */}
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-rose-200 text-xs font-semibold uppercase tracking-wider">NOTA DE ENTREGA</p>
                      <h3 className="text-2xl font-bold font-mono mt-1">{selected.code}</h3>
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Cliente',         value: selected.clientName  },
                      { label: 'Tipo de Entrega', value: selected.deliveryType },
                      { label: 'Quien Solicita',  value: selected.requestedBy },
                      { label: 'Fecha',           value: format(new Date(selected.createdAt), 'dd/MM/yyyy') },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="block text-[11px] font-bold text-slate-400 uppercase mb-0.5">{label}</span>
                        <span className="font-semibold text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                    <strong className="text-rose-700">Nota:</strong> Al abrir el editor podrás personalizar los datos de empresa, cliente, precios de productos y agregar observaciones antes de generar el PDF.
                  </p>
                  <button
                    onClick={() => openEditor(selected)}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    Abrir Editor de Nota Personalizada
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pestaña 2: Historial de Notas Creadas ────────────────────── */}
      {!noteEditor && activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historyQuery}
                onChange={e => setHistoryQuery(e.target.value)}
                placeholder="Buscar en el historial por código, cliente o empresa…"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">
              Total notas creadas: {filteredHistory.length}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-16 px-4">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">Sin notas creadas aún</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                  Las notas personalizadas que generes en el editor aparecerán en esta lista con su fecha de creación para que puedas volver a descargarlas cuando lo necesites.
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear primera nota
                </button>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase">Fecha y Hora</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase">Código Orden</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase">Empresa Remitente</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-700 uppercase">Total ($)</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-700 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map(note => (
                    <tr key={note.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {format(new Date(note.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">
                        {note.orderCode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {note.clientName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {note.data.companyName || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        ${(Number(note.total) || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => redownloadSavedNote(note)}
                            title="Volver a Descargar PDF"
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Descargar PDF
                          </button>
                          <button
                            onClick={() => {
                              setNoteEditor(note.data);
                            }}
                            title="Ver / Re-editar Nota"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteSavedNote(note.id)}
                            title="Eliminar del Historial"
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Editor de Nota Personalizada ───────────────────────────── */}
      {noteEditor && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header del editor */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="bg-rose-100 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Editando Nota de Entrega</h3>
                <p className="text-xs text-slate-500">
                  Orden {noteEditor.order.code} · Ajusta los datos y genera el PDF
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNoteEditor(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={() => printNote(noteEditor)}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {generating ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Generando…</>
                ) : (
                  <><Download className="w-4 h-4" /> Generar y Guardar PDF</>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* ── Empresa y Cliente ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Empresa */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center text-blue-600 text-[10px] font-bold">E</span>
                  Datos de la Empresa
                </h4>
                {[
                  { label: 'Nombre Empresa', key: 'companyName'    as const, ph: 'SUPREPARTS'  },
                  { label: 'RIF',            key: 'companyRif'     as const, ph: 'J-00000000'  },
                  { label: 'Dirección',      key: 'companyAddress' as const, ph: 'Ubicación…'  },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={noteEditor[key]}
                      onChange={e => setField(key, e.target.value)}
                      placeholder={ph}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Cliente */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center text-emerald-600 text-[10px] font-bold">C</span>
                  Datos del Cliente
                </h4>
                {[
                  { label: 'Nombre',    key: 'clientName'    as const, ph: 'Nombre completo' },
                  { label: 'RIF / CI',  key: 'clientRif'     as const, ph: 'V-00000000'      },
                  { label: 'Dirección', key: 'clientAddress' as const, ph: 'Calle, sector…'  },
                  { label: 'Teléfono', key: 'clientPhone'   as const, ph: '0412-0000000'    },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={noteEditor[key]}
                      onChange={e => setField(key, e.target.value)}
                      placeholder={ph}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tabla de productos editables ───────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Productos</h4>
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar línea
                </button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-700 uppercase">Código</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700 uppercase">Descripción</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700 uppercase">Categoría</th>
                      <th className="px-3 py-2 text-center font-bold text-slate-700 uppercase">Cant.</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-700 uppercase">Precio ($)</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-700 uppercase">Total ($)</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {noteEditor.lines.map(ln => (
                      <tr key={ln.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-600">{ln.code}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={ln.name}
                            onChange={e => updateLine(ln.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-transparent hover:border-slate-200 rounded-lg focus:border-rose-400 focus:ring-1 focus:ring-rose-300 focus:outline-none text-xs font-medium text-slate-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-600">{ln.category}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min={1} value={ln.quantity}
                            onChange={e => updateLine(ln.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 text-center px-2 py-1 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-300 focus:outline-none font-bold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min={0} step={0.01} value={ln.price}
                            onChange={e => updateLine(ln.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right px-2 py-1 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-300 focus:outline-none font-bold"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                          ${((Number(ln.price) || 0) * (Number(ln.quantity) || 0)).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => removeLine(ln.id)}
                            className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {noteEditor.lines.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                          Sin productos. Todos fueron eliminados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right font-bold text-slate-700 uppercase text-xs">
                        Total General
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700 text-sm">
                        ${(Number(grandTotal) || 0).toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── Observaciones ──────────────────────────────────── */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Observaciones / Notas finales
              </label>
              <textarea
                value={noteEditor.footerNotes}
                onChange={e => setField('footerNotes', e.target.value)}
                rows={3}
                placeholder="Condiciones de pago, instrucciones de entrega, observaciones adicionales…"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-rose-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchPrintNote;