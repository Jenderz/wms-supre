import { useState, useEffect, useCallback } from 'react';
import { ProductApi, CategoryApi, WarehouseApi, PickingLotApi, UserApi, StockApi } from '../../../services/api';
import { Product, Category, Warehouse, PickingLot, User, Stock } from '../../../types';

export const usePurchasing = () => {
  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [warehouses, setStores]       = useState<Warehouse[]>([]);
  const [pickingLots, setPickingLots] = useState<PickingLot[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [stock, setStock]             = useState<Stock[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  const normalizeLots = (rawLots: any[]): PickingLot[] => {
    return (Array.isArray(rawLots) ? rawLots : []).map((lot: any) => ({
      ...lot,
      id: String(lot.id),
      warehouseId: String(lot.warehouseId),
      createdBy: String(lot.createdBy),
      items: (Array.isArray(lot.items) ? lot.items : []).map((item: any) => ({
        ...item,
        id: String(item.id),
        productId: String(item.productId),
        quantityToEnter: Number(item.quantityToEnter) || 0,
        numberOfPackages: Number(item.numberOfPackages) || 1,
        packagesConfig: Array.isArray(item.packagesConfig) ? item.packagesConfig : [],
        packageDescription: item.packageDescription || '',
        minStockAlert: Number(item.minStockAlert) || 0,
      })),
    }));
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productsData, categoriesData, storesData, lotsData, usersData, stockData] = await Promise.all([
        ProductApi.getAll(),
        CategoryApi.getAll(),
        WarehouseApi.getAll(),
        PickingLotApi.getAll(),
        UserApi.getAll(),
        StockApi.getAll(),
      ]);
      setProducts(productsData as Product[]);
      setCategories(categoriesData as Category[]);
      setStores(storesData as Warehouse[]);
      setPickingLots(normalizeLots(lotsData as any[]));
      setUsers(usersData as User[]);
      setStock(stockData as Stock[]);
    } catch (error) {
      console.error('Error loading purchasing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const savePickingLot = async (lot: PickingLot) => {
    if (lot.id) {
      await PickingLotApi.update(lot.id, lot);
    } else {
      await PickingLotApi.create(lot);
    }
    const updated = await PickingLotApi.getAll();
    setPickingLots(normalizeLots(updated as any[]));
  };

  const deletePickingLot = async (id: string) => {
    await PickingLotApi.remove(id);
    const updated = await PickingLotApi.getAll();
    setPickingLots(normalizeLots(updated as any[]));
  };

  const getProduct  = (id: string) => products.find(p => String(p.id) === String(id));
  const getCategory = (id: string) => categories.find(c => String(c.id) === String(id));
  const getStore    = (id: string) => warehouses.find(s => String(s.id) === String(id));
  const getUser     = (id: string) => users.find(u => String(u.id) === String(id));

  return {
    products,
    categories,
    warehouses,
    pickingLots,
    users,
    stock,
    isLoading,
    loadData,
    savePickingLot,
    deletePickingLot,
    getProduct,
    getCategory,
    getStore,
    getUser,
  };
};
