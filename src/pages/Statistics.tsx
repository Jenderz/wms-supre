import React, { useState, useEffect, useMemo } from 'react';
import { ProductApi, StockApi, StoreApi, MovementApi, DisincorporationApi } from '../services/api';
import { Product, Stock, Store, StockMovement, Disincorporation } from '../types';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Package, TrendingUp, AlertTriangle, DollarSign, Filter, Wallet, TrendingDown } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { StockMovements } from './StockMovements';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const LOSS_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#64748b', '#334155'];

export const Statistics: React.FC = () => {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');
  const [globalStoreFilter, setGlobalStoreFilter] = useState<string>('ALL');

  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [disincorporations, setDisincorporations] = useState<Disincorporation[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, s, st, m, d] = await Promise.all([
          ProductApi.getAll(),
          StockApi.getAll(),
          StoreApi.getAll(),
          MovementApi.getAll(),
          DisincorporationApi.getAll(),
        ]);
        setProducts(p as Product[]);
        setStock(s as Stock[]);
        setStores(st as Store[]);
        setMovements(m as StockMovement[]);
        setDisincorporations(d as Disincorporation[]);
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      }
    };
    load();
  }, []);

  // Protect route
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  // --- Filtered Data ---
  const filteredStock = useMemo(() => {
    if (globalStoreFilter === 'ALL') return stock;
    return stock.filter(s => s.storeId === globalStoreFilter);
  }, [stock, globalStoreFilter]);

  const filteredMovements = useMemo(() => {
    if (globalStoreFilter === 'ALL') return movements;
    return movements.filter(m => m.storeId === globalStoreFilter);
  }, [movements, globalStoreFilter]);

  const filteredDisincorporations = useMemo(() => {
    if (globalStoreFilter === 'ALL') return disincorporations;
    return disincorporations.filter(d => d.storeId === globalStoreFilter);
  }, [disincorporations, globalStoreFilter]);

  // --- Calculations ---
  const totalItemsInStock = useMemo(() => {
    return filteredStock.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [filteredStock]);

  const totalInventoryValue = useMemo(() => {
    return filteredStock.reduce((acc, curr) => {
      const product = products.find(p => p.id === curr.productId);
      const cost = product?.costs?.[0] || 0;
      return acc + (curr.quantity * cost);
    }, 0);
  }, [filteredStock, products]);

  const totalProjectedValue = useMemo(() => {
    return filteredStock.reduce((acc, curr) => {
      const product = products.find(p => p.id === curr.productId);
      const price = product?.prices?.[0] || 0;
      return acc + (curr.quantity * price);
    }, 0);
  }, [filteredStock, products]);

  const grossMargin = totalProjectedValue - totalInventoryValue;

  const lowStockAlerts = useMemo(() => {
    return filteredStock.filter(s => s.quantity <= s.minStock).length;
  }, [filteredStock]);

  // Shrinkage by Reason (Value Lost)
  const translateReason = (reason: string) => {
    switch (reason) {
      case 'DAMAGED': return 'Dañado';
      case 'EXPIRED': return 'Vencido';
      case 'LOST': return 'Extraviado';
      case 'THEFT': return 'Robo';
      case 'OBSOLETE': return 'Obsoleto';
      case 'OTHER': return 'Otro';
      default: return reason;
    }
  };

  const shrinkageData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    const approvedDisincorporations = filteredDisincorporations.filter(d => d.status === 'APPROVED');
    
    approvedDisincorporations.forEach(d => {
      d.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const cost = product?.costs?.[0] || 0;
        const lossValue = item.quantity * cost;
        
        const reasonLabel = translateReason(item.reason);
        dataMap[reasonLabel] = (dataMap[reasonLabel] || 0) + lossValue;
      });
    });
    
    return Object.entries(dataMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDisincorporations, products]);

  const totalShrinkageValue = shrinkageData.reduce((acc, curr) => acc + curr.value, 0);

  // Stock by Store for Pie Chart
  const stockByStoreData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    filteredStock.forEach(s => {
      const storeName = stores.find(st => st.id === s.storeId)?.name || 'Desconocida';
      dataMap[storeName] = (dataMap[storeName] || 0) + s.quantity;
    });
    return Object.entries(dataMap).map(([name, value]) => ({ name, value }));
  }, [filteredStock, stores]);

  // Movements last 30 days
  const movementsTrendData = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentMovements = filteredMovements.filter(m => isAfter(new Date(m.createdAt), thirtyDaysAgo));
    
    const dataMap: Record<string, { date: string, in: number, out: number }> = {};
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'MMM dd', { locale: es });
      dataMap[dateStr] = { date: dateStr, in: 0, out: 0 };
    }

    recentMovements.forEach(m => {
      const dateStr = format(new Date(m.createdAt), 'MMM dd', { locale: es });
      if (dataMap[dateStr]) {
        if (m.type === 'IN') dataMap[dateStr].in += m.quantity;
        if (m.type === 'OUT') dataMap[dateStr].out += m.quantity;
      }
    });

    return Object.values(dataMap);
  }, [filteredMovements]);

  // Top Products by Quantity
  const topProductsData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    filteredStock.forEach(s => {
      const productName = products.find(p => p.id === s.productId)?.name || 'Desconocido';
      dataMap[productName] = (dataMap[productName] || 0) + s.quantity;
    });
    
    return Object.entries(dataMap)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10); // Top 10
  }, [filteredStock, products]);

  // Fast Movers (Top 10 by OUT movements in last 30 days)
  const fastMoversData = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentOutMovements = filteredMovements.filter(m => 
      m.type === 'OUT' && isAfter(new Date(m.createdAt), thirtyDaysAgo)
    );
    
    const dataMap: Record<string, number> = {};
    recentOutMovements.forEach(m => {
      const productName = products.find(p => p.id === m.productId)?.name || 'Desconocido';
      dataMap[productName] = (dataMap[productName] || 0) + m.quantity;
    });
    
    return Object.entries(dataMap)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [filteredMovements, products]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Estadísticas y Movimientos</h1>
          <p className="text-slate-500 mt-2">Análisis global del inventario y registro detallado de operaciones.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Resumen General
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'movements' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Historial de Movimientos
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Overview Filters */}
          <div className="flex justify-end">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white text-sm font-medium text-slate-700 shadow-sm"
                value={globalStoreFilter}
                onChange={(e) => setGlobalStoreFilter(e.target.value)}
              >
                <option value="ALL">Todas las tiendas</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Artículos en Stock</p>
                <p className="text-2xl font-bold text-slate-900">{totalItemsInStock.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Costo Total Inventario</p>
                <p className="text-2xl font-bold text-slate-900">${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-violet-50 text-violet-600 rounded-2xl">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Valor de Venta Proyectado</p>
                <p className="text-2xl font-bold text-slate-900">${totalProjectedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Margen Bruto Estimado</p>
                <p className="text-2xl font-bold text-slate-900">${grossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Alertas de Stock Bajo</p>
                <p className="text-2xl font-bold text-slate-900">{lowStockAlerts}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
                <TrendingDown className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Valor Total Mermas (Pérdidas)</p>
                <p className="text-2xl font-bold text-slate-900">${totalShrinkageValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Stock by Store */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Distribución de Stock por Tienda</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockByStoreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stockByStoreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Movement Trends */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Tendencia de Movimientos (Últimos 30 días)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={movementsTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => val.toLocaleString()} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="in" name="Entradas" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="out" name="Salidas" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Top 10 Productos con Mayor Stock</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="quantity" name="Cantidad en Stock" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Fast Movers */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Top 10 Mayor Rotación (Salidas 30 días)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fastMoversData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="quantity" name="Unidades Salientes" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Shrinkage by Reason */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Valor de Mermas por Motivo (Desincorporaciones)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shrinkageData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <Bar dataKey="value" name="Valor Perdido" fill="#ef4444" radius={[4, 4, 0, 0]}>
                      {shrinkageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={LOSS_COLORS[index % LOSS_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <StockMovements />
        </div>
      )}
    </div>
  );
};

export default Statistics;
