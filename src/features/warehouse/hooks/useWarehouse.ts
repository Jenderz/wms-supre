import { useState, useEffect } from 'react';
import { PickingLotApi, StoreApi, LocationApi, ProductApi, UserApi, CategoryApi, StockApi } from '../../../services/api';
import { PickingLot, Store, Stock, Location, Product, User, Category } from '../../../types';

export const useWarehouse = () => {
  const [lots, setLots] = useState<PickingLot[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lotsData, storesData, locationsData, productsData, usersData, categoriesData, stockData] = await Promise.all([
        PickingLotApi.getAll(),
        StoreApi.getAll(),
        LocationApi.getAll(),
        ProductApi.getAll(),
        UserApi.getAll(),
        CategoryApi.getAll(),
        StockApi.getAll(),
      ]);
      setLots(lotsData as PickingLot[]);
      setStores(storesData as Store[]);
      setLocations(locationsData as Location[]);
      setProducts(productsData as Product[]);
      setUsers(usersData as User[]);
      setCategories(categoriesData as Category[]);
      setStock(stockData as Stock[]);
    } catch (error) {
      console.error('Error loading warehouse data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Conforma un lote: el backend actualiza el stock y registra los movimientos IN.
   */
  const conformLot = async (lotId: string, _itemLocations: Record<string, string>, _userId: string) => {
    // El backend PATCH /picking-lots/{id}/conform lo maneja todo.
    await PickingLotApi.conform(lotId);
    await loadData();
  };

  /**
   * Mueve stock a una nueva ubicación llamando al endpoint /stock/move.
   */
  const updateStockLocation = async (stockId: string, newLocationId: string, quantityToMove: number, _userId: string) => {
    const stockItem = stock.find(s => String(s.id) === String(stockId));
    if (!stockItem) return;

    // Ejecuta transacción de movimiento real que resta de origen y suma al destino
    await StockApi.move({
      productId: stockItem.productId,
      storeId: stockItem.storeId,
      fromLocationId: stockItem.locationId ?? undefined, // Undefined si es del área de pendientes
      toLocationId: newLocationId,
      quantity: quantityToMove,
    });
    await loadData();
  };

  /**
   * Actualiza el stock mínimo de un producto en una tienda específica.
   */
  const updateMinStock = async (productId: string, storeId: string, newMinStock: number) => {
    const stockItem = stock.find(s =>
      String(s.productId) === String(productId) &&
      String(s.storeId) === String(storeId)
    );
    if (!stockItem) return;

    await StockApi.upsert({
      productId,
      storeId,
      locationId: stockItem.locationId ?? null,
      quantity: stockItem.quantity,
      minStock: newMinStock,
    });
    await loadData();
  };

  const getStore          = (id: string) => stores.find(s => String(s.id) === String(id));
  const getProduct        = (id: string) => products.find(p => String(p.id) === String(id));
  const getStoreLocations = (storeId: string) => locations.filter(l => String(l.storeId) === String(storeId));
  const getUser           = (id: string) => users.find(u => String(u.id) === String(id));
  const getCategory       = (id: string) => categories.find(c => String(c.id) === String(id));
  const getLocation       = (id: string) => locations.find(l => String(l.id) === String(id));

  return {
    lots,
    stores,
    locations,
    products,
    users,
    categories,
    stock,
    isLoading,
    conformLot,
    updateStockLocation,
    updateMinStock,
    getStore,
    getProduct,
    getStoreLocations,
    getUser,
    getCategory,
    getLocation,
  };
};
