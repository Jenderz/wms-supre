import React, { useState } from 'react';
import { useInfrastructure } from '../features/infrastructure/hooks/useInfrastructure';
import { Store, Location } from '../types';
import { Building2, MapPin, Plus, Edit2, Trash2, X, Box, LayoutGrid, Layers, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { QRCodeCanvas } from 'qrcode.react';

const Infrastructure: React.FC = () => {
  const { stores, locations, isLoading, saveStore, deleteStore, saveLocation, deleteLocation } = useInfrastructure();
  
  // Store Modal State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState<Partial<Store>>({ name: '', description: '', qrCode: '' });

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState<Partial<Location>>({ room: '', shelf: '', cubicle: '' });

  // Store Handlers
  const handleOpenStoreModal = (store?: Store) => {
    if (store) {
      setEditingStoreId(store.id);
      setStoreForm({ name: store.name, description: store.description, qrCode: store.qrCode });
    } else {
      setEditingStoreId(null);
      setStoreForm({ name: '', description: '', qrCode: '' });
    }
    setIsStoreModalOpen(true);
  };

  const handleSaveStore = () => {
    if (!storeForm.name || !storeForm.qrCode) return;
    
    saveStore({
      id: editingStoreId || undefined,
      name: storeForm.name,
      description: storeForm.description || '',
      qrCode: storeForm.qrCode
    });
    setIsStoreModalOpen(false);
  };

  const handleDeleteStore = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar esta tienda? Se perderán todas las ubicaciones asociadas.')) {
      deleteStore(id);
    }
  };

  // Location Handlers
  const handleManageLocations = (store: Store) => {
    setSelectedStore(store);
    setIsLocationModalOpen(true);
    setEditingLocationId(null);
    setLocationForm({ room: '', shelf: '', cubicle: '' });
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocationId(location.id);
    setLocationForm({ room: location.room, shelf: location.shelf, cubicle: location.cubicle });
  };

  const handleSaveLocation = () => {
    if (!selectedStore || !locationForm.room || !locationForm.shelf || !locationForm.cubicle) return;

    saveLocation({
      id: editingLocationId || undefined,
      storeId: selectedStore.id,
      room: locationForm.room,
      shelf: locationForm.shelf,
      cubicle: locationForm.cubicle
    });
    
    // Reset form but keep modal open
    setEditingLocationId(null);
    setLocationForm({ room: '', shelf: '', cubicle: '' });
  };

  const handleDeleteLocation = (id: string) => {
    if (window.confirm('¿Eliminar esta ubicación?')) {
      deleteLocation(id);
    }
  };

  const handleDownloadQR = (storeId: string, storeName: string) => {
    const canvas = document.getElementById(`qr-${storeId}`) as HTMLCanvasElement;
    if (canvas) {
      const size = 600;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, size, size);
        const url = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-tienda-${storeName.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = url;
        link.click();
      }
    }
  };

  const storeLocations = selectedStore ? locations.filter(l => l.storeId === selectedStore.id) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tiendas</h1>
          <p className="text-slate-500 mt-2">Gestión de tiendas, cuartos, estantes y cubículos.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => handleOpenStoreModal()}>
          <Plus className="w-5 h-5" />
          Nueva Tienda
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stores.map(store => {
            const locs = locations.filter(l => l.storeId === store.id);
            const uniqueRooms = new Set(locs.map(l => l.room)).size;
            const uniqueShelves = new Set(locs.map(l => l.shelf)).size;
            const totalCubicles = locs.length;

            return (
              <div key={store.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-500/30 transition-all group relative">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenStoreModal(store)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteStore(store.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 group-hover:bg-blue-100 transition-all">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-2 group/qr">
                        <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                          <QRCodeCanvas 
                            id={`qr-${store.id}`}
                            value={store.qrCode} 
                            size={32} 
                            level="L" 
                          />
                        </div>
                        <button
                          onClick={() => handleDownloadQR(store.id, store.name)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all opacity-0 group-hover/qr:opacity-100"
                          title="Descargar QR"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <p className="text-sm text-slate-500 font-mono">QR: {store.qrCode}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-600 text-sm mb-6 min-h-[40px]">{store.description || 'Sin descripción'}</p>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{uniqueRooms}</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Cuartos</p>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <p className="text-2xl font-bold text-slate-900">{uniqueShelves}</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Estantes</p>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <p className="text-2xl font-bold text-blue-600">{totalCubicles}</p>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Cubículos</p>
                  </div>
                </div>

                <Button variant="outline" className="w-full gap-2" onClick={() => handleManageLocations(store)}>
                  <MapPin className="w-4 h-4" />
                  Gestionar Ubicaciones
                </Button>
              </div>
            );
          })}
          
          {stores.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              No hay tiendas registradas. Comienza creando una nueva.
            </div>
          )}
        </div>
      )}

      {/* Modal Tienda */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingStoreId ? 'Editar Tienda' : 'Nueva Tienda'}
              </h2>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                <Input 
                  placeholder="Ej: Tienda Principal" 
                  value={storeForm.name || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Código QR</label>
                <Input 
                  placeholder="Ej: T001" 
                  value={storeForm.qrCode || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, qrCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
                <Input 
                  placeholder="Ej: Almacén central de repuestos..." 
                  value={storeForm.description || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsStoreModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleSaveStore} disabled={!storeForm.name || !storeForm.qrCode} className="w-full sm:w-auto">
                {editingStoreId ? 'Guardar Cambios' : 'Crear Tienda'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubicaciones */}
      {isLocationModalOpen && selectedStore && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-xl border border-slate-200 h-[80vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Gestionar Ubicaciones</h2>
                <p className="text-slate-500 text-sm mt-1">Tienda: {selectedStore.name}</p>
              </div>
              <button onClick={() => setIsLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Formulario Lateral */}
              <div className="w-full md:w-80 bg-slate-50 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto">
                <h3 className="font-semibold text-slate-900 mb-4">
                  {editingLocationId ? 'Editar Ubicación' : 'Nueva Ubicación'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cuarto / Área</label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Ej: A, B, Recepción..."
                        value={locationForm.room || ''}
                        onChange={(e) => setLocationForm({ ...locationForm, room: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Estante / Rack</label>
                    <div className="relative">
                      <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Ej: 1, 2, R1..."
                        value={locationForm.shelf || ''}
                        onChange={(e) => setLocationForm({ ...locationForm, shelf: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cubículo / Nivel</label>
                    <div className="relative">
                      <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Ej: A1, B2..."
                        value={locationForm.cubicle || ''}
                        onChange={(e) => setLocationForm({ ...locationForm, cubicle: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 flex gap-2">
                    {editingLocationId && (
                      <Button 
                        variant="secondary" 
                        className="flex-1 text-xs"
                        onClick={() => {
                          setEditingLocationId(null);
                          setLocationForm({ room: '', shelf: '', cubicle: '' });
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button 
                      className="flex-1 text-xs" 
                      onClick={handleSaveLocation}
                      disabled={!locationForm.room || !locationForm.shelf || !locationForm.cubicle}
                    >
                      {editingLocationId ? 'Actualizar' : 'Agregar'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de Ubicaciones */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[400px] px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cuarto</TableHead>
                          <TableHead>Estante</TableHead>
                          <TableHead>Cubículo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storeLocations.map(loc => (
                          <TableRow key={loc.id}>
                            <TableCell className="font-medium text-slate-900">{loc.room}</TableCell>
                            <TableCell>{loc.shelf}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono font-medium">
                                {loc.cubicle}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => handleEditLocation(loc)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteLocation(loc.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {storeLocations.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="py-12 text-center text-slate-500">
                              No hay ubicaciones registradas en esta tienda.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Infrastructure;
