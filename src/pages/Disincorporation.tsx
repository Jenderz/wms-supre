import React, { useState } from 'react';
import { useDisincorporation } from '../features/disincorporation/hooks/useDisincorporation';
import { useAuth } from '../context/AuthContext';
import { Disincorporation, DisincorporationItem, DisincorporationReason, Product, Stock } from '../types';
import { Plus, Search, Trash2, Save, X, AlertTriangle, CheckCircle2, FileText, ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DisincorporationPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    disincorporations, 
    products, 
    stores, 
    stock, 
    locations, 
    isLoading, 
    saveDisincorporation, 
    deleteDisincorporation,
    approveDisincorporation 
  } = useDisincorporation();

  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [currentDisincorporation, setCurrentDisincorporation] = useState<Partial<Disincorporation>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [formItems, setFormItems] = useState<DisincorporationItem[]>([]);
  
  // Item Addition State
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<DisincorporationReason>('DAMAGED');
  const [notes, setNotes] = useState('');

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [showConfirmApprove, setShowConfirmApprove] = useState<Disincorporation | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  const handleCreateNew = () => {
    setCurrentDisincorporation({
      id: undefined,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      createdBy: user?.id || 'unknown',
    });
    setFormItems([]);
    setDescription('');
    setSelectedStoreId(stores[0]?.id || '');
    setView('FORM');
  };

  const handleEdit = (disincorporation: Disincorporation) => {
    setCurrentDisincorporation(disincorporation);
    setFormItems(disincorporation.items);
    setDescription(disincorporation.description || '');
    setSelectedStoreId(disincorporation.storeId || '');
    setView('FORM');
  };

  const handleDelete = (id: string) => {
    setShowConfirmDelete(id);
  };

  const confirmDelete = () => {
    if (showConfirmDelete) {
      deleteDisincorporation(showConfirmDelete);
      setShowConfirmDelete(null);
    }
  };

  const handleSave = (status: 'DRAFT' | 'APPROVED') => {
    setError(null);
    if (!selectedStoreId) {
      setError('Seleccione una tienda');
      return;
    }
    if (formItems.length === 0) {
      setError('Agregue al menos un item');
      return;
    }

    const newDisincorporation: Disincorporation = {
      id: currentDisincorporation.id || undefined,
      storeId: selectedStoreId,
      description,
      items: formItems,
      status: 'DRAFT', // We save as draft first
      createdAt: currentDisincorporation.createdAt || new Date().toISOString(),
      createdBy: currentDisincorporation.createdBy || user?.id || 'unknown',
    };

    saveDisincorporation(newDisincorporation);

    if (status === 'APPROVED') {
      setShowConfirmApprove(newDisincorporation);
    } else {
      setView('LIST');
    }
  };

  const confirmApprove = () => {
    if (showConfirmApprove && user) {
      approveDisincorporation(showConfirmApprove.id, user.id);
      setShowConfirmApprove(null);
      setView('LIST');
    }
  };

  const handleAddItem = () => {
    setError(null);
    if (!selectedProduct || !selectedStockId || quantity <= 0) return;

    // Check stock availability
    const stockItem = availableStock.find(s => s.id === selectedStockId);

    if (!stockItem || stockItem.availableQuantity < quantity) {
      setError(`Stock insuficiente. Disponible: ${stockItem?.availableQuantity || 0}`);
      return;
    }

    const newItem: DisincorporationItem = {
      id: uuidv4(),
      productId: selectedProduct.id,
      locationId: stockItem.locationId,
      quantity,
      reason,
      notes
    };

    setFormItems([...formItems, newItem]);
    
    // Reset item form
    setSelectedProduct(null);
    setProductSearch('');
    setSelectedStockId('');
    setQuantity(1);
    setReason('DAMAGED');
    setNotes('');
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(formItems.filter(i => i.id !== id));
  };

  const handleExportPDF = (d: Disincorporation) => {
    const doc = new jsPDF();
    const storeName = stores.find(s => s.id === d.storeId)?.name || 'Tienda Desconocida';
    const date = format(new Date(d.createdAt), 'dd/MM/yyyy HH:mm');

    // Header
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38); // Red-ish for disincorporation
    doc.text('SUPRE WMS', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Reporte de Desincorporación / Merma', 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Fecha: ${date}`, 140, 22);
    doc.text(`Estado: ${d.status === 'DRAFT' ? 'Borrador' : 'Procesado'}`, 140, 30);

    // Info
    doc.setFontSize(10);
    doc.text(`Tienda: ${storeName}`, 14, 45);
    doc.text(`Descripción: ${d.description || '-'}`, 14, 52);

    // Table
    const tableData = d.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const location = locations.find(l => l.id === item.locationId);
      const locStr = location ? `${location.room}-${location.shelf}-${location.cubicle}` : 'N/A';
      
      const reasonMap: Record<string, string> = {
        DAMAGED: 'Dañado',
        EXPIRED: 'Vencido',
        LOST: 'Perdido',
        THEFT: 'Robo',
        OBSOLETE: 'Obsoleto',
        OTHER: 'Otro'
      };

      return [
        product?.code || 'N/A',
        product?.name || 'Producto Desconocido',
        locStr,
        item.quantity.toString(),
        reasonMap[item.reason] || item.reason,
        item.notes || '-'
      ];
    });

    autoTable(doc, {
      startY: 65,
      head: [['Código', 'Producto', 'Ubicación', 'Cant.', 'Motivo', 'Notas']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [248, 249, 250], textColor: [100, 100, 100], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    doc.save(`Desincorporacion_${format(new Date(d.createdAt), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // Solo mostramos productos que tienen stock disponible EN la tienda seleccionada
  const filteredProducts = productSearch
    ? products.filter(p => {
        const matchesSearch = (
          p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
          p.code.includes(productSearch)
        );
        if (!matchesSearch) return false;
        // Debe tener al menos 1 unidad en stock en la tienda seleccionada
        if (!selectedStoreId) return true; // Si no hay tienda aún, mostrar todos los que hacen match
        const hasStock = stock.some(s =>
          String(s.productId) === String(p.id) &&
          String(s.storeId) === String(selectedStoreId) &&
          s.quantity > 0
        );
        return hasStock;
      }).slice(0, 8)
    : [];

  const availableStock = selectedProduct ? stock.filter(s => {
    if (String(s.productId) !== String(selectedProduct.id) || String(s.storeId) !== String(selectedStoreId)) return false;
    
    // Calculate how much of this specific stock is already in the form
    const quantityInForm = formItems
      .filter(item => item.productId === s.productId && item.locationId === s.locationId)
      .reduce((sum, item) => sum + Number(item.quantity), 0);
      
    return (s.quantity - quantityInForm) > 0;
  }).map(s => {
    const quantityInForm = formItems
      .filter(item => item.productId === s.productId && item.locationId === s.locationId)
      .reduce((sum, item) => sum + Number(item.quantity), 0);
    return { ...s, availableQuantity: s.quantity - quantityInForm };
  }) : [];

  if (view === 'FORM') {
    return (
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <button 
            onClick={() => setView('LIST')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {currentDisincorporation.id ? 'Editar Desincorporación' : 'Nueva Desincorporación'}
            </h1>
            <p className="text-slate-500 mt-1">Registre la salida de mercancía por mermas o daños.</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        <div className={`grid grid-cols-1 ${currentDisincorporation.status === 'APPROVED' ? '' : 'lg:grid-cols-3'} gap-6`}>
          {/* Left Column: Form Details */}
          <div className={`${currentDisincorporation.status === 'APPROVED' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tienda</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70"
                    value={selectedStoreId}
                    onChange={(e) => {
                      setSelectedStoreId(e.target.value);
                      setFormItems([]); // Clear items if store changes
                    }}
                    disabled={formItems.length > 0 || currentDisincorporation.status === 'APPROVED'} // Lock store if items added or approved
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción / Referencia</label>
                  <Input 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Daños por inundación..."
                    disabled={currentDisincorporation.status === 'APPROVED'}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">Items a Desincorporar</h3>
                
                {formItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No hay items agregados. Use el panel derecho para agregar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formItems.map(item => {
                      const product = products.find(p => p.id === item.productId);
                      const location = locations.find(l => l.id === item.locationId);
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-100">
                              <FileText className="w-5 h-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{product?.name}</p>
                              <p className="text-xs text-slate-500">
                                {location?.room} - {location?.shelf} - {location?.cubicle} | Razón: {item.reason}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-slate-700">{item.quantity} un.</span>
                            {currentDisincorporation.status !== 'APPROVED' && (
                              <button 
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {currentDisincorporation.status !== 'APPROVED' ? (
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => handleSave('DRAFT')}>
                  Guardar Borrador
                </Button>
                <Button onClick={() => handleSave('APPROVED')} className="bg-red-600 hover:bg-red-700 text-white">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Procesar Salida
                </Button>
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <Button onClick={() => handleExportPDF(currentDisincorporation)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            )}
          </div>

          {/* Right Column: Add Item */}
          {currentDisincorporation.status !== 'APPROVED' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm sticky top-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  Agregar Producto
                </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Buscar Producto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setSelectedProduct(null);
                      }}
                      placeholder="Código o nombre..."
                      className="pl-9"
                    />
                  </div>
                  {productSearch && !selectedProduct && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto absolute z-10 w-full max-w-xs">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                          <button
                            key={product.id}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                            onClick={() => {
                              setSelectedProduct(product);
                              setProductSearch(product.name);
                            }}
                          >
                            <div className="font-medium text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{product.code}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 italic">
                          {selectedStoreId
                            ? 'No hay productos con stock en esta tienda que coincidan con la búsqueda.'
                            : 'Seleccione una tienda primero.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedProduct && (
                  <>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-sm font-medium text-blue-900">{selectedProduct.name}</p>
                      <p className="text-xs text-blue-600 font-mono mt-1">{selectedProduct.code}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Ubicación de Origen</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={selectedStockId}
                        onChange={(e) => setSelectedStockId(e.target.value)}
                      >
                        <option value="">Seleccione ubicación...</option>
                        {availableStock.map(s => {
                          const loc = locations.find(l => l.id === s.locationId);
                          return (
                            <option key={s.id} value={s.id}>
                              {loc ? `${loc.room} - ${loc.shelf} - ${loc.cubicle}` : 'Sin ubicación'} (Stock: {s.availableQuantity})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                        <Input 
                          type="number" 
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Motivo</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={reason}
                          onChange={(e) => setReason(e.target.value as DisincorporationReason)}
                        >
                          <option value="DAMAGED">Dañado</option>
                          <option value="EXPIRED">Vencido</option>
                          <option value="LOST">Perdido</option>
                          <option value="THEFT">Robo</option>
                          <option value="OBSOLETE">Obsoleto</option>
                          <option value="OTHER">Otro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Notas (Opcional)</label>
                      <Input 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalles adicionales..."
                      />
                    </div>

                    <Button onClick={handleAddItem} className="w-full" disabled={!selectedStockId}>
                      Agregar Item
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Desincorporación</h1>
          <p className="text-slate-500 mt-2">Gestión de salidas de inventario y mermas.</p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 w-full sm:w-auto">
          <Plus className="w-5 h-5" />
          Nueva Salida
        </Button>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              placeholder="Buscar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12"
            />
          </div>
        </div>

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
                <TableHead>Fecha</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disincorporations.map(d => (
                <TableRow key={d.id} className="group hover:bg-slate-50 transition-colors">
                  <TableCell className="text-slate-900 font-medium">
                    {format(new Date(d.createdAt), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {stores.find(s => s.id === d.storeId)?.name}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {d.description || 'Sin descripción'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{d.items.length} items</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === 'APPROVED' ? 'destructive' : 'default'}>
                      {d.status === 'DRAFT' ? 'Borrador' : 'Procesado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleExportPDF(d)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Exportar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {d.status === 'DRAFT' && (
                        <>
                          <button 
                            onClick={() => handleEdit(d)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(d.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {d.status === 'APPROVED' && (
                        <button 
                          onClick={() => handleEdit(d)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Ver Detalles"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {disincorporations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                    No hay registros de desincorporación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!showConfirmApprove}
        onClose={() => setShowConfirmApprove(null)}
        title="Confirmar Salida de Inventario"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">Esta acción descontará el stock inmediatamente y no se puede deshacer.</p>
          </div>
          <p className="text-slate-600 text-sm">¿Está seguro de que desea procesar esta desincorporación?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmApprove(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmApprove} className="bg-red-600 hover:bg-red-700 text-white">
              Procesar Salida
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showConfirmDelete}
        onClose={() => setShowConfirmDelete(null)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">¿Está seguro de que desea eliminar este registro de desincorporación? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DisincorporationPage;
