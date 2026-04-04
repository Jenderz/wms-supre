import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWarehouse } from '../features/warehouse/hooks/useWarehouse';
import { PickingListTab } from '../features/warehouse/components/PickingListTab';
import { PendingOrgTab } from '../features/warehouse/components/PendingOrgTab';
import { InventoryTab } from '../features/warehouse/components/InventoryTab';

const Warehouse: React.FC = () => {
  const { user } = useAuth();
  const { 
    lots, 
    stock,
    stores,
    isLoading, 
    conformLot, 
    updateStockLocation,
    getStore, 
    getProduct, 
    getStoreLocations,
    getUser,
    getCategory,
    getLocation,
    updateMinStock
  } = useWarehouse();
  
  const [activeTab, setActiveTab] = useState<'PICKING' | 'PENDING_ORG' | 'INVENTORY'>('PICKING');

  const filteredLots = lots.filter(lot => {
    if (user?.role === 'DEPOSITO' && user.assignedStores && user.assignedStores.length > 0) {
      return user.assignedStores.includes(lot.storeId);
    }
    return true;
  });

  const filteredStock = stock.filter(s => {
    if (user?.role === 'DEPOSITO' && user.assignedStores && user.assignedStores.length > 0) {
      return user.assignedStores.includes(s.storeId);
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
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6 no-print scrollbar-hide">
        <button
          onClick={() => setActiveTab('PICKING')}
          className={`whitespace-nowrap px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PICKING' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Lista de Picking
        </button>
        <button
          onClick={() => setActiveTab('PENDING_ORG')}
          className={`whitespace-nowrap px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PENDING_ORG' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Pendiente por Organizar
        </button>
        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`whitespace-nowrap px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'INVENTORY' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Inventario
        </button>
      </div>

      {/* Render Active Tab Content */}
      {activeTab === 'PICKING' && (
        <PickingListTab 
          lots={filteredLots}
          getStore={getStore}
          getUser={getUser}
          getProduct={getProduct}
          getCategory={getCategory}
          conformLot={conformLot}
          user={user}
          isLoading={isLoading}
        />
      )}
      {activeTab === 'PENDING_ORG' && (
        <PendingOrgTab 
          stock={filteredStock}
          stores={stores}
          getProduct={getProduct}
          getCategory={getCategory}
          getStore={getStore}
          getStoreLocations={getStoreLocations}
          updateStockLocation={updateStockLocation}
          user={user}
        />
      )}
      {activeTab === 'INVENTORY' && (
        <InventoryTab 
          stock={filteredStock}
          stores={stores}
          getProduct={getProduct}
          getCategory={getCategory}
          getLocation={getLocation}
          getStore={getStore}
          user={user}
          updateMinStock={updateMinStock}
        />
      )}
    </div>
  );
};

export default Warehouse;
