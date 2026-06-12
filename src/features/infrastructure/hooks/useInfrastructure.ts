import { useState, useEffect } from 'react';
import { WarehouseApi, WarehouseSpaceApi, SpaceTypeApi } from '../../../services/api';
import { Warehouse, WarehouseSpace, SpaceType } from '../../../types';

export const useInfrastructure = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseSpaces, setWarehouseSpaces] = useState<WarehouseSpace[]>([]);
  const [spaceTypes, setSpaceTypes] = useState<SpaceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [warehousesData, spacesData, typesData] = await Promise.all([
        WarehouseApi.getAll(),
        WarehouseSpaceApi.getAll(),
        SpaceTypeApi.getAll()
      ]);
      setWarehouses(warehousesData as Warehouse[]);
      setWarehouseSpaces(spacesData as WarehouseSpace[]);
      setSpaceTypes(typesData as SpaceType[]);
    } catch (error) {
      console.error('Error loading infrastructure data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveWarehouse = async (warehouse: Warehouse) => {
    if (warehouse.id && !String(warehouse.id).startsWith('new')) {
      await WarehouseApi.update(warehouse.id, warehouse);
    } else {
      await WarehouseApi.create(warehouse);
    }
    await loadData();
  };

  const deleteWarehouse = async (id: string) => {
    await WarehouseApi.remove(id);
    await loadData();
  };

  const saveWarehouseSpace = async (space: WarehouseSpace) => {
    if (space.id && !String(space.id).startsWith('new')) {
       await WarehouseSpaceApi.update(space.id, space);
    } else {
       await WarehouseSpaceApi.create(space);
    }
    await loadData();
  };

  const deleteWarehouseSpace = async (id: string) => {
    await WarehouseSpaceApi.remove(id);
    await loadData();
  };

  const saveSpaceType = async (type: SpaceType) => {
    await SpaceTypeApi.create(type);
    await loadData();
  };

  const updateSpaceType = async (id: string, data: Partial<SpaceType>) => {
    await SpaceTypeApi.update(id, data);
    await loadData();
  };
  
  const deleteSpaceType = async (id: string) => {
    await SpaceTypeApi.remove(id);
    await loadData();
  };

  return {
    warehouses,
    warehouseSpaces,
    spaceTypes,
    isLoading,
    saveWarehouse,
    deleteWarehouse,
    saveWarehouseSpace,
    deleteWarehouseSpace,
    saveSpaceType,
    updateSpaceType,
    deleteSpaceType,
    setWarehouseSpaces // Exponer setter para importación
  };
};
