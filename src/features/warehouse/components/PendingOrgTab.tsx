import React, { useState } from 'react';
import { Stock } from '../../../types';
import { Package, MapPin, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Tag, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';

interface PendingOrgTabProps {
  stock: Stock[];
  getProduct: (id: string) => any;
  getCategory: (id: string) => any;
  getStoreLocations: (storeId: string) => any[];
  updateStockLocation: (stockId: string, locationId: string, quantity: number, userId: string) => Promise<void>;
  user: any;
}

export const PendingOrgTab: React.FC<PendingOrgTabProps> = ({
  stock,
  getProduct,
  getCategory,
  getStoreLocations,
  updateStockLocation,
  user
}) => {
  const [selectedProductToOrganize, setSelectedProductToOrganize] = useState<string | null>(null);
  const [locationAssignments, setLocationAssignments] = useState<{locationId: string, quantity: number}[]>([]);

  // Group stock by product that has NO location assigned
  const pendingStockByProduct = stock.reduce((acc, s) => {
    if (!s.locationId) {
      if (!acc[s.productId]) {
        acc[s.productId] = {
          productId: s.productId,
          storeId: s.storeId,
          totalQuantity: 0,
          stockItems: []
        };
      }
      acc[s.productId].totalQuantity += Number(s.quantity);
      acc[s.productId].stockItems.push(s);
    }
    return acc;
  }, {} as Record<string, { productId: string, storeId: string, totalQuantity: number, stockItems: Stock[] }>);

  const handleSelectToOrganize = (productId: string) => {
    setSelectedProductToOrganize(productId);
    setLocationAssignments([{ locationId: '', quantity: pendingStockByProduct[productId].totalQuantity }]);
  };

  const handleAddLocationAssignment = () => {
    setLocationAssignments([...locationAssignments, { locationId: '', quantity: 0 }]);
  };

  const handleUpdateLocationAssignment = (index: number, field: 'locationId' | 'quantity', value: any) => {
    const newAssignments = [...locationAssignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setLocationAssignments(newAssignments);
  };

  const handleRemoveLocationAssignment = (index: number) => {
    setLocationAssignments(locationAssignments.filter((_, i) => i !== index));
  };

  const handleSaveOrganization = async () => {
    if (!selectedProductToOrganize) return;

    const pendingData = pendingStockByProduct[selectedProductToOrganize];
    const totalAssigned = locationAssignments.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

    if (totalAssigned !== pendingData.totalQuantity) {
      alert(`La cantidad asignada (${totalAssigned}) no coincide con la cantidad pendiente (${pendingData.totalQuantity}).`);
      return;
    }

    if (locationAssignments.some(a => !a.locationId)) {
      alert('Todas las asignaciones deben tener una ubicación seleccionada.');
      return;
    }

    // Process assignments sequentially to avoid race conditions in stock updates
    let remainingStockItems = [...pendingData.stockItems];
    
    for (const assignment of locationAssignments) {
      let quantityNeeded = assignment.quantity;
      
      while (quantityNeeded > 0 && remainingStockItems.length > 0) {
        const currentStock = remainingStockItems[0];
        
        if (currentStock.quantity <= quantityNeeded) {
          // Use entire stock item
          await updateStockLocation(currentStock.id, assignment.locationId, currentStock.quantity, user?.id);
          quantityNeeded -= currentStock.quantity;
          remainingStockItems.shift(); // Remove from list
        } else {
          // Split stock item
          await updateStockLocation(currentStock.id, assignment.locationId, quantityNeeded, user?.id);
          // Update remaining quantity in memory for next iterations if needed
          currentStock.quantity -= quantityNeeded;
          quantityNeeded = 0;
        }
      }
    }

    // Reset state
    setSelectedProductToOrganize(null);
    setLocationAssignments([]);
    alert('Mercancía organizada exitosamente.');
  };

  if (selectedProductToOrganize) {
    const pendingData = pendingStockByProduct[selectedProductToOrganize];
    const product = getProduct(selectedProductToOrganize);
    const category = getCategory(product?.categoryId || '');
    const availableLocations = getStoreLocations(pendingData.storeId);
    const totalAssigned = locationAssignments.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
    const isBalanced = totalAssigned === pendingData.totalQuantity;

    return (
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedProductToOrganize(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Organizar: {product?.name}
            </h1>
            <p className="text-slate-500 mt-1">
              Asignar ubicaciones físicas para la mercancía recibida.
            </p>
          </div>
          <Button 
            onClick={handleSaveOrganization} 
            disabled={!isBalanced || locationAssignments.some(a => !a.locationId)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 w-full sm:w-auto"
          >
            <CheckCircle2 className="w-5 h-5" />
            Guardar Ubicaciones
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-fit">
            <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">Resumen de Mercancía</h3>
            
            <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg">{product?.name}</p>
                <p className="text-sm text-slate-500 font-mono">{product?.code}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-100">
                <span className="font-medium">Total a Organizar:</span>
                <span className="text-2xl font-bold">{Number(pendingData.totalQuantity)}</span>
              </div>
              
              <div className={`flex justify-between items-center p-3 rounded-xl border ${isBalanced ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-amber-50 text-amber-900 border-amber-100'}`}>
                <span className="font-medium">Total Asignado:</span>
                <span className="text-xl font-bold">{Number(totalAssigned)}</span>
              </div>

              {!isBalanced && (
                <div className="flex items-start gap-2 text-amber-600 text-sm mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>La cantidad asignada debe ser exactamente igual a la cantidad total a organizar.</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Asignación de Ubicaciones
                </h3>
                <Button variant="outline" size="sm" onClick={handleAddLocationAssignment}>
                  + Añadir Ubicación
                </Button>
              </div>

              <div className="space-y-4">
                {locationAssignments.map((assignment, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Ubicación</label>
                      <select
                        value={assignment.locationId}
                        onChange={(e) => handleUpdateLocationAssignment(index, 'locationId', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                      >
                        <option value="">Seleccione ubicación...</option>
                        {availableLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.room} - Estante {loc.shelf} - Cubículo {loc.cubicle}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-32">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                      <Input
                        type="number"
                        min="1"
                        value={assignment.quantity}
                        onChange={(e) => handleUpdateLocationAssignment(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full text-center font-mono"
                      />
                    </div>
                    {locationAssignments.length > 1 && (
                      <button 
                        onClick={() => handleRemoveLocationAssignment(index)}
                        className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-auto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Pendiente por Organizar</h1>
          <p className="text-slate-500 mt-2">Mercancía recibida que requiere asignación de ubicación física.</p>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[1000px] px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Letra</TableHead>
                  <TableHead className="text-center">Cant. Pendiente</TableHead>
                  <TableHead className="text-center">Alerta Stock Min.</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(pendingStockByProduct).map((data: { productId: string, storeId: string, totalQuantity: number, stockItems: Stock[] }) => {
                  const product = getProduct(data.productId);
                  const category = getCategory(product?.categoryId || '');
                  // Calculate min stock across all stock items for this product
                  const minStock = data.stockItems.reduce((acc, curr) => Math.max(acc, curr.minStock), 0);
                  const isLowStock = data.totalQuantity <= minStock;

                  return (
                    <TableRow key={data.productId} className="group hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono text-slate-500">{product?.code}</TableCell>
                      <TableCell className="font-medium text-slate-900">{product?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{category?.name || 'Sin Categoría'}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-slate-700">
                        {category?.code || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                          {Number(data.totalQuantity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono ${isLowStock ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                          {minStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleSelectToOrganize(data.productId)}>
                          Seleccionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(pendingStockByProduct).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                      No hay mercancía pendiente por organizar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};
