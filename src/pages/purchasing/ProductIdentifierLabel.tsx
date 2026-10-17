import React, { useState, useRef } from 'react';
import { usePurchasing } from '../../features/purchasing/hooks/usePurchasing';
import { Product } from '../../types';
import {
  Tag,
  Search,
  Download,
  Printer,
  Scan,
  RefreshCw,
  Sliders,
  CheckCircle,
  Copy,
  Info,
  Package
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { QRScannerModal, ScanType } from '../../components/QRScannerModal';
import html2canvas from 'html2canvas';

export const ProductIdentifierLabel: React.FC = () => {
  const { products, getCategory } = usePurchasing();

  // Estados de Selección y Edición Libre
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => products[0] || null);
  const [customQuantity, setCustomQuantity] = useState<string>('30');
  const [customCategoryCode, setCustomCategoryCode] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const labelRef = useRef<HTMLDivElement>(null);

  // Al seleccionar producto, sincronizar campos iniciales
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    const cat = getCategory(product.categoryId);
    setCustomCategoryCode(cat?.code || '-');
    setCustomName(product.name);
    setSearchTerm('');
  };

  // Escaneo de código de barra o QR para seleccionar producto
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

  // Nombre y Categoría efectivos
  const currentCategory = selectedProduct ? getCategory(selectedProduct.categoryId) : null;
  const displayName = customName || selectedProduct?.name || 'NOMBRE DEL PRODUCTO';
  const displayCategory = customCategoryCode || currentCategory?.code || 'B';
  const displayQuantity = customQuantity || '0';

  // Descarga en formato JPG (60mm x 40mm a alta resolución 300 DPI)
  const handleDownloadJPG = async () => {
    if (!labelRef.current) return;
    setIsGenerating(true);

    try {
      // Dimensiones de 60mm x 40mm a 300 DPI = 708 x 472 px aprox
      const canvas = await html2canvas(labelRef.current, {
        scale: 4, // 4x para máxima nitidez térmica
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const jpgUrl = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      const filename = selectedProduct
        ? `etiqueta_${selectedProduct.code}_60x40.jpg`
        : 'etiqueta_identificadora_60x40.jpg';
      link.download = filename;
      link.href = jpgUrl;
      link.click();
    } catch (err) {
      console.error('Error al generar JPG:', err);
      alert('Error al generar la imagen JPG de la etiqueta.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Impresión directa calibrada a 60mm x 40mm
  const handlePrint = () => {
    if (!labelRef.current) return;

    const printWindow = window.open('', '_blank', 'width=600,height=500');
    if (!printWindow) {
      alert('Por favor permita las ventanas emergentes para imprimir la etiqueta.');
      return;
    }

    const labelHtml = labelRef.current.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Etiqueta Identificadora (60x40mm)</title>
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
            .label-container {
              width: 58mm;
              height: 38mm;
              border: 2.5px solid #000;
              display: flex;
              flex-direction: column;
              background: #fff;
            }
            .top-box {
              flex: 1.6;
              border-bottom: 2.5px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 3px 6px;
              font-weight: 900;
              font-size: 14pt;
              line-height: 1.15;
              text-transform: uppercase;
              word-break: break-word;
            }
            .bottom-row {
              flex: 1;
              display: flex;
              width: 100%;
            }
            .bottom-left {
              flex: 1;
              border-right: 2.5px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 20pt;
              text-transform: uppercase;
            }
            .bottom-right {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 20pt;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="top-box">${displayName}</div>
            <div class="bottom-row">
              <div class="bottom-left">${displayCategory}</div>
              <div class="bottom-right">${displayQuantity}</div>
            </div>
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
      {/* ── Barra Superior Informativa ── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Etiqueta Identificadora de Producto (60mm x 40mm)
            </h2>
            <p className="text-xs text-slate-600">
              Genera e imprime etiquetas térmicas estándar con el nombre del producto, código de categoría y cantidad libre.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex bg-white text-amber-700 border-amber-300 font-mono text-xs">
          Formato: 60 x 40 mm (JPG / Térmico)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Columna Izquierda: Panel de Control y Configuración (5 cols) ── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selector de Producto */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-600" />
                1. Seleccionar Producto Registrado
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsScannerOpen(true)}
                className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <Scan className="w-3.5 h-3.5 mr-1" />
                Escanear
              </Button>
            </div>

            <div className="relative">
              <Input
                placeholder="Buscar por código o nombre de producto..."
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
                      className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-amber-700">{p.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{p.code}</p>
                      </div>
                      <Tag className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Producto Actual</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white">
                    {selectedProduct.code}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-800">{selectedProduct.name}</p>
                <p className="text-xs text-slate-500">
                  Categoría Sistema: <strong className="text-slate-700">{currentCategory?.name || '-'} ({currentCategory?.code || '-'})</strong>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay producto seleccionado. Selecciona uno del listado.</p>
            )}
          </div>

          {/* Ajuste de Campos Libres */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600" />
              2. Parámetros de la Etiqueta
            </h3>

            {/* Nombre del Producto (Editable/multilínea) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre del Producto (Caja Superior)
              </label>
              <textarea
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nombre para la etiqueta..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <span className="text-[10px] text-slate-400">
                Se ajusta automáticamente en mayúsculas centradas.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Código de Categoría */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cat. (Lado Izq.)
                </label>
                <Input
                  value={customCategoryCode}
                  onChange={(e) => setCustomCategoryCode(e.target.value)}
                  placeholder="Ej: B, A..."
                  className="text-center font-bold text-sm uppercase bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Cantidad Libre */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cantidad (Lado Der.) <span className="text-amber-600">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  placeholder="30"
                  className="text-center font-bold text-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Button
                onClick={handleDownloadJPG}
                disabled={isGenerating}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs py-2.5 shadow-sm"
              >
                <Download className="w-4 h-4 mr-1.5" />
                {isGenerating ? 'Generando JPG...' : 'Descargar JPG (60x40mm)'}
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 text-xs py-2.5"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Térmica
              </Button>
            </div>
          </div>
        </div>

        {/* ── Columna Derecha: Previsualizador Térmico a Escala Real (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[480px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-4 left-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Vista Previa 60mm x 40mm (Proporción 3:2)
              </span>
            </div>

            {/* Contenedor Visual de la Etiqueta 60x40mm */}
            <div className="my-8 flex items-center justify-center p-4 bg-slate-100/70 rounded-2xl border border-dashed border-slate-300 shadow-inner">
              <div
                ref={labelRef}
                id="identifier-label-badge"
                className="bg-white text-black border-[3px] border-black flex flex-col select-none shadow-2xl transition-all"
                style={{
                  width: '360px',  // Proporción exacta 60mm (360px a pantalla)
                  height: '240px', // Proporción exacta 40mm (240px a pantalla)
                  boxSizing: 'border-box',
                }}
              >
                {/* Caja Superior: Nombre del Producto (~62% alto) */}
                <div
                  className="flex-1 flex items-center justify-center text-center p-3 border-b-[3px] border-black bg-white"
                  style={{ minHeight: '140px' }}
                >
                  <p
                    className="font-black text-black leading-tight tracking-tight uppercase"
                    style={{
                      fontSize: displayName.length > 30 ? '16px' : displayName.length > 20 ? '18px' : '22px',
                      wordBreak: 'break-word',
                      fontFamily: 'Arial, -apple-system, sans-serif'
                    }}
                  >
                    {displayName}
                  </p>
                </div>

                {/* Caja Inferior: Categoría (Izq) | Cantidad (Der) (~38% alto) */}
                <div className="h-[90px] flex divide-x-[3px] divide-black bg-white">
                  {/* Categoría */}
                  <div className="flex-1 flex items-center justify-center">
                    <span
                      className="font-black text-black uppercase"
                      style={{ fontSize: '32px', fontFamily: 'Arial, -apple-system, sans-serif' }}
                    >
                      {displayCategory}
                    </span>
                  </div>

                  {/* Cantidad */}
                  <div className="flex-1 flex items-center justify-center">
                    <span
                      className="font-black text-black font-mono"
                      style={{ fontSize: '34px', fontFamily: 'Arial, -apple-system, sans-serif' }}
                    >
                      {displayQuantity}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Especificaciones Técnicas */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span>📏 <strong>Medidas:</strong> 60mm × 40mm</span>
              <span>🖨️ <strong>Resolución:</strong> 300 DPI (708×472 px)</span>
              <span>🏷️ <strong>Compatible:</strong> Zebra, Xprinter, Niimbot, Dymo</span>
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

export default ProductIdentifierLabel;
