import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWarehouse } from '../features/warehouse/hooks/useWarehouse';
import { InventoryTab } from '../features/warehouse/components/InventoryTab';

const Warehouse: React.FC = () => {
  const { user } = useAuth();
  const {
    stock,
    warehouses,
    warehouseSpaces,
    products,
    providers,
    isLoading,
    getStore,
    getProduct,
    getCategory,
    getLocation,
    getProvider,
    updateMinStock,
    updateStockQuantity,
    updateProduct,
    assignSpace,
    upsertStock,
  } = useWarehouse();

  // Leer el filtro guardado desde el módulo de Infraestructura de forma síncrona
  const [initialFilters] = useState<{ spaceId: string; warehouseId: string }>(() => {
    const stored = sessionStorage.getItem('wms_inventory_filter');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.tab === 'INVENTORY') {
          sessionStorage.removeItem('wms_inventory_filter');
          return {
            spaceId: parsed.spaceId || '',
            warehouseId: parsed.warehouseId || '',
          };
        }
      } catch {}
    }
    return { spaceId: '', warehouseId: '' };
  });

  const filteredStock = stock.filter(s => {
    if (user?.role === 'DEPOSITO' && user.assignedWarehouses && user.assignedWarehouses.length > 0) {
      return user.assignedWarehouses.includes(s.warehouseId);
    }
    return true;
  });

  // Filtrar productos también por almacén asignado si aplica
  const filteredProducts = products.filter(p => {
    if (user?.role === 'DEPOSITO' && user.assignedWarehouses && user.assignedWarehouses.length > 0) {
      // Incluir producto si tiene algún stock en el almacén asignado o si no tiene stock en ningún lado
      const productStockWarehouses = stock
        .filter(s => String(s.productId) === String(p.id))
        .map(s => s.warehouseId);
      if (productStockWarehouses.length === 0) return false; // sin stock en ningún lado, no mostrar para DEPOSITO
      return productStockWarehouses.some(wId => user.assignedWarehouses!.includes(wId));
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <InventoryTab
      stock={filteredStock}
      products={filteredProducts}
      warehouses={warehouses}
      warehouseSpaces={warehouseSpaces}
      providers={providers}
      getProduct={getProduct}
      getCategory={getCategory}
      getLocation={getLocation}
      getStore={getStore}
      getProvider={getProvider}
      user={user}
      updateMinStock={updateMinStock}
      updateStockQuantity={updateStockQuantity}
      updateProduct={updateProduct}
      assignSpace={assignSpace}
      upsertStock={upsertStock}
      initialSpaceFilter={initialFilters.spaceId}
      initialWarehouseFilter={initialFilters.warehouseId}
    />
  );
};

export default Warehouse;
