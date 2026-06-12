import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfrastructure } from '../features/infrastructure/hooks/useInfrastructure';
import { Warehouse, WarehouseSpace, SpaceType } from '../types';
import { Building2, MapPin, Plus, Edit2, Trash2, X, Download, Upload, QrCode, Layers, Package, BarChart2, Filter, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { QRCodeCanvas } from 'qrcode.react';
import Papa from 'papaparse';

const Infrastructure: React.FC = () => {
  const navigate = useNavigate();

  const {
    warehouses,
    warehouseSpaces,
    spaceTypes,
    isLoading,
    saveWarehouse,
    deleteWarehouse,
    saveWarehouseSpace,
    deleteWarehouseSpace,
    saveSpaceType,
    updateSpaceType,
    deleteSpaceType,
    setWarehouseSpaces
  } = useInfrastructure();

  const [activeTab, setActiveTab] = useState<'warehouses' | 'spaces' | 'spaceTypes'>('warehouses');

  // Warehouse Modal State
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<Partial<Warehouse>>({ name: '', description: '', qrCode: '' });

  // Space Modal State
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceForm, setSpaceForm] = useState<Partial<WarehouseSpace>>({ warehouseId: '', name: '', spaceTypeId: '', proximity: 0 });
  const [newSpaceType, setNewSpaceType] = useState<string>('');
  const [isCreatingSpaceType, setIsCreatingSpaceType] = useState(false);

  // Space Type Modal State
  const [isSpaceTypeModalOpen, setIsSpaceTypeModalOpen] = useState(false);
  const [editingSpaceTypeId, setEditingSpaceTypeId] = useState<string | null>(null);
  const [spaceTypeForm, setSpaceTypeForm] = useState<Partial<SpaceType>>({ name: '' });
  const [spaceTypeError, setSpaceTypeError] = useState<string>('');

  // Filtro por almacén en la tab de Espacios
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('');

  // Ordenamiento de la tabla de Espacios
  type SpacesSortKey = 'name' | 'spaceType' | 'proximity' | 'productCount' | 'totalQuantity';
  const [spacesSortKey, setSpacesSortKey] = useState<SpacesSortKey | ''>('');
  const [spacesSortDir, setSpacesSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSpacesSort = (key: SpacesSortKey) => {
    if (spacesSortKey === key) {
      setSpacesSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSpacesSortKey(key);
      setSpacesSortDir('asc');
    }
  };

  // ─── Handlers Warehouses ───────────────────────────────────────────────────

  const handleOpenWarehouseModal = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouseId(warehouse.id);
      setWarehouseForm({ name: warehouse.name, description: warehouse.description, qrCode: warehouse.qrCode });
    } else {
      setEditingWarehouseId(null);
      setWarehouseForm({ name: '', description: '', qrCode: '' });
    }
    setIsWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = () => {
    if (!warehouseForm.name || !warehouseForm.qrCode) return;
    saveWarehouse({
      id: editingWarehouseId || undefined,
      name: warehouseForm.name,
      description: warehouseForm.description || '',
      qrCode: warehouseForm.qrCode
    } as Warehouse);
    setIsWarehouseModalOpen(false);
  };

  const handleDeleteWarehouse = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este almacén? Se perderán todos los espacios asociados.')) {
      deleteWarehouse(id);
    }
  };

  const handleExportWarehouses = () => {
    const data = warehouses.map(w => ({
      ID: w.id,
      Nombre: w.name,
      Descripcion: w.description,
      CodigoQR: w.qrCode
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almacenes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWarehouses = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          if (row['Nombre']) {
            saveWarehouse({
              id: row['ID'] || undefined,
              name: row['Nombre'],
              description: row['Descripcion'] || '',
              qrCode: row['CodigoQR'] || `ALM-${Date.now()}`
            } as Warehouse);
          }
        });
      }
    });
    e.target.value = '';
  };

  // ─── Handlers Spaces ───────────────────────────────────────────────────────

  const handleOpenSpaceModal = (space?: WarehouseSpace) => {
    setIsCreatingSpaceType(false);
    if (space) {
      setEditingSpaceId(space.id);
      setSpaceForm({ warehouseId: space.warehouseId, name: space.name, spaceTypeId: space.spaceTypeId, proximity: space.proximity });
    } else {
      setEditingSpaceId(null);
      setSpaceForm({ warehouseId: selectedWarehouseFilter || '', name: '', spaceTypeId: '', proximity: 0 });
    }
    setIsSpaceModalOpen(true);
  };

  const handleCreateSpaceType = async () => {
    if (!newSpaceType.trim()) return;
    await saveSpaceType({ name: newSpaceType.trim() } as SpaceType);
    setNewSpaceType('');
    setIsCreatingSpaceType(false);
  };

  const handleSaveSpace = () => {
    if (!spaceForm.warehouseId || !spaceForm.name || !spaceForm.spaceTypeId) return;

    const finalQrCode = editingSpaceId
      ? warehouseSpaces.find(s => s.id === editingSpaceId)?.qrCode
      : `${spaceForm.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`;

    saveWarehouseSpace({
      id: editingSpaceId || undefined,
      warehouseId: spaceForm.warehouseId,
      spaceTypeId: spaceForm.spaceTypeId,
      name: spaceForm.name,
      proximity: spaceForm.proximity || 0,
      qrCode: finalQrCode
    } as WarehouseSpace);

    setIsSpaceModalOpen(false);
  };

  const handleDeleteSpace = (id: string) => {
    if (window.confirm('¿Eliminar este espacio de almacén?')) {
      deleteWarehouseSpace(id);
    }
  };

  const handleExportSpaces = () => {
    const data = warehouseSpaces.map(s => {
      const wh = warehouses.find(w => w.id === s.warehouseId);
      const st = spaceTypes.find(t => t.id == s.spaceTypeId);
      return {
        ID: s.id,
        Almacen: wh?.name || s.warehouseId,
        AlmacenID: s.warehouseId,
        Nombre: s.name,
        TipoEspacio: st?.name || s.spaceTypeName || '',
        TipoEspacioID: s.spaceTypeId,
        Cercania: s.proximity,
        CodigoQR: s.qrCode
      };
    });
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'espacios_almacen.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSpaces = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          if (row['Nombre'] && row['AlmacenID'] && row['TipoEspacioID']) {
            saveWarehouseSpace({
              id: row['ID'] || undefined,
              warehouseId: row['AlmacenID'],
              spaceTypeId: row['TipoEspacioID'],
              name: row['Nombre'],
              proximity: Number(row['Cercania']) || 0,
              qrCode: row['CodigoQR'] || `${row['Nombre'].toUpperCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`
            } as WarehouseSpace);
          }
        });
      }
    });
    e.target.value = '';
  };

  // ─── Handlers Space Types ──────────────────────────────────────────────────

  const handleOpenSpaceTypeModal = (spaceType?: SpaceType) => {
    setSpaceTypeError('');
    if (spaceType) {
      setEditingSpaceTypeId(spaceType.id);
      setSpaceTypeForm({ name: spaceType.name });
    } else {
      setEditingSpaceTypeId(null);
      setSpaceTypeForm({ name: '' });
    }
    setIsSpaceTypeModalOpen(true);
  };

  const handleSaveSpaceType = async () => {
    if (!spaceTypeForm.name?.trim()) return;
    if (editingSpaceTypeId) {
      await updateSpaceType(editingSpaceTypeId, { name: spaceTypeForm.name.trim() });
    } else {
      await saveSpaceType({ name: spaceTypeForm.name.trim() } as SpaceType);
    }
    setIsSpaceTypeModalOpen(false);
  };

  const handleDeleteSpaceType = async (id: string, name: string) => {
    if (window.confirm(`¿Eliminar el tipo de espacio "${name}"? Solo se puede si no está en uso.`)) {
      try {
        await deleteSpaceType(id);
      } catch (err: any) {
        alert(err.message || 'No se puede eliminar porque este tipo de espacio está en uso.');
      }
    }
  };

  // ─── Navegar al inventario filtrando por espacio ───────────────────────────

  const handleViewInventory = (space: WarehouseSpace) => {
    sessionStorage.setItem('wms_inventory_filter', JSON.stringify({
      tab: 'INVENTORY',
      spaceId: space.id,
      spaceName: space.name,
      warehouseId: space.warehouseId
    }));
    navigate('/warehouse');
  };

  // ─── Filtrado de espacios por almacén ─────────────────────────────────────

  const filteredSpaces = selectedWarehouseFilter
    ? warehouseSpaces.filter(s => String(s.warehouseId) === String(selectedWarehouseFilter))
    : warehouseSpaces;

  // Ordenar espacios filtrados
  const sortedSpaces = spacesSortKey
    ? [...filteredSpaces].sort((a, b) => {
        let valA: any, valB: any;
        switch (spacesSortKey) {
          case 'name':
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
            break;
          case 'spaceType':
            valA = (spaceTypes.find(t => t.id == a.spaceTypeId)?.name || a.spaceTypeName || '').toLowerCase();
            valB = (spaceTypes.find(t => t.id == b.spaceTypeId)?.name || b.spaceTypeName || '').toLowerCase();
            break;
          case 'proximity':
            valA = Number(a.proximity || 0);
            valB = Number(b.proximity || 0);
            break;
          case 'productCount':
            valA = Number(a.productCount || 0);
            valB = Number(b.productCount || 0);
            break;
          case 'totalQuantity':
            valA = Number(a.totalQuantity || 0);
            valB = Number(b.totalQuantity || 0);
            break;
          default: return 0;
        }
        if (valA < valB) return spacesSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return spacesSortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredSpaces;

  // Agrupar espacios ordenados por almacén
  const groupedSpaces = sortedSpaces.reduce((acc, space) => {
    const wid = String(space.warehouseId);
    if (!acc[wid]) acc[wid] = [];
    acc[wid].push(space);
    return acc;
  }, {} as Record<string, WarehouseSpace[]>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6 scrollbar-hide">
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'warehouses' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('warehouses')}
        >
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Almacenes</span>
          {activeTab === 'warehouses' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'spaces' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('spaces')}
        >
          <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Espacios de Almacén</span>
          {activeTab === 'spaces' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'spaceTypes' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('spaceTypes')}
        >
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Tipos de Espacio</span>
          {activeTab === 'spaceTypes' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {/* ═══ TAB: ALMACENES ════════════════════════════════════════════════════ */}
      {activeTab === 'warehouses' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Almacenes</h1>
              <p className="text-slate-500 mt-2">Gestión de almacenes, nombre y código</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
              <Button className="gap-2 whitespace-nowrap" onClick={() => handleOpenWarehouseModal()}>
                <Plus className="w-4 h-4" /> Crear nuevo almacén
              </Button>
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 cursor-pointer text-sm font-medium shadow-sm transition-all whitespace-nowrap">
                <Upload className="w-4 h-4" /> Importar
                <input type="file" accept=".csv" className="hidden" onChange={handleImportWarehouses} />
              </label>
              <Button variant="outline" className="gap-2 bg-white whitespace-nowrap" onClick={handleExportWarehouses}>
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {warehouses.map(warehouse => {
              const locs = warehouseSpaces.filter(l => l.warehouseId === warehouse.id);
              const totalProducts = locs.reduce((sum, s) => sum + Number(s.productCount || 0), 0);
              const totalUnits = locs.reduce((sum, s) => sum + Number(s.totalQuantity || 0), 0);
              return (
                <div key={warehouse.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-500/30 transition-all group relative">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenWarehouseModal(warehouse)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteWarehouse(warehouse.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 group-hover:bg-blue-100 transition-all">
                        <Building2 className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{warehouse.name}</h3>
                        <p className="text-sm text-slate-500">QR: {warehouse.qrCode}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm mb-6 min-h-[40px]">{warehouse.description || 'Sin descripción'}</p>

                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-slate-400 text-xs mb-1">Espacios</p>
                      <p className="font-bold text-blue-600 text-lg">{locs.length}</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-slate-400 text-xs mb-1">Productos</p>
                      <p className="font-bold text-emerald-600 text-lg">{totalProducts}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs mb-1">Unidades</p>
                      <p className="font-bold text-violet-600 text-lg">{totalUnits}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {warehouses.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                No hay almacenes registrados.
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: ESPACIOS DE ALMACÉN ══════════════════════════════════════════ */}
      {activeTab === 'spaces' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Espacios de Almacén</h1>
              <p className="text-slate-500 mt-2">Gestión y control de ubicaciones internas físicas</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button className="gap-2" onClick={() => handleOpenSpaceModal()}>
                <Plus className="w-4 h-4" /> Nuevo Espacio
              </Button>
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 cursor-pointer text-sm font-medium shadow-sm transition-all whitespace-nowrap">
                <Upload className="w-4 h-4" /> Importar
                <input type="file" accept=".csv" className="hidden" onChange={handleImportSpaces} />
              </label>
              <Button variant="outline" className="gap-2 bg-white" onClick={handleExportSpaces}>
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </header>

          {/* Filtro por Almacén */}
          <div className="flex items-center gap-3 mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-600 shrink-0">Filtrar por almacén:</span>
            <select
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            >
              <option value="">Todos los almacenes ({warehouseSpaces.length} espacios)</option>
              {warehouses.map(w => {
                const count = warehouseSpaces.filter(s => String(s.warehouseId) === String(w.id)).length;
                return (
                  <option key={w.id} value={w.id}>{w.name} ({count} espacios)</option>
                );
              })}
            </select>
            {selectedWarehouseFilter && (
              <button
                onClick={() => setSelectedWarehouseFilter('')}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"
                title="Limpiar filtro"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tabla agrupada por almacén */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {Object.keys(groupedSpaces).length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No hay espacios registrados para el filtro seleccionado.
              </div>
            ) : (
              Object.entries(groupedSpaces).map(([warehouseId, spaces]: [string, any]) => {
                const warehouse = warehouses.find(w => String(w.id) === String(warehouseId));
                return (
                  <div key={warehouseId}>
                    {/* Encabezado separador por almacén */}
                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200">
                      <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-semibold text-slate-700 text-sm">{warehouse?.name || `Almacén ${warehouseId}`}</span>
                      <span className="text-xs text-slate-400 ml-auto">{spaces.length} espacio{spaces.length !== 1 ? 's' : ''}</span>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Helper inline para ícono de orden */}
                          {([
                            { key: 'name',          label: 'Nombre / Referencia', align: 'left'   },
                            { key: 'spaceType',     label: 'Tipo de Espacio',     align: 'left'   },
                            { key: 'proximity',     label: 'Cercanía',            align: 'left'   },
                            { key: 'productCount',  label: 'Productos',           align: 'center' },
                            { key: 'totalQuantity', label: 'Unidades',            align: 'center' },
                          ] as { key: SpacesSortKey; label: string; align: 'left' | 'center' }[]).map(col => {
                            const isActive = spacesSortKey === col.key;
                            const Icon = isActive
                              ? (spacesSortDir === 'asc' ? ChevronUp : ChevronDown)
                              : ChevronsUpDown;
                            return (
                              <TableHead key={col.key} className={col.align === 'center' ? 'text-center' : ''}>
                                <button
                                  onClick={() => handleSpacesSort(col.key)}
                                  className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-blue-600 ${
                                    col.align === 'center' ? 'justify-center w-full' : ''
                                  } ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                                  title={`Ordenar por ${col.label}`}
                                >
                                  {col.key === 'productCount' && <Package className="w-3 h-3 text-emerald-500" />}
                                  {col.key === 'totalQuantity' && <BarChart2 className="w-3 h-3 text-violet-500" />}
                                  {col.label}
                                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'opacity-40'}`} />
                                </button>
                              </TableHead>
                            );
                          })}
                          <TableHead className="text-center">Código QR</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spaces.map((space) => {
                          const spaceType = spaceTypes.find(t => t.id == space.spaceTypeId);
                          return (
                            <TableRow key={space.id}>
                              <TableCell>{space.name}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                                  {spaceType?.name || space.spaceTypeName || 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell>{Math.round(Number(space.proximity))}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold ${(space.productCount || 0) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400'}`}>
                                  {space.productCount || 0}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold ${(space.totalQuantity || 0) > 0 ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-400'}`}>
                                  {Math.round(Number(space.totalQuantity || 0))}
                                </span>
                              </TableCell>
                              <TableCell className="text-center w-32">
                                <div className="flex justify-center group/qr relative cursor-pointer">
                                  <QrCode className="w-5 h-5 text-slate-400 hover:text-blue-600 transition-colors" />
                                  <div className="absolute invisible group-hover/qr:visible opacity-0 group-hover/qr:opacity-100 transition-all bottom-full pt-2 pb-3 z-10 w-32 bg-white border rounded shadow-xl left-1/2 -ml-16 flex justify-center">
                                    <QRCodeCanvas value={space.qrCode} size={90} />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleViewInventory(space)}
                                    title="Ver inventario de este espacio"
                                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                  >
                                    <BarChart2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenSpaceModal(space)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSpace(space.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: TIPOS DE ESPACIO ═════════════════════════════════════════════ */}
      {activeTab === 'spaceTypes' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tipos de Espacio</h1>
              <p className="text-slate-500 mt-2">Categorías para clasificar los espacios de almacén</p>
            </div>
            <Button className="gap-2" onClick={() => handleOpenSpaceTypeModal()}>
              <Plus className="w-4 h-4" /> Nuevo Tipo de Espacio
            </Button>
          </header>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Espacios que lo usan</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spaceTypes.map((type) => {
                  const usageCount = warehouseSpaces.filter(s => String(s.spaceTypeId) === String(type.id)).length;
                  return (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                            <Layers className="w-4 h-4 text-blue-600" />
                          </div>
                          {type.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${usageCount > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                          {usageCount} espacio{usageCount !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenSpaceTypeModal(type)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar tipo de espacio"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSpaceType(type.id, type.name)}
                            className={`p-1.5 rounded-lg transition-all ${usageCount > 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={usageCount > 0 ? 'No se puede eliminar: está en uso' : 'Eliminar tipo de espacio'}
                            disabled={usageCount > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {spaceTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                      No hay tipos de espacio registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ─── Modal Almacén ──────────────────────────────────────────────────── */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingWarehouseId ? 'Editar Almacén' : 'Nuevo Almacén'}
              </h2>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                <Input
                  placeholder="Ej: Almacén Principal"
                  value={warehouseForm.name || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Código QR</label>
                <Input
                  placeholder="Ej: ALM-001"
                  value={warehouseForm.qrCode || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, qrCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
                <Input
                  placeholder="Ej: Depósito central de distribución"
                  value={warehouseForm.description || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsWarehouseModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleSaveWarehouse} disabled={!warehouseForm.name || !warehouseForm.qrCode} className="w-full sm:w-auto">
                {editingWarehouseId ? 'Guardar Cambios' : 'Crear Almacén'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Espacio de Almacén ────────────────────────────────────────── */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
                {editingSpaceId ? 'Editar Espacio Almacén' : 'NUEVO ESPACIO ALMACÉN'}
              </h2>
              <button onClick={() => setIsSpaceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Seleccionar Almacén */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Seleccionar Almacén</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  value={spaceForm.warehouseId || ''}
                  onChange={(e) => setSpaceForm({ ...spaceForm, warehouseId: e.target.value })}
                >
                  <option value="">Seleccione un almacén...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Nombre Referencia */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Nombre / Referencia de Espacio</label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ej: Pasillo A, Estante 4..."
                  value={spaceForm.name || ''}
                  onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value })}
                />
              </div>

              {/* Tipo de Espacio */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Tipo de Espacio</label>
                <div className="flex flex-col gap-2">
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    value={spaceForm.spaceTypeId || ''}
                    onChange={(e) => setSpaceForm({ ...spaceForm, spaceTypeId: e.target.value })}
                  >
                    <option value="">Seleccione tipo...</option>
                    {spaceTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {!isCreatingSpaceType ? (
                    <button
                      onClick={() => setIsCreatingSpaceType(true)}
                      className="text-xs text-blue-600 font-semibold hover:text-blue-800 text-left cursor-pointer flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Crear nuevo tipo de espacio
                    </button>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Ej: Pallet, Mostrador..."
                        className="flex-1 text-xs px-2 py-1.5 border rounded-md"
                        value={newSpaceType}
                        onChange={(e) => setNewSpaceType(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleCreateSpaceType} className="bg-slate-900 text-white px-2 py-1 text-xs rounded hover:bg-slate-800 transition-colors">Guardar</button>
                      <button onClick={() => setIsCreatingSpaceType(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cercanía */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Cercanía de Espacio <span className="text-blue-600 normal-case ml-1 font-medium bg-blue-50 px-2 py-0.5 rounded text-[10px]">solo N°</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="Valor numérico (Ej: 1, 2, 3)"
                  value={spaceForm.proximity === 0 ? '' : spaceForm.proximity}
                  onChange={(e) => setSpaceForm({ ...spaceForm, proximity: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsSpaceModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button
                onClick={handleSaveSpace}
                disabled={!spaceForm.warehouseId || !spaceForm.name || !spaceForm.spaceTypeId}
                className="w-full sm:w-auto"
              >
                {editingSpaceId ? 'Guardar Cambios' : 'Crear Espacio'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Tipo de Espacio ───────────────────────────────────────────── */}
      {isSpaceTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingSpaceTypeId ? 'Editar Tipo de Espacio' : 'Nuevo Tipo de Espacio'}
              </h2>
              <button onClick={() => setIsSpaceTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del tipo</label>
              <Input
                placeholder="Ej: Pallet, Estante, Mostrador..."
                value={spaceTypeForm.name || ''}
                onChange={(e) => setSpaceTypeForm({ ...spaceTypeForm, name: e.target.value })}
                autoFocus
              />
              {spaceTypeError && (
                <p className="text-sm text-red-600 mt-2">{spaceTypeError}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsSpaceTypeModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleSaveSpaceType} disabled={!spaceTypeForm.name?.trim()} className="w-full sm:w-auto">
                {editingSpaceTypeId ? 'Guardar Cambios' : 'Crear Tipo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Infrastructure;
