import { v4 as uuidv4 } from 'uuid';
import { Category, Product, Store, Location, Stock, PickingLot, User, Disincorporation, StockMovement } from '../types';

const PREFIX = 'supre_wms_';

const getItems = <T>(key: string): T[] => {
  const data = localStorage.getItem(`${PREFIX}${key}`);
  return data ? JSON.parse(data) : [];
};

const setItems = <T>(key: string, items: T[]) => {
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(items));
};

export const StorageService = {
  getItems,
  setItems,
  // Users
  getUsers: () => getItems<User>('users'),
  saveUser: (user: User) => {
    const users = getItems<User>('users');
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push(user);
    setItems('users', users);
  },

  // Categories
  getCategories: () => getItems<Category>('categories'),
  saveCategory: (category: Category) => {
    const categories = getItems<Category>('categories');
    const index = categories.findIndex(c => c.id === category.id);
    if (index >= 0) categories[index] = category;
    else categories.push(category);
    setItems('categories', categories);
  },
  deleteCategory: (id: string) => {
    const categories = getItems<Category>('categories');
    const filtered = categories.filter(c => c.id !== id);
    setItems('categories', filtered);
  },

  // Products
  getProducts: () => getItems<Product>('products'),
  saveProduct: (product: Product) => {
    const products = getItems<Product>('products');
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) products[index] = product;
    else products.push(product);
    setItems('products', products);
  },
  setProducts: (products: Product[]) => setItems('products', products),
  deleteProduct: (id: string) => {
    const products = getItems<Product>('products');
    const filtered = products.filter(p => p.id !== id);
    setItems('products', filtered);
  },

  // Stores
  getStores: () => getItems<Store>('stores'),
  saveStore: (store: Store) => {
    const stores = getItems<Store>('stores');
    const index = stores.findIndex(s => s.id === store.id);
    if (index >= 0) stores[index] = store;
    else stores.push(store);
    setItems('stores', stores);
  },
  deleteStore: (id: string) => {
    const stores = getItems<Store>('stores');
    const filtered = stores.filter(s => s.id !== id);
    setItems('stores', filtered);
  },

  // Locations
  getLocations: () => getItems<Location>('locations'),
  saveLocation: (location: Location) => {
    const locations = getItems<Location>('locations');
    const index = locations.findIndex(l => l.id === location.id);
    if (index >= 0) locations[index] = location;
    else locations.push(location);
    setItems('locations', locations);
  },
  deleteLocation: (id: string) => {
    const locations = getItems<Location>('locations');
    const filtered = locations.filter(l => l.id !== id);
    setItems('locations', filtered);
  },

  // Stock
  getStock: () => getItems<Stock>('stock'),
  saveStock: (stock: Stock) => {
    const stocks = getItems<Stock>('stock');
    const index = stocks.findIndex(s => s.id === stock.id);
    if (index >= 0) stocks[index] = stock;
    else stocks.push(stock);
    setItems('stock', stocks);
  },

  // Picking Lots
  getPickingLots: () => getItems<PickingLot>('picking_lots'),
  savePickingLot: (lot: PickingLot) => {
    const lots = getItems<PickingLot>('picking_lots');
    const index = lots.findIndex(l => l.id === lot.id);
    if (index >= 0) lots[index] = lot;
    else lots.push(lot);
    setItems('picking_lots', lots);
  },
  deletePickingLot: (id: string) => {
    const lots = getItems<PickingLot>('picking_lots');
    const filtered = lots.filter(l => l.id !== id);
    setItems('picking_lots', filtered);
  },

  // Disincorporations
  getDisincorporations: () => getItems<Disincorporation>('disincorporations'),
  saveDisincorporation: (disincorporation: Disincorporation) => {
    const items = getItems<Disincorporation>('disincorporations');
    const index = items.findIndex(d => d.id === disincorporation.id);
    if (index >= 0) items[index] = disincorporation;
    else items.push(disincorporation);
    setItems('disincorporations', items);
  },
  deleteDisincorporation: (id: string) => {
    const items = getItems<Disincorporation>('disincorporations');
    const filtered = items.filter(d => d.id !== id);
    setItems('disincorporations', filtered);
  },

  // Stock Movements
  getStockMovements: () => getItems<StockMovement>('stock_movements'),
  saveStockMovement: (movement: StockMovement) => {
    const movements = getItems<StockMovement>('stock_movements');
    movements.push(movement);
    setItems('stock_movements', movements);
  },

  // Seeding initial data
  seedData: () => {
    const currentUsers = getItems<User>('users');
    
    // Initial seed if empty
    if (currentUsers.length === 0) {
      setItems('users', [
        { id: 'u1', name: 'Admin', username: 'admin', password: 'password', role: 'ADMIN', permissions: ['MANAGE_USERS', 'EDIT_MIN_STOCK', 'MANAGE_CATALOG', 'MANAGE_INFRASTRUCTURE', 'APPROVE_PURCHASES', 'MANAGE_DISINCORPORATION', 'VIEW_REPORTS', 'EXPORT_DATA'] },
        { id: 'u2', name: 'Ramon Gutierrez', username: 'ramon', password: 'password', role: 'COMPRAS', permissions: ['MANAGE_CATALOG', 'APPROVE_PURCHASES', 'VIEW_REPORTS'], assignedStores: ['s1'] },
        { id: 'u3', name: 'Jefe Deposito', username: 'jefe', password: 'password', role: 'DEPOSITO', permissions: ['EDIT_MIN_STOCK', 'MANAGE_INFRASTRUCTURE'] },
        { id: 'u4', name: 'Encargado Desincorporacion', username: 'encargado', password: 'password', role: 'DESINCORPORACION', permissions: ['MANAGE_DISINCORPORATION'] },
      ]);
    } else {
      // Migration: Ensure new roles exist if data already exists
      let updated = false;
      const hasDisincorporation = currentUsers.some(u => u.role === 'DESINCORPORACION');
      if (!hasDisincorporation) {
        currentUsers.push({ id: 'u4', name: 'Encargado Desincorporacion', username: 'encargado', password: 'password', role: 'DESINCORPORACION', permissions: ['MANAGE_DISINCORPORATION'] });
        updated = true;
      }
      
      // Migration: Add default permissions to existing users if they don't have any
      currentUsers.forEach(u => {
        if (!u.permissions) {
          if (u.role === 'ADMIN') u.permissions = ['MANAGE_USERS', 'EDIT_MIN_STOCK', 'MANAGE_CATALOG', 'MANAGE_INFRASTRUCTURE', 'APPROVE_PURCHASES', 'MANAGE_DISINCORPORATION', 'VIEW_REPORTS', 'EXPORT_DATA'];
          else if (u.role === 'COMPRAS') u.permissions = ['MANAGE_CATALOG', 'APPROVE_PURCHASES', 'VIEW_REPORTS'];
          else if (u.role === 'DEPOSITO') u.permissions = ['EDIT_MIN_STOCK', 'MANAGE_INFRASTRUCTURE'];
          else if (u.role === 'DESINCORPORACION') u.permissions = ['MANAGE_DISINCORPORATION'];
          updated = true;
        }
        if (!u.username) {
          u.username = u.name.toLowerCase().replace(/\s/g, '');
          u.password = 'password';
          updated = true;
        }
      });

      if (updated) {
        setItems('users', currentUsers);
      }
    }

    if (getItems<Store>('stores').length === 0) {
      setItems('stores', [
        { id: 's1', name: 'Tienda 1', description: 'Principal', qrCode: 'T001' },
      ]);
      setItems('categories', [
        { id: 'c1', name: 'Accesorios', code: 'A', description: 'Accesorios generales', qrCode: 'C001', isFractional: false },
        { id: 'c2', name: 'Luces LED para faros', code: 'J', description: 'Luces', qrCode: 'C002', isFractional: false },
      ]);
      setItems('products', [
        {
          id: 'p1', code: '2221133', name: 'Alfombra carro', imageUrl: '', footerUrl: '', categoryId: 'c1',
          dimensions: { height: 20, width: 15, depth: 30 }, costs: [10], prices: [15, 12], enabledStores: ['s1']
        },
        {
          id: 'p2', code: '1714551', name: 'Bocina claxo', imageUrl: '', footerUrl: '', categoryId: 'c1',
          dimensions: { height: 15, width: 20, depth: 30 }, costs: [8], prices: [12, 10], enabledStores: ['s1']
        },
        {
          id: 'p3', code: '3476321', name: 'Luces led', imageUrl: '', footerUrl: '', categoryId: 'c2',
          dimensions: { height: 47, width: 30, depth: 43 }, costs: [20], prices: [30, 25], enabledStores: ['s1']
        }
      ]);
      setItems('stock', [
        { id: 'st1', productId: 'p1', storeId: 's1', quantity: 30, minStock: 10 },
        { id: 'st2', productId: 'p2', storeId: 's1', quantity: 14, minStock: 5 },
        { id: 'st3', productId: 'p3', storeId: 's1', quantity: 25, minStock: 5 },
      ]);
    }
  }
};
