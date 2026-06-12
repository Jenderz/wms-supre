import React, { useState, useEffect, useMemo } from 'react';
import { MovementApi, ProductApi, WarehouseApi, UserApi, WarehouseSpaceApi } from '../services/api';
import { StockMovement, Product, Warehouse, User, WarehouseSpace } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Search, Filter, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const StockMovements: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setStores] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [warehouseSpaces, setLocations] = useState<WarehouseSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [m, p, s, u, l] = await Promise.all([
          MovementApi.getAll(),
          ProductApi.getAll(),
          WarehouseApi.getAll(),
          UserApi.getAll(),
          WarehouseSpaceApi.getAll(),
        ]);
        setMovements((m as StockMovement[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setProducts(p as Product[]);
        setStores(s as Warehouse[]);
        setUsers(u as User[]);
        setLocations(l as WarehouseSpace[]);
      } catch (err) {
        console.error('Error cargando movimientos:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const getProduct = (id: string) => products.find(p => p.id === id);
  const getStore = (id: string) => warehouses.find(s => s.id === id);
  const getUser = (id: string) => users.find(u => u.id === id);
  const getLocation = (id: string) => warehouseSpaces.find(l => l.id === id);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const product = getProduct(m.productId);
      const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            product?.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
      const matchesStore = storeFilter === 'ALL' || m.warehouseId === storeFilter;
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const mDate = new Date(m.createdAt);
        const start = dateFrom ? startOfDay(new Date(dateFrom)) : new Date(0);
        const end = dateTo ? endOfDay(new Date(dateTo)) : new Date(8640000000000000);
        matchesDate = isWithinInterval(mDate, { start, end });
      }

      return matchesSearch && matchesType && matchesStore && matchesDate;
    });
  }, [movements, searchTerm, typeFilter, storeFilter, dateFrom, dateTo, products]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, storeFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <ArrowDownRight className="w-4 h-4 text-emerald-500" />;
      case 'OUT': return <ArrowUpRight className="w-4 h-4 text-rose-500" />;
      case 'TRANSFER': return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'IN': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OUT': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'TRANSFER': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const translateReason = (reason: string) => {
    switch (reason) {
      case 'RECEPTION': return 'Recepci贸n';
      case 'DISINCORPORATION': return 'Desincorporaci贸n';
      case 'MANUAL_ADJUSTMENT': return 'Ajuste Manual';
      case 'RELOCATION': return 'Reubicaci贸n';
      default: return reason;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por producto o c贸digo..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Todos los tipos</option>
              <option value="IN">Entradas</option>
              <option value="OUT">Salidas</option>
              <option value="TRANSFER">Transferencias</option>
            </select>
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white text-sm"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="ALL">Todas las Almacenes</option>
              {warehouses.map(Warehouse => (
                <option key={Warehouse.id} value={Warehouse.id}>{Warehouse.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 lg:col-span-2">
            <div className="relative flex-1">
              <Input
                type="date"
                className="text-sm px-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Fecha desde"
              />
            </div>
            <div className="relative flex-1">
              <Input
                type="date"
                className="text-sm px-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Fecha hasta"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Cant.</TableHead>
              <TableHead className="hidden lg:table-cell">Motivo</TableHead>
              <TableHead className="hidden lg:table-cell">Ubicaci贸n / Almac閚</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMovements.map((movement) => {
              const product = getProduct(movement.productId);
              const Warehouse = getStore(movement.warehouseId);
              const user = getUser(movement.createdBy);
              const WarehouseSpace = movement.warehouseSpaceId ? getLocation(movement.warehouseSpaceId) : null;

              return (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getMovementColor(movement.type)}`}>
                      {getMovementIcon(movement.type)}
                      {movement.type === 'IN' ? 'Entrada' : movement.type === 'OUT' ? 'Salida' : 'Transferencia'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{product?.name || 'Producto Desconocido'}</div>
                    <div className="text-xs text-slate-500 font-mono">{product?.code}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <span className={`font-bold ${movement.type === 'IN' ? 'text-emerald-600' : movement.type === 'OUT' ? 'text-rose-600' : 'text-blue-600'}`}>
                      {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}{movement.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-slate-900 font-medium">{translateReason(movement.reason)}</div>
                    {movement.notes && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1" title={movement.notes}>{movement.notes}</div>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-slate-900 font-medium">{Warehouse?.name}</div>
                    {WarehouseSpace ? (
                      <div className="text-xs text-slate-500">
                        C:{WarehouseSpace.room} E:{WarehouseSpace.shelf} Cb:{WarehouseSpace.cubicle}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Sin ubicaci贸n</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {user?.name || 'Sistema'}
                  </TableCell>
                </TableRow>
              );
            })}
            {paginatedMovements.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                  No se encontraron movimientos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-4">
        {paginatedMovements.map((movement) => {
          const product = getProduct(movement.productId);
          const Warehouse = getStore(movement.warehouseId);
          const user = getUser(movement.createdBy);
          const WarehouseSpace = movement.warehouseSpaceId ? getLocation(movement.warehouseSpaceId) : null;

          return (
            <div key={movement.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getMovementColor(movement.type)}`}>
                  {getMovementIcon(movement.type)}
                  {movement.type === 'IN' ? 'Entrada' : movement.type === 'OUT' ? 'Salida' : 'Transferencia'}
                </div>
                <span className="text-xs text-slate-500">
                  {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              
              <div>
                <div className="font-medium text-slate-900">{product?.name || 'Producto Desconocido'}</div>
                <div className="text-xs text-slate-500 font-mono">{product?.code}</div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                <div className="text-sm">
                  <span className="text-slate-500">Cant: </span>
                  <span className={`font-bold ${movement.type === 'IN' ? 'text-emerald-600' : movement.type === 'OUT' ? 'text-rose-600' : 'text-blue-600'}`}>
                    {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}{movement.quantity}
                  </span>
                </div>
                <div className="text-sm text-right">
                  <div className="font-medium text-slate-900">{translateReason(movement.reason)}</div>
                </div>
              </div>

              <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs font-medium text-slate-700">{Warehouse?.name}</div>
                  {WarehouseSpace ? (
                    <div className="text-xs text-slate-500">
                      C:{WarehouseSpace.room} E:{WarehouseSpace.shelf} Cb:{WarehouseSpace.cubicle}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Sin ubicaci贸n</div>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Por: {user?.name || 'Sistema'}
                </div>
              </div>
              {movement.notes && (
                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 italic">
                  "{movement.notes}"
                </div>
              )}
            </div>
          );
        })}
        {paginatedMovements.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-500">
            No se encontraron movimientos que coincidan con los filtros.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-2xl shadow-sm">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredMovements.length)}</span> de <span className="font-medium">{filteredMovements.length}</span> resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <span className="sr-only">Anterior</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-4 py-2 border-t border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
                  P谩gina {currentPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="sr-only">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </div>
          
          {/* Mobile pagination */}
          <div className="flex items-center justify-between w-full sm:hidden">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
