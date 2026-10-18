import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePurchasing } from '../../features/purchasing/hooks/usePurchasing';
import { PickingLot, PickingLotItem, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import {
  Search,
  Save,
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  Package,
  FileText,
  Scan,
  QrCode,
  Barcode,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { QRScannerModal, ScanType } from '../../components/QRScannerModal';

export const PickingCreate: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editLotId = searchParams.get('edit');

  const {
    products,
    warehouses,
    pickingLots,
    stock,
    savePickingLot,
    conformPickingLot,
    getCategory,
  } = usePurchasing();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados del Formulario
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [lotDescription, setLotDescription] = useState<string>('');
  const [items, setItems] = useState<PickingLotItem[]>([]);

  // Estados de Búsqueda y Selección
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Cargar datos si estamos en modo edición
  useEffect(() => {
    if (editLotId && pickingLots.length > 0) {
      const lotToEdit = pickingLots.find(l => String(l.id) === String(editLotId));
      if (lotToEdit) {
        setSelectedStoreId(String(lotToEdit.warehouseId || ''));
        setLotDescription(lotToEdit.description || '');
        setItems(
          (lotToEdit.items || []).map(i => ({
            ...i,
            id: i.id || uuidv4(),
            productId: String(i.productId),
            numberOfPackages: Number(i.numberOfPackages) || 1,
            quantityToEnter: Number(i.quantityToEnter) || 1,
            packagesConfig: Array.isArray(i.packagesConfig) && i.packagesConfig.length > 0
              ? i.packagesConfig
              : Array.from({ length: Number(i.numberOfPackages) || 1 }, (_, idx) => ({
                  packageIndex: idx + 1,
                  quantity: Math.max(1, Math.floor((Number(i.quantityToEnter) || 1) / (Number(i.numberOfPackages) || 1))),
                })),
            packageDescription: i.packageDescription || '',
            minStockAlert: Number(i.minStockAlert) || 0,
          }))
        );
      }
    }
  }, [editLotId, pickingLots]);

  const getProductStock = (productId: string, warehouseId: string) => {
    const stockItem = stock.find(s => s.productId === productId && s.warehouseId === warehouseId);
    return stockItem ? stockItem.quantity : 0;
  };

  // Agregar producto seleccionado al listado
  const handleAddProduct = (prodToAdd?: Product) => {
    const prod = prodToAdd || selectedProduct;
    if (!prod) return;

    // Validar si el producto ya existe en los items
    if (items.some(item => String(item.productId) === String(prod.id))) {
      setScanFeedback({
        message: `"${prod.name}" ya está en la lista de items.`,
        type: 'error'
      });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const newItem: PickingLotItem = {
      id: uuidv4(),
      productId: prod.id,
      quantityToEnter: 1,
      numberOfPackages: 1,
      packagesConfig: [{ packageIndex: 1, quantity: 1 }],
      packageDimensions: undefined,
      packageDescription: '',
      minStockAlert: 0 // Valor por defecto seguro para integridad de base de datos
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProduct(null);
    setSearchTerm('');
    setScanFeedback({
      message: `Producto agregado: ${prod.name}`,
      type: 'success'
    });
    setTimeout(() => setScanFeedback(null), 3000);
  };

  // Manejar resultado del escáner QR o Código de Barras
  const handleScanCode = (decodedText: string, type: ScanType) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    // Buscar coincidencia en productos por código exacto, ID o nombre
    const matchedProduct = products.find(p =>
      p.code.toLowerCase() === cleanText.toLowerCase() ||
      p.id.toLowerCase() === cleanText.toLowerCase() ||
      p.name.toLowerCase().includes(cleanText.toLowerCase())
    );

    if (matchedProduct) {
      handleAddProduct(matchedProduct);
    } else {
      setScanFeedback({
        message: `No se encontró ningún producto con el código: "${cleanText}"`,
        type: 'error'
      });
      setTimeout(() => setScanFeedback(null), 4000);
    }
  };

  // Soporte para lectores de código de barra físicos vía USB (Enter)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const cleanTerm = searchTerm.trim().toLowerCase();
      const matched = products.find(p =>
        p.code.toLowerCase() === cleanTerm ||
        p.id.toLowerCase() === cleanTerm ||
        p.name.toLowerCase() === cleanTerm
      );

      if (matched) {
        handleAddProduct(matched);
      } else if (filteredProducts.length === 1) {
        handleAddProduct(filteredProducts[0]);
      }
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, field: keyof PickingLotItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };

        // Ajuste reactivo al cambiar la cantidad de bultos
        if (field === 'numberOfPackages') {
          const newCount = Math.max(1, value as number);
          const currentConfig = item.packagesConfig || [];
          let newConfig = [...currentConfig];

          if (newCount > currentConfig.length) {
            for (let i = currentConfig.length + 1; i <= newCount; i++) {
              newConfig.push({ packageIndex: i, quantity: 1 });
            }
          } else if (newCount < currentConfig.length) {
            newConfig = newConfig.slice(0, newCount);
          }
          updatedItem.numberOfPackages = newCount;
          updatedItem.packagesConfig = newConfig;
          updatedItem.quantityToEnter = newConfig.reduce((sum, p) => sum + (p.quantity || 0), 0);
        }

        return updatedItem;
      }
      return item;
    }));
  };

  const handleUpdatePackageConfig = (itemId: string, index: number, quantity: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newConfig = [...item.packagesConfig];
        newConfig[index] = { ...newConfig[index], quantity: Math.max(0, quantity) };
        const totalQuantity = newConfig.reduce((sum, p) => sum + (p.quantity || 0), 0);
        return { ...item, packagesConfig: newConfig, quantityToEnter: totalQuantity };
      }
      return item;
    }));
  };

  const handleUpdatePackageDescription = (itemId: string, description: string) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, packageDescription: description } : item
    ));
  };

  // Guardar Lote de Picking (Borrador o Pendiente)
  const handleSave = async (status: 'DRAFT' | 'PENDING') => {
    if (!selectedStoreId) {
      alert('Por favor, seleccione un Almacén destino.');
      return;
    }
    if (items.length === 0) {
      alert('Agregue al menos un producto a la lista de picking.');
      return;
    }

    const currentLot = editLotId ? pickingLots.find(l => String(l.id) === String(editLotId)) : null;

    const lot: PickingLot = {
      id: editLotId || undefined,
      lotNumber: currentLot?.lotNumber || `LOT-${Math.floor(10000 + Math.random() * 90000)}`,
      warehouseId: selectedStoreId,
      description: lotDescription,
      items: items.map(it => ({
        ...it,
        productId: String(it.productId),
        quantityToEnter: Number(it.quantityToEnter) || 1,
        numberOfPackages: Number(it.numberOfPackages) || 1,
        packagesConfig: it.packagesConfig || [{ packageIndex: 1, quantity: Number(it.quantityToEnter) || 1 }],
      })),
      status,
      createdAt: currentLot?.createdAt || new Date().toISOString(),
      createdBy: currentLot?.createdBy || user?.id || 'unknown'
    };

    setIsSubmitting(true);
    try {
      await savePickingLot(lot);
      navigate('/purchasing/list');
    } catch (e: any) {
      alert(`Error al guardar el lote: ${e?.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar y Conformar Inmediatamente
  const handleSaveAndConform = async () => {
    if (!selectedStoreId) {
      alert('Por favor, seleccione un Almacén destino.');
      return;
    }
    if (items.length === 0) {
      alert('Agregue al menos un producto a la lista de picking.');
      return;
    }
    if (!window.confirm('¿Guardar y conformar este lote de inmediato?\n\nLa mercancía ingresará al inventario del almacén de forma definitiva.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const currentLot = editLotId ? pickingLots.find(l => String(l.id) === String(editLotId)) : null;

      const lot: PickingLot = {
        id: editLotId || undefined,
        lotNumber: currentLot?.lotNumber || `LOT-${Math.floor(10000 + Math.random() * 90000)}`,
        warehouseId: selectedStoreId,
        description: lotDescription,
        items: items.map(it => ({
          ...it,
          productId: String(it.productId),
          quantityToEnter: Number(it.quantityToEnter) || 1,
          numberOfPackages: Number(it.numberOfPackages) || 1,
          packagesConfig: it.packagesConfig || [{ packageIndex: 1, quantity: Number(it.quantityToEnter) || 1 }],
        })),
        status: 'PENDING',
        createdAt: currentLot?.createdAt || new Date().toISOString(),
        createdBy: currentLot?.createdBy || user?.id || 'unknown'
      };

      const savedId = await savePickingLot(lot);
      if (savedId) {
        await conformPickingLot(savedId);
      }
      navigate('/purchasing/list');
    } catch (e: any) {
      alert(`Error al guardar y conformar el lote: ${e?.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtro de productos para búsqueda manual
  const filteredProducts = searchTerm
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchasing/list')}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
            title="Volver a la lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {editLotId ? 'Modificar Picking' : 'Crear Nuevo Picking'}
            </h2>
            <p className="text-xs text-slate-500">
              {editLotId ? 'Actualiza los datos del lote de abastecimiento.' : 'Configura almacén, productos y bultos.'}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback de Escaneo */}
      {scanFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm transition-all duration-300 ${
            scanFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {scanFeedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{scanFeedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Información General y Buscador con Escáner */}
        <div className="space-y-6">
          {/* Información General */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-blue-600" />
              Información General
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Almacén Destino <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Seleccione Almacén...</option>
                  {warehouses
                    .filter(s => {
                      if (user?.role === 'COMPRAS' && user.assignedWarehouses && user.assignedWarehouses.length > 0) {
                        return user.assignedWarehouses.includes(s.id);
                      }
                      return true;
                    })
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Descripción / Observaciones
                </label>
                <textarea
                  value={lotDescription}
                  onChange={(e) => setLotDescription(e.target.value)}
                  placeholder="Ej: Reabastecimiento mensual de repuestos..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[90px]"
                />
              </div>
            </div>
          </div>

          {/* Agregar Productos (Búsqueda + Escáner) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-base">
                <Search className="w-5 h-5 text-blue-600" />
                Agregar Productos
              </h3>
              <Badge variant="outline" className="text-[11px] text-blue-700 bg-blue-50 border-blue-200">
                {products.length} Disponibles
              </Badge>
            </div>

            {/* Input con botón de escaneo integrado */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Buscar por código o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Botón de Escaneo QR / Código de Barras */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 flex items-center gap-1.5"
                  title="Escanear Código de Barras o QR"
                >
                  <Scan className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-semibold">Escanear</span>
                </Button>
              </div>

              {/* Lista desplegable de coincidencias */}
              {searchTerm && filteredProducts.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/60 flex items-center justify-between group transition-colors"
                    >
                      <div className="pr-2">
                        <p className="font-medium text-sm text-slate-900 group-hover:text-blue-700">{product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{product.code}</p>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Producto seleccionado listo para agregar */}
              {selectedProduct && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Seleccionado
                      </span>
                      <p className="font-bold text-slate-900 mt-1">{selectedProduct.name}</p>
                      <p className="text-xs text-blue-600 font-mono">{selectedProduct.code}</p>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    onClick={() => handleAddProduct()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Agregar al Picking
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tabla de Items del Picking (SIN columna Alerta) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm min-h-[520px] flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-base">
                  <Package className="w-5 h-5 text-blue-600" />
                  Items del Picking ({items.length})
                </h3>
                {items.length > 0 && (
                  <span className="text-xs text-slate-500">
                    Total Piezas: <strong className="text-blue-600 font-mono text-sm">{items.reduce((s, i) => s + (i.quantityToEnter || 0), 0)}</strong>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[750px] px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[170px]">Producto</TableHead>
                        <TableHead className="w-16 text-center">Cat.</TableHead>
                        <TableHead className="w-16 text-center">Stock</TableHead>
                        <TableHead className="w-20 text-center">Bultos</TableHead>
                        <TableHead className="min-w-[130px]">Detalle Bultos</TableHead>
                        <TableHead className="min-w-[130px]">Desc. Bulto</TableHead>
                        <TableHead className="w-20 text-center font-bold">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => {
                        const product = products.find(p => String(p.id) === String(item.productId));
                        const category = getCategory(product?.categoryId || '');
                        const currentStock = getProductStock(String(item.productId), selectedStoreId);

                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50/60">
                            {/* Producto */}
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900 text-sm">{product?.name || 'Desconocido'}</p>
                                <p className="text-xs text-slate-500 font-mono">{product?.code}</p>
                              </div>
                            </TableCell>

                            {/* Categoría */}
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono text-xs font-semibold">
                                {category?.code || '-'}
                              </Badge>
                            </TableCell>

                            {/* Stock Actual */}
                            <TableCell className="text-center font-mono text-xs text-slate-600">
                              {currentStock}
                            </TableCell>

                            {/* Número de Bultos */}
                            <TableCell>
                              <input
                                type="number"
                                min="1"
                                value={item.numberOfPackages}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'numberOfPackages', parseInt(e.target.value, 10) || 1)
                                }
                                className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-sm font-semibold focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                              />
                            </TableCell>

                            {/* Detalle de Cantidad por Bulto */}
                            <TableCell>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {item.packagesConfig.map((pkg, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                                    <span className="text-slate-400 font-mono w-5">#{pkg.packageIndex}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={pkg.quantity}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        handleUpdatePackageConfig(item.id, idx, parseInt(e.target.value, 10) || 0)
                                      }
                                      className="w-16 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                      placeholder="Cant."
                                    />
                                    <span className="text-[10px] text-slate-400">pzas</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>

                            {/* Descripción Libre del Bulto */}
                            <TableCell>
                              <textarea
                                value={item.packageDescription ?? ''}
                                onChange={(e) => handleUpdatePackageDescription(item.id, e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs resize-none focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                placeholder="Ej: 1 llegó por fuera..."
                                rows={2}
                              />
                            </TableCell>

                            {/* Cantidad Total de Piezas */}
                            <TableCell className="text-center font-bold font-mono text-blue-600 text-sm">
                              {item.quantityToEnter}
                            </TableCell>

                            {/* Eliminar Item */}
                            <TableCell className="text-right">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Quitar producto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-16 text-center text-slate-500 border-none">
                            <div className="flex flex-col items-center justify-center">
                              <Package className="w-12 h-12 text-slate-200 mb-3" />
                              <p className="font-medium text-slate-600">No hay productos en este picking</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Utiliza el buscador manual o el botón de escáner para agregar productos.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Acciones de Guardado */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-5 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => handleSave('DRAFT')}
                className="w-full sm:w-auto text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar Borrador
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSave('PENDING')}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Picking
              </Button>
              {user?.role === 'ADMIN' && (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveAndConform}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardar y Conformar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Unificado de Escaneo (QR y Código de Barras) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanCode}
        title="Escanear Producto para Picking"
      />
    </div>
  );
};

export default PickingCreate;
