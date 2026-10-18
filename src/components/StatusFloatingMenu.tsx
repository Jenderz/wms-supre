import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Clock, FileText, CheckCircle2, Lock } from 'lucide-react';

export type GeneralStatus = 'DRAFT' | 'PENDING' | 'CONFORMED';

interface StatusFloatingMenuProps {
  status: GeneralStatus;
  onChange: (newStatus: GeneralStatus) => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  GeneralStatus,
  { label: string; bg: string; text: string; border: string; dot: string; icon: any }
> = {
  DRAFT: {
    label: 'Borrador',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
    icon: FileText,
  },
  PENDING: {
    label: 'Pendiente',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  CONFORMED: {
    label: 'Conformado',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
};

export const StatusFloatingMenu: React.FC<StatusFloatingMenuProps> = ({
  status,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  const current = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const isConformed = status === 'CONFORMED';
  const isInteractive = !disabled && !isConformed;

  const handleSelect = (newStatus: GeneralStatus) => {
    if (newStatus !== status) {
      onChange(newStatus);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        disabled={!isInteractive}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
          current.bg
        } ${current.text} ${current.border} ${
          isInteractive ? 'hover:shadow-sm cursor-pointer' : 'cursor-default opacity-90'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        <span>{current.label}</span>
        {isConformed ? (
          <Lock className="w-3 h-3 text-emerald-600 opacity-60 ml-0.5" />
        ) : isInteractive ? (
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        ) : null}
      </button>

      {isOpen && isInteractive && (
        <div className="absolute z-50 mt-1 right-0 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-100">
          {(['DRAFT', 'PENDING', 'CONFORMED'] as GeneralStatus[]).map(st => {
            const conf = STATUS_CONFIG[st];
            const Icon = conf.icon;
            const isSelected = st === status;

            return (
              <button
                key={st}
                type="button"
                onClick={() => handleSelect(st)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors ${
                  isSelected ? 'font-bold text-slate-900 bg-slate-50/80' : 'text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                  <span>{conf.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
