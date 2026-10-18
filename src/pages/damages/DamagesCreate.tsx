import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DamageApi,
  WarehouseApi,
  WarehouseSpaceApi,
  ProductApi,
  UserApi,
  StockApi,
} from '../../services/api';
import {
  Warehouse,
  WarehouseSpace,
  Product,
  User,
  Stock,
  SpaceDistributionItem,
} from '../../types';
import {
  Building2,
  User as UserIcon,
  Search,
  ScanLine,
  Trash2,
  Save,
  Boxes,
  Minus,
  Plus,
  Loader2,
  AlertTriangle,
  Flame,
  Check,
} from 'lucide-react';
import { SpaceDistributionPopover, SpaceOption } from '../../components/SpaceDistributionPopover';
import { QRScannerModal } from '../../components/QRScannerModal';

interface DamageItemRow {
  productId: string;
  productCode: string;
  productName: string;
  imageUrl?: string;
  stockActual: number;
  quantity: number;
  spacesDistribution: SpaceDistributionItem[];
}

export const DamagesCreate: React.FC = () => {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [spaces, setSpaces] = useState<WarehouseSpace[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Formulario cabecera
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryCorrection, setInventoryCorrection] = useState<boolean>(true);
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [description, setDescription] = useState('');

  // Ítems
  const [items, setItems] = useState<DamageItemRow[]>([]);

  // Buscador
  const [productSearch, setProductSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [whs, sps, prods, usrs, stks] = await Promise.all([
          WarehouseApi.getAll(),
          WarehouseSpaceApi.getAll(),
          ProductApi.getAll(),
          UserApi.getAll(),
          StockApi.getAll(),
        ]);
        setWarehouses(whs as Warehouse[]);
        setSpaces(sps as WarehouseSpace[]);
        setProducts(prods as Product[]);
        setUsers(usrs as User[]);
        setStock(stks as Stock[]);

        if (whs.length > 0) {
          setWarehouseId(String(whs[0].id));
        }
        if (usrs.length > 0) {
          setResponsibleUserId(String(usrs[0].id));
        }
      } catch (err) {
        console.error('Error inicializando DamagesCreate:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const warehouseSpaces = spaces.filter(s => String(s.warehouseId) === String(warehouseId));

  const getSpacesForProduct = (productId: string): SpaceOption[] => {
    return warehouseSpaces.map(sp => {
      const stockRow = stock.find(
        s =>
          String(s.productId) === String(productId) &&
          String(s.warehouseId) === String(warehouseId) &&
          String(s.warehouseSpaceId) === String(sp.id)
      );
      return {
        id: String(sp.id),
        name: sp.name,
        spaceUsageType: sp.spaceUsageType,
        stockQty: stockRow ? Number(stockRow.quantity) : 0,
      };
    });
  };

  const handleAddProduct = (prod: Product) => {
    if (items.some(it => it.productId === String(prod.id))) {
      return;
    }

    const whStock = stock.filter(
      s => String(s.productId) === String(prod.id) && String(s.warehouseId) === String(warehouseId)
    );
    const totalStk = whStock.reduce((sum, s) => sum + Number(s.quantity), 0);

    const spaceWithStock = whStock.find(s => s.warehouseSpaceId && Number(s.quantity) > 0);
    const initialSpaces: SpaceDistributionItem[] = [];
    if (spaceWithStock && spaceWithStock.warehouseSpaceId) {
      const spObj = spaces.find(sp => String(sp.id) === String(spaceWithStock.warehouseSpaceId));
      if (spObj) {
        initialSpaces.push({
          warehouseSpaceId: String(spObj.id),
          spaceName: spObj.name,
          quantity: 1,
        });
      }
    }

    const newItem: DamageItemRow = {
      productId: String(prod.id),
      productCode: prod.code,
      productName: prod.name,
      imageUrl: prod.imageUrl,
      stockActual: totalStk,
      quantity: 1,
      spacesDistribution: initialSpaces,
    };

    setItems(prev => [newItem, ...prev]);
    setProductSearch('');
  };

  const updateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    setItems(prev => {
      const next = [...prev];
      const cur = next[index];
      let newDist = [...cur.spacesDistribution];
      if (newDist.length === 1) {
        newDist[0] = { ...newDist[0], quantity: qty };
      }
      next[index] = { ...cur, quantity: qty, spacesDistribution: newDist };
      return next;
    });
  };

  const updateItemSpaces = (index: number, dist: SpaceDistributionItem[]) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], spacesDistribution: dist };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalBajaUnits = items.reduce((sum, it) => sum + it.quantity, 0);

  const handleSave = async (status: 'DRAFT' | 'PENDING') => {
    setError(null);

    if (!warehouseId) {
      setError('Debe seleccionar el almacén.');
      return;
    }

    if (!responsibleUserId) {
      setError('Debe asignar el usuario responsable.');
      return;
    }

    if (items.length === 0) {
      setError('Debe agregar al menos un producto con avería.');
      return;
    }

    // Validar asignación de espacios solo si corrección de inventario = Sí
    if (status === 'PENDING' && inventoryCorrection) {
      for (const it of items) {
        const assigned = it.spacesDistribution.reduce((sum, sp) => sum + (Number(sp.quantity) || 0), 0);
        if (Math.abs(assigned - it.quantity) > 0.0001) {
          setError(
            `El producto "${it.productName}" tiene asignado ${assigned} u. en espacios pero la cantidad a desincorporar es ${it.quantity} u.`
          );
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        warehouseId,
        responsibleUserId,
        inventoryCorrection,
        description,
        status,
        items: items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          spacesDistribution: inventoryCorrection ? it.spacesDistribution : null,
        })),
      };

      await DamageApi.createBatch(payload);
      navigate('/damages/list');
    } catch (err: any) {
      setError(err?.message || 'Error al guardar averías');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = productSearch.trim()
    ? products
        .filter(
          p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.code.toLowerCase().includes(productSearch.toLowerCase())
        )
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjeta 1: Parámetros de Avería */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-600" />
          <span>Parámetros de Avería</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Almacén Origen *</label>
            <select
              value={warehouseId}
              onChange={e => {
                const newWid = e.target.value;
                setWarehouseId(newWid);
                setItems(prev =>
                  prev.map(it => {
                    const whStock = stock.filter(
                      s => String(s.productId) === String(it.productId) && String(s.warehouseId) === String(newWid)
                    );
                    const totalStk = whStock.reduce((sum, s) => sum + Number(s.quantity), 0);
                    const spaceWithStock = whStock.find(s => s.warehouseSpaceId && Number(s.quantity) > 0);
                    const initialSpaces: SpaceDistributionItem[] = [];
                    if (spaceWithStock && spaceWithStock.warehouseSpaceId) {
                      const spObj = spaces.find(sp => String(sp.id) === String(spaceWithStock.warehouseSpaceId));
                      if (spObj) {
                        initialSpaces.push({
                          warehouseSpaceId: String(spObj.id),
                          spaceName: spObj.name,
                          quantity: it.quantity,
                        });
                      }
                    }
                    return {
                      ...it,
                      stockActual: totalStk,
                      spacesDistribution: initialSpaces,
                    };
                  })
                );
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Corrección Inventario *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInventoryCorrection(true)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  inventoryCorrection
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sí (Descontar)
              </button>
              <button
                type="button"
                onClick={() => setInventoryCorrection(false)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  !inventoryCorrection
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                No (Solo Auditoría)
              </button>
            </div>
          </div>

          <div className="md:col-span-5 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Agregar Producto *</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                title="Escanear producto"
              >
                <ScanLine className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown de búsqueda */}
            {filteredProducts.length > 0 && (
              <div className="absolute z-40 mt-1 w-full bg-white rounded-2xl shadow-xl border border-slate-200 py-1 max-h-60 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <Boxes className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-800">{p.name}</div>
                        <div className="text-[10px] font-mono text-blue-600">{p.code}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">
                      + Agregar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tarjeta 2: Responsable y Observaciones */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-rose-600" />
          <span>Descripción / Observación</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Responsable *</label>
            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <select
                value={responsibleUserId}
                onChange={e => setResponsibleUserId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-8">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observación de la Avería</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej. Mercancía rota por caída en estantería..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>
        </div>
      </div>

      {/* Tabla Detalle de Averías */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Detalle de Averías</h3>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800">
              {items.length} productos
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
              Vaciar Lista
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12">Imagen</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-center w-36">Stock Desincorporar</th>
                <th className="py-3 px-4 w-60">Espacio Almacén</th>
                <th className="py-3 px-4 text-center">Total Restante</th>
                <th className="py-3 px-4 text-right w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Utilice el buscador superior para agregar productos averiados
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const restante = inventoryCorrection
                    ? item.stockActual - item.quantity
                    : item.stockActual;
                  const productSpaces = getSpacesForProduct(item.productId);

                  return (
                    <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <Boxes className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="font-mono text-[11px] text-blue-600 font-semibold">{item.productCode}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{item.stockActual} u.</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateItemQty(index, item.quantity - 1)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateItemQty(index, parseFloat(e.target.value) || 1)}
                            className="w-14 px-1 py-1 text-center font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(index, item.quantity + 1)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {inventoryCorrection ? (
                          <SpaceDistributionPopover
                            spaces={productSpaces}
                            targetQuantity={item.quantity}
                            value={item.spacesDistribution}
                            onChange={dist => updateItemSpaces(index, dist)}
                          />
                        ) : (
                          <div className="text-center py-1.5 px-3 bg-slate-100 rounded-xl text-slate-400 text-xs italic font-medium">
                            No aplica (Sin corrección)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={restante < 0 ? 'text-red-600' : 'text-slate-800'}>
                          {restante} u.
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-700">
            Total a dar de baja: <span className="text-rose-600 font-extrabold">{totalBajaUnits}</span> Unidades
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSaving || items.length === 0}
              onClick={() => handleSave('DRAFT')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Borrador</span>
            </button>

            <button
              type="button"
              disabled={isSaving || items.length === 0}
              onClick={() => handleSave('PENDING')}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm shadow-rose-500/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Guardar Registro Avería</span>
            </button>
          </div>
        </div>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={code => {
          setIsScannerOpen(false);
          const found = products.find(p => p.code.toLowerCase() === code.toLowerCase());
          if (found) {
            handleAddProduct(found);
          } else {
            setProductSearch(code);
          }
        }}
        title="Escanear Producto Averiado"
      />
    </div>
  );
};

export default DamagesCreate;
