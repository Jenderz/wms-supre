import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Stock, User } from '../../../types';
import { Search, Printer, MapPin, ChevronDown, ChevronRight, Box, ScanLine, Edit2, Check, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { QRScannerModal } from '../../../components/QRScannerModal';

interface InventoryTabProps {
  stock: Stock[];
  getProduct: (id: string) => any;
  getCategory: (id: string) => any;
  getLocation: (id: string) => any;
  user: User | null;
  updateMinStock: (productId: string, storeId: string, newMinStock: number) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  stock,
  getProduct,
  getCategory,
  getLocation,
  user,
  updateMinStock
}) => {
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingMinStock, setEditingMinStock] = useState<{ productId: string, storeId: string } | null>(null);
  const [minStockValue, setMinStockValue] = useState<string>('');

  const canEditMinStock = user?.role === 'ADMIN' || user?.permissions?.includes('EDIT_MIN_STOCK');

  const toggleProductExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handlePrintInventory = () => {
    window.print();
  };

  const filteredInventory = stock.filter(s => {
    const product = getProduct(s.productId);
    if (!product) return false;
    
    const matchesSearch = product.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                          product.code.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === '' || product.categoryId === inventoryCategoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = Array.from(new Set(stock.map(s => getProduct(s.productId)?.categoryId))).filter(Boolean);

  const groupedInventory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = [];
    }
    acc[item.productId].push(item);
    return acc;
  }, {} as Record<string, Stock[]>);

  const handleSaveMinStock = (productId: string, storeId: string) => {
    const value = parseInt(minStockValue);
    if (!isNaN(value) && value >= 0) {
      updateMinStock(productId, storeId, value);
    }
    setEditingMinStock(null);
  };

  const renderMinStockCell = (productId: string, storeId: string, minStock: number, isLowStock: boolean) => {
    const isEditing = editingMinStock?.productId === productId && editingMinStock?.storeId === storeId;

    if (isEditing) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Input 
            type="number" 
            min="0" 
            value={minStockValue} 
            onChange={(e) => setMinStockValue(e.target.value)}
            className="w-16 h-8 text-center px-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveMinStock(productId, storeId);
              if (e.key === 'Escape') setEditingMinStock(null);
            }}
          />
          <button onClick={() => handleSaveMinStock(productId, storeId)} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditingMinStock(null)} className="p-1 text-red-600 hover:bg-red-50 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 group/minstock">
        <span className={`font-mono ${isLowStock ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
          {minStock}
        </span>
        {canEditMinStock && (
          <button 
            onClick={() => {
              setEditingMinStock({ productId, storeId });
              setMinStockValue(minStock.toString());
            }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover/minstock:opacity-100 transition-opacity"
            title="Editar Stock Mínimo"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Inventario</h1>
          <p className="text-slate-500 mt-2">Visión global del stock y sus ubicaciones.</p>
        </div>
        <Button variant="secondary" onClick={handlePrintInventory} className="gap-2 no-print w-full sm:w-auto">
          <Printer className="w-4 h-4" />
          Imprimir Lista
        </Button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Filtrar por Categoría:</span>
          <select
            value={inventoryCategoryFilter}
            onChange={(e) => setInventoryCategoryFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
          >
            <option value="">Todas</option>
            {uniqueCategories.map(catId => {
              const cat = getCategory(catId as string);
              return cat ? <option key={cat.id} value={cat.id}>{cat.name}</option> : null;
            })}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Buscador:</span>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Código o nombre del producto..." 
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="pl-9 py-2 h-auto w-full"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[1000px] px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Letra</TableHead>
                  <TableHead className="text-center">Cant. con Ubicación</TableHead>
                  <TableHead className="text-center">Cant. Pendiente</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Ubicación Principal</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-center">Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedInventory).map(([productId, items]: [string, Stock[]]) => {
                  const product = getProduct(productId);
                  const category = getCategory(product?.categoryId || '');
                  
                  const totalWithLocation = items.filter(i => i.locationId).reduce((acc, curr) => acc + Number(curr.quantity), 0);
                  const totalPending = items.filter(i => !i.locationId).reduce((acc, curr) => acc + Number(curr.quantity), 0);
                  const totalQuantity = totalWithLocation + totalPending;
                  const minStock = items.reduce((acc, curr) => Math.max(acc, curr.minStock), 0);
                  const isLowStock = totalQuantity <= minStock;
                  
                  const hasMultipleLocations = items.filter(i => i.locationId).length > 1;
                  const isExpanded = expandedProducts.has(productId);

                  return (
                    <React.Fragment key={productId}>
                      <TableRow className={`group transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <TableCell>
                          {hasMultipleLocations && (
                            <button 
                              onClick={() => toggleProductExpand(productId)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500">{product?.code}</TableCell>
                        <TableCell className="font-medium text-slate-900">{product?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{category?.name || 'Sin Categoría'}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-slate-700">
                          {category?.code || '-'}
                        </TableCell>
                        <TableCell className="text-center text-emerald-600 font-medium">
                          {totalWithLocation}
                        </TableCell>
                        <TableCell className="text-center text-amber-600 font-medium">
                          {totalPending}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                            {totalQuantity}
                          </span>
                        </TableCell>
                        
                        {!hasMultipleLocations ? (
                          <>
                            <TableCell className={!items[0].locationId ? 'text-slate-400 italic' : ''}>
                              {items[0].locationId ? getLocation(items[0].locationId)?.room : 'Sin asignar'}
                            </TableCell>
                            <TableCell className={!items[0].locationId ? 'text-slate-400 italic' : ''}>
                              {items[0].locationId ? `Estante ${getLocation(items[0].locationId)?.shelf} - Cub. ${getLocation(items[0].locationId)?.cubicle}` : '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {renderMinStockCell(productId, items[0].storeId, minStock, isLowStock)}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell colSpan={2} className="text-slate-400 italic text-center">
                              Ver detalles de ubicaciones ({items.length})
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {renderMinStockCell(productId, items[0].storeId, minStock, isLowStock)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                      
                      {hasMultipleLocations && isExpanded && items.map((item) => {
                        const location = item.locationId ? getLocation(item.locationId) : null;
                        return (
                          <TableRow key={item.id} className="bg-slate-50/50">
                            <TableCell colSpan={8} className="border-r border-slate-100"></TableCell>
                            <TableCell className={!location ? 'text-slate-400 italic pl-8' : 'pl-8'}>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {location ? location.room : 'Sin asignar'}
                              </div>
                            </TableCell>
                            <TableCell className={!location ? 'text-slate-400 italic' : ''}>
                              {location ? `Estante ${location.shelf} - Cub. ${location.cubicle}` : '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium text-blue-600">
                              {Number(item.quantity)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {Object.keys(groupedInventory).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-slate-500">
                      No se encontraron registros en el inventario.
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
