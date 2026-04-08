import { useState, useEffect } from 'react';
import { ProductApi, CategoryApi } from '../../../services/api';
import { Product, Category } from '../../../types';

export const useCatalog = () => {
  const [products, setProductsState] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, categoriesData] = await Promise.all([
        ProductApi.getAll(),
        CategoryApi.getAll(),
      ]);
      setProductsState(productsData as Product[]);
      setCategories(categoriesData as Category[]);
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
      await ProductApi.update(product.id, product);
    } else {
      await ProductApi.create(product);
    }
    await loadData();
  };

  const setAllProducts = async (products: Product[]) => {
    // Upsert masivo: crear cada uno que no exista
    await Promise.all(products.map(p => ProductApi.create(p)));
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

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => String(c.id) === String(categoryId))?.name || 'N/A';
  };

  return {
    products,
    categories,
    isLoading,
    saveProduct,
    setAllProducts,
    deleteProduct,
    saveCategory,
    deleteCategory,
    getCategoryName,
    refresh: loadData,
  };
};
