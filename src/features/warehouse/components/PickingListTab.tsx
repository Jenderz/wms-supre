import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { PickingLot } from '../../../types';
import { Search, Package, CheckCircle2, Eye, Printer, ArrowLeft, Tag, ScanLine } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { QRScannerModal } from '../../../components/QRScannerModal';
import { useLockedAction } from '../../../hooks/useLockedAction';
import { LockModal } from '../../../components/LockModal';

interface PickingListTabProps {
  lots: PickingLot[];
  getStore: (id: string) => any;
  getUser: (id: string) => any;
  getProduct: (id: string) => any;
  getCategory: (id: string) => any;
  conformLot: (lotId: string, warehouseSpaces: Record<string, string>, userId: string) => Promise<void>;
  user: any;
  isLoading: boolean;
}

export const PickingListTab: React.FC<PickingListTabProps> = ({
  lots,
  getStore,
  getUser,
  getProduct,
  getCategory,
  conformLot,
  user,
  isLoading
}) => {
  const lockConform = useLockedAction('WAREHOUSE', 'CONFORM');

  const [selectedLot, setSelectedLot] = useState<PickingLot | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFORMED'>('ALL');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Label State
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [selectedLabelItemId, setSelectedLabelItemId] = useState<string>('');
  const [selectedPackageNumber, setSelectedPackageNumber] = useState<number>(1);
  const [selectedLabelFields, setSelectedLabelFields] = useState({
    lotNumber: true,
    productName: true,
    quantity: true,
    description: false,
    date: false,
    Warehouse: false,
    category: false,
    letter: false,
    code: false
  });

  const filteredLots = lots.filter(lot => {
    const matchesSearch = lot.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getStore(lot.warehouseId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || lot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleConform = async () => {
    if (!selectedLot || !user) return;
    
    if (window.confirm('¿Confirmar la recepción de este lote? Esto actualizará el stock y lo dejará pendiente por organizar.')) {
      await conformLot(selectedLot.id, {}, user.id);
      await new Promise(resolve => setTimeout(resolve, 100));
      setSelectedLot(null);
    }
  };

  const handlePrintPicking = () => {
    if (!selectedLot) return;
    
    const Warehouse = getStore(selectedLot.warehouseId);
    const creator = getUser(selectedLot.createdBy);
    
    const printContent = `
      <html>
        <head>
          <title>Picking - ${selectedLot.lotNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: 600; text-transform: uppercase; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Picking - ${selectedLot.lotNumber}</div>
            <div>Almac�n: ${Warehouse?.name}</div>
            <div>Creador: ${creator?.name}</div>
            <div>Fecha: ${format(new Date(selectedLot.createdAt), 'dd-MM-yy')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${selectedLot.items.map(item => {
                const product = getProduct(item.productId);
                return `
                  <tr>
                    <td>${product?.code}</td>
                    <td>${product?.name}</td>
                    <td>${item.quantityToEnter}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  const handleDownloadItemQR = async (productId: string, productCode: string) => {
    const element = document.getElementById(`qr-wrapper-${productId}`);
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 4,
      backgroundColor: '#ffffff',
      allowTaint: true,
      useCORS: true,
    });
    const data = canvas.toDataURL('image/jpeg', 1.0);
    const link = document.createElement('a');
    link.href = data;
    link.download = `QR-${selectedLot?.lotNumber}-${productCode}.jpg`;
    link.click();
  };

  const handleDownloadLabel = async () => {
    const element = document.getElementById('label-template');
    if (!element) return;

    // html2canvas no interpreta unidades CSS en 'mm' correctamente.
    // Creamos un clon con dimensiones fijas en px (50mm≈189px, 30mm≈113px @ 96dpi)
    // y lo renderizamos fuera de pantalla para no alterar el UI.
    const PX_PER_MM = 3.7795275591; // 96dpi
    const widthPx  = Math.round(50 * PX_PER_MM); // 189px
    const heightPx = Math.round(30 * PX_PER_MM); // 113px

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position   = 'fixed';
    clone.style.left       = '-9999px';
    clone.style.top        = '0';
    clone.style.width      = `${widthPx}px`;
    clone.style.height     = `${heightPx}px`;
    clone.style.padding    = '4px';
    clone.style.boxSizing  = 'border-box';
    clone.style.background = '#ffffff';
    clone.style.overflow   = 'hidden';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 6, // alta resolución para impresión
        backgroundColor: '#ffffff',
        allowTaint: true,
        useCORS: true,
        width: widthPx,
        height: heightPx,
      });
      const data = canvas.toDataURL('image/jpeg', 1.0);
      const link = document.createElement('a');
      link.href = data;
      link.download = `etiqueta-${selectedLot?.lotNumber}.jpg`;
      link.click();
    } finally {
      document.body.removeChild(clone);
    }
    setIsLabelModalOpen(false);
  };

  if (selectedLot) {
    const Warehouse = getStore(selectedLot.warehouseId);
    const creator = getUser(selectedLot.createdBy);
    const conformer = selectedLot.conformedBy ? getUser(selectedLot.conformedBy) : null;

    return (
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedLot(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Lote {selectedLot.lotNumber}
            </h1>
            <p className="text-slate-500 mt-1">
              Revisión y conformación de mercancía recibida.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={handlePrintPicking} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => {
              if (selectedLot.items.length > 0) {
                setSelectedLabelItemId(selectedLot.items[0].id);
                setSelectedPackageNumber(1);
              }
              setIsLabelModalOpen(true);
            }} className="gap-2">
              <Tag className="w-4 h-4" />
              Etiqueta de Bulto
            </Button>
            {selectedLot.status === 'PENDING' && (
              <Button onClick={() => lockConform.execute(handleConform)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20">
                <CheckCircle2 className="w-5 h-5" />
                Conformar Lote
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">Detalles del Lote</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Almac�n Destino:</span>
                <span className="font-medium text-slate-900">{Warehouse?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Creado por:</span>
                <span className="font-medium text-slate-900">{creator?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Creación:</span>
                <span className="font-medium text-slate-900">{format(new Date(selectedLot.createdAt), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estado:</span>
                <Badge variant={selectedLot.status === 'CONFORMED' ? 'success' : 'warning'}>
                  {selectedLot.status === 'PENDING' ? 'Pendiente' : 'Conformado'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm md:col-span-2">
            <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">Descripción / Notas</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{selectedLot.description || 'Sin descripción adicional.'}</p>
            
            {selectedLot.status === 'CONFORMED' && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">
                  Conformado por {conformer?.name} el {selectedLot.conformedAt ? format(new Date(selectedLot.conformedAt), 'dd/MM/yyyy HH:mm') : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Items Recibidos ({selectedLot.items.length})
          </h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-center">Bultos</TableHead>
                    <TableHead className="text-center">Pzas. por Bulto</TableHead>
                    <TableHead className="text-center">Total Piezas</TableHead>
                    <TableHead>Desc. Bulto</TableHead>
                    <TableHead className="text-center">QR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLot.items.map(item => {
                    const product = getProduct(item.productId);
                    const category = getCategory(product?.categoryId || '');
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-slate-500">{product?.code}</TableCell>
                        <TableCell className="font-medium text-slate-900">{product?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{category?.name || 'Sin Categoría'}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{item.numberOfPackages}</TableCell>
                        <TableCell className="text-center">
                          {/* Desglose de cantidades por bulto desde packagesConfig */}
                          {item.packagesConfig && item.packagesConfig.length > 0 ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              {item.packagesConfig.map((pkg, i) => (
                                <span key={i} className="text-xs font-mono text-slate-600">
                                  #{pkg.packageIndex ?? (i + 1)}: <strong>{pkg.quantity}</strong>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600">{item.quantityToEnter}</TableCell>
                        <TableCell className="text-sm text-slate-600 italic max-w-[120px]">
                          {item.packageDescription || <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="outline" size="sm" onClick={() => handleDownloadItemQR(item.productId, product?.code || '')} title="Descargar QR Individual" className="px-2">
                            <ScanLine className="w-4 h-4 text-blue-600" />
                          </Button>
                          <div className="absolute -left-[9999px]">
                            <div id={`qr-wrapper-${item.productId}`} className="bg-white p-6 inline-flex flex-col items-center justify-center border border-slate-200 rounded-xl">
                              <QRCodeSVG value={`${selectedLot.lotNumber}-${product?.code}`} size={200} level="M" />
                              <div className="text-center font-bold text-xl mt-4 font-mono text-slate-900">{selectedLot.lotNumber}-{product?.code}</div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {isLabelModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
              <h2 className="text-xl font-bold mb-4">Configurar Etiqueta (50x30mm)</h2>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Producto a Etiquetar</label>
                  <select 
                    value={selectedLabelItemId} 
                    onChange={(e) => {
                      setSelectedLabelItemId(e.target.value);
                      setSelectedPackageNumber(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {selectedLot.items.map(i => {
                      const p = getProduct(i.productId);
                      return <option key={i.id} value={i.id}>{p?.code} - {p?.name}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Número de Bulto</label>
                  <select
                    value={selectedPackageNumber}
                    onChange={(e) => setSelectedPackageNumber(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {Array.from({ length: selectedLot.items.find(i => i.id === selectedLabelItemId)?.numberOfPackages || 1 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Bulto {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2 mb-6 max-h-[150px] overflow-y-auto pr-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.lotNumber} onChange={() => setSelectedLabelFields({...selectedLabelFields, lotNumber: !selectedLabelFields.lotNumber})} />
                  Incluir Lote
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.code} onChange={() => setSelectedLabelFields({...selectedLabelFields, code: !selectedLabelFields.code})} />
                  Incluir Código
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.productName} onChange={() => setSelectedLabelFields({...selectedLabelFields, productName: !selectedLabelFields.productName})} />
                  Incluir Producto
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.category} onChange={() => setSelectedLabelFields({...selectedLabelFields, category: !selectedLabelFields.category})} />
                  Incluir Categoría
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.letter} onChange={() => setSelectedLabelFields({...selectedLabelFields, letter: !selectedLabelFields.letter})} />
                  Incluir Letra
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.quantity} onChange={() => setSelectedLabelFields({...selectedLabelFields, quantity: !selectedLabelFields.quantity})} />
                  Incluir Cantidad
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.description} onChange={() => setSelectedLabelFields({...selectedLabelFields, description: !selectedLabelFields.description})} />
                  Incluir Descripción
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.date} onChange={() => setSelectedLabelFields({...selectedLabelFields, date: !selectedLabelFields.date})} />
                  Incluir Fecha
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedLabelFields.Warehouse} onChange={() => setSelectedLabelFields({...selectedLabelFields, Warehouse: !selectedLabelFields.Warehouse})} />
                  Incluir Almac�n
                </label>
              </div>
              <div className="flex justify-center overflow-hidden bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div id="label-template" className="bg-white flex flex-col justify-center text-black" style={{ width: '50mm', height: '30mm', padding: '2mm', boxSizing: 'border-box' }}>
                  <div className="w-full flex-1 flex flex-col justify-center h-full overflow-hidden text-[8px] leading-[1.4]">
                    {(() => {
                      const item = selectedLot.items.find(i => i.id === selectedLabelItemId) || selectedLot.items[0];
                      const product = item ? getProduct(item.productId) : null;
                      const category = product ? getCategory(product.categoryId) : null;
                      const Warehouse = getStore(selectedLot.warehouseId);
                      
                      return (
                        <>
                          {selectedLabelFields.lotNumber && <div className="font-bold text-[10px] mb-0.5 whitespace-nowrap flex justify-between"><span>Lote: {selectedLot.lotNumber}</span> <span className="text-[10px] font-bold bg-black text-white px-1 rounded">Bulto: {selectedPackageNumber} de {item?.numberOfPackages || 1}</span></div>}
                          {selectedLabelFields.code && <div className="whitespace-nowrap font-mono">Cód: {product?.code}</div>}
                          {selectedLabelFields.productName && <div className="whitespace-nowrap font-bold text-[10px] truncate">Prod: {product?.name}</div>}
                          {selectedLabelFields.category && <div className="whitespace-nowrap">Cat: {category?.name}</div>}
                          {selectedLabelFields.letter && <div className="whitespace-nowrap font-bold">Letra: {category?.code}</div>}
                          {selectedLabelFields.quantity && <div className="whitespace-nowrap">Cant. Pzas Internas: {item?.quantityPerPackage} (Total Pzas: {item?.quantityToEnter})</div>}
                          {selectedLabelFields.description && <div className="whitespace-nowrap truncate">Desc: {selectedLot.description}</div>}
                          {selectedLabelFields.date && <div className="whitespace-nowrap">Fecha: {format(new Date(selectedLot.createdAt), 'dd-MM-yy')}</div>}
                          {selectedLabelFields.Warehouse && <div className="whitespace-nowrap">Almac�n: {Warehouse?.name}</div>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setIsLabelModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleDownloadLabel}>Descargar JPG</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Lista de Picking</h1>
          <p className="text-slate-500 mt-2">Recepción y conformación de mercancía.</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="CONFORMED">Conformados</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Buscador:</span>
          <div className="flex flex-1 w-full gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar por lote o Almac�n..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 py-2 h-auto w-full"
              />
            </div>
            <Button 
              variant="secondary" 
              className="px-3 md:hidden" 
              onClick={() => setIsScannerOpen(true)}
              title="Escanear QR"
            >
              <ScanLine className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Almac�n</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-center">Bultos Totales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.map(lot => {
                    const Warehouse = getStore(lot.warehouseId);
                    const totalBultos = lot.items.reduce((acc, item) => acc + Number(item.numberOfPackages), 0);
                    
                    return (
                      <TableRow key={lot.id} className="group hover:bg-slate-50 transition-colors">
                        <TableCell className="font-mono font-medium text-blue-600">{lot.lotNumber}</TableCell>
                        <TableCell className="font-medium text-slate-900">{Warehouse?.name || 'Desconocida'}</TableCell>
                        <TableCell className="text-slate-500">{format(new Date(lot.createdAt), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{lot.items.length}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-slate-600">{totalBultos}</TableCell>
                        <TableCell>
                          <Badge variant={lot.status === 'CONFORMED' ? 'success' : 'warning'}>
                            {lot.status === 'PENDING' ? 'Pendiente' : 'Conformado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setSelectedLot(lot)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                        No se encontraron lotes de picking.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal de Escáner QR */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setSearchTerm(code)}
      />

      {/* Modales de Llaves de Acceso */}
      <LockModal {...lockConform.lockModalProps} />
    </div>
  );
};
