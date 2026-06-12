import { useState, useEffect } from 'react';
import { PickingLotApi, WarehouseApi, WarehouseSpaceApi, ProductApi, UserApi, CategoryApi, StockApi, ProviderApi } from '../../../services/api';
import { PickingLot, Warehouse, Stock, WarehouseSpace, Product, User, Category, Provider } from '../../../types';

export const useWarehouse = () => {
  const [lots, setLots] = useState<PickingLot[]>([]);
  const [warehouses, setStores] = useState<Warehouse[]>([]);
  const [warehouseSpaces, setLocations] = useState<WarehouseSpace[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lotsData, storesData, locationsData, productsData, usersData, categoriesData, stockData, providersData] = await Promise.all([
        PickingLotApi.getAll(),
        WarehouseApi.getAll(),
        WarehouseSpaceApi.getAll(),
        ProductApi.getAll(),
        UserApi.getAll(),
        CategoryApi.getAll(),
        StockApi.getAll(),
        ProviderApi.getAll(),
      ]);
      setLots(lotsData as PickingLot[]);
      setStores(storesData as Warehouse[]);
      setLocations(locationsData as WarehouseSpace[]);
      setProducts(productsData as Product[]);
      setUsers(usersData as User[]);
      setCategories(categoriesData as Category[]);
      setStock(stockData as Stock[]);
      setProviders(providersData as Provider[]);
    } catch (error) {
      console.error('Error loading warehouse data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const conformLot = async (lotId: string, _itemLocations: Record<string, string>, _userId: string) => {
    await PickingLotApi.conform(lotId);
    await loadData();
  };

  const updateStockLocation = async (stockId: string, newLocationId: string, quantityToMove: number, _userId: string) => {
    const stockItem = stock.find(s => String(s.id) === String(stockId));
    if (!stockItem) return;
    await StockApi.move({
      productId: stockItem.productId,
      warehouseId: stockItem.warehouseId,
      fromLocationId: stockItem.warehouseSpaceId ?? undefined,
      toLocationId: newLocationId,
      quantity: quantityToMove,
    });
    await loadData();
  };

  const updateMinStock = async (productId: string, warehouseId: string, newMinStock: number) => {
    const stockItem = stock.find(s =>
      String(s.productId) === String(productId) &&
      String(s.warehouseId) === String(warehouseId)
    );
    if (!stockItem) return;
    await StockApi.upsert({
      productId,
      warehouseId,
      warehouseSpaceId: stockItem.warehouseSpaceId ?? null,
      quantity: stockItem.quantity,
      minStock: newMinStock,
    });
    await loadData();
  };

  const updateStockQuantity = async (stockId: string, newQuantity: number) => {
    const stockItem = stock.find(s => String(s.id) === String(stockId));
    if (!stockItem) return;
    await StockApi.upsert({
      productId: stockItem.productId,
      warehouseId: stockItem.warehouseId,
      warehouseSpaceId: stockItem.warehouseSpaceId ?? null,
      quantity: newQuantity,
      minStock: stockItem.minStock,
    });
    await loadData();
  };

  const updateProduct = async (productId: string, data: unknown) => {
    await ProductApi.update(productId, data);
    await loadData();
  };

  const upsertStock = async (payload: {
    productId: string;
    warehouseId: string;
    warehouseSpaceId: string | null;
    quantity: number;
    minStock: number;
  }) => {
    await StockApi.upsert(payload);
    await loadData();
  };

  const assignSpace = async (stockId: string, newSpaceId: string | null) => {
    const stockItem = stock.find(s => String(s.id) === String(stockId));
    if (!stockItem) return;
    if (newSpaceId) {
      await StockApi.move({
        productId: stockItem.productId,
        warehouseId: stockItem.warehouseId,
        fromLocationId: stockItem.warehouseSpaceId ?? undefined,
        toLocationId: newSpaceId,
        quantity: stockItem.quantity,
      });
    } else {
      await StockApi.upsert({
        productId: stockItem.productId,
        warehouseId: stockItem.warehouseId,
        warehouseSpaceId: null,
        quantity: stockItem.quantity,
        minStock: stockItem.minStock,
      });
    }
    await loadData();
  };

  const getStore          = (id: string) => warehouses.find(s => String(s.id) === String(id));
  const getProduct        = (id: string) => products.find(p => String(p.id) === String(id));
  const getStoreLocations = (warehouseId: string) => warehouseSpaces.filter(l => String(l.warehouseId) === String(warehouseId));
  const getUser           = (id: string) => users.find(u => String(u.id) === String(id));
  const getCategory       = (id: string) => categories.find(c => String(c.id) === String(id));
  const getLocation       = (id: string) => warehouseSpaces.find(l => String(l.id) === String(id));
  const getProvider       = (id: string) => providers.find(p => String(p.id) === String(id));

  return {
    lots, warehouses, warehouseSpaces, products, users, categories, stock, providers, isLoading,
    conformLot, updateStockLocation, updateMinStock, updateStockQuantity, updateProduct, assignSpace,
    upsertStock,
    getStore, getProduct, getStoreLocations, getUser, getCategory, getLocation, getProvider,
  };
};