import { useState, useEffect } from 'react';
import { ProductApi, CategoryApi, WarehouseApi, StockApi } from '../../../services/api';
import { Product, Category, Warehouse } from '../../../types';
import { Provider } from '../../../types';

export const useCatalog = () => {
  const [products, setProductsState] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, categoriesData, warehousesData] = await Promise.all([
        ProductApi.getAll(),
        CategoryApi.getAll(),
        WarehouseApi.getAll(),
      ]);
      setProductsState(productsData as Product[]);
      setCategories(categoriesData as Category[]);
      setWarehouses(warehousesData as Warehouse[]);
    } catch (error) {
      console.error('Error loading catalog data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProduct = async (product: Product) => {
    if (product.id) {
      // Actualización: solo actualizar el producto, no tocar el stock existente
      await ProductApi.update(product.id, product);
    } else {
      // Creación: primero crear el producto y obtener el ID generado
      const created = await ProductApi.create(product);
      const newProductId = String(created.id);

      // Crear registros de stock con quantity=0 por cada almacén habilitado
      const enabledWarehouses = product.enabledWarehouses ?? [];
      if (enabledWarehouses.length > 0) {
        await Promise.all(
          enabledWarehouses.map((warehouseId) =>
            StockApi.upsert({
              productId: newProductId,
              warehouseId: String(warehouseId),
              warehouseSpaceId: null,
              quantity: 0,
              minStock: 0,
            })
          )
        );
      }
    }
    await loadData();
  };

  const setAllProducts = async (products: Product[]) => {
    // Upsert masivo: crear o actualizar según si tiene id
    await Promise.all(
      products.map(p =>
        p.id ? ProductApi.update(p.id, p) : ProductApi.create(p)
      )
    );
    await loadData();
  };

  const deleteProduct = async (id: string) => {
    await ProductApi.remove(id);
    await loadData();
  };

  const saveCategory = async (category: Category) => {
    if (category.id) {
      await CategoryApi.update(category.id, category);
    } else {
      await CategoryApi.create(category);
    }
    await loadData();
  };

  const deleteCategory = async (id: string) => {
    await CategoryApi.remove(id);
    await loadData();
  };

  /**
   * Devuelve el nombre de la categoría por su ID.
   * Si no se encuentra, muestra 'Sin Categoría' como fallback.
   */
  const getCategoryName = (categoryId: string) => {
    return categories.find(c => String(c.id) === String(categoryId))?.name || 'Sin Categoría';
  };

  /**
   * Devuelve el nombre del primer proveedor asignado al producto.
   * Si no hay proveedores asignados, devuelve 'Sin proveedor asignado'.
   */
  const getProviderName = (providerIds: (string | number)[], providers: Provider[]): string => {
    if (!providerIds || providerIds.length === 0) return 'Sin proveedor asignado';
    const validIds = providerIds.filter(id => !!id);
    if (validIds.length === 0) return 'Sin proveedor asignado';
    const found = providers.find(p => String(p.id) === String(validIds[0]));
    return found?.name || 'Sin proveedor asignado';
  };

  return {
    products,
    categories,
    warehouses,
    isLoading,
    saveProduct,
    setAllProducts,
    deleteProduct,
    saveCategory,
    deleteCategory,
    getCategoryName,
    getProviderName,
    refresh: loadData,
  };
};
