import React from 'react';
import { X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Escanear Código QR</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-black">
          <Scanner 
            onScan={(result) => {
              if (result && result.length > 0) {
                onScan(result[0].rawValue);
                onClose();
              }
            }}
            onError={(error) => console.error(error)}
          />
        </div>
        <p className="text-sm text-slate-500 mt-4 text-center">
          Apunta la cámara al código QR del producto
        </p>
      </div>
    </div>
  );
};
