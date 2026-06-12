import React, { useState, useEffect, useRef } from 'react';
import { LockModule, LockAction } from '../types';
import { Lock, LockOpen, Eye, EyeOff, X, ShieldAlert } from 'lucide-react';

// Etiquetas legibles para módulos
const MODULE_LABELS: Record<string, string> = {
  CATALOG: 'Productos',
  CATEGORIES: 'Categorías',
  PROVIDERS: 'Proveedores',
  INFRASTRUCTURE: 'Infraestructura',
  PURCHASING: 'Abastecimiento',
  WAREHOUSE: 'Depósito',
  DISINCORPORATION: 'Desincorporación',
  USERS: 'Usuarios',
  SETTINGS: 'Configuración',
};

// Etiquetas legibles para acciones
const ACTION_LABELS: Record<string, string> = {
  DELETE: 'Eliminar',
  EDIT: 'Editar',
  CREATE: 'Crear',
  VIEW: 'Ver detalles de',
  IMPORT: 'Importar',
  EXPORT: 'Exportar',
  CONFORM: 'Conformar',
  APPROVE: 'Aprobar',
  ADJUST_STOCK: 'Ajustar Stock en',
  '*': 'acceder a',
};

interface LockModalProps {
  isOpen: boolean;
  module: LockModule;
  action: LockAction;
  onVerify: (key: string) => Promise<boolean>;
  onSuccess: () => void;
  onCancel: () => void;
}

type ModalState = 'idle' | 'loading' | 'error' | 'success';

export const LockModal: React.FC<LockModalProps> = ({
  isOpen,
  module,
  action,
  onVerify,
  onSuccess,
  onCancel,
}) => {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [state, setState] = useState<ModalState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setKey('');
      setShowKey(false);
      setState('idle');
      setErrorMsg('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setErrorMsg('Ingresa la llave de acceso.');
      setState('error');
      return;
    }

    setState('loading');
    setErrorMsg('');

    const ok = await onVerify(key.trim());

    if (ok) {
      setState('success');
      setTimeout(() => onSuccess(), 600);
    } else {
      setState('error');
      setErrorMsg('Llave incorrecta. Inténtalo de nuevo.');
      setKey('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  if (!isOpen) return null;

  const moduleLabel = MODULE_LABELS[module] ?? module;
  const actionLabel = ACTION_LABELS[action] ?? action;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div
        className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícono central animado */}
        <div className="flex flex-col items-center mb-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
              state === 'success'
                ? 'bg-green-100 text-green-600 scale-110'
                : state === 'error'
                ? 'bg-red-100 text-red-600 animate-[shake_0.4s_ease-in-out]'
                : 'bg-amber-100 text-amber-600'
            }`}
          >
            {state === 'success' ? (
              <LockOpen className="w-8 h-8" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 text-center">Acción Protegida</h2>
          <p className="text-sm text-slate-500 text-center mt-1">
            {action === 'VIEW' ? (
              <>
                Ingresa la llave para{' '}
                <span className="font-semibold text-slate-700">{actionLabel}</span>
                {' '}
                <span className="font-semibold text-slate-700">{moduleLabel}</span>
              </>
            ) : (
              <>
                Ingresa la llave para{' '}
                <span className="font-semibold text-slate-700">{actionLabel}</span>
                {' '}en{' '}
                <span className="font-semibold text-slate-700">{moduleLabel}</span>
              </>
            )}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                if (state === 'error') setState('idle');
              }}
              placeholder="Llave de acceso..."
              disabled={state === 'loading' || state === 'success'}
              className={`w-full pl-9 pr-10 py-3 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 ${
                state === 'error'
                  ? 'border-red-400 bg-red-50 focus:ring-red-300'
                  : state === 'success'
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-300 bg-white focus:ring-blue-300'
              }`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <p className="text-red-500 text-xs text-center font-medium animate-in fade-in">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={state === 'loading' || state === 'success'}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={state === 'loading' || state === 'success' || !key.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {state === 'loading' ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : state === 'success' ? (
                '✓ Verificado'
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Verificar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
