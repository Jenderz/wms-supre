import React, { useState, useRef } from 'react';
import { usePurchasing } from '../../features/purchasing/hooks/usePurchasing';
import { Product } from '../../types';
import {
  QrCode,
  Barcode as BarcodeIcon,
  Search,
  Download,
  Printer,
  Scan,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { QRScannerModal, ScanType } from '../../components/QRScannerModal';
import { BarcodeDisplay } from '../../components/BarcodeDisplay';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

export const ProductBarcodeLabel: React.FC = () => {
  const { products } = usePurchasing();

  // Estados de Selección
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => products[0] || null);
  const [customName, setCustomName] = useState<string>('');
  const [customCode, setCustomCode] = useState<string>('');
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const labelRef = useRef<HTMLDivElement>(null);

  // Sincronizar campos al seleccionar producto
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCustomName(product.name);
    setCustomCode(product.code);
    setSearchTerm('');
  };

  // Escaneo para selección rápida
  const handleScan = (decodedText: string, _type: ScanType) => {
    const clean = decodedText.trim().toLowerCase();
    const matched = products.find(p =>
      p.code.toLowerCase() === clean ||
      p.id.toLowerCase() === clean ||
      p.name.toLowerCase().includes(clean)
    );
    if (matched) {
      handleSelectProduct(matched);
    } else {
      alert(`No se encontró producto con código: "${decodedText}"`);
    }
  };

  const displayName = customName || selectedProduct?.name || 'SET TOPE PUERTA TOYOTA';
  const displayCode = customCode || selectedProduct?.code || '110626-0001';

  // Descarga en JPG (60mm x 40mm a 300 DPI)
  const handleDownloadJPG = async () => {
    if (!labelRef.current) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 4, // 4x para alta definición
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const jpgUrl = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      const filename = `etiqueta_codigo_${displayCode}_60x40.jpg`;
      link.download = filename;
      link.href = jpgUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar JPG:', err);
      alert('Error al generar la imagen JPG de la etiqueta.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Descarga en PNG
  const handleDownloadPNG = async () => {
    if (!labelRef.current) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 4,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `etiqueta_codigo_${displayCode}_60x40.png`;
      link.href = pngUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar PNG:', err);
      alert('Error al generar la imagen PNG.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Impresión térmica directa
  const handlePrint = () => {
    if (!labelRef.current) return;

    const printWindow = window.open('', '_blank', 'width=600,height=500');
    if (!printWindow) {
      alert('Por favor permita las ventanas emergentes para imprimir.');
      return;
    }

    const labelHtml = labelRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Etiqueta Código (60x40mm)</title>
          <style>
            @page {
              size: 60mm 40mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            html, body {
              width: 60mm;
              height: 40mm;
              margin: 0;
              padding: 0;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            .print-wrapper {
              width: 58mm;
              height: 38mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              padding: 2mm;
              text-align: center;
              background: #fff;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${labelHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const filteredProducts = searchTerm
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600 text-white rounded-xl shadow-sm">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Etiqueta con Código de Barra / QR del Producto (60mm x 40mm)
            </h2>
            <p className="text-xs text-slate-600">
              Genera etiquetas térmicas con el nombre, código y código de barras lineal (CODE128) o código QR.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex bg-white text-violet-700 border-violet-300 font-mono text-xs">
          Formato: 60 x 40 mm (JPG / PNG / Térmico)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Columna Izquierda: Configuración y Selección (5 cols) ── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selector de Producto */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-600" />
                1. Seleccionar Producto
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-violet-700 border-violet-200 hover:bg-violet-50"
              >
                <Scan className="w-3.5 h-3.5 mr-1" />
                Escanear
              </Button>
            </div>

            <div className="relative">
              <Input
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm"
              />
              {searchTerm && filteredProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-violet-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-violet-700">{p.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{p.code}</p>
                      </div>
                      <QrCode className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Seleccionado</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white text-violet-700">
                    {selectedProduct.code}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-800">{selectedProduct.name}</p>
              </div>
            )}
          </div>

          {/* Tipo de Código y Textos */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-600" />
              2. Formato de Representación Visual
            </h3>

            {/* Alternador Código de Barras vs QR */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCodeType('barcode')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all font-medium text-xs ${
                  codeType === 'barcode'
                    ? 'border-violet-600 bg-violet-50 text-violet-900 font-bold shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BarcodeIcon className="w-4 h-4" />
                <span>Código de Barras</span>
              </button>

              <button
                type="button"
                onClick={() => setCodeType('qr')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all font-medium text-xs ${
                  codeType === 'qr'
                    ? 'border-violet-600 bg-violet-50 text-violet-900 font-bold shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Código QR</span>
              </button>
            </div>

            {/* Nombre del Producto */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre de Producto (Encabezado)
              </label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="SET TOPE PUERTA TOYOTA"
                className="font-bold text-xs uppercase bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Código del Producto */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Código del Producto (Sub-encabezado)
              </label>
              <Input
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="110626-0001"
                className="font-mono font-bold text-xs bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Botones de Exportación */}
            <div className="pt-2 space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadJPG}
                  disabled={isGenerating}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs py-2.5 shadow-sm"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Descargar JPG (60x40)
                </Button>
                <Button
                  onClick={handleDownloadPNG}
                  disabled={isGenerating}
                  variant="outline"
                  className="border-violet-200 text-violet-700 hover:bg-violet-50 text-xs py-2.5"
                >
                  PNG
                </Button>
              </div>

              <Button
                onClick={handlePrint}
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 text-xs py-2.5"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Térmica (60x40mm)
              </Button>
            </div>
          </div>
        </div>

        {/* ── Columna Derecha: Vista Previa 60x40mm (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[480px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-4 left-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Vista Previa 60mm x 40mm (Proporción 3:2)
              </span>
            </div>

            {/* Contenedor Visual Exacto de la Etiqueta Térmica 60x40mm */}
            <div className="my-8 flex items-center justify-center p-6 bg-slate-100/70 rounded-2xl border border-dashed border-slate-300 shadow-inner">
              <div
                ref={labelRef}
                id="barcode-label-badge"
                className="bg-white text-black p-4 flex flex-col items-center justify-between select-none shadow-2xl transition-all border border-slate-300"
                style={{
                  width: '360px',  // Proporción exacta 60mm
                  height: '240px', // Proporción exacta 40mm
                  boxSizing: 'border-box',
                }}
              >
                {/* 1. Nombre del Producto (Arriba, mayúsculas, centrado) */}
                <div className="w-full text-center">
                  <div className="border-b border-black pb-1.5 mb-1.5">
                    <p
                      className="font-black text-black leading-tight tracking-tight uppercase"
                      style={{
                        fontSize: displayName.length > 35 ? '13px' : displayName.length > 25 ? '15px' : '17px',
                        fontFamily: 'Arial, -apple-system, sans-serif'
                      }}
                    >
                      {displayName}
                    </p>
                  </div>

                  {/* 2. Código del Producto (Sub-encabezado con línea delimitadora) */}
                  <div className="border-b border-black pb-1 mb-2">
                    <p
                      className="font-mono font-bold text-black tracking-wider text-sm"
                      style={{ fontFamily: 'monospace, Arial' }}
                    >
                      {displayCode}
                    </p>
                  </div>
                </div>

                {/* 3. Zona Inferior: Código de Barras Lineal (CODE128) o Código QR */}
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden py-1">
                  {codeType === 'barcode' ? (
                    <div className="w-full flex items-center justify-center">
                      <BarcodeDisplay
                        value={displayCode}
                        width={310}
                        height={60}
                        displayValue={false}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-1 bg-white">
                      <QRCodeSVG
                        value={displayCode}
                        size={86}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Especificaciones Técnicas */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span>📏 <strong>Dimensiones:</strong> 60mm × 40mm</span>
              <span>🔲 <strong>Formato Activo:</strong> {codeType === 'barcode' ? 'CODE128 Lineal' : 'QR Code 2D'}</span>
              <span>⚡ <strong>300 DPI:</strong> Alta Legibilidad Óptica</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Escaneo */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        title="Escanear para Seleccionar Producto"
      />
    </div>
  );
};

export default ProductBarcodeLabel;
