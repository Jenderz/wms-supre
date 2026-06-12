import { useState, useEffect } from 'react';
import { ProductApi, CategoryApi, WarehouseApi, PickingLotApi, UserApi, StockApi } from '../../../services/api';
import { Product, Category, Warehouse, PickingLot, User, Stock } from '../../../types';

export const usePurchasing = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setStores] = useState<Warehouse[]>([]);
  const [pickingLots, setPickingLots] = useState<PickingLot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
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
      setPickingLots(lotsData as PickingLot[]);
      setUsers(usersData as User[]);
      setStock(stockData as Stock[]);
    } catch (error) {
      console.error('Error loading purchasing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePickingLot = async (lot: PickingLot) => {
    if (lot.id) {
      await PickingLotApi.update(lot.id, lot);
    } else {
      await PickingLotApi.create(lot);
    }
    setPickingLots((await PickingLotApi.getAll()) as PickingLot[]);
  };

  const deletePickingLot = async (id: string) => {
    await PickingLotApi.remove(id);
    setPickingLots((await PickingLotApi.getAll()) as PickingLot[]);
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
    savePickingLot,
    deletePickingLot,
    getProduct,
    getCategory,
    getStore,
    getUser,
  };
};
