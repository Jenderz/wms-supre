import React, { useState } from 'react';
import { useProviders } from '../hooks/useProviders';
import { Plus, Search, Edit2, ShieldAlert, Trash2, Building } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { AuthApi } from '../../../services/api';

export const ProvidersPage: React.FC = () => {
  const { providers, isLoading, saveProvider, deleteProvider } = useProviders();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', contact_number: '', address: '' });
  
  // Password verify state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlockedProviders, setUnlockedProviders] = useState<Record<string, boolean>>({});
  const [pendingUnlockId, setPendingUnlockId] = useState<string | null>(null);

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (provider?: any) => {
    if (provider) {
      setEditingId(provider.id);
      setFormData({
        code: provider.code,
        name: provider.name,
        contact_number: provider.contact_number || '',
        address: provider.address || ''
      });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', contact_number: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (formData.code && formData.name) {
      saveProvider({
        id: editingId || '',
        code: formData.code,
        name: formData.name,
        contact_number: formData.contact_number,
        address: formData.address,
      });
      setFormData({ code: '', name: '', contact_number: '', address: '' });
      setEditingId(null);
      setIsModalOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      deleteProvider(id);
    }
  };

  const handleRequestUnlock = (id: string) => {
    setPendingUnlockId(id);
    setPasswordError('');
    setAdminPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!adminPassword) {
      setPasswordError('Ingrese la contraseña.');
      return;
    }

    try {
      await AuthApi.verifyPassword(adminPassword);
      if (pendingUnlockId) {
        setUnlockedProviders(prev => ({ ...prev, [pendingUnlockId]: true }));
      }
      setIsPasswordModalOpen(false);
    } catch (error: any) {
      setPasswordError(error.message || 'Contraseña incorrecta.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Proveedores</h1>
          <p className="text-slate-500 mt-2">Gestión de proveedores y datos de contacto protegidos.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5" />
          Nuevo Proveedor
        </Button>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              icon={<Search className="w-5 h-5" />}
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Proveedor</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map(provider => (
                    <TableRow key={provider.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                            <Building className="w-5 h-5 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-900">{provider.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {unlockedProviders[provider.id] ? (
                          <div className="text-sm text-slate-600 space-y-1">
                            <div><span className="font-medium text-slate-900">Código:</span> {provider.code}</div>
                            <div><span className="font-medium text-slate-900">Teléfono:</span> {provider.contact_number || '-'}</div>
                            <div><span className="font-medium text-slate-900">Dirección:</span> {provider.address || '-'}</div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleRequestUnlock(provider.id)}
                            className="flex items-center gap-2 text-sm text-amber-600 font-medium hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            Ver Detalles
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {unlockedProviders[provider.id] ? (
                            <button 
                              onClick={() => handleOpenModal(provider)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button 
                            onClick={() => handleDelete(provider.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProviders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-slate-500">
                        No se encontraron proveedores.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Creación/Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Código</label>
                <Input 
                  placeholder="Ej: PROV-001" 
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del Proveedor</label>
                <Input 
                  placeholder="Ej: Distribuidora Nacional CA" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Número de Contacto</label>
                <Input 
                  placeholder="Ej: +58 414 1234567" 
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
                <Input 
                  placeholder="Ej: Av. Principal, Edificio Central" 
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.code || !formData.name}
              >
                {editingId ? 'Guardar Cambios' : 'Crear Proveedor'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contraseña Admin */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Validación Requerida</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Ingrese su contraseña de administrador para visualizar los datos sensibles de este proveedor.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <Input 
                  type="password"
                  placeholder="Contraseña..." 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleVerifyPassword} className="bg-amber-600 hover:bg-amber-700">
                Verificar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
