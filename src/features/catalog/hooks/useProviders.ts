import { useState, useEffect } from 'react';
import { ProviderApi } from '../../../services/api';
import { Provider } from '../../../types';

export const useProviders = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await ProviderApi.getAll();
      setProviders(data as Provider[]);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProvider = async (provider: Provider) => {
    if (provider.id) {
      await ProviderApi.update(provider.id, provider);
    } else {
      await ProviderApi.create(provider);
    }
    await loadData();
  };

  const deleteProvider = async (id: string) => {
    await ProviderApi.remove(id);
    await loadData();
  };

  return {
    providers,
    isLoading,
    saveProvider,
    deleteProvider,
    reload: loadData
  };
};
