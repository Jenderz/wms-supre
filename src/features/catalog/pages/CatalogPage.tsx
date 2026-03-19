import React, { useState } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { Plus, Search, Edit2, Package, Trash2, X, Upload, Download, QrCode, ScanLine } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { Product } from '../../../types';
import { QRCodeCanvas } from 'qrcode.react';
import { QRScannerModal } from '../../../components/QRScannerModal';

export const CatalogPage: React.FC = () => {
  const { products, categories, isLoading, getCategoryName, saveProduct, setAllProducts, deleteProduct } = useCatalog();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  
  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    categoryId: '',
    dimensions: { height: 0, width: 0, depth: 0 },
    costs: [0],
    prices: [0],
    imageUrl: '',
    footerUrl: '',
    enabledStores: []
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm);
    const matchesCategory = filterCategory ? String(p.categoryId) === String(filterCategory) : true;
    return matchesSearch && matchesCategory;
  });

  const handleExport = () => {
    const csv = [
      ['ID', 'Código', 'Nombre', 'Categoría', 'Alto', 'Ancho', 'Largo', 'Costes', 'Precios', 'Imagen', 'Footer', 'Tiendas'].join(','),
      ...products.map(p => {
        const costsArray = Array.isArray(p.costs) ? p.costs : (p.costs ? (typeof p.costs === 'object' ? Object.values(p.costs) : [p.costs]) : []);
        const pricesArray = Array.isArray(p.prices) ? p.prices : (p.prices ? (typeof p.prices === 'object' ? Object.values(p.prices) : [p.prices]) : []);
        const storesArray = Array.isArray(p.enabledStores) ? p.enabledStores : [];
        const dims = p.dimensions || { height: 0, width: 0, depth: 0 };
        return [
          p.id, p.code, p.name, p.categoryId, dims.height, dims.width, dims.depth,
          `"${costsArray.join('|')}"`, `"${pricesArray.join('|')}"`, p.imageUrl, p.footerUrl, `"${storesArray.join('|')}"`
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(1);
      const newProducts: Product[] = lines.filter(l => l.trim()).map(line => {
        const [id, code, name, categoryId, height, width, depth, costs, prices, imageUrl, footerUrl, enabledStores] = line.split(',');
        return {
          id, code, name, categoryId,
          dimensions: { height: Number(height), width: Number(width), depth: Number(depth) },
          costs: costs ? costs.replace(/"/g, '').split('|').map(Number) : [0],
          prices: prices ? prices.replace(/"/g, '').split('|').map(Number) : [0],
          imageUrl: imageUrl || '',
          footerUrl: footerUrl || '',
          enabledStores: enabledStores ? enabledStores.replace(/"/g, '').split('|').filter(Boolean) : []
        };
      });
      setAllProducts(newProducts);
    };
    reader.readAsText(file);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        ...product,
        dimensions: product.dimensions ? { ...product.dimensions } : { height: 0, width: 0, depth: 0 },
        costs: Array.isArray(product.costs) ? [...product.costs] : (product.costs ? (typeof product.costs === 'object' ? Object.values(product.costs) : [product.costs]) : [0]),
        prices: Array.isArray(product.prices) ? [...product.prices] : (product.prices ? (typeof product.prices === 'object' ? Object.values(product.prices) : [product.prices]) : [0]),
        enabledStores: Array.isArray(product.enabledStores) ? [...product.enabledStores] : []
      });
    } else {
      setEditingId(null);
      setFormData({
        code: '',
        name: '',
        categoryId: '',
        dimensions: { height: 0, width: 0, depth: 0 },
        costs: [0],
        prices: [0],
        imageUrl: '',
        footerUrl: '',
        enabledStores: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.categoryId) {
      alert('Por favor complete los campos obligatorios (Código, Nombre, Categoría)');
      return;
    }

    const productToSave: Product = {
      id: editingId || undefined,
      code: formData.code,
      name: formData.name,
      categoryId: formData.categoryId,
      dimensions: {
        height: Number(formData.dimensions?.height) || 0,
        width: Number(formData.dimensions?.width) || 0,
        depth: Number(formData.dimensions?.depth) || 0,
      },
      costs: formData.costs?.map(c => Number(c) || 0) || [0],
      prices: formData.prices?.map(p => Number(p) || 0) || [0],
      imageUrl: formData.imageUrl || '',
      footerUrl: formData.footerUrl || '',
      enabledStores: formData.enabledStores || []
    };

    saveProduct(productToSave);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      deleteProduct(id);
    }
  };

  const handleDownloadQR = (id: string, code: string) => {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement;
    if (canvas) {
      // Create a larger canvas for better print quality (600px is excellent for ~50mm at 300dpi)
      const size = 600;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, size, size);
        const url = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-${code}.png`;
        link.href = url;
        link.click();
      }
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Productos</h1>
          <p className="text-slate-500 mt-2">Gestión de ítems, categorías y precios base.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input type="file" accept=".csv" onChange={handleImport} className="hidden" id="import-file" />
          <Button variant="secondary" className="gap-2 w-full sm:w-auto" onClick={() => document.getElementById('import-file')?.click()}>
            <Upload className="w-5 h-5" />
            Importar
          </Button>
          <Button variant="secondary" className="gap-2 w-full sm:w-auto" onClick={handleExport}>
            <Download className="w-5 h-5" />
            Exportar
          </Button>
          <Button className="gap-2 w-full sm:w-auto" onClick={() => handleOpenModal()}>
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </Button>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            <div className="flex-1">
              <Input
                icon={<Search className="w-5 h-5" />}
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className={`w-full sm:w-auto ${showFilters ? 'bg-slate-200' : ''}`}>
            Filtros {filterCategory && <span className="ml-2 w-2 h-2 rounded-full bg-blue-600"></span>}
          </Button>
        </div>

        {showFilters && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
            <div className="w-full sm:w-64">
              <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>CBM (m³)</TableHead>
                  <TableHead>Precio Base</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => {
                  const dims = product.dimensions || { height: 0, width: 0, depth: 0 };
                  const cbm = (dims.height * dims.width * dims.depth) / 1000000;
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm text-blue-600 font-medium">{product.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 group/qr">
                          <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                            <QRCodeCanvas 
                              id={`qr-${product.id}`}
                              value={product.code} 
                              size={40} 
                              level="L" 
                            />
                          </div>
                          <button
                            onClick={() => handleDownloadQR(product.id, product.code)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all opacity-0 group-hover/qr:opacity-100"
                            title="Descargar QR"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <span className="font-medium text-slate-900">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{getCategoryName(product.categoryId)}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 font-mono text-sm">{cbm.toFixed(4)}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-sm">
                        ${Number(
                          Array.isArray(product.prices) 
                            ? (product.prices[0] || 0) 
                            : (product.prices ? (typeof product.prices === 'object' ? Object.values(product.prices)[0] : product.prices) : 0)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                      No se encontraron productos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-xl border border-slate-200 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Información Básica</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Código</label>
                  <Input 
                    placeholder="Ej: PROD-001" 
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                  <Input 
                    placeholder="Ej: Silla de Oficina" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Seleccione una categoría...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dimensiones y Precios */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Dimensiones (cm)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Alto</label>
                    <Input 
                      type="number"
                      value={formData.dimensions?.height || 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dimensions: { ...formData.dimensions!, height: Number(e.target.value) } 
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Ancho</label>
                    <Input 
                      type="number"
                      value={formData.dimensions?.width || 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dimensions: { ...formData.dimensions!, width: Number(e.target.value) } 
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Largo</label>
                    <Input 
                      type="number"
                      value={formData.dimensions?.depth || 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        dimensions: { ...formData.dimensions!, depth: Number(e.target.value) } 
                      })}
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 pt-2">Costes ($)</h3>
                <div className="space-y-2">
                  {formData.costs?.map((cost, index) => (
                    <Input 
                      key={index}
                      type="number"
                      value={cost}
                      onChange={(e) => {
                        const currentCosts = Array.isArray(formData.costs) ? formData.costs : (formData.costs ? (typeof formData.costs === 'object' ? Object.values(formData.costs) : [formData.costs]) : []);
                        const newCosts = [...currentCosts];
                        newCosts[index] = Number(e.target.value);
                        setFormData({ ...formData, costs: newCosts });
                      }}
                    />
                  ))}
                  {formData.costs && formData.costs.length < 2 && (
                    <Button variant="secondary" size="sm" onClick={() => {
                      const currentCosts = Array.isArray(formData.costs) ? formData.costs : (formData.costs ? (typeof formData.costs === 'object' ? Object.values(formData.costs) : [formData.costs]) : []);
                      setFormData({ ...formData, costs: [...currentCosts, 0] });
                    }}>
                      Añadir Coste
                    </Button>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 pt-2">Precios ($)</h3>
                <div className="space-y-2">
                  {formData.prices?.map((price, index) => (
                    <Input 
                      key={index}
                      type="number"
                      value={price}
                      onChange={(e) => {
                        const currentPrices = Array.isArray(formData.prices) ? formData.prices : (formData.prices ? (typeof formData.prices === 'object' ? Object.values(formData.prices) : [formData.prices]) : []);
                        const newPrices = [...currentPrices];
                        newPrices[index] = Number(e.target.value);
                        setFormData({ ...formData, prices: newPrices });
                      }}
                    />
                  ))}
                  {formData.prices && formData.prices.length < 5 && (
                    <Button variant="secondary" size="sm" onClick={() => {
                      const currentPrices = Array.isArray(formData.prices) ? formData.prices : (formData.prices ? (typeof formData.prices === 'object' ? Object.values(formData.prices) : [formData.prices]) : []);
                      setFormData({ ...formData, prices: [...currentPrices, 0] });
                    }}>
                      Añadir Precio
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Escáner QR */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setSearchTerm(code)}
      />
    </div>
  );
};
