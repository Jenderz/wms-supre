import { useState, useEffect, useCallback } from 'react';
import { SpaceGroupApi } from '../../../services/api';

export interface SpaceGroup {
  id: number;
  name: string;
  warehouseId: number | null;
  spaceIds: number[];
  createdAt: string;
}

export const useSpaceGroups = () => {
  const [groups, setGroups] = useState<SpaceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async (warehouseId?: string | number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await SpaceGroupApi.getAll(warehouseId) as SpaceGroup[];
      // Asegurarnos de que spaceIds siempre sea un array de números
      const formattedData = data.map(g => ({
        ...g,
        spaceIds: g.spaceIds ? g.spaceIds.map(Number) : [],
        id: Number(g.id),
      }));
      setGroups(formattedData);
    } catch (err: any) {
      console.error('Error fetching space groups:', err);
      setError(err.message || 'Error al cargar los grupos de espacios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = useCallback(async (name: string, spaceIds: (string | number)[], warehouseId: string | number | null): Promise<SpaceGroup | undefined> => {
    try {
      const payload = {
        name: name.trim(),
        warehouseId: warehouseId ? Number(warehouseId) : null,
        spaceIds: spaceIds.map(Number),
      };
      const result = await SpaceGroupApi.create(payload) as { id: number };
      await fetchGroups(); // Recargar la lista después de crear
      // Retornar el grupo recién creado con su id
      if (result?.id) {
        return {
          id: Number(result.id),
          name: name.trim(),
          warehouseId: warehouseId ? Number(warehouseId) : null,
          spaceIds: spaceIds.map(Number),
          createdAt: new Date().toISOString(),
        };
      }
      return undefined;
    } catch (err: any) {
      console.error('Error creating group:', err);
      throw err;
    }
  }, [fetchGroups]);

  const updateGroup = useCallback(async (id: string | number, name: string, spaceIds: (string | number)[], warehouseId?: string | number | null) => {
    try {
      const payload = {
        name: name.trim(),
        warehouseId: warehouseId ? Number(warehouseId) : null,
        spaceIds: spaceIds.map(Number),
      };
      await SpaceGroupApi.update(id, payload);
      await fetchGroups(); // Recargar la lista
    } catch (err: any) {
      console.error('Error updating group:', err);
      throw err;
    }
  }, [fetchGroups]);

  const deleteGroup = useCallback(async (id: string | number) => {
    try {
      await SpaceGroupApi.remove(id);
      await fetchGroups();
    } catch (err: any) {
      console.error('Error deleting group:', err);
      throw err;
    }
  }, [fetchGroups]);

  /** Devuelve los grupos que contienen un spaceId dado */
  const getGroupsForSpace = useCallback((spaceId: string | number): SpaceGroup[] => {
    const sId = Number(spaceId);
    return groups.filter(g => g.spaceIds.includes(sId));
  }, [groups]);

  return {
    groups,
    isLoading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupsForSpace,
  };
};
