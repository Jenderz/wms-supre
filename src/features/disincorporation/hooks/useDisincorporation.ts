import { useState, useEffect } from 'react';
import { DisincorporationApi, ProductApi, WarehouseApi, StockApi, WarehouseSpaceApi } from '../../../services/api';
import { Disincorporation, Product, Warehouse, Stock, WarehouseSpace } from '../../../types';

export const useDisincorporation = () => {
  const [disincorporations, setDisincorporations] = useState<Disincorporation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setStores] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [warehouseSpaces, setLocations] = useState<WarehouseSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [disData, prodData, storeData, stockData, locData] = await Promise.all([
        DisincorporationApi.getAll(),
        ProductApi.getAll(),
        WarehouseApi.getAll(),
        StockApi.getAll(),
        WarehouseSpaceApi.getAll(),
      ]);
      setDisincorporations(disData as Disincorporation[]);
      setProducts(prodData as Product[]);
      setStores(storeData as Warehouse[]);
      setStock(stockData as Stock[]);
      setLocations(locData as WarehouseSpace[]);
    } catch (error) {
      console.error('Error loading disincorporation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveDisincorporation = async (data: Disincorporation) => {
    await DisincorporationApi.create(data);
    setDisincorporations((await DisincorporationApi.getAll()) as Disincorporation[]);
  };

  const deleteDisincorporation = async (_id: string) => {
    // El API no expone DELETE en desincorporaciones (regla de negocio).
    // Si se necesita, se puede agregar. Por ahora solo recarga.
    await loadData();
  };

  const approveDisincorporation = async (id: string, _userId: string) => {
    // El backend maneja la reducción de stock y el movimiento OUT automáticamente.
    await DisincorporationApi.approve(id);
    await loadData();
  };

  const refreshData = () => {
    loadData();
  };

  return {
    disincorporations,
    products,
    warehouses,
    stock,
    warehouseSpaces,
    isLoading,
    saveDisincorporation,
    deleteDisincorporation,
    approveDisincorporation,
    refreshData,
  };
};
