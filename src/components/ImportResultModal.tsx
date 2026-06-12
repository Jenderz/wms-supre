import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X, FileText } from 'lucide-react';

export interface ImportResultItem {
  type: 'success' | 'warning' | 'error';
  message: string;
}

export interface ImportResultData {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  items: ImportResultItem[];
}

interface ImportResultModalProps {
  isOpen: boolean;
  title: string;
  result: ImportResultData | null;
  onClose: () => void;
}

export const ImportResultModal: React.FC<ImportResultModalProps> = ({
  isOpen,
  title,
  result,
  onClose,
}) => {
  if (!isOpen || !result) return null;

  const hasErrors = result.errors > 0;
  const hasWarnings = result.items.some(i => i.type === 'warning');

  const overallStatus = hasErrors && result.created === 0 && result.updated === 0
    ? 'error'
    : hasErrors || hasWarnings
    ? 'warning'
    : 'success';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between ${
          overallStatus === 'success' ? 'bg-green-50 border-b border-green-100' :
          overallStatus === 'warning' ? 'bg-amber-50 border-b border-amber-100' :
          'bg-red-50 border-b border-red-100'
        }`}>
          <div className="flex items-center gap-3">
            {overallStatus === 'success' && <CheckCircle2 className="w-6 h-6 text-green-600" />}
            {overallStatus === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-600" />}
            {overallStatus === 'error' && <XCircle className="w-6 h-6 text-red-600" />}
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className={`text-xs font-medium mt-0.5 ${
                overallStatus === 'success' ? 'text-green-600' :
                overallStatus === 'warning' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {overallStatus === 'success' ? 'Importación completada' :
                 overallStatus === 'warning' ? 'Completado con advertencias' :
                 'Error en la importación'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
          {[
            { label: 'Total', value: result.total, color: 'text-slate-700' },
            { label: 'Creados', value: result.created, color: 'text-green-600' },
            { label: 'Actualizados', value: result.updated, color: 'text-blue-600' },
            { label: 'Errores', value: result.errors, color: result.errors > 0 ? 'text-red-600' : 'text-slate-400' },
          ].map((stat, i) => (
            <div key={i} className={`py-4 text-center ${i < 3 ? 'border-r border-slate-100' : ''}`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Lista de items */}
        {result.items.length > 0 && (
          <div className="max-h-52 overflow-y-auto px-6 py-4 space-y-2">
            {result.items.map((item, i) => (
              <div key={i} className={`flex items-start gap-2 text-sm ${
                item.type === 'success' ? 'text-green-700' :
                item.type === 'warning' ? 'text-amber-700' : 'text-red-700'
              }`}>
                {item.type === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                {item.type === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                {item.type === 'error' && <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
