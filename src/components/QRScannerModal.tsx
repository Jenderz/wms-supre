import React, { useState } from 'react';
import { X, QrCode, Barcode } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

export type ScanType = 'qr' | 'barcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback cuando se escanea un código. Recibe el valor y el tipo de escaneo. */
  onScan: (decodedText: string, type: ScanType) => void;
  /** Modo fijo: si se pasa, omite la pantalla de selección y escanea directamente */
  fixedMode?: ScanType;
  /** Título del modal (opcional) */
  title?: string;
}

/**
 * Modal unificado para escanear códigos QR o códigos de barras.
 * - Sin `fixedMode`: muestra pantalla de selección primero.
 * - Con `fixedMode`: abre directamente el escáner del tipo indicado.
 */
export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  fixedMode,
  title,
}) => {
  const [selectedType, setSelectedType] = useState<ScanType | null>(fixedMode ?? null);

  if (!isOpen) return null;

  const handleScan = (result: any[]) => {
    if (result && result.length > 0) {
      const value = result[0].rawValue;
      onScan(value, selectedType ?? 'qr');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedType(fixedMode ?? null);
    onClose();
  };

  const typeLabels: Record<ScanType, { label: string; hint: string; icon: React.ReactNode }> = {
    qr: {
      label: 'Código QR',
      hint: 'Apunta la cámara al código QR del producto',
      icon: <QrCode className="w-5 h-5" />,
    },
    barcode: {
      label: 'Código de Barras',
      hint: 'Apunta la cámara al código de barras del producto',
      icon: <Barcode className="w-5 h-5" />,
    },
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {title ?? (selectedType ? typeLabels[selectedType].label : 'Escanear Código')}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pantalla de selección */}
        {!selectedType && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 mb-4">
              ¿Qué tipo de código deseas escanear?
            </p>
            <button
              onClick={() => setSelectedType('qr')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                <QrCode className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">Código QR</p>
                <p className="text-xs text-slate-500 mt-0.5">Escanea el código QR cuadrado del producto</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('barcode')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50 transition-all group"
            >
              <div className="w-12 h-12 bg-violet-100 group-hover:bg-violet-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                <Barcode className="w-6 h-6 text-violet-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800 group-hover:text-violet-700">Código de Barras</p>
                <p className="text-xs text-slate-500 mt-0.5">Escanea el código de barras lineal del producto</p>
              </div>
            </button>
          </div>
        )}

        {/* Scanner activo */}
        {selectedType && (
          <>
            <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-black">
              <Scanner
                onScan={handleScan}
                onError={(error) => console.error('Scanner error:', error)}
              />
            </div>
            <p className="text-sm text-slate-500 mt-4 text-center flex items-center justify-center gap-2">
              {typeLabels[selectedType].icon}
              {typeLabels[selectedType].hint}
            </p>
            {/* Botón para volver a la selección si no hay fixedMode */}
            {!fixedMode && (
              <button
                onClick={() => setSelectedType(null)}
                className="w-full mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                ← Cambiar tipo de código
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
