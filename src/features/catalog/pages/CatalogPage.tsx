import React, { useState } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { useProviders } from '../hooks/useProviders';
import { Plus, Search, Edit2, Package, Trash2, X, Upload, Download, FileDown, ScanLine, DollarSign, FileEdit, ChevronUp, ChevronDown, ChevronsUpDown, Warehouse } from 'lucide-react';
import Papa from 'papaparse';
import { CategoriesPage } from './CategoriesPage';
import { ProvidersPage } from './ProvidersPage';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/Table';
import { Product } from '../../../types';
import { QRCodeCanvas } from 'qrcode.react';
import { QRScannerModal } from '../../../components/QRScannerModal';
import { useLockedAction } from '../../../hooks/useLockedAction';
import { LockModal } from '../../../components/LockModal';
import { ImportResultModal, ImportResultData } from '../../../components/ImportResultModal';

// Tipo de columna ordenable
type SortKey = 'name' | 'category' | 'provider' | 'price';
type SortDir = 'asc' | 'desc';

export const CatalogPage: React.FC = () => {
  const { products, categories, warehouses, isLoading, getCategoryName, getProviderName, saveProduct, setAllProducts, deleteProduct, refresh } = useCatalog();
  const { providers } = useProviders();

  // Llaves de acceso para Productos
  const lockEdit   = useLockedAction('CATALOG', 'EDIT');
  const lockDelete = useLockedAction('CATALOG', 'DELETE');
  const lockExport = useLockedAction('CATALOG', 'EXPORT');
  // CATALOG + IMPORT queda libre (sin llave)

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // ─── Ordenamiento de columnas ───────────────
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ─── Modales ───────────────────────────────
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES' | 'PROVIDERS'>('PRODUCTS');

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'PRODUCTS') {
      refresh();
    }
  };
  
  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    categoryId: '',
    dimensions: { height: 0, width: 0, depth: 0 },
    costs: [0],
    prices: [0],
    imageUrl: '',
    footerUrl: '',
    enabledWarehouses: [],
    subcategoryId: '',
    providers: ['']
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm);
    const matchesCategory = filterCategory ? String(p.categoryId) === String(filterCategory) : true;
    const matchesSubcategory = filterSubcategory ? String(p.subcategoryId) === String(filterSubcategory) : true;
    let matchesProvider = true;
    if (filterProvider === 'NO_PROVIDER') {
      // Solo productos sin proveedor asignado
      const provs = p.providers || [];
      matchesProvider = provs.length === 0 || provs.every(pid => !pid || pid === '' || pid === null);
    } else if (filterProvider) {
      matchesProvider = (p.providers || []).some(pid => String(pid) === String(filterProvider));
    }
    // Filtro por almacén habilitado
    const matchesWarehouse = filterWarehouse
      ? (p.enabledWarehouses || []).map(String).includes(String(filterWarehouse))
      : true;
    return matchesSearch && matchesCategory && matchesSubcategory && matchesProvider && matchesWarehouse;
  });

  // ─── Ordenamiento de la lista filtrada ────────────────────
  const sortedProducts = sortKey
    ? [...filteredProducts].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortKey === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortKey === 'category') {
          valA = getCategoryName(a.categoryId).toLowerCase();
          valB = getCategoryName(b.categoryId).toLowerCase();
        } else if (sortKey === 'provider') {
          valA = getProviderName(a.providers || [], providers).toLowerCase();
          valB = getProviderName(b.providers || [], providers).toLowerCase();
        } else if (sortKey === 'price') {
          const priceA = Array.isArray(a.prices) ? (a.prices[0] || 0) : 0;
          const priceB = Array.isArray(b.prices) ? (b.prices[0] || 0) : 0;
          return sortDir === 'asc' ? priceA - priceB : priceB - priceA;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredProducts;

  // Helper para renderizar el ícono de la columna ordenable
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-blue-500 ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 text-blue-500 ml-1" />;
  };

  // Sub-categorías disponibles según la categoría seleccionada en el filtro
  const subcategoriesForFilter = filterCategory
    ? (categories.find(c => String(c.id) === String(filterCategory))?.subcategories || [])
    : [];

  const activeFiltersCount = [filterCategory, filterSubcategory, filterProvider, filterWarehouse].filter(Boolean).length;

  // Estado para el modal de resultados
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);

  // Estado para el modal de estrategia de importación
  type ImportStrategy = 'all' | 'new_only' | 'update_only';
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('all');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ─── EXPORTAR ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const fecha = new Date().toISOString().slice(0, 10);
    const data = products.map(p => {
      const costsArray  = Array.isArray(p.costs)  ? p.costs  : (p.costs  ? Object.values(p.costs  as object) : []);
      const pricesArray = Array.isArray(p.prices) ? p.prices : (p.prices ? Object.values(p.prices as object) : []);
      const dims = p.dimensions || { height: 0, width: 0, depth: 0 };
      const catName   = getCategoryName(p.categoryId) || '';
      const provNames = (Array.isArray(p.providers) ? p.providers : [])
        .map(pid => getProviderName([pid], providers))
        .filter(n => n && n !== 'Sin proveedor asignado')
        .join('|');
      return {
        'Código':      p.code || '',
        'Nombre':      p.name || '',
        'Categoría':   catName,
        'Alto (cm)':   dims.height || 0,
        'Ancho (cm)':  dims.width  || 0,
        'Largo (cm)':  dims.depth  || 0,
        'Costo 1':     costsArray[0] !== undefined  ? String(costsArray[0]).replace('.', ',')  : '',
        'Costo 2':     costsArray[1] !== undefined  ? String(costsArray[1]).replace('.', ',')  : '',
        'Precio 1':    pricesArray[0] !== undefined ? String(pricesArray[0]).replace('.', ',') : '',
        'Precio 2':    pricesArray[1] !== undefined ? String(pricesArray[1]).replace('.', ',') : '',
        'Precio 3':    pricesArray[2] !== undefined ? String(pricesArray[2]).replace('.', ',') : '',
        'Precio 4':    pricesArray[3] !== undefined ? String(pricesArray[3]).replace('.', ',') : '',
        'Proveedores': provNames,
        'Imagen URL':  p.imageUrl  || '',
        'Footer URL':  p.footerUrl || '',
      };
    });

    const csv  = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `productos_${fecha}.csv`;
    // FIX: el anchor debe estar en el DOM para que el navegador acepte la descarga
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // ─── PLANTILLA EN BLANCO ─────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = ['Código','Nombre','Categoría','Alto (cm)','Ancho (cm)','Largo (cm)',
                     'Costo 1','Costo 2','Precio 1','Precio 2','Precio 3','Precio 4',
                     'Proveedores','Imagen URL','Footer URL'];
    // Fila de ejemplo: costos y precios en 0, categoría y proveedor son opcionales
    const example = ['PROD-001','Nombre del producto','Sin Categoría',30,20,15,
                     '0','0','0','0','0','0',
                     '','',''];
    const csv  = Papa.unparse({ fields: headers, data: [example] });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'plantilla_productos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // ─── IMPORTAR ────────────────────────────────────────────────────────────────
  // Paso 1: capturar el archivo y mostrar modal de estrategia
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPendingFile(file);
    setImportStrategy('all');
    setShowStrategyModal(true);
  };

  // Paso 2: ejecutar la importación según estrategia elegida
  const executeImport = (file: File, strategy: ImportStrategy) => {

    Papa.parse(file, {
      header:         true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (!rows.length) {
          alert('El archivo CSV está vacío o sin cabeceras reconocibles.');
          return;
        }

        // Mapeo tolerante de columnas (nombre exacto, sin tildes, lowercase)
        const col = (row: any, ...keys: string[]): string => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]).trim();
          }
          return '';
        };

        const result: ImportResultData = {
          total:   rows.length,
          created: 0, updated: 0, skipped: 0, errors: 0,
          items:   [],
        };

        const validProducts: Product[] = [];

        rows.forEach((row, idx) => {
          const fila = idx + 2; // +1 header +1 base-1
          const code  = col(row, 'Código', 'Codigo', 'code', 'CODE');
          const name  = col(row, 'Nombre', 'name', 'NAME');

          if (!code || !name) {
            result.errors++;
            result.items.push({ type: 'error', message: `Fila ${fila}: Código y Nombre son obligatorios (se omitió).` });
            return;
          }

          const catName  = col(row, 'Categoría', 'Categoria', 'categoryId');
          const provRaw  = col(row, 'Proveedores', 'Proveedor', 'providers');

          // Resolver categoría por nombre → ID
          // Si no se encuentra, se busca la categoría reservada 'SIN-CAT' del sistema
          const sinCat = categories.find(c =>
            c.code?.toLowerCase() === 'sin-cat' ||
            c.name?.toLowerCase() === 'sin categoría' ||
            c.name?.toLowerCase() === 'sin categoria'
          );
          const defaultCategoryId = sinCat ? String(sinCat.id) : '';

          let categoryId = defaultCategoryId;
          if (catName && catName.toLowerCase() !== 'sin categoría' && catName.toLowerCase() !== 'sin categoria') {
            const found = categories.find(c =>
              c.name.toLowerCase() === catName.toLowerCase() ||
              c.code.toLowerCase() === catName.toLowerCase()
            );
            if (found) {
              categoryId = String(found.id);
            } else {
              categoryId = defaultCategoryId;
              result.items.push({ type: 'warning', message: `Fila ${fila} (${code}): Categoría "${catName}" no encontrada → asignada a Sin Categoría.` });
            }
          }

          // Resolver proveedores por nombre → ID
          const providerIds: string[] = [];
          if (provRaw) {
            String(provRaw).split('|').map(s => s.trim()).filter(Boolean).forEach(pName => {
              // Ignorar si el usuario escribió literalmente 'sin proveedor'
              if (pName.toLowerCase() === 'sin proveedor asignado' || pName.toLowerCase() === 'sin proveedor') return;
              const found = providers.find(p =>
                p.name.toLowerCase() === pName.toLowerCase() ||
                p.code.toLowerCase() === pName.toLowerCase()
              );
              if (found) {
                providerIds.push(String(found.id));
              } else {
                result.items.push({ type: 'warning', message: `Fila ${fila} (${code}): Proveedor "${pName}" no encontrado, se omite.` });
              }
            });
          }
          // Si tras resolver no hay ningún proveedor válido, registrarlo como 'Sin proveedor asignado'
          if (providerIds.length === 0) {
            result.items.push({ type: 'warning', message: `${code} — Sin proveedor asignado.` });
          }

          // ¿Es actualizar o crear?
          const existente = products.find(p => p.code === code);

          // Filtrar según la estrategia seleccionada
          if (strategy === 'new_only' && existente) {
            result.skipped++;
            result.items.push({ type: 'warning', message: `${code} — ya existe, omitido (modo "solo nuevos").` });
            return;
          }
          if (strategy === 'update_only' && !existente) {
            result.skipped++;
            result.items.push({ type: 'warning', message: `${code} — no existe aún, omitido (modo "solo actualizar").` });
            return;
          }

          if (existente) {
            result.updated++;
            result.items.push({ type: 'success', message: `${code} — actualizado.` });
          } else {
            result.created++;
          }

          // Parsear costos y precios: siempre arrays de tamaño fijo, 0 como default
          // Soporta columnas individuales (nuevo formato) y columna legacy 'Costos'/'Precios'
          const parseMoney = (v: string) => {
            if (!v || !v.trim()) return 0;
            return Number(v.trim().replace(',', '.')) || 0;
          };

          // Intentar primero columnas individuales
          const hasCostCols  = 'Costo 1'  in row || 'Costo 2'  in row;
          const hasPriceCols = 'Precio 1' in row || 'Precio 2' in row || 'Precio 3' in row || 'Precio 4' in row;

          const costs: number[] = hasCostCols
            ? [
                parseMoney(col(row, 'Costo 1')),
                parseMoney(col(row, 'Costo 2')),
              ]
            : (() => {
                const raw = col(row, 'Costos', 'Costes');
                const parts = raw ? raw.split('|').map(parseMoney) : [];
                return [parts[0] ?? 0, parts[1] ?? 0];
              })();

          const prices: number[] = hasPriceCols
            ? [
                parseMoney(col(row, 'Precio 1')),
                parseMoney(col(row, 'Precio 2')),
                parseMoney(col(row, 'Precio 3')),
                parseMoney(col(row, 'Precio 4')),
              ]
            : (() => {
                const raw = col(row, 'Precios');
                const parts = raw ? raw.split('|').map(parseMoney) : [];
                return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
              })();

          validProducts.push({
            id:       existente?.id || undefined,
            code,
            name,
            categoryId,
            providers: providerIds,
            dimensions: {
              height: Number(col(row, 'Alto (cm)', 'Alto', 'height')) || 0,
              width:  Number(col(row, 'Ancho (cm)', 'Ancho', 'width'))  || 0,
              depth:  Number(col(row, 'Largo (cm)', 'Largo', 'depth'))  || 0,
            },
            costs,
            prices,
            imageUrl:  col(row, 'Imagen URL', 'Imagen', 'imageUrl'),
            footerUrl: col(row, 'Footer URL', 'Footer', 'footerUrl'),
            enabledWarehouses: [],
          });
        });

        result.skipped = result.total - result.created - result.updated - result.errors;

        if (validProducts.length === 0) {
          result.items.unshift({ type: 'error', message: 'No se encontraron filas válidas para importar.' });
          setImportResult(result);
          setShowImportResult(true);
          return;
        }

        try {
          await setAllProducts(validProducts);
          await refresh();
          setImportResult(result);
          setShowImportResult(true);
        } catch (error: any) {
          result.errors++;
          result.items.unshift({ type: 'error', message: `Error del servidor: ${error.message || 'Error desconocido'}` });
          setImportResult(result);
          setShowImportResult(true);
        }
      },
      error: (error: any) => {
        alert(`❌ Error al leer el CSV: ${error.message}`);
      },
    });
  };


  const handleOpenModal = (product?: Product, isAdmin: boolean = true) => {
    setIsAdminMode(isAdmin);
    if (product) {
      setEditingId(product.id);
      setFormData({
        ...product,
        dimensions: product.dimensions ? { ...product.dimensions } : { height: 0, width: 0, depth: 0 },
        costs: Array.isArray(product.costs) ? [...product.costs] : (product.costs ? (typeof product.costs === 'object' ? Object.values(product.costs) : [product.costs]) : [0]),
        prices: Array.isArray(product.prices) ? [...product.prices] : (product.prices ? (typeof product.prices === 'object' ? Object.values(product.prices) : [product.prices]) : [0]),
        enabledWarehouses: Array.isArray(product.enabledWarehouses) ? [...product.enabledWarehouses] : [],
        subcategoryId: product.subcategoryId || '',
        providers: Array.isArray(product.providers) ? (product.providers.length > 0 ? [...product.providers] : ['']) : ['']
      });
    } else {
      setEditingId(null);
      setFormData({
        code: '',
        name: '',
        categoryId: '',
        dimensions: { height: 0, width: 0, depth: 0 },
        costs: [0],
        prices: [0],
        imageUrl: '',
        footerUrl: '',
        enabledWarehouses: [],
        subcategoryId: '',
        providers: ['']
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Por favor complete los campos obligatorios (Código y Nombre)');
      return;
    }

    // Si es un producto nuevo sin almacenes seleccionados, advertir
    if (!editingId && (!formData.enabledWarehouses || formData.enabledWarehouses.length === 0)) {
      const continuar = window.confirm(
        '⚠️ No seleccionaste ningún almacén.\n\n' +
        'Sin almacén asignado, el producto no aparecerá en el módulo de Inventario.\n\n' +
        '¿Deseas continuar de todas formas?'
      );
      if (!continuar) return;
    }

    const productToSave: Product = {
      id: editingId || undefined,
      code: formData.code,
      name: formData.name,
      categoryId: formData.categoryId,
      dimensions: {
        height: Number(formData.dimensions?.height) || 0,
        width: Number(formData.dimensions?.width) || 0,
        depth: Number(formData.dimensions?.depth) || 0,
      },
      costs: formData.costs?.map(c => Number(c) || 0) || [0],
      prices: formData.prices?.map(p => Number(p) || 0) || [0],
      imageUrl: formData.imageUrl || '',
      footerUrl: formData.footerUrl || '',
      enabledWarehouses: formData.enabledWarehouses || [],
      subcategoryId: formData.subcategoryId || null,
      providers: formData.providers?.filter(p => !!p).map(String) || []
    };

    try {
      await saveProduct(productToSave);
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message || 'Error al guardar el producto');
    }
  };

  const handleDelete = (product: Product) => {
    lockDelete.execute(() => {
      setProductToDelete(product);
    });
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete.id);
      } catch (error: any) {
        alert(error.message || 'Error al eliminar el producto');
      }
      setProductToDelete(null);
    }
  };

  const handleDownloadQR = (id: string, code: string) => {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement;
    if (canvas) {
      // Create a larger canvas for better print quality (600px is excellent for ~50mm at 300dpi)
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
        link.download = `qr-${code}.png`;
        link.href = url;
        link.click();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6 no-print scrollbar-hide">
        <button
          onClick={() => handleTabChange('PRODUCTS')}
          className={`whitespace-nowrap px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PRODUCTS' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => handleTabChange('CATEGORIES')}
          className={`whitespace-nowrap px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'CATEGORIES' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Categorías
        </button>
        <button
          onClick={() => handleTabChange('PROVIDERS')}
          className={`whitespace-nowrap px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PROVIDERS' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Proveedores
        </button>
      </div>

      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Productos</h1>
              <p className="text-slate-500 mt-2">Gestión de ítems, categorías y precios base.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" id="import-file" />
              <Button variant="secondary" className="gap-2 w-full sm:w-auto" onClick={() => document.getElementById('import-file')?.click()}>
                <Upload className="w-5 h-5" />
                Importar
              </Button>
              <Button variant="secondary" className="gap-2 w-full sm:w-auto" onClick={() => lockExport.execute(handleExport)}>
                <Download className="w-5 h-5" />
                Exportar
              </Button>
              <Button variant="secondary" className="gap-2 w-full sm:w-auto" onClick={handleDownloadTemplate}>
                <FileDown className="w-5 h-5" />
                Plantilla
              </Button>
              <Button className="gap-2 w-full sm:w-auto" onClick={() => handleOpenModal(undefined, true)}>
                <Plus className="w-5 h-5" />
                Nuevo Producto
              </Button>
            </div>
          </header>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <Input
                    icon={<Search className="w-5 h-5" />}
                    placeholder="Buscar por código o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  variant="secondary" 
                  className="px-3 md:hidden" 
                  onClick={() => setIsScannerOpen(true)}
                  title="Escanear QR"
                >
                  <ScanLine className="w-5 h-5" />
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowFilters(!showFilters)}
                className={`w-full sm:w-auto gap-2 ${showFilters ? 'bg-slate-200' : ''}`}
              >
                Filtros
                {activeFiltersCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Filtro: Categoría */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => {
                        setFilterCategory(e.target.value);
                        setFilterSubcategory(''); // reset sub al cambiar categoría
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro: Sub-categoría (dependiente de la categoría seleccionada) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sub-categoría</label>
                    <select
                      value={filterSubcategory}
                      onChange={(e) => setFilterSubcategory(e.target.value)}
                      disabled={subcategoriesForFilter.length === 0}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {subcategoriesForFilter.length === 0
                          ? filterCategory ? 'Sin sub-categorías' : 'Seleccione una categoría primero'
                          : 'Todas las sub-categorías'}
                      </option>
                      {subcategoriesForFilter.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro: Proveedor */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor</label>
                    <select
                      value={filterProvider}
                      onChange={(e) => setFilterProvider(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Todos los proveedores</option>
                      <option value="NO_PROVIDER">⚠ Sin proveedor asignado</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro: Almacén */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Warehouse className="w-3.5 h-3.5" />
                        Almacén
                      </span>
                    </label>
                    <select
                      value={filterWarehouse}
                      onChange={(e) => setFilterWarehouse(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Todos los almacenes</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Botón limpiar filtros */}
                {activeFiltersCount > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => { setFilterCategory(''); setFilterSubcategory(''); setFilterProvider(''); setFilterWarehouse(''); }}
                      className="text-xs text-slate-500 hover:text-red-600 transition-colors underline underline-offset-2"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[800px] px-4 sm:px-0">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead
                        onClick={() => handleSort('name')}
                        className="cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center">
                          Producto
                          <SortIcon col="name" />
                        </span>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('category')}
                        className="cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center">
                          Categoría
                          <SortIcon col="category" />
                        </span>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('provider')}
                        className="cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center">
                          Proveedor
                          <SortIcon col="provider" />
                        </span>
                      </TableHead>
                      <TableHead>CBM (m³)</TableHead>
                      <TableHead
                        onClick={() => handleSort('price')}
                        className="cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center">
                          Precio Base
                          <SortIcon col="price" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProducts.map(product => {
                      const dims = product.dimensions || { height: 0, width: 0, depth: 0 };
                      const cbm = (dims.height * dims.width * dims.depth) / 1000000;
                      
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm text-blue-600 font-medium">{product.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 group/qr">
                              <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                                <QRCodeCanvas 
                                  id={`qr-${product.id}`}
                                  value={product.code} 
                                  size={40} 
                                  level="L" 
                                />
                              </div>
                              <button
                                onClick={() => handleDownloadQR(product.id, product.code)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all opacity-0 group-hover/qr:opacity-100"
                                title="Descargar QR"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <span className="font-medium text-slate-900">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{getCategoryName(product.categoryId)}</Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const name = getProviderName(product.providers || [], providers);
                              const isMissing = name === 'Sin proveedor asignado';
                              return (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  isMissing
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isMissing ? '⚠ Sin proveedor' : name}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-slate-600 font-mono text-sm">{cbm.toFixed(4)}</TableCell>
                          <TableCell className="text-slate-600 font-mono text-sm">
                            ${Number(
                              Array.isArray(product.prices) 
                                ? (product.prices[0] || 0) 
                                : (product.prices ? (typeof product.prices === 'object' ? Object.values(product.prices)[0] : product.prices) : 0)
                            ).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenModal(product, false)}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Editar detalles"
                              >
                                <FileEdit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  // Sin categoría real → editar libremente para poder asignar una
                                  const sinCat = !product.categoryId || getCategoryName(product.categoryId) === 'Sin Categoría';
                                  if (sinCat) {
                                    handleOpenModal(product, true);
                                  } else {
                                    lockEdit.execute(() => handleOpenModal(product, true));
                                  }
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Editar administrador"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(product)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {sortedProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                          No se encontraron productos.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CATEGORIES' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          <CategoriesPage />
        </div>
      )}

      {activeTab === 'PROVIDERS' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          <ProvidersPage />
        </div>
      )}


      {/* Modal de Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-xl border border-slate-200 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Columna Izquierda */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Código</label>
                  <Input 
                    placeholder="Ej: PROD-001" 
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                  <Input 
                    placeholder="Ej: Silla de Oficina" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Sin Categoría (se asignará automáticamente)</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sub-Categoría</label>
                  <select
                    value={formData.subcategoryId || ''}
                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                    disabled={!formData.categoryId}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Seleccione una sub-categoría...</option>
                    {categories.find(c => String(c.id) === String(formData.categoryId))?.subcategories?.map(sub => (
                      <option key={sub.id} value={String(sub.id)}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                {isAdminMode && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dimensiones (cm)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Alto</label>
                        <Input 
                          type="number"
                          value={formData.dimensions?.height || 0}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            dimensions: { ...formData.dimensions!, height: Number(e.target.value) } 
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ancho</label>
                        <Input 
                          type="number"
                          value={formData.dimensions?.width || 0}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            dimensions: { ...formData.dimensions!, width: Number(e.target.value) } 
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Profundidad</label>
                        <Input 
                          type="number"
                          value={formData.dimensions?.depth || 0}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            dimensions: { ...formData.dimensions!, depth: Number(e.target.value) } 
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha */}
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">URL Imagen</label>
                    <Input 
                      placeholder="https://..." 
                      value={formData.imageUrl || ''}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">URL Pie Página</label>
                    <Input 
                      placeholder="https://..." 
                      value={formData.footerUrl || ''}
                      onChange={(e) => setFormData({ ...formData, footerUrl: e.target.value })}
                    />
                  </div>
                </div>

                {isAdminMode && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-slate-700">Proveedores</label>
                      {(!formData.providers || formData.providers.length < 2) && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                            const current = Array.isArray(formData.providers) ? formData.providers : [];
                            setFormData({ ...formData, providers: [...current, ''] });
                          }} className="h-6 py-0 px-2 text-xs gap-1 text-blue-600">
                          <Plus className="w-3 h-3" /> Añadir
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {formData.providers?.map((prov, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={prov}
                            onChange={(e) => {
                              const newProviders = [...(formData.providers || [])];
                              newProviders[index] = e.target.value;
                              setFormData({ ...formData, providers: newProviders });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="">Seleccione un proveedor...</option>
                            {providers.map(p => (
                              <option key={p.id} value={String(p.id)}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const newProviders = [...(formData.providers || [])];
                              newProviders.splice(index, 1);
                              setFormData({ ...formData, providers: newProviders });
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Almacenes habilitados */}
                {isAdminMode && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5">
                        <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                        Almacenes habilitados
                        {!editingId && (
                          <span className="text-xs font-normal text-blue-600 ml-1">(recomendado al crear)</span>
                        )}
                      </span>
                    </label>
                    {!editingId && (
                      <p className="text-xs text-slate-500 mb-2">
                        El producto se creará con <strong>cantidad 0</strong> en cada almacén seleccionado, listo para gestionar desde Inventario.
                      </p>
                    )}
                    <div className={`border rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 ${
                      !editingId && (!formData.enabledWarehouses || formData.enabledWarehouses.length === 0)
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}>
                      {warehouses.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">
                          No hay almacenes registrados en el sistema.
                        </p>
                      ) : (
                        warehouses.map(wh => {
                          const isChecked = (formData.enabledWarehouses || []).map(String).includes(String(wh.id));
                          return (
                            <label
                              key={wh.id}
                              className={`flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${
                                isChecked ? 'bg-blue-50' : 'hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = (formData.enabledWarehouses || []).map(String);
                                  setFormData({
                                    ...formData,
                                    enabledWarehouses: e.target.checked
                                      ? [...current, String(wh.id)]
                                      : current.filter(id => id !== String(wh.id))
                                  });
                                }}
                                className="accent-blue-600 w-4 h-4 shrink-0"
                              />
                              <span className={`text-sm ${isChecked ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>
                                {wh.name}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {!editingId && (!formData.enabledWarehouses || formData.enabledWarehouses.length === 0) && warehouses.length > 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        ⚠️ Sin almacén seleccionado el producto no aparecerá en Inventario.
                      </p>
                    )}
                  </div>
                )}

                {/* Costos fijos */}
                {isAdminMode && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Costos ($)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['Costo 1', 'Costo 2'] as const).map((label, i) => (
                        <div key={i}>
                          <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={formData.costs?.[i] ?? 0}
                            onChange={(e) => {
                              const newCosts = [...(Array.isArray(formData.costs) ? formData.costs : [0, 0])];
                              while (newCosts.length < 2) newCosts.push(0);
                              newCosts[i] = Number(e.target.value);
                              setFormData({ ...formData, costs: newCosts });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Precios fijos */}
                {isAdminMode && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Precios ($)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['Precio 1', 'Precio 2', 'Precio 3', 'Precio 4'] as const).map((label, i) => (
                        <div key={i}>
                          <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={formData.prices?.[i] ?? 0}
                            onChange={(e) => {
                              const newPrices = [...(Array.isArray(formData.prices) ? formData.prices : [0, 0, 0, 0])];
                              while (newPrices.length < 4) newPrices.push(0);
                              newPrices[i] = Number(e.target.value);
                              setFormData({ ...formData, prices: newPrices });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Escáner QR */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setSearchTerm(code)}
      />

      {/* Modales de Llave de Acceso */}
      <LockModal {...lockEdit.lockModalProps} />
      <LockModal {...lockDelete.lockModalProps} />
      <LockModal {...lockExport.lockModalProps} />

      {/* Modal de resultados de importación */}
      <ImportResultModal
        isOpen={showImportResult}
        title="Resultado de la Importación de Productos"
        result={importResult}
        onClose={() => setShowImportResult(false)}
      />

      {/* ─── Modal de Estrategia de Importación ─────────────────────────── */}
      {showStrategyModal && pendingFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Estrategia de Importación</h2>
                <p className="text-sm text-slate-500 truncate max-w-xs">{pendingFile.name}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-5">¿Cómo deseas procesar los registros del archivo?</p>

            <div className="space-y-3 mb-8">
              {([
                { value: 'all',         label: 'Actualizar y cargar nuevos',    desc: 'Crea productos nuevos y actualiza los existentes.' },
                { value: 'new_only',    label: 'Solo cargar nuevos',            desc: 'Ignora productos cuyo código ya existe en el sistema.' },
                { value: 'update_only', label: 'Solo actualizar existentes',    desc: 'Ignora productos cuyo código no existe aún.' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    importStrategy === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    value={opt.value}
                    checked={importStrategy === opt.value}
                    onChange={() => setImportStrategy(opt.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${
                      importStrategy === opt.value ? 'text-blue-700' : 'text-slate-800'
                    }`}>{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => { setShowStrategyModal(false); setPendingFile(null); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  setShowStrategyModal(false);
                  executeImport(pendingFile!, importStrategy);
                  setPendingFile(null);
                }}
              >
                <Upload className="w-4 h-4" />
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modal de Confirmación de Eliminación ─────────────────────────── */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">¿Estás seguro?</h2>
            <p className="text-sm text-slate-500 mb-8">
              Estás a punto de eliminar el producto <strong>{productToDelete.name}</strong>.<br/><br/>
              Esta acción <strong>borrará toda referencia</strong> del producto en el almacén, inventario, historiales y ubicaciones de forma irreversible.
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setProductToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmDelete}
              >
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
