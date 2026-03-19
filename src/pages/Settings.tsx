import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Role, Permission, Store } from '../types';
import { UserApi, StoreApi, ProductApi, CategoryApi, StockApi, MovementApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Shield, Users, Plus, Edit2, Trash2, X, Check, Store as StoreIcon, Settings2, Database, Download } from 'lucide-react';

const AVAILABLE_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: 'MANAGE_USERS', label: 'Gestionar Usuarios', description: 'Crear, editar y eliminar usuarios y roles.' },
  { id: 'EDIT_MIN_STOCK', label: 'Editar Stock Mínimo', description: 'Modificar el valor de stock mínimo de los productos.' },
  { id: 'MANAGE_CATALOG', label: 'Gestionar Catálogo', description: 'Crear y editar productos y categorías.' },
  { id: 'MANAGE_INFRASTRUCTURE', label: 'Gestionar Infraestructura', description: 'Administrar tiendas y ubicaciones físicas.' },
  { id: 'APPROVE_PURCHASES', label: 'Aprobar Compras', description: 'Crear y aprobar órdenes de compra/abastecimiento.' },
  { id: 'MANAGE_DISINCORPORATION', label: 'Desincorporación', description: 'Gestionar la desincorporación de productos.' },
  { id: 'VIEW_REPORTS', label: 'Ver Reportes', description: 'Acceso a reportes y analíticas del sistema.' },
  { id: 'EXPORT_DATA', label: 'Exportar Datos', description: 'Permite exportar datos a CSV/Excel.' },
];

const ROLES: Role[] = ['ADMIN', 'COMPRAS', 'DEPOSITO', 'DESINCORPORACION'];

const Settings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'preferences' | 'data'>('users');
  
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    role: 'DEPOSITO',
    permissions: [],
    assignedStores: []
  });

  // System Preferences State (Mock for now, could be saved in localStorage)
  const [preferences, setPreferences] = useState({
    currency: 'USD',
    allowNegativeStock: false,
    qrSize: '100',
    autoApproveDisincorporationLimit: 50
  });

  useEffect(() => {
    loadData();
    const savedPrefs = localStorage.getItem('supre_preferences');
    if (savedPrefs) setPreferences(JSON.parse(savedPrefs));
  }, []);

  const loadData = async () => {
    try {
      const [usersData, storesData] = await Promise.all([
        UserApi.getAll(),
        StoreApi.getAll(),
      ]);
      setUsers(usersData as User[]);
      setStores(storesData as Store[]);
    } catch (err) {
      console.error('Error cargando configuración:', err);
    }
  };

  const savePreferences = (newPrefs: typeof preferences) => {
    setPreferences(newPrefs);
    localStorage.setItem('supre_preferences', JSON.stringify(newPrefs));
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username || '',
        password: user.password || '',
        role: user.role,
        permissions: user.permissions || [],
        assignedStores: user.assignedStores || []
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        role: 'DEPOSITO',
        permissions: [],
        assignedStores: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.role || !formData.username) return;

    const payload = {
      name: formData.name,
      username: formData.username,
      password: formData.password || 'password',
      role: formData.role as Role,
      permissions: formData.permissions,
      assignedStores: formData.assignedStores,
    };

    if (editingUser) {
      await UserApi.update(editingUser.id, payload);
    } else {
      await UserApi.create(payload);
    }
    await loadData();
    setIsModalOpen(false);
  };

  const handleDeleteUser = async (id: string) => {
    if (id === String(currentUser?.id)) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      await UserApi.remove(id);
      await loadData();
    }
  };

  const togglePermission = (permission: Permission) => {
    setFormData(prev => {
      const current = prev.permissions || [];
      if (current.includes(permission)) {
        return { ...prev, permissions: current.filter(p => p !== permission) };
      } else {
        return { ...prev, permissions: [...current, permission] };
      }
    });
  };

  const toggleStore = (storeId: string) => {
    setFormData(prev => {
      const current = prev.assignedStores || [];
      if (current.includes(storeId)) {
        return { ...prev, assignedStores: current.filter(id => id !== storeId) };
      } else {
        return { ...prev, assignedStores: [...current, storeId] };
      }
    });
  };

  const handleExportData = async () => {
    try {
      const [usersData, productsData, categoriesData, storesData, stockData, movementsData] = await Promise.all([
        UserApi.getAll(),
        ProductApi.getAll(),
        CategoryApi.getAll(),
        StoreApi.getAll(),
        StockApi.getAll(),
        MovementApi.getAll(),
      ]);
      const data = { users: usersData, products: productsData, categories: categoriesData, stores: storesData, stock: stockData, movements: movementsData };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supre_wms_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar los datos.');
    }
  };

  // Check if current user has permission to manage users
  const canManageUsers = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes('MANAGE_USERS');

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h2>
        <p className="text-slate-500">No tienes permisos para acceder a la configuración general.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Configuración del Sistema</h1>
          <p className="text-slate-500 mt-2">Gestión de usuarios, preferencias y mantenimiento de datos.</p>
        </div>
        {activeTab === 'users' && (
          <Button className="gap-2 w-full sm:w-auto" onClick={() => handleOpenModal()}>
            <Plus className="w-5 h-5" />
            Nuevo Usuario
          </Button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Users className="w-4 h-4" />
          Usuarios y Roles
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'preferences' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Settings2 className="w-4 h-4" />
          Preferencias
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'data' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Database className="w-4 h-4" />
          Mantenimiento de Datos
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos Especiales</TableHead>
                  <TableHead>Tiendas Asignadas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-900">
                      {user.name}
                      {user.id === currentUser?.id && (
                        <Badge variant="secondary" className="ml-2 text-xs">Tú</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.permissions?.length ? (
                          user.permissions.map(p => (
                            <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-sm italic">Por defecto del rol</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.assignedStores?.length ? (
                          user.assignedStores.map(storeId => {
                            const store = stores.find(s => s.id === storeId);
                            return (
                              <span key={storeId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <StoreIcon className="w-3 h-3" />
                                {store?.name || 'Desconocida'}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-400 text-sm italic">Todas / Ninguna</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar Usuario"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          title="Eliminar Usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Reglas de Negocio e Interfaz</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Moneda Principal</label>
                <select
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
                  value={preferences.currency}
                  onChange={(e) => savePreferences({ ...preferences, currency: e.target.value })}
                >
                  <option value="USD">Dólar Estadounidense (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="VES">Bolívar Venezolano (VES)</option>
                  <option value="MXN">Peso Mexicano (MXN)</option>
                  <option value="COP">Peso Colombiano (COP)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Símbolo utilizado en los reportes financieros.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tamaño de Impresión QR (mm)</label>
                <Input 
                  type="number"
                  value={preferences.qrSize}
                  onChange={(e) => savePreferences({ ...preferences, qrSize: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">Tamaño por defecto al imprimir etiquetas.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={preferences.allowNegativeStock}
                  onChange={(e) => savePreferences({ ...preferences, allowNegativeStock: e.target.checked })}
                />
                <div>
                  <span className="block text-sm font-medium text-slate-900">Permitir Stock Negativo</span>
                  <span className="block text-xs text-slate-500">Permite realizar salidas de almacén incluso si el sistema indica que no hay stock suficiente.</span>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">Límite de Auto-Aprobación de Mermas (Monto)</label>
              <Input 
                type="number"
                value={preferences.autoApproveDisincorporationLimit}
                onChange={(e) => savePreferences({ ...preferences, autoApproveDisincorporationLimit: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-500 mt-1">Las desincorporaciones por debajo de este monto se aprobarán automáticamente sin requerir revisión del administrador.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Mantenimiento y Respaldos</h2>
          
          <div className="space-y-6">
            <div className="p-4 border border-blue-100 bg-blue-50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-blue-900">Exportar Base de Datos</h3>
                <p className="text-sm text-blue-700 mt-1">Descarga un archivo JSON con todo el inventario, usuarios, tiendas y movimientos históricos.</p>
              </div>
              <Button onClick={handleExportData} className="flex-shrink-0 gap-2">
                <Download className="w-4 h-4" />
                Descargar Backup
              </Button>
            </div>

            <div className="p-4 border border-rose-100 bg-rose-50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-rose-900">Limpiar Datos de Prueba</h3>
                <p className="text-sm text-rose-700 mt-1">Elimina todos los movimientos y resetea el stock a cero. (Acción irreversible).</p>
              </div>
              <Button variant="danger" className="flex-shrink-0" onClick={() => alert('Esta función requiere confirmación de doble factor en producción.')}>
                Resetear Sistema
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información Básica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nombre Completo</label>
                    <Input 
                      placeholder="Ej: Juan Pérez" 
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Usuario</label>
                    <Input 
                      placeholder="Ej: jperez" 
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
                    <Input 
                      type="password"
                      placeholder="******" 
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rol Principal</label>
                    <select
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tiendas Asignadas (Visible para COMPRAS o DEPOSITO) */}
              {(formData.role === 'COMPRAS' || formData.role === 'DEPOSITO') && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Tiendas Asignadas</h3>
                  <p className="text-sm text-slate-500 mb-2">Selecciona las tiendas a las que este usuario tiene acceso. Si no seleccionas ninguna, tendrá acceso a todas (según su rol).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stores.map(store => {
                      const isSelected = formData.assignedStores?.includes(store.id);
                      return (
                        <div 
                          key={store.id}
                          onClick={() => toggleStore(store.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <StoreIcon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                              {store.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Permisos Específicos */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Permisos Específicos</h3>
                <p className="text-sm text-slate-500 mb-4">Asigna permisos adicionales que sobrescriben o complementan los permisos por defecto de su rol.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_PERMISSIONS.map(permission => {
                    const isSelected = formData.permissions?.includes(permission.id);
                    return (
                      <div 
                        key={permission.id}
                        onClick={() => togglePermission(permission.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-slate-800 border-slate-800 text-white' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                          isSelected ? 'bg-white border-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {permission.label}
                          </p>
                          <p className={`text-xs mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser}>
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;