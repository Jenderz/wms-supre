import React, { useState } from 'react';
import { useLock } from '../../../context/LockContext';
import { LockApi } from '../../../services/api';
import { LockKey, LockModule, LockAction } from '../../../types';
import {
  Plus, Search, Edit2, Trash2, X, Lock, LockOpen, Eye, EyeOff,
  Shield, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';

const MODULES: { value: LockModule; label: string }[] = [
  { value: 'CATALOG',          label: 'Productos' },
  { value: 'CATEGORIES',       label: 'Categorías' },
  { value: 'PROVIDERS',        label: 'Proveedores' },
  { value: 'INFRASTRUCTURE',   label: 'Infraestructura' },
  { value: 'PURCHASING',       label: 'Abastecimiento' },
  { value: 'WAREHOUSE',        label: 'Depósito' },
  { value: 'DISINCORPORATION', label: 'Desincorporación' },
  { value: 'USERS',            label: 'Usuarios' },
  { value: 'SETTINGS',         label: 'Configuración' },
  { value: 'INVENTORY',        label: 'Inventario' },
];

const ACTIONS: { value: LockAction; label: string }[] = [
  { value: '*',            label: 'Todas las acciones (*)' },
  { value: 'VIEW',         label: 'Ver detalles' },
  { value: 'DELETE',       label: 'Eliminar' },
  { value: 'EDIT',         label: 'Editar' },
  { value: 'CREATE',       label: 'Crear' },
  { value: 'IMPORT',       label: 'Importar' },
  { value: 'EXPORT',       label: 'Exportar' },
  { value: 'CONFORM',      label: 'Conformar lote' },
  { value: 'APPROVE',      label: 'Aprobar' },
  { value: 'ADJUST_STOCK', label: 'Ajustar Stock' },
];

const ACTION_COLORS: Record<string, string> = {
  DELETE:       'bg-red-100 text-red-700 border-red-200',
  EDIT:         'bg-blue-100 text-blue-700 border-blue-200',
  CREATE:       'bg-green-100 text-green-700 border-green-200',
  VIEW:         'bg-amber-100 text-amber-700 border-amber-200',
  IMPORT:       'bg-purple-100 text-purple-700 border-purple-200',
  EXPORT:       'bg-indigo-100 text-indigo-700 border-indigo-200',
  CONFORM:      'bg-orange-100 text-orange-700 border-orange-200',
  APPROVE:      'bg-teal-100 text-teal-700 border-teal-200',
  ADJUST_STOCK: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '*':          'bg-slate-100 text-slate-700 border-slate-200',
};

type FormData = {
  name: string;
  module: LockModule;
  action: LockAction;
  key: string;
  keyConfirm: string;
  isActive: boolean;
  description: string;
};

const emptyForm = (): FormData => ({
  name: '',
  module: 'CATALOG',
  action: '*',
  key: '',
  keyConfirm: '',
  isActive: true,
  description: '',
});

export const LocksPage: React.FC = () => {
  const { locks, reload, isLoading, clearCache } = useLock();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm());
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filtered = locks.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModuleLabel = (m: string) => MODULES.find(x => x.value === m)?.label ?? m;
  const getActionLabel = (a: string) => ACTIONS.find(x => x.value === a)?.label ?? a;

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setFormError('');
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lock: LockKey) => {
    setEditingId(lock.id);
    setFormData({
      name: lock.name,
      module: lock.module,
      action: lock.action,
      key: '',
      keyConfirm: '',
      isActive: lock.isActive,
      description: lock.description ?? '',
    });
    setFormError('');
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formData.name.trim()) { setFormError('El nombre es requerido.'); return; }

    // Al crear, la clave es obligatoria
    if (!editingId && !formData.key) { setFormError('La llave de acceso es requerida.'); return; }

    // Si viene clave nueva, validar coincidencia
    if (formData.key && formData.key !== formData.keyConfirm) {
      setFormError('Las llaves no coinciden.'); return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        module: formData.module,
        action: formData.action,
        isActive: formData.isActive,
        description: formData.description.trim() || null,
      };
      if (formData.key) payload['key'] = formData.key;

      if (editingId) {
        await LockApi.update(editingId, payload);
      } else {
        await LockApi.create(payload);
      }
      clearCache();
      await reload();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta llave de acceso? La acción que protege quedará libre.')) return;
    try {
      await LockApi.remove(id);
      clearCache();
      await reload();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar.');
    }
  };

  const handleToggleActive = async (lock: LockKey) => {
    try {
      await LockApi.update(lock.id, { ...lock, isActive: !lock.isActive });
      clearCache();
      await reload();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl">
              <Shield className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Llaves de Acceso</h1>
          </div>
          <p className="text-slate-500 mt-2 ml-1">
            Configura claves que protegen acciones críticas por módulo o acción específica.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={handleOpenCreate}>
          <Plus className="w-5 h-5" />
          Nueva Llave
        </Button>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="mb-6">
          <Input
            icon={<Search className="w-5 h-5" />}
            placeholder="Buscar por nombre o módulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[700px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Clave</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(lock => (
                    <TableRow key={lock.id} className="group">
                      <TableCell className="font-medium text-slate-900">{lock.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          {getModuleLabel(lock.module)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLORS[lock.action] ?? ACTION_COLORS['*']}`}>
                          {getActionLabel(lock.action)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-slate-400 text-sm tracking-widest">●●●●●●</span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(lock)}
                          className="flex items-center gap-1.5 transition-colors"
                          title={lock.isActive ? 'Activa — click para desactivar' : 'Inactiva — click para activar'}
                        >
                          {lock.isActive ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-green-500" />
                              <span className="text-xs font-medium text-green-600">Activa</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                              <span className="text-xs font-medium text-slate-400">Inactiva</span>
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(lock)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lock.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Lock className="w-10 h-10" />
                          <p className="font-medium">No hay llaves configuradas</p>
                          <p className="text-sm">Crea una nueva llave para proteger acciones críticas.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl border border-slate-200 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Editar Llave' : 'Nueva Llave de Acceso'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre descriptivo *</label>
                <Input
                  placeholder="Ej: Llave para eliminar productos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Módulo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Módulo *</label>
                  <select
                    value={formData.module}
                    onChange={(e) => setFormData({ ...formData, module: e.target.value as LockModule })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  >
                    {MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {/* Acción */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Acción *</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value as LockAction })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  >
                    {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Clave */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {editingId ? 'Nueva llave (dejar vacío para no cambiar)' : 'Llave de acceso *'}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder={editingId ? '••••••••' : 'Ingresa la clave secreta'}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar clave */}
              {formData.key && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar llave *</label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={formData.keyConfirm}
                    onChange={(e) => setFormData({ ...formData, keyConfirm: e.target.value })}
                    placeholder="Repite la clave"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                </div>
              )}

              {/* Estado activo */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">Estado de la llave</p>
                  <p className="text-xs text-slate-500 mt-0.5">Si está inactiva, la acción pasa libre sin pedir clave.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className="transition-colors"
                >
                  {formData.isActive
                    ? <ToggleRight className="w-8 h-8 text-green-500" />
                    : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                </button>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción (opcional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notas internas sobre esta llave..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
                />
              </div>

              {formError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-600 gap-2"
              >
                {isSaving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Lock className="w-4 h-4" />}
                {editingId ? 'Guardar Cambios' : 'Crear Llave'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
