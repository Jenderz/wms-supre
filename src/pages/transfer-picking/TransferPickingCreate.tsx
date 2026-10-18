import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TransferPickingApi,
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
  Printer,
  Save,
  Send,
  Boxes,
  Minus,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { SpaceDistributionPopover, SpaceOption } from '../../components/SpaceDistributionPopover';
import { QRScannerModal } from '../../components/QRScannerModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface TransferItemRow {
  productId: string;
  productCode: string;
  productName: string;
  imageUrl?: string;
  categoryName?: string;
  numberOfPackages: number;
  stockActual: number;
  quantity: number;
  spacesDistribution: SpaceDistributionItem[];
}

export const TransferPickingCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [spaces, setSpaces] = useState<WarehouseSpace[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Formulario cabecera
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [description, setDescription] = useState('');

  // Ítems
  const [items, setItems] = useState<TransferItemRow[]>([]);

  // Buscador de productos
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

        if (whs.length >= 2) {
          setOriginWarehouseId(String(whs[0].id));
          setDestinationWarehouseId(String(whs[1].id));
        }
        if (usrs.length > 0) {
          setResponsibleUserId(String(usrs[0].id));
        }

        // Si es edición de un picking existente
        if (editId) {
          const existing = await TransferPickingApi.getById(editId);
          if (existing) {
            setOriginWarehouseId(String(existing.originWarehouseId));
            setDestinationWarehouseId(String(existing.destinationWarehouseId));
            setResponsibleUserId(String(existing.responsibleUserId));
            setDescription(existing.description || '');

            const mappedItems: TransferItemRow[] = (existing.items || []).map(it => {
              const p = (prods as Product[]).find(prod => String(prod.id) === String(it.productId));
              const whStock = (stks as Stock[]).filter(
                s => String(s.productId) === String(it.productId) && String(s.warehouseId) === String(existing.originWarehouseId)
              );
              const totalStk = whStock.reduce((sum, s) => sum + Number(s.quantity), 0);

              return {
                productId: String(it.productId),
                productCode: it.productCode || p?.code || '—',
                productName: it.productName || p?.name || '—',
                imageUrl: it.imageUrl || p?.imageUrl,
                categoryName: it.categoryName,
                numberOfPackages: 1,
                stockActual: totalStk,
                quantity: it.quantity,
                spacesDistribution: it.spacesDistribution || [],
              };
            });
            setItems(mappedItems);
          }
        }
      } catch (err) {
        console.error('Error inicializando TransferPickingCreate:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [editId]);

  // Espacios del almacén origen
  const originSpaces = spaces.filter(s => String(s.warehouseId) === String(originWarehouseId));

  const getSpacesForProduct = (productId: string): SpaceOption[] => {
    return originSpaces.map(sp => {
      const stockRow = stock.find(
        s =>
          String(s.productId) === String(productId) &&
          String(s.warehouseId) === String(originWarehouseId) &&
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
      return; // ya agregado
    }

    const whStock = stock.filter(
      s => String(s.productId) === String(prod.id) && String(s.warehouseId) === String(originWarehouseId)
    );
    const totalStk = whStock.reduce((sum, s) => sum + Number(s.quantity), 0);

    // Sugerir primer espacio con stock si existe
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

    const newItem: TransferItemRow = {
      productId: String(prod.id),
      productCode: prod.code,
      productName: prod.name,
      imageUrl: prod.imageUrl,
      numberOfPackages: 1,
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
      // Si solo hay un espacio asignado, sincronizar su cantidad
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

  const handleClearList = () => {
    if (items.length > 0 && confirm('¿Desea vaciar todos los productos seleccionados?')) {
      setItems([]);
    }
  };

  // Validación y envío
  const handleSave = async (status: 'DRAFT' | 'PENDING') => {
    setError(null);

    if (!originWarehouseId || !destinationWarehouseId) {
      setError('Debe seleccionar los almacenes de origen y destino.');
      return;
    }

    if (originWarehouseId === destinationWarehouseId) {
      setError('El almacén de origen y destino no pueden ser iguales.');
      return;
    }

    if (!responsibleUserId) {
      setError('Debe asignar un usuario responsable de la transferencia.');
      return;
    }

    if (items.length === 0) {
      setError('Debe agregar al menos un producto al picking de transferencia.');
      return;
    }

    // Si se envía (PENDING), validar que la distribución por espacio cuadre
    if (status === 'PENDING') {
      for (const it of items) {
        const assigned = it.spacesDistribution.reduce((sum, sp) => sum + (Number(sp.quantity) || 0), 0);
        if (Math.abs(assigned - it.quantity) > 0.0001) {
          setError(
            `El producto "${it.productName}" tiene asignado ${assigned} u. en espacios pero la cantidad a transferir es ${it.quantity} u.`
          );
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        originWarehouseId,
        destinationWarehouseId,
        responsibleUserId,
        description,
        status,
        items: items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          numberOfPackages: 1, // 1 ítem = 1 bulto
          spacesDistribution: it.spacesDistribution,
        })),
      };

      if (editId) {
        await TransferPickingApi.update(editId, payload);
      } else {
        await TransferPickingApi.create(payload);
      }

      navigate('/transfer-picking/list');
    } catch (err: any) {
      setError(err?.message || 'Error al guardar la transferencia');
    } finally {
      setIsSaving(false);
    }
  };

  // Imprimir PDF
  const handlePrint = () => {
    if (items.length === 0) {
      alert('Agregue productos para poder generar la nota de picking.');
      return;
    }

    const origWh = warehouses.find(w => String(w.id) === String(originWarehouseId));
    const destWh = warehouses.find(w => String(w.id) === String(destinationWarehouseId));
    const respUser = users.find(u => String(u.id) === String(responsibleUserId));

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('PICKING DE TRANSFERENCIA', 14, 15);
    doc.setFontSize(9);
    doc.text(`Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
    doc.text(`Origen: ${origWh?.name || '—'}  ->  Destino: ${destWh?.name || '—'}`, 14, 27);
    doc.text(`Responsable: ${respUser?.name || '—'}`, 14, 32);
    if (description) doc.text(`Descripción: ${description}`, 14, 37);

    const head = [['#', 'Código', 'Producto', 'Bultos', 'Cant.', 'Espacio Origen']];
    const data = items.map((it, idx) => [
      idx + 1,
      it.productCode,
      it.productName,
      '1',
      `${it.quantity} u.`,
      it.spacesDistribution.map(sp => `${sp.spaceName}: ${sp.quantity}`).join(', ') || 'Pendientes',
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: description ? 42 : 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Picking_Transferencia_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // Filtrado de productos para el buscador
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

      {/* Tarjeta 1: Información de Transferencia */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>Información de Transferencia</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Almacén Origen *</label>
            <select
              value={originWarehouseId}
              onChange={e => {
                const newWid = e.target.value;
                setOriginWarehouseId(newWid);
                // Si destino era igual, cambiarlo
                if (newWid === destinationWarehouseId) {
                  const alt = warehouses.find(w => String(w.id) !== newWid);
                  if (alt) setDestinationWarehouseId(String(alt.id));
                }
                // Recalcular stockActual y espacios sugeridos para el nuevo almacén
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Almacén Destino *</label>
            <select
              value={destinationWarehouseId}
              onChange={e => setDestinationWarehouseId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {warehouses
                .filter(w => String(w.id) !== String(originWarehouseId))
                .map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Responsable *</label>
            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <select
                value={responsibleUserId}
                onChange={e => setResponsibleUserId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta 2: Agregar Productos al Picking */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Boxes className="w-4 h-4 text-blue-600" />
          <span>Agregar Productos al Picking</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-8 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Buscar Producto</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Escriba código o nombre del producto..."
                className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

            {/* Dropdown resultados de búsqueda */}
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
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                      + Agregar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descripción / Observación</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej. Transferencia para reposición de stock..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Items */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Items del Picking Transferencia
            </h3>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              {items.length} productos
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearList}
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
                <th className="py-3 px-4 w-12">Foto</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4 text-center">Bultos</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-center w-36">Stock a Transferir</th>
                <th className="py-3 px-4 w-60">Espacio Almacén</th>
                <th className="py-3 px-4 text-center">Total Restante</th>
                <th className="py-3 px-4 text-right w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Utilice el buscador superior para agregar productos al picking
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const restante = item.stockActual - item.quantity;
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
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-slate-700">
                          1 bulto
                        </span>
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
                            className="w-14 px-1 py-1 text-center font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                        <SpaceDistributionPopover
                          spaces={productSpaces}
                          targetQuantity={item.quantity}
                          value={item.spacesDistribution}
                          onChange={dist => updateItemSpaces(index, dist)}
                        />
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

        {/* Footer con botones de acción */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Picking Transferencia</span>
          </button>

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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Enviar Picking Transferencia</span>
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
        title="Escanear Producto para Transferencia"
      />
    </div>
  );
};

export default TransferPickingCreate;
