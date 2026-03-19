import { useState, useEffect } from 'react';
import { StoreApi, LocationApi } from '../../../services/api';
import { Store, Location } from '../../../types';

export const useInfrastructure = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storesData, locationsData] = await Promise.all([
        StoreApi.getAll(),
        LocationApi.getAll(),
      ]);
      setStores(storesData as Store[]);
      setLocations(locationsData as Location[]);
    } catch (error) {
      console.error('Error loading infrastructure data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveStore = async (store: Store) => {
    if (store.id && !String(store.id).startsWith('new')) {
      await StoreApi.update(store.id, store);
    } else {
      await StoreApi.create(store);
    }
    await loadData();
  };

  const deleteStore = async (id: string) => {
    await StoreApi.remove(id);
    await loadData();
  };

  const saveLocation = async (location: Location) => {
    if (location.id && !String(location.id).startsWith('new')) {
      // Las ubicaciones no tienen PUT en el API, se elimina y recrea
      await LocationApi.remove(location.id);
    }
    await LocationApi.create(location);
    await loadData();
  };

  const deleteLocation = async (id: string) => {
    await LocationApi.remove(id);
    await loadData();
  };

  return {
    stores,
    locations,
    isLoading,
    saveStore,
    deleteStore,
    saveLocation,
    deleteLocation,
  };
};
