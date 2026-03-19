import React, { useState, useEffect } from 'react';
import { usePurchasing } from '../features/purchasing/hooks/usePurchasing';
import { PickingLot, PickingLotItem, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { Search, Save, Send, Plus, Trash2, Edit2, ArrowLeft, Package, FileText, Calendar, Store as StoreIcon, Printer, User as UserIcon, Box, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Purchasing: React.FC = () => {
  const { user } = useAuth();
  const { 
    products, 
    stores, 
    pickingLots, 
    stock,
    users,
    isLoading, 
    savePickingLot, 
    deletePickingLot,
    getCategory,
    getStore,
    getUser
  } = usePurchasing();

  // View State
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingLotId, setEditingLotId] = useState<string | null>(null);

  // Form State
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [lotDescription, setLotDescription] = useState<string>('');
  const [items, setItems] = useState<PickingLotItem[]>([]);
  
  // Product Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Initialize Form
  const handleCreateNew = () => {
    setEditingLotId(null);
    setSelectedStoreId('');
    setLotDescription('');
    setItems([]);
    setView('form');
  };

  const handleEditLot = (lot: PickingLot) => {
    setEditingLotId(lot.id);
    setSelectedStoreId(lot.storeId);
    setLotDescription(lot.description);
    setItems(lot.items); // Deep copy might be needed if items are mutated directly
    setView('form');
  };

  const handleBackToList = () => {
    if (window.confirm('¿Estás seguro de volver? Los cambios no guardados se perderán.')) {
      setView('list');
    }
  };

  const getProductStock = (productId: string, storeId: string) => {
    const stockItem = stock.find(s => s.productId === productId && s.storeId === storeId);
    return stockItem ? stockItem.quantity : 0;
  };

  const handleExportPDF = (lot: PickingLot) => {
    const doc = new jsPDF();
    const storeName = getStore(lot.storeId)?.name || 'Tienda Desconocida';
    const creatorName = getUser(lot.createdBy)?.name || 'Desconocido';
    const date = format(new Date(lot.createdAt), 'dd/MM/yyyy HH:mm');

    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('SUPRE WMS', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Orden de Picking / Abastecimiento', 14, 30);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Lote: ${lot.lotNumber}`, 140, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${date}`, 140, 30);

    // Info
    doc.setFontSize(10);
    doc.text(`Tienda Destino: ${storeName}`, 14, 45);
    doc.text(`Creado Por: ${creatorName}`, 14, 52);
    doc.text(`Estado: ${lot.status === 'DRAFT' ? 'Borrador' : lot.status === 'PENDING' ? 'Pendiente' : 'Conformado'}`, 14, 59);
    doc.text(`Descripción: ${lot.description || '-'}`, 14, 66);

    // Table
    const tableData = lot.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const category = getCategory(product?.categoryId || '');
      const packagesStr = item.packagesConfig.map(p => `Bulto ${p.packageIndex}: ${p.quantity}`).join('\n');
      return [
        product?.code || 'N/A',
        product?.name || 'Producto Desconocido',
        category?.code || '-',
        item.quantityToEnter.toString(),
        item.numberOfPackages.toString(),
        packagesStr,
        `${item.packageDimensions.height}x${item.packageDimensions.width}x${item.packageDimensions.depth}`
      ];
    });

    autoTable(doc, {
      startY: 75,
      head: [['Código', 'Producto', 'Cat.', 'Cant.', 'Bultos', 'Detalle Bultos', 'Medidas']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [248, 249, 250], textColor: [100, 100, 100], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    doc.save(`Orden_Picking_${lot.lotNumber}.pdf`);
  };

  // Item Management
  const handleAddProduct = () => {
    if (!selectedProduct) return;
    
    // Check if product already exists in items
    if (items.some(item => item.productId === selectedProduct.id)) {
      alert('Este producto ya está en la lista.');
      return;
    }

    const newItem: PickingLotItem = {
      id: uuidv4(),
      productId: selectedProduct.id,
      quantityToEnter: 1,
      numberOfPackages: 1,
      packagesConfig: [{ packageIndex: 1, quantity: 1 }],
      packageDimensions: selectedProduct.dimensions || { height: 0, width: 0, depth: 0 }, // Default to product dimensions
      minStockAlert: 5
    };
    
    setItems([...items, newItem]);
    setSelectedProduct(null);
    setSearchTerm('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, field: keyof PickingLotItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // Logic for updating packagesConfig when numberOfPackages changes
        if (field === 'numberOfPackages') {
          const newCount = value as number;
          const currentConfig = item.packagesConfig;
          let newConfig = [...currentConfig];

          if (newCount > currentConfig.length) {
            // Add new packages
            for (let i = currentConfig.length + 1; i <= newCount; i++) {
              newConfig.push({ packageIndex: i, quantity: 0 });
            }
          } else if (newCount < currentConfig.length) {
            // Remove packages
            newConfig = newConfig.slice(0, newCount);
          }
          updatedItem.packagesConfig = newConfig;
          
          // Recalculate total quantity
          updatedItem.quantityToEnter = newConfig.reduce((sum, p) => sum + p.quantity, 0);
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
        newConfig[index] = { ...newConfig[index], quantity };
        
        // Optional: Auto-update total quantity based on packages?
        // For now, we keep them independent as per requirement "ingresar cantidad de productos" AND "ingresar cantidad por bultos"
        // But usually they should match. Let's sum them up to update quantityToEnter automatically?
        // The requirement lists them as separate columns, but logic dictates they should sync.
        // Let's update quantityToEnter to match sum of packages for convenience.
        const totalQuantity = newConfig.reduce((sum, p) => sum + p.quantity, 0);
        
        return { ...item, packagesConfig: newConfig, quantityToEnter: totalQuantity };
      }
      return item;
    }));
  };

  const handleUpdateDimensions = (itemId: string, dimField: 'height' | 'width' | 'depth', value: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          packageDimensions: {
            ...item.packageDimensions,
            [dimField]: value
          }
        };
      }
      return item;
    }));
  };

  // Save / Send
  const handleSave = (status: 'DRAFT' | 'PENDING') => {
    if (!selectedStoreId) return alert('Seleccione una tienda destino');
    if (items.length === 0) return alert('Agregue al menos un producto');

    const lot: PickingLot = {
      id: editingLotId || undefined,
      lotNumber: editingLotId 
        ? pickingLots.find(l => l.id === editingLotId)?.lotNumber || `LOT-${Math.floor(Math.random() * 100000)}`
        : `LOT-${Math.floor(Math.random() * 100000)}`,
      storeId: selectedStoreId,
      description: lotDescription,
      items,
      status,
      createdAt: editingLotId 
        ? pickingLots.find(l => l.id === editingLotId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      createdBy: editingLotId
        ? pickingLots.find(l => l.id === editingLotId)?.createdBy || user?.id || 'unknown'
        : user?.id || 'unknown'
    };

    savePickingLot(lot);
    setView('list');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar este lote de picking?')) {
      deletePickingLot(id);
    }
  };

  // Filtered Products for Search
  const filteredProducts = searchTerm 
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.code.includes(searchTerm)
      ).slice(0, 5) // Limit results
    : [];

  const visibleLots = pickingLots.filter(lot => {
    if (user?.role === 'COMPRAS' && user.assignedStores && user.assignedStores.length > 0) {
      return user.assignedStores.includes(lot.storeId);
    }
    return true;
  });

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Abastecimiento</h1>
            <p className="text-slate-500 mt-2">Gestión de lotes de picking y órdenes de compra.</p>
          </div>
          <Button className="gap-2 w-full sm:w-auto" onClick={handleCreateNew}>
            <Plus className="w-5 h-5" />
            Nuevo Picking
          </Button>
        </header>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[1000px] px-4 sm:px-0">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tienda Destino</TableHead>
                  <TableHead>Creador</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-center">Bultos</TableHead>
                  <TableHead className="text-center">Piezas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLots.map(lot => {
                  const totalBultos = lot.items.reduce((acc, item) => acc + item.numberOfPackages, 0);
                  const totalPiezas = lot.items.reduce((acc, item) => acc + item.quantityToEnter, 0);
                  const creator = getUser(lot.createdBy);

                  return (
                    <TableRow key={lot.id}>
                      <TableCell className="font-mono text-blue-600 font-medium">{lot.lotNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StoreIcon className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-700">{getStore(lot.storeId)?.name || 'Tienda Desconocida'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{creator?.name || 'Desconocido'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-[150px] truncate" title={lot.description}>
                        {lot.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">
                          {lot.items.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-slate-600">
                        {totalBultos}
                      </TableCell>
                      <TableCell className="text-center font-mono text-slate-600">
                        {totalPiezas}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lot.status === 'CONFORMED' ? 'success' : lot.status === 'PENDING' ? 'warning' : 'default'}>
                          {lot.status === 'DRAFT' ? 'Borrador' : lot.status === 'PENDING' ? 'Pendiente' : 'Conformado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(new Date(lot.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleExportPDF(lot)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Exportar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {lot.status === 'DRAFT' && (
                            <>
                              <button 
                                onClick={() => handleEditLot(lot)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(lot.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visibleLots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-slate-500">
                      No hay lotes registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form View
  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <button 
          onClick={handleBackToList}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors self-start sm:self-auto"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {editingLotId ? 'Editar Picking' : 'Nuevo Picking'}
          </h1>
          <p className="text-slate-500 mt-1">
            {editingLotId ? 'Modificando lote existente' : 'Creando un nuevo lote de abastecimiento'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General Info & Product Search */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Información General
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tienda Destino</label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Seleccione tienda...</option>
                  {stores
                    .filter(s => {
                      if (user?.role === 'COMPRAS' && user.assignedStores && user.assignedStores.length > 0) {
                        return user.assignedStores.includes(s.id);
                      }
                      return true;
                    })
                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
                <textarea
                  value={lotDescription}
                  onChange={(e) => setLotDescription(e.target.value)}
                  placeholder="Ej: Reabastecimiento mensual..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Agregar Productos
            </h3>
            <div className="relative mb-4">
              <Input
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              {searchTerm && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{product.code}</p>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedProduct && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-blue-900">{selectedProduct.name}</p>
                    <p className="text-xs text-blue-600 font-mono">{selectedProduct.code}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-blue-400 hover:text-blue-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={handleAddProduct} className="w-full">
                  Agregar al Picking
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Items Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm min-h-[500px] flex flex-col overflow-hidden">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Items del Picking ({items.length})
            </h3>
            
            <div className="flex-1 overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[800px] px-4 sm:px-0">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Producto</TableHead>
                    <TableHead className="w-16 text-center">Cat.</TableHead>
                    <TableHead className="w-16 text-center">Stock</TableHead>
                    <TableHead className="w-20 text-center">Bultos</TableHead>
                    <TableHead className="min-w-[120px]">Detalle Bultos</TableHead>
                    <TableHead className="min-w-[120px]">Medidas (cm)</TableHead>
                    <TableHead className="w-20 text-center">Alerta</TableHead>
                    <TableHead className="w-20 text-center">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const category = getCategory(product?.categoryId || '');
                    const currentStock = getProductStock(item.productId, selectedStoreId);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{product?.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{product?.code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {category?.code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-slate-600">
                          {currentStock}
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            min="1"
                            value={item.numberOfPackages}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateItem(item.id, 'numberOfPackages', parseInt(e.target.value) || 1)}
                            className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {item.packagesConfig.map((pkg, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 w-4">#{pkg.packageIndex}</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={pkg.quantity}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdatePackageConfig(item.id, idx, parseInt(e.target.value) || 0)}
                                  className="w-16 text-center bg-white border border-slate-200 rounded px-1 py-0.5"
                                  placeholder="Cant."
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number"
                              value={item.packageDimensions.height}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleUpdateDimensions(item.id, 'height', parseInt(e.target.value) || 0)}
                              className="w-10 text-center bg-white border border-slate-200 rounded px-1"
                              placeholder="Al"
                            />
                            <span className="text-slate-300">x</span>
                            <input
                              type="number"
                              value={item.packageDimensions.width}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleUpdateDimensions(item.id, 'width', parseInt(e.target.value) || 0)}
                              className="w-10 text-center bg-white border border-slate-200 rounded px-1"
                              placeholder="An"
                            />
                            <span className="text-slate-300">x</span>
                            <input
                              type="number"
                              value={item.packageDimensions.depth}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleUpdateDimensions(item.id, 'depth', parseInt(e.target.value) || 0)}
                              className="w-10 text-center bg-white border border-slate-200 rounded px-1"
                              placeholder="Pr"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            min="0"
                            value={item.minStockAlert}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateItem(item.id, 'minStockAlert', parseInt(e.target.value) || 0)}
                            className="w-16 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600">
                          {item.quantityToEnter}
                        </TableCell>
                        <TableCell className="text-right">
                          <button 
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-slate-500 border-none">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-12 h-12 text-slate-200 mb-3" />
                          <p>No hay productos agregados.</p>
                          <p className="text-sm text-slate-400">Utiliza el buscador para agregar items.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 mt-6 pt-6 border-t border-slate-100">
              <Button variant="secondary" onClick={() => handleSave('DRAFT')} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                Guardar Borrador
              </Button>
              <Button onClick={() => handleSave('PENDING')} className="w-full sm:w-auto">
                <Send className="w-4 h-4 mr-2" />
                Enviar Picking
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Purchasing;
