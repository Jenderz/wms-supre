import React, { useState, useRef, useEffect } from 'react';
import { SpaceDistributionItem } from '../types';
import { MapPin, Check, AlertCircle, ChevronDown, X } from 'lucide-react';

export interface SpaceOption {
  id: string;
  name: string;
  spaceUsageType?: string;
  stockQty?: number;
}

interface SpaceDistributionPopoverProps {
  spaces: SpaceOption[];
  targetQuantity: number;
  value: SpaceDistributionItem[];
  onChange: (items: SpaceDistributionItem[]) => void;
  disabled?: boolean;
  label?: string;
}

export const SpaceDistributionPopover: React.FC<SpaceDistributionPopoverProps> = ({
  spaces,
  targetQuantity,
  value,
  onChange,
  disabled = false,
  label = 'Espacio Almacén',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const totalAssigned = value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const isComplete = Math.abs(totalAssigned - targetQuantity) < 0.0001 && targetQuantity > 0;
  const isOver = totalAssigned > targetQuantity;

  const handleQtyChange = (spaceId: string, spaceName: string, qtyStr: string) => {
    const qty = parseFloat(qtyStr) || 0;
    const existingIndex = value.findIndex(item => item.warehouseSpaceId === spaceId);

    let next = [...value];
    if (qty <= 0) {
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex >= 0) {
        next[existingIndex] = { warehouseSpaceId: spaceId, spaceName, quantity: qty };
      } else {
        next.push({ warehouseSpaceId: spaceId, spaceName, quantity: qty });
      }
    }
    onChange(next);
  };

  const getSpaceQty = (spaceId: string): number | '' => {
    const item = value.find(i => i.warehouseSpaceId === spaceId);
    return item && item.quantity > 0 ? item.quantity : '';
  };

  // Texto resumido para el trigger
  const summaryText = () => {
    if (value.length === 0) return 'Sin asignar';
    if (value.length === 1) return `${value[0].spaceName} (${value[0].quantity} u.)`;
    return `${value.length} espacios (${totalAssigned} u.)`;
  };

  return (
    <div className="relative inline-block text-left w-full" ref={popoverRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isComplete
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:border-emerald-400'
            : isOver
            ? 'bg-red-50 text-red-800 border-red-300 hover:border-red-400'
            : totalAssigned > 0
            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400'
            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          <span className="truncate">{summaryText()}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {targetQuantity > 0 && (
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-md font-semibold ${
                isComplete
                  ? 'bg-emerald-200/70 text-emerald-900'
                  : isOver
                  ? 'bg-red-200/70 text-red-900'
                  : 'bg-slate-200/70 text-slate-700'
              }`}
            >
              {totalAssigned}/{targetQuantity}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 right-0 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{label}</h4>
              <p className="text-[11px] text-slate-500">Distribución de unidades por espacio</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {spaces.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No hay espacios disponibles en este almacén
              </div>
            ) : (
              spaces.map(sp => {
                const assigned = getSpaceQty(sp.id);
                const isDispatch = sp.spaceUsageType === 'Despachos';

                return (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800 truncate">{sp.name}</span>
                        {isDispatch && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800">
                            DESPACHO
                          </span>
                        )}
                      </div>
                      {sp.stockQty !== undefined && (
                        <div className="text-[10px] text-slate-500">Stock: {sp.stockQty} u.</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] text-slate-500">Asignar:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={assigned}
                        onChange={e => handleQtyChange(sp.id, sp.name, e.target.value)}
                        placeholder="0"
                        className="w-16 px-2 py-1 text-xs text-right font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {isComplete ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : isOver ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
              <span className={`font-semibold ${isComplete ? 'text-emerald-700' : isOver ? 'text-red-700' : 'text-slate-700'}`}>
                {totalAssigned} de {targetQuantity} u.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
