import React, { useState } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { Plus, Search, Edit2, Tag, Trash2, X, Download, Upload } from 'lucide-react';
import { Category } from '../../../types';
import { CategoryApi } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';

export const CategoriesPage: React.FC = () => {
  const { categories, isLoading, saveCategory, deleteCategory, refresh } = useCatalog();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ code: string, name: string, subcategories: {id?: string|number, name: string}[] }>({ code: '', name: '', subcategories: [] });

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingId(category.id);
      setFormData({ code: category.code, name: category.name, subcategories: category.subcategories || [] });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', subcategories: [] });
    }
    setIsModalOpen(true);
  };

  const handleAddSubcategory = () => {
    setFormData(prev => ({
      ...prev,
      subcategories: [...prev.subcategories, { name: '' }]
    }));
  };

  const handleUpdateSubcategory = (index: number, name: string) => {
    setFormData(prev => {
      const newSubs = [...prev.subcategories];
      newSubs[index].name = name;
      return { ...prev, subcategories: newSubs };
    });
  };

  const handleRemoveSubcategory = (index: number) => {
    setFormData(prev => {
      const newSubs = [...prev.subcategories];
      newSubs.splice(index, 1);
      return { ...prev, subcategories: newSubs };
    });
  };

  const handleSave = () => {
    if (formData.code && formData.name) {
      saveCategory({
        id: editingId || undefined,
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: '',
        qrCode: '',
        isFractional: false,
        subcategories: formData.subcategories.filter(s => s.name.trim() !== '') as any, // Typed correctly in backend anyway
      } as Category);
      setFormData({ code: '', name: '', subcategories: [] });
      setEditingId(null);
      setIsModalOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
      deleteCategory(id);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await CategoryApi.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'categorias.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error al exportar categorías');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await CategoryApi.importCsv(file);
      alert(result.message || 'Importación completada');
      refresh();
    } catch (error: any) {
      alert(error.message || 'Error al importar categorías');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Categorías</h1>
          <p className="text-slate-500 mt-2">Gestión de letras de pasillo y organización del catálogo.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="ghost" className="gap-2 border border-slate-200" onClick={() => document.getElementById('import-input')?.click()} disabled={isImporting}>
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importando...' : 'Importar'}
          </Button>
          <input 
            id="import-input" 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleImport} 
          />
          <Button variant="ghost" className="gap-2 border border-slate-200" onClick={handleExport} disabled={isExporting}>
            <Download className="w-4 h-4" />
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
          <Button className="gap-2" onClick={() => handleOpenModal()}>
            <Plus className="w-5 h-5" />
            Nueva Categoría
          </Button>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              icon={<Search className="w-5 h-5" />}
              placeholder="Buscar por letra o nombre..."
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
                    <TableHead>Letra (Código)</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map(category => (
                    <TableRow key={category.id} className="group">
                      <TableCell className="font-mono text-sm text-blue-600 font-bold">
                        {category.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                            <Tag className="w-5 h-5 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-900">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(category)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(category.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCategories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-slate-500">
                        No se encontraron categorías.
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
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Letra (Código)</label>
                <Input 
                  placeholder="Ej: A, B, C..." 
                  maxLength={1}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de la Categoría</label>
                <Input 
                  placeholder="Ej: Electrónica, Ropa..." 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700 shadow-sm">Sub-categorías</label>
                  <Button type="button" variant="ghost" onClick={handleAddSubcategory} className="h-8 py-0 px-2 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0 border border-slate-200">
                    <Plus className="w-4 h-4" /> Añadir
                  </Button>
                </div>
                {formData.subcategories.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-2">No hay sub-categorías. Haz clic en "Añadir" para crear una.</p>
                ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {formData.subcategories.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            placeholder={`Sub-categoría ${idx + 1}...`}
                            value={sub.name}
                            onChange={(e) => handleUpdateSubcategory(idx, e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubcategory(idx)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                          title="Eliminar Sub-categoría"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                {editingId ? 'Guardar Cambios' : 'Crear Categoría'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
