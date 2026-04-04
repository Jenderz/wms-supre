import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProductApi, StockApi, PickingLotApi } from '../services/api';
import { Product, Stock, PickingLot } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Package, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [lots, setLots] = useState<PickingLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [p, s, l] = await Promise.all([
          ProductApi.getAll(),
          StockApi.getAll(),
          PickingLotApi.getAll(),
        ]);
        setProducts(p as Product[]);
        setStock(s as Stock[]);
        setLots(l as PickingLot[]);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const totalProducts = products.length;
  const lowStockItems = stock.filter(s => s.quantity <= s.minStock).length;
  const pendingLots   = lots.filter(l => l.status === 'PENDING').length;
  const conformedLots = lots.filter(l => l.status === 'CONFORMED').length;

  const chartData = products.map(p => {
    const pStock = stock
      .filter(s => String(s.productId) === String(p.id))
      .reduce((acc, curr) => acc + Number(curr.quantity), 0);
    return { name: p.name, stock: pStock };
  }).slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
        <p className="text-slate-500 mt-2">Resumen de operaciones y estado del almacén.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Total Productos"      value={totalProducts} icon={Package}     color="text-blue-600"   bg="bg-blue-50" />
        <StatCard title="Alertas Stock Mínimo" value={lowStockItems} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" />
        <StatCard title="Lotes Pendientes"     value={pendingLots}   icon={Clock}        color="text-purple-600" bg="bg-purple-50" />
        <StatCard title="Lotes Conformados"    value={conformedLots} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm mt-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Top 5 Productos por Stock</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
              <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a' }}
                itemStyle={{ color: '#2563eb' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="stock" name="Stock Actual" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex items-center gap-4">
    <div className={`p-4 rounded-2xl ${bg}`}>
      <Icon className={`w-8 h-8 ${color}`} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  </div>
);

export default Dashboard;
