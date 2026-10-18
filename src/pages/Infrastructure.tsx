import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfrastructure } from '../features/infrastructure/hooks/useInfrastructure';
import { useSpaceGroups, SpaceGroup } from '../features/infrastructure/hooks/useSpaceGroups';
import { Warehouse, WarehouseSpace, SpaceType } from '../types';
import { Building2, MapPin, Plus, Edit2, Trash2, X, Download, Upload, QrCode, Layers, Package, BarChart2, Filter, ChevronsUpDown, ChevronUp, ChevronDown, FolderPlus, Folder, CheckSquare, Square, Check, Tag } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { QRCodeCanvas } from 'qrcode.react';
import Papa from 'papaparse';
import { SmartSpaceImportModal } from '../features/infrastructure/components/SmartSpaceImportModal';

const Infrastructure: React.FC = () => {
  const navigate = useNavigate();

  const {
    warehouses,
    warehouseSpaces,
    spaceTypes,
    isLoading,
    saveWarehouse,
    deleteWarehouse,
    saveWarehouseSpace,
    batchSaveWarehouseSpaces,
    deleteWarehouseSpace,
    bulkDeleteWarehouseSpaces,
    bulkUpdateWarehouseSpaces,
    saveSpaceType,
    updateSpaceType,
    deleteSpaceType,
    setWarehouseSpaces
  } = useInfrastructure();

  const [activeTab, setActiveTab] = useState<'warehouses' | 'spaces' | 'spaceTypes'>('warehouses');

  // Smart Import State
  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [pendingSpaceImports, setPendingSpaceImports] = useState<any[]>([]);

  // Warehouse Modal State
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<Partial<Warehouse>>({ name: '', description: '', qrCode: '' });

  // Space Modal State
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceForm, setSpaceForm] = useState<Partial<WarehouseSpace>>({ warehouseId: '', name: '', spaceTypeId: '', spaceUsageType: 'Almacenamiento', proximity: 0 });
  const [newSpaceType, setNewSpaceType] = useState<string>('');
  const [isCreatingSpaceType, setIsCreatingSpaceType] = useState(false);
  // Grupo en modal de espacio individual
  const [spaceFormGroupId, setSpaceFormGroupId] = useState<string>('');
  const [isCreatingSpaceFormGroup, setIsCreatingSpaceFormGroup] = useState(false);
  const [newSpaceFormGroupName, setNewSpaceFormGroupName] = useState('');
  const [spaceFormGroupError, setSpaceFormGroupError] = useState('');
  const [spaceFormError, setSpaceFormError] = useState<string>('');

  // Space Type Modal State
  const [isSpaceTypeModalOpen, setIsSpaceTypeModalOpen] = useState(false);
  const [editingSpaceTypeId, setEditingSpaceTypeId] = useState<string | null>(null);
  const [spaceTypeForm, setSpaceTypeForm] = useState<Partial<SpaceType>>({ name: '' });
  const [spaceTypeError, setSpaceTypeError] = useState<string>('');

  // Bulk Edit Modals
  const [isBulkProximityModalOpen, setIsBulkProximityModalOpen] = useState(false);
  const [bulkProximityValue, setBulkProximityValue] = useState<number | ''>('');
  const [isBulkSpaceTypeModalOpen, setIsBulkSpaceTypeModalOpen] = useState(false);
  const [bulkSpaceTypeId, setBulkSpaceTypeId] = useState<string>('');
  const [isBulkUsageTypeModalOpen, setIsBulkUsageTypeModalOpen] = useState(false);
  const [bulkUsageTypeValue, setBulkUsageTypeValue] = useState<'Almacenamiento' | 'Despachos'>('Almacenamiento');

  // Filtro por almacén en la tab de Espacios
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('');

  // Ordenamiento de la tabla de Espacios
  type SpacesSortKey = 'name' | 'spaceType' | 'usageType' | 'proximity' | 'productCount' | 'totalQuantity' | 'group';
  const [spacesSortKey, setSpacesSortKey] = useState<SpacesSortKey | ''>('');
  const [spacesSortDir, setSpacesSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Grupos de espacios ────────────────────────────────────────────────────
  const {
    groups: spaceGroups,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupsForSpace,
  } = useSpaceGroups();

  // Modo selección múltiple de espacios
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<Set<string>>(new Set());

  // Modal crear/editar grupo
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalName, setGroupModalName] = useState('');
  const [groupModalError, setGroupModalError] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | number | null>(null);
  // Modo del modal de grupo: 'new' = crear nuevo, 'existing' = agregar a grupo existente
  const [groupModalMode, setGroupModalMode] = useState<'new' | 'existing'>('new');
  const [groupModalExistingId, setGroupModalExistingId] = useState<string>('');
  // Modo standalone: crear grupo sin espacios preseleccionados
  const [isStandaloneGroupModal, setIsStandaloneGroupModal] = useState(false);
  const [groupModalWarehouseId, setGroupModalWarehouseId] = useState<string>('');

  // Filtro activo por grupo (null = sin filtro)
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  const handleSpacesSort = (key: SpacesSortKey) => {
    if (spacesSortKey === key) {
      setSpacesSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSpacesSortKey(key);
      setSpacesSortDir('asc');
    }
  };

  // ── Helpers de selección ──────────────────────────────────────────────────
  const toggleSelectMode = () => {
    setIsSelectMode(v => !v);
    setSelectedSpaceIds(new Set());
  };

  const toggleSpaceSelection = (id: string) => {
    setSelectedSpaceIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = sortedSpaces.map(s => s.id);
    setSelectedSpaceIds(new Set(allIds));
  };

  const clearSelection = () => setSelectedSpaceIds(new Set());

  // ── Handlers de grupos ────────────────────────────────────────────────────
  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupModalName('');
    setGroupModalError('');
    setGroupModalMode('new');
    setGroupModalExistingId('');
    setIsStandaloneGroupModal(false);
    setGroupModalWarehouseId('');
    setIsGroupModalOpen(true);
  };

  /** Abre el modal para crear un grupo de forma independiente (sin espacios requeridos) */
  const openStandaloneGroupModal = () => {
    setEditingGroupId(null);
    setGroupModalName('');
    setGroupModalError('');
    setGroupModalMode('new');
    setGroupModalExistingId('');
    setIsStandaloneGroupModal(true);
    setGroupModalWarehouseId(selectedWarehouseFilter || '');
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: SpaceGroup) => {
    setEditingGroupId(group.id);
    setGroupModalName(group.name);
    setGroupModalError('');
    setIsStandaloneGroupModal(false);
    setGroupModalWarehouseId('');
    // Pre-seleccionar los espacios del grupo
    setSelectedSpaceIds(new Set(group.spaceIds));
    setIsSelectMode(true);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async () => {
    // En modo standalone se permite crear un grupo vacío (sin espacios)
    if (!isStandaloneGroupModal && selectedSpaceIds.size === 0) {
      setGroupModalError('Selecciona al menos un espacio.');
      return;
    }
    // Determinar warehouseId:
    // - Modo standalone: obligatorio desde el selector del modal.
    // - Modo selección: preferir el filtro de almacén activo; si no hay filtro,
    //   inferirlo del primer espacio seleccionado.
    let warehouseId: string | null = null;
    if (isStandaloneGroupModal) {
      if (!groupModalWarehouseId) {
        setGroupModalError('Debes seleccionar un almacén para crear el grupo.');
        return;
      }
      warehouseId = groupModalWarehouseId;
    } else {
      if (selectedWarehouseFilter) {
        warehouseId = selectedWarehouseFilter;
      } else if (selectedSpaceIds.size > 0) {
        const firstId = [...selectedSpaceIds][0];
        const firstSpace = warehouseSpaces.find(ws => ws.id === firstId);
        warehouseId = firstSpace ? String(firstSpace.warehouseId) : null;
      }
    }

    try {
      if (editingGroupId) {
        // Modo edición de un grupo existente
        const trimmed = groupModalName.trim();
        if (!trimmed) {
          setGroupModalError('El nombre del grupo no puede estar vacío.');
          return;
        }
        // Verificar nombre duplicado en el mismo almacén (excluyendo el propio grupo)
        const editingGroup = spaceGroups.find(g => g.id === Number(editingGroupId));
        const scopeWarehouseId = editingGroup?.warehouseId ?? null;
        const duplicado = spaceGroups.find(
          g => g.id !== Number(editingGroupId) &&
               g.name.trim().toLowerCase() === trimmed.toLowerCase() &&
               String(g.warehouseId ?? '') === String(scopeWarehouseId ?? '')
        );
        if (duplicado) {
          setGroupModalError(`El grupo "${trimmed}" ya existe en este almacén. Por favor elige un nombre diferente.`);
          return;
        }
        // Verificar que los espacios seleccionados no estén en otro grupo
        const spacesInOtherGroup = Array.from(selectedSpaceIds).filter(sid => {
          const ownerGroups = getGroupsForSpace(sid);
          return ownerGroups.some(g => g.id !== Number(editingGroupId));
        });
        if (spacesInOtherGroup.length > 0) {
          const spaceNames = spacesInOtherGroup
            .map(sid => warehouseSpaces.find(ws => ws.id === sid)?.name || sid)
            .join(', ');
          const ownerGroup = getGroupsForSpace(spacesInOtherGroup[0]).find(g => g.id !== Number(editingGroupId));
          setGroupModalError(`Los espacios "${spaceNames}" ya pertenecen al grupo "${ownerGroup?.name}". Un espacio solo puede pertenecer a un grupo.`);
          return;
        }
        await updateGroup(editingGroupId, trimmed, [...selectedSpaceIds], scopeWarehouseId);
      } else if (groupModalMode === 'existing') {
        // Añadir los espacios seleccionados a un grupo existente
        if (!groupModalExistingId) {
          setGroupModalError('Selecciona un grupo existente.');
          return;
        }
        const targetGroup = spaceGroups.find(g => String(g.id) === groupModalExistingId);
        if (!targetGroup) {
          setGroupModalError('El grupo seleccionado ya no existe.');
          return;
        }
        // Verificar que los espacios seleccionados no estén en otro grupo distinto al target
        const spacesInOtherGroup = Array.from(selectedSpaceIds).filter(sid => {
          const ownerGroups = getGroupsForSpace(sid);
          return ownerGroups.some(g => g.id !== targetGroup.id);
        });
        if (spacesInOtherGroup.length > 0) {
          const spaceNames = spacesInOtherGroup
            .map(sid => warehouseSpaces.find(ws => ws.id === sid)?.name || sid)
            .join(', ');
          const ownerGroup = getGroupsForSpace(spacesInOtherGroup[0]).find(g => g.id !== targetGroup.id);
          setGroupModalError(`Los espacios "${spaceNames}" ya pertenecen al grupo "${ownerGroup?.name}". Un espacio solo puede pertenecer a un grupo.`);
          return;
        }
        // Unir los ids existentes con los nuevos seleccionados (sin duplicados)
        const mergedIds = [...new Set([...targetGroup.spaceIds.map(String), ...Array.from(selectedSpaceIds).map(String)])];
        await updateGroup(targetGroup.id, targetGroup.name, mergedIds, targetGroup.warehouseId);
      } else {
        // Crear grupo nuevo
        const trimmed = groupModalName.trim();
        if (!trimmed) {
          setGroupModalError('El nombre del grupo no puede estar vacío.');
          return;
        }
        // Verificar nombre duplicado dentro del mismo almacén
        const duplicado = spaceGroups.find(
          g => g.name.trim().toLowerCase() === trimmed.toLowerCase() &&
               String(g.warehouseId ?? '') === String(warehouseId ?? '')
        );
        if (duplicado) {
          setGroupModalError(`El grupo "${trimmed}" ya existe en este almacén. Por favor elige un nombre diferente.`);
          return;
        }
        // Verificar que los espacios seleccionados no estén en otro grupo
        const spacesInOtherGroup = Array.from(selectedSpaceIds).filter(sid => {
          return getGroupsForSpace(sid).length > 0;
        });
        if (spacesInOtherGroup.length > 0) {
          const spaceNames = spacesInOtherGroup
            .map(sid => warehouseSpaces.find(ws => ws.id === sid)?.name || sid)
            .join(', ');
          const ownerGroup = getGroupsForSpace(spacesInOtherGroup[0])[0];
          setGroupModalError(`Los espacios "${spaceNames}" ya pertenecen al grupo "${ownerGroup?.name}". Un espacio solo puede pertenecer a un grupo.`);
          return;
        }
        await createGroup(trimmed, [...selectedSpaceIds], warehouseId);
      }
      setIsGroupModalOpen(false);
      setIsStandaloneGroupModal(false);
      setGroupModalWarehouseId('');
      if (!isStandaloneGroupModal) {
        setIsSelectMode(false);
        setSelectedSpaceIds(new Set());
      }
      setGroupModalName('');
      setGroupModalError('');
      setEditingGroupId(null);
      setGroupModalMode('new');
      setGroupModalExistingId('');
    } catch (err: any) {
      // Mostrar el mensaje exacto del servidor (nombre duplicado, espacio ya asignado, etc.)
      setGroupModalError(err?.message || 'Ocurrió un error al guardar el grupo.');
    }
  };


  const handleDeleteGroup = async (id: string | number) => {
    if (window.confirm('¿Eliminar este grupo? Los espacios no se eliminarán.')) {
      try {
        await deleteGroup(id);
        if (activeGroupFilter === String(id)) setActiveGroupFilter(null);
      } catch (err) {
        alert('Ocurrió un error al eliminar el grupo.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`¿Estás seguro de eliminar ${selectedSpaceIds.size} espacios?`)) {
      await bulkDeleteWarehouseSpaces(Array.from(selectedSpaceIds));
      clearSelection();
      setIsSelectMode(false);
    }
  };

  const handleBulkUpdateProximity = async () => {
    if (bulkProximityValue === '') return;
    await bulkUpdateWarehouseSpaces(Array.from(selectedSpaceIds), { proximity: Number(bulkProximityValue) });
    setIsBulkProximityModalOpen(false);
    clearSelection();
    setIsSelectMode(false);
  };

  const handleBulkUpdateSpaceType = async () => {
    if (!bulkSpaceTypeId) return;
    await bulkUpdateWarehouseSpaces(Array.from(selectedSpaceIds), { spaceTypeId: bulkSpaceTypeId });
    setIsBulkSpaceTypeModalOpen(false);
    clearSelection();
    setIsSelectMode(false);
  };

  const handleBulkUpdateUsageType = async () => {
    if (!bulkUsageTypeValue) return;
    await bulkUpdateWarehouseSpaces(Array.from(selectedSpaceIds), { spaceUsageType: bulkUsageTypeValue });
    setIsBulkUsageTypeModalOpen(false);
    clearSelection();
    setIsSelectMode(false);
  };

  // ─── Handlers Warehouses ───────────────────────────────────────────────────

  const handleOpenWarehouseModal = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouseId(warehouse.id);
      setWarehouseForm({ name: warehouse.name, description: warehouse.description, qrCode: warehouse.qrCode });
    } else {
      setEditingWarehouseId(null);
      setWarehouseForm({ name: '', description: '', qrCode: '' });
    }
    setIsWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = () => {
    if (!warehouseForm.name || !warehouseForm.qrCode) return;
    saveWarehouse({
      id: editingWarehouseId || undefined,
      name: warehouseForm.name,
      description: warehouseForm.description || '',
      qrCode: warehouseForm.qrCode
    } as Warehouse);
    setIsWarehouseModalOpen(false);
  };

  const handleDeleteWarehouse = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este almacén? Se perderán todos los espacios asociados.')) {
      deleteWarehouse(id);
    }
  };

  const handleExportWarehouses = () => {
    const data = warehouses.length > 0 ? warehouses.map(w => ({
      ID: w.id,
      Nombre: w.name,
      Descripcion: w.description,
      CodigoQR: w.qrCode
    })) : [{ ID: '', Nombre: '', Descripcion: '', CodigoQR: '' }];
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almacenes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWarehouseTemplate = () => {
    const data = [{ ID: '', Nombre: 'Almacén Principal', Descripcion: 'Descripción breve', CodigoQR: '' }];
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_almacenes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWarehouses = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          if (row['Nombre']) {
            saveWarehouse({
              id: row['ID'] || undefined,
              name: row['Nombre'],
              description: row['Descripcion'] || '',
              qrCode: row['CodigoQR'] || `ALM-${Date.now()}-${Math.floor(Math.random() * 10000)}`
            } as Warehouse);
          }
        });
      }
    });
    e.target.value = '';
  };

  // ─── Handlers Spaces ───────────────────────────────────────────────────────

  const handleOpenSpaceModal = (space?: WarehouseSpace) => {
    setIsCreatingSpaceType(false);
    setIsCreatingSpaceFormGroup(false);
    setNewSpaceFormGroupName('');
    setSpaceFormGroupError('');
    setSpaceFormError('');
    if (space) {
      setEditingSpaceId(space.id);
      setSpaceForm({ warehouseId: space.warehouseId, name: space.name, spaceTypeId: space.spaceTypeId, spaceUsageType: space.spaceUsageType || 'Almacenamiento', proximity: space.proximity });
      // Pre-cargar el primer grupo al que pertenece el espacio
      const existingGroups = getGroupsForSpace(space.id);
      setSpaceFormGroupId(existingGroups.length > 0 ? String(existingGroups[0].id) : '');
    } else {
      setEditingSpaceId(null);
      setSpaceForm({ warehouseId: selectedWarehouseFilter || '', name: '', spaceTypeId: '', spaceUsageType: 'Almacenamiento', proximity: 0 });
      setSpaceFormGroupId('');
    }
    setIsSpaceModalOpen(true);
  };

  const handleCreateSpaceType = async () => {
    if (!newSpaceType.trim()) return;
    await saveSpaceType({ name: newSpaceType.trim() } as SpaceType);
    setNewSpaceType('');
    setIsCreatingSpaceType(false);
  };

  const handleSaveSpace = async () => {
    if (!spaceForm.warehouseId || !spaceForm.name || !spaceForm.spaceTypeId) return;
    setSpaceFormError('');

    // ── Validación preventiva de nombre duplicado en el mismo almacén ─────────
    const normalizedName = spaceForm.name.trim().toLowerCase();
    const isDuplicate = warehouseSpaces.some(s =>
      s.warehouseId === spaceForm.warehouseId &&
      s.name.trim().toLowerCase() === normalizedName &&
      s.id !== editingSpaceId   // excluir el propio espacio al editar
    );
    if (isDuplicate) {
      setSpaceFormError(
        `Ya existe un espacio llamado "${spaceForm.name.trim()}" en este almacén. Por favor elige un nombre diferente.`
      );
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const finalQrCode = editingSpaceId
      ? warehouseSpaces.find(s => s.id === editingSpaceId)?.qrCode
      : `${spaceForm.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`;

    const isNew = !editingSpaceId;

    try {
      // Para espacios NUEVOS: enviar groupId directamente al backend, que lo asigna
      // de forma atómica en la misma transacción (evita la asignación al grupo
      // predeterminado "(sin grupo asignado)" cuando el usuario ya eligió un grupo).
      await saveWarehouseSpace({
        id: editingSpaceId || undefined,
        warehouseId: spaceForm.warehouseId,
        spaceTypeId: spaceForm.spaceTypeId,
        spaceUsageType: spaceForm.spaceUsageType || 'Almacenamiento',
        name: spaceForm.name,
        proximity: spaceForm.proximity || 0,
        qrCode: finalQrCode,
        ...(isNew && spaceFormGroupId ? { groupId: spaceFormGroupId } : {}),
      } as WarehouseSpace);

      if (!isNew) {
        // ── EDICIÓN: mover/quitar el espacio de grupos via API de grupos ──────
        if (spaceFormGroupId) {
          const group = spaceGroups.find(g => String(g.id) === spaceFormGroupId);
          if (group) {
            const spaceId = editingSpaceId!;
            // Si el espacio ya pertenece a OTRO grupo, quitarlo de allí primero
            const previousGroups = getGroupsForSpace(spaceId).filter(g => g.id !== group.id);
            for (const prevGrp of previousGroups) {
              const cleanIds = prevGrp.spaceIds.filter(id => String(id) !== String(spaceId));
              await updateGroup(prevGrp.id, prevGrp.name, cleanIds, prevGrp.warehouseId);
            }
            // Añadir al grupo seleccionado (evitando duplicados)
            const currentIds = group.spaceIds.filter(id => String(id) !== String(spaceId));
            await updateGroup(group.id, group.name, [...currentIds, spaceId], group.warehouseId);
          }
        } else {
          // Si se quitó el grupo, remover el espacio de todos los grupos en que estaba
          const prevGroups = getGroupsForSpace(editingSpaceId!);
          for (const grp of prevGroups) {
            const newIds = grp.spaceIds.filter(id => String(id) !== String(editingSpaceId));
            await updateGroup(grp.id, grp.name, newIds, grp.warehouseId);
          }
        }
      }
      // Para espacios NUEVOS el groupId ya fue manejado atómicamente por el backend.
      // En ambos casos refrescamos los grupos para que el cliente refleje el estado real.
      await fetchGroups();

      setIsSpaceModalOpen(false);
    } catch (err: any) {
      setSpaceFormError(err?.message || 'Error al guardar el espacio. Intenta de nuevo.');
    }
  };

  const handleDeleteSpace = (id: string) => {
    if (window.confirm('¿Eliminar este espacio de almacén?')) {
      deleteWarehouseSpace(id);
    }
  };

  const handleExportSpaces = () => {
    const data = warehouseSpaces.length > 0 ? warehouseSpaces.map(s => {
      const wh = warehouses.find(w => w.id === s.warehouseId);
      const st = spaceTypes.find(t => t.id == s.spaceTypeId);
      const grupos = getGroupsForSpace(s.id).map(g => g.name).join(', ');
      return {
        ID: s.id,
        Almacen: wh?.name || s.warehouseId,
        AlmacenID: s.warehouseId,
        Nombre: s.name,
        TipoEspacio: st?.name || s.spaceTypeName || '',
        TipoEspacioID: s.spaceTypeId,
        TipoUsoEspacio: s.spaceUsageType || 'Almacenamiento',
        Cercania: s.proximity,
        Grupo: grupos,
        CodigoQR: s.qrCode
      };
    }) : [{ ID: '', Almacen: '', AlmacenID: '', Nombre: '', TipoEspacio: '', TipoEspacioID: '', TipoUsoEspacio: '', Cercania: '', Grupo: '', CodigoQR: '' }];
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'espacios_almacen.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSpaceTemplate = () => {
    // La columna CodigoQR es opcional: si la dejas vacía el sistema genera uno automático.
    // Si la completas, ese código se asignará al espacio. Puedes también editarlo desde el
    // importador inteligente antes de confirmar la importación.
    // La columna Grupo es opcional: si se especifica un nombre de grupo se asignará el espacio
    // a ese grupo. Si el grupo no existe, el importador preguntará si deseas crearlo.
    const data = [
      { ID: '', Almacen: 'Almacén Principal', AlmacenID: '', Nombre: 'Pasillo A', TipoEspacio: 'Estante', TipoEspacioID: '', TipoUsoEspacio: 'Almacenamiento', Cercania: '1', Grupo: 'Grupo A', CodigoQR: 'ESP-PA-001' },
      { ID: '', Almacen: 'Almacén Principal', AlmacenID: '', Nombre: 'Despacho 1', TipoEspacio: 'Mostrador', TipoEspacioID: '', TipoUsoEspacio: 'Despachos', Cercania: '2', Grupo: 'Grupo A', CodigoQR: 'ESP-D1-001' },
    ];
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_espacios_almacen.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSpaces = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPendingSpaceImports(results.data);
        setIsSmartImportModalOpen(true);
      }
    });
    e.target.value = '';
  };

  const handleConfirmSmartImport = async (validData: WarehouseSpace[]) => {
    // Usar importación en lote: todas las operaciones se hacen sin recargar
    // el estado entre medias (evita race conditions con N loadData()).
    // El backend gestiona la asignación de grupo en la misma transacción.
    await batchSaveWarehouseSpaces(validData);

    // Refrescar grupos para capturar los grupos predeterminados creados por el backend
    await fetchGroups();
    setIsSmartImportModalOpen(false);
    setPendingSpaceImports([]);
  };

  const handleCreateSpaceGroupForImport = async (name: string, warehouseId: string | number) => {
    await createGroup(name, [], warehouseId);
    // groups will be refreshed automatically inside createGroup
  };

  // ─── Handlers Space Types ──────────────────────────────────────────────────

  const handleOpenSpaceTypeModal = (spaceType?: SpaceType) => {
    setSpaceTypeError('');
    if (spaceType) {
      setEditingSpaceTypeId(spaceType.id);
      setSpaceTypeForm({ name: spaceType.name });
    } else {
      setEditingSpaceTypeId(null);
      setSpaceTypeForm({ name: '' });
    }
    setIsSpaceTypeModalOpen(true);
  };

  const handleSaveSpaceType = async () => {
    if (!spaceTypeForm.name?.trim()) return;
    if (editingSpaceTypeId) {
      await updateSpaceType(editingSpaceTypeId, { name: spaceTypeForm.name.trim() });
    } else {
      await saveSpaceType({ name: spaceTypeForm.name.trim() } as SpaceType);
    }
    setIsSpaceTypeModalOpen(false);
  };

  const handleDeleteSpaceType = async (id: string, name: string) => {
    if (window.confirm(`¿Eliminar el tipo de espacio "${name}"? Solo se puede si no está en uso.`)) {
      try {
        await deleteSpaceType(id);
      } catch (err: any) {
        alert(err.message || 'No se puede eliminar porque este tipo de espacio está en uso.');
      }
    }
  };


  // ─── Navegar al inventario filtrando por espacio ───────────────────────────

  const handleViewInventory = (space: WarehouseSpace) => {
    sessionStorage.setItem('wms_inventory_filter', JSON.stringify({
      tab: 'INVENTORY',
      spaceId: space.id,
      spaceName: space.name,
      warehouseId: space.warehouseId
    }));
    navigate('/warehouse');
  };

  // ─── Filtrado de espacios por almacén y grupo ──────────────────────────────

  const filteredSpaces = warehouseSpaces.filter(s => {
    const matchesWarehouse = !selectedWarehouseFilter || String(s.warehouseId) === String(selectedWarehouseFilter);
    const matchesGroup = !activeGroupFilter || (() => {
      const grp = spaceGroups.find(g => g.id === activeGroupFilter);
      return grp ? grp.spaceIds.includes(s.id) : true;
    })();
    return matchesWarehouse && matchesGroup;
  });

  // Ordenar espacios filtrados
  const sortedSpaces = spacesSortKey
    ? [...filteredSpaces].sort((a, b) => {
        let valA: any, valB: any;
        switch (spacesSortKey) {
          case 'name':
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
            break;
          case 'spaceType':
            valA = (spaceTypes.find(t => t.id == a.spaceTypeId)?.name || a.spaceTypeName || '').toLowerCase();
            valB = (spaceTypes.find(t => t.id == b.spaceTypeId)?.name || b.spaceTypeName || '').toLowerCase();
            break;
          case 'proximity':
            valA = Number(a.proximity || 0);
            valB = Number(b.proximity || 0);
            break;
          case 'productCount':
            valA = Number(a.productCount || 0);
            valB = Number(b.productCount || 0);
            break;
          case 'totalQuantity':
            valA = Number(a.totalQuantity || 0);
            valB = Number(b.totalQuantity || 0);
            break;
          case 'usageType':
            valA = (a.spaceUsageType || '').toLowerCase();
            valB = (b.spaceUsageType || '').toLowerCase();
            break;
          case 'group': {
            const groupsA = getGroupsForSpace(a.id).map(g => g.name).join(', ').toLowerCase();
            const groupsB = getGroupsForSpace(b.id).map(g => g.name).join(', ').toLowerCase();
            valA = groupsA || 'zzzzzz';
            valB = groupsB || 'zzzzzz';
            break;
          }
          default: return 0;
        }
        if (valA < valB) return spacesSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return spacesSortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredSpaces;

  // Grupos de espacios filtrados al almacén activo (para el panel de chips)
  // Usamos String() en ambas partes para evitar mismatch number vs string
  const visibleGroups = spaceGroups.filter(g =>
    !selectedWarehouseFilter || String(g.warehouseId) === String(selectedWarehouseFilter)
  );

  // Agrupar espacios ordenados por almacén
  const groupedSpaces = sortedSpaces.reduce((acc, space) => {
    const wid = String(space.warehouseId);
    if (!acc[wid]) acc[wid] = [];
    acc[wid].push(space);
    return acc;
  }, {} as Record<string, WarehouseSpace[]>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6 scrollbar-hide">
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'warehouses' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('warehouses')}
        >
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Almacenes</span>
          {activeTab === 'warehouses' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'spaces' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('spaces')}
        >
          <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Espacios de Almacén</span>
          {activeTab === 'spaces' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'spaceTypes' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('spaceTypes')}
        >
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Tipos de Espacio</span>
          {activeTab === 'spaceTypes' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {/* ═══ TAB: ALMACENES ════════════════════════════════════════════════════ */}
      {activeTab === 'warehouses' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Almacenes</h1>
              <p className="text-slate-500 mt-2">Gestión de almacenes, nombre y código</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
              <Button className="gap-2 whitespace-nowrap" onClick={() => handleOpenWarehouseModal()}>
                <Plus className="w-4 h-4" /> Crear nuevo almacén
              </Button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {warehouses.map(warehouse => {
              const locs = warehouseSpaces.filter(l => l.warehouseId === warehouse.id);
              const totalProducts = locs.reduce((sum, s) => sum + Number(s.productCount || 0), 0);
              const totalUnits = locs.reduce((sum, s) => sum + Number(s.totalQuantity || 0), 0);
              return (
                <div key={warehouse.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-500/30 transition-all group relative">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenWarehouseModal(warehouse)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteWarehouse(warehouse.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 group-hover:bg-blue-100 transition-all">
                        <Building2 className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{warehouse.name}</h3>
                        <p className="text-sm text-slate-500">QR: {warehouse.qrCode}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm mb-6 min-h-[40px]">{warehouse.description || 'Sin descripción'}</p>

                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-slate-400 text-xs mb-1">Espacios</p>
                      <p className="font-bold text-blue-600 text-lg">{locs.length}</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-slate-400 text-xs mb-1">Productos</p>
                      <p className="font-bold text-emerald-600 text-lg">{totalProducts}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs mb-1">Unidades</p>
                      <p className="font-bold text-violet-600 text-lg">{totalUnits}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {warehouses.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                No hay almacenes registrados.
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: ESPACIOS DE ALMACÉN ══════════════════════════════════════════ */}
      {activeTab === 'spaces' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Espacios de Almacén</h1>
              <p className="text-slate-500 mt-2">Gestión y control de ubicaciones internas físicas</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              {/* Botón Seleccionar / Cancelar selección */}
              <Button
                variant={isSelectMode ? 'primary' : 'secondary'}
                className="gap-2 whitespace-nowrap"
                onClick={toggleSelectMode}
              >
                {isSelectMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {isSelectMode ? 'Cancelar selección' : 'Seleccionar'}
              </Button>
              <Button variant="outline" className="gap-2 bg-white whitespace-nowrap" onClick={openStandaloneGroupModal}>
                <FolderPlus className="w-4 h-4" /> Nuevo Grupo
              </Button>
              <Button className="gap-2" onClick={() => handleOpenSpaceModal()}>
                <Plus className="w-4 h-4" /> Nuevo Espacio
              </Button>
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 cursor-pointer text-sm font-medium shadow-sm transition-all whitespace-nowrap">
                <Upload className="w-4 h-4" /> Importar
                <input type="file" accept=".csv" className="hidden" onChange={handleImportSpaces} />
              </label>
              <Button variant="outline" className="gap-2 bg-white" onClick={handleDownloadSpaceTemplate}>
                <Download className="w-4 h-4" /> Plantilla
              </Button>
              <Button variant="outline" className="gap-2 bg-white" onClick={handleExportSpaces}>
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </header>

          {/* Filtros: Almacén + Grupo */}
          <div className="flex flex-col gap-3 mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {/* Fila 1: Almacén */}
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-600 shrink-0">Almacén:</span>
              <select
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={selectedWarehouseFilter}
                onChange={(e) => { setSelectedWarehouseFilter(e.target.value); setActiveGroupFilter(null); }}
              >
                <option value="">Todos los almacenes ({warehouseSpaces.length} espacios)</option>
                {warehouses.map(w => {
                  const count = warehouseSpaces.filter(s => String(s.warehouseId) === String(w.id)).length;
                  return (
                    <option key={w.id} value={w.id}>{w.name} ({count} espacios)</option>
                  );
                })}
              </select>
              {selectedWarehouseFilter && (
                <button
                  onClick={() => { setSelectedWarehouseFilter(''); setActiveGroupFilter(null); }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"
                  title="Limpiar filtro de almacén"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Fila 2: Grupo de Cercanía (solo si hay almacén seleccionado) */}
            {selectedWarehouseFilter && (
              <div className="flex items-center gap-3 pl-6">
                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-sm font-medium text-slate-600 shrink-0">Grupo:</span>
                <select
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                  value={activeGroupFilter ?? ''}
                  onChange={(e) => setActiveGroupFilter(e.target.value || null)}
                >
                  <option value="">Todos los grupos</option>
                  {spaceGroups
                    .filter(g => String(g.warehouseId) === String(selectedWarehouseFilter))
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.spaceIds.length} esp.)</option>
                    ))}
                </select>
                {activeGroupFilter && (
                  <button
                    onClick={() => setActiveGroupFilter(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"
                    title="Limpiar filtro de grupo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Panel de Grupos ──────────────────────────────────────────────────── */}
          {(visibleGroups.length > 0 || isSelectMode || true) && (
            <div className="mb-4 bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-700">Grupos de Espacios</span>
                {visibleGroups.length > 0 && (
                  <span className="text-xs text-slate-400 ml-1">({visibleGroups.length} grupo{visibleGroups.length !== 1 ? 's' : ''})</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {isSelectMode && selectedSpaceIds.size > 0 && (
                    <button
                      onClick={openCreateGroupModal}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                      title="Crear nuevo grupo con los espacios seleccionados"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      Agrupar ({selectedSpaceIds.size})
                    </button>
                  )}
                  <button
                    onClick={openStandaloneGroupModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-all shadow-sm"
                    title="Crear nuevo grupo de espacios"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Nuevo Grupo
                  </button>
                </div>
              </div>

              {visibleGroups.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {isSelectMode
                    ? 'Selecciona espacios y pulsa "Agrupar" para crear un grupo con ellos.'
                    : 'No hay grupos. Pulsa "Nuevo Grupo" para crear uno.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {visibleGroups.map(group => {
                    const isActive = activeGroupFilter === group.id;
                    return (
                      <div
                        key={group.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        <button
                          onClick={() => setActiveGroupFilter(isActive ? null : group.id)}
                          className="flex items-center gap-1.5 pl-3 pr-1 py-1.5"
                          title={isActive ? 'Quitar filtro de grupo' : `Filtrar por ${group.name}`}
                        >
                          <Tag className="w-3 h-3 shrink-0" />
                          <span>{group.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                            {group.spaceIds.length}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 pr-1.5">
                          <button
                            onClick={() => openEditGroupModal(group)}
                            className={`p-0.5 rounded-full transition-colors ${isActive ? 'hover:bg-white/20 text-white/80' : 'hover:bg-indigo-200 text-indigo-500'}`}
                            title="Editar grupo"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className={`p-0.5 rounded-full transition-colors ${isActive ? 'hover:bg-white/20 text-white/80' : 'hover:bg-red-100 text-indigo-400 hover:text-red-600'}`}
                            title="Eliminar grupo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {activeGroupFilter && (
                    <button
                      onClick={() => setActiveGroupFilter(null)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                    >
                      Limpiar filtro de grupo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toolbar de selección (cuando hay seleccionados) */}
          {isSelectMode && (
            <div className={`mb-4 px-4 py-3 rounded-2xl border flex flex-wrap items-center gap-3 text-sm transition-all ${
              selectedSpaceIds.size > 0
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <button
                onClick={() => selectedSpaceIds.size === sortedSpaces.length ? clearSelection() : selectAllVisible()}
                className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-700 font-medium transition-colors"
              >
                {selectedSpaceIds.size === sortedSpaces.length && sortedSpaces.length > 0
                  ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                  : <Square className="w-4 h-4" />}
                {selectedSpaceIds.size === sortedSpaces.length && sortedSpaces.length > 0
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
              {selectedSpaceIds.size > 0 && (
                <>
                  <span className="text-indigo-600 font-bold">{selectedSpaceIds.size} espacio{selectedSpaceIds.size !== 1 ? 's' : ''} seleccionado{selectedSpaceIds.size !== 1 ? 's' : ''}</span>
                  <button onClick={clearSelection} className="text-slate-400 hover:text-red-500 text-xs underline underline-offset-2 transition-colors">Limpiar</button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all shadow-sm"
                      title="Borrar seleccionados"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar
                    </button>
                    <button
                      onClick={() => { setBulkProximityValue(''); setIsBulkProximityModalOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-all shadow-sm"
                      title="Cambiar cercanía"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Cercanía
                    </button>
                    <button
                      onClick={() => { setBulkSpaceTypeId(''); setIsBulkSpaceTypeModalOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-all shadow-sm"
                      title="Cambiar tipo de espacio"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Tipo Espacio
                    </button>
                    <button
                      onClick={() => { setBulkUsageTypeValue('Almacenamiento'); setIsBulkUsageTypeModalOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-all shadow-sm"
                      title="Cambiar tipo de uso de espacio"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Tipo Uso
                    </button>
                    <button
                      onClick={openCreateGroupModal}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      Agrupar
                    </button>
                  </div>
                </>
              )}
              {selectedSpaceIds.size === 0 && (
                <span className="text-slate-400 text-xs italic">Haz click en los checkboxes para seleccionar espacios</span>
              )}
            </div>
          )}

          {/* Tabla agrupada por almacén */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {Object.keys(groupedSpaces).length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                {activeGroupFilter
                  ? 'No hay espacios en este grupo para el filtro de almacén seleccionado.'
                  : 'No hay espacios registrados para el filtro seleccionado.'}
              </div>
            ) : (
              Object.entries(groupedSpaces).map(([warehouseId, spaces]: [string, any]) => {
                const warehouse = warehouses.find(w => String(w.id) === String(warehouseId));
                return (
                  <div key={warehouseId}>
                    {/* Encabezado separador por almacén */}
                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200">
                      <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-semibold text-slate-700 text-sm">{warehouse?.name || `Almacén ${warehouseId}`}</span>
                      <span className="text-xs text-slate-400 ml-auto">{spaces.length} espacio{spaces.length !== 1 ? 's' : ''}</span>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Columna checkbox (solo en modo selección) */}
                          {isSelectMode && <TableHead className="w-10 pr-0" />}
                          {([
                            { key: 'name',          label: 'Nombre / Referencia', align: 'left'   },
                            { key: 'spaceType',     label: 'Tipo de Espacio',     align: 'left'   },
                            { key: 'usageType',     label: 'Tipo de Uso',         align: 'left'   },
                            { key: 'proximity',     label: 'Cercanía',            align: 'left'   },
                            { key: 'productCount',  label: 'Productos',           align: 'center' },
                            { key: 'totalQuantity', label: 'Unidades',            align: 'center' },
                            { key: 'group',         label: 'Grupos',              align: 'center' },
                          ] as { key: SpacesSortKey; label: string; align: 'left' | 'center' }[]).map(col => {
                            const isActive = spacesSortKey === col.key;
                            const Icon = isActive
                              ? (spacesSortDir === 'asc' ? ChevronUp : ChevronDown)
                              : ChevronsUpDown;
                            return (
                              <TableHead key={col.key} className={col.align === 'center' ? 'text-center' : ''}>
                                <button
                                  onClick={() => handleSpacesSort(col.key)}
                                  className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-blue-600 ${
                                    col.align === 'center' ? 'justify-center w-full' : ''
                                  } ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                                  title={`Ordenar por ${col.label}`}
                                >
                                  {col.key === 'productCount' && <Package className="w-3 h-3 text-emerald-500" />}
                                  {col.key === 'totalQuantity' && <BarChart2 className="w-3 h-3 text-violet-500" />}
                                  {col.label}
                                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'opacity-40'}`} />
                                </button>
                              </TableHead>
                            );
                          })}
                          <TableHead className="text-center">Código QR</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spaces.map((space) => {
                          const spaceType = spaceTypes.find(t => t.id == space.spaceTypeId);
                          const spaceGroupList = getGroupsForSpace(space.id);
                          const isSelected = selectedSpaceIds.has(space.id);
                          return (
                            <TableRow
                              key={space.id}
                              className={`transition-colors ${isSelected ? 'bg-indigo-50/60' : ''} ${isSelectMode ? 'cursor-pointer hover:bg-indigo-50/40' : ''}`}
                              onClick={isSelectMode ? () => toggleSpaceSelection(space.id) : undefined}
                            >
                              {/* Checkbox (solo en modo selección) */}
                              {isSelectMode && (
                                <TableCell className="pr-0 w-10">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleSpaceSelection(space.id); }}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    {isSelected
                                      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                                      : <Square className="w-4 h-4" />}
                                  </button>
                                </TableCell>
                              )}
                              <TableCell>
                                <span className="font-medium text-slate-900">{space.name}</span>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                                  {spaceType?.name || space.spaceTypeName || 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                                  space.spaceUsageType === 'Despachos'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {space.spaceUsageType === 'Despachos' ? '🚪 Despachos' : '📦 Almacenamiento'}
                                </span>
                              </TableCell>
                              <TableCell>{Math.round(Number(space.proximity))}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold ${(space.productCount || 0) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400'}`}>
                                  {space.productCount || 0}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold ${(space.totalQuantity || 0) > 0 ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-400'}`}>
                                  {Math.round(Number(space.totalQuantity || 0))}
                                </span>
                              </TableCell>
                              {/* Columna Grupos: badges de los grupos a los que pertenece */}
                              <TableCell className="text-center">
                                {spaceGroupList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {spaceGroupList.map(g => (
                                      <span
                                        key={g.id}
                                        onClick={(e) => { e.stopPropagation(); setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id); }}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer hover:bg-indigo-200 transition-colors"
                                        title={`Filtrar por grupo: ${g.name}`}
                                      >
                                        <Tag className="w-2.5 h-2.5 shrink-0" />
                                        {g.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center w-32">
                                <div className="flex justify-center group/qr relative cursor-pointer" onClick={e => e.stopPropagation()}>
                                  <QrCode className="w-5 h-5 text-slate-400 hover:text-blue-600 transition-colors" />
                                  <div className="absolute invisible group-hover/qr:visible opacity-0 group-hover/qr:opacity-100 transition-all bottom-full pt-2 pb-3 z-10 w-32 bg-white border rounded shadow-xl left-1/2 -ml-16 flex justify-center">
                                    <QRCodeCanvas value={space.qrCode} size={90} />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleViewInventory(space)}
                                    title="Ver inventario de este espacio"
                                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                  >
                                    <BarChart2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenSpaceModal(space)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSpace(space.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: TIPOS DE ESPACIO ═════════════════════════════════════════════ */}
      {activeTab === 'spaceTypes' && (
        <>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tipos de Espacio</h1>
              <p className="text-slate-500 mt-2">Categorías para clasificar los espacios de almacén</p>
            </div>
            <Button className="gap-2" onClick={() => handleOpenSpaceTypeModal()}>
              <Plus className="w-4 h-4" /> Nuevo Tipo de Espacio
            </Button>
          </header>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Espacios que lo usan</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spaceTypes.map((type) => {
                  const usageCount = warehouseSpaces.filter(s => String(s.spaceTypeId) === String(type.id)).length;
                  return (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                            <Layers className="w-4 h-4 text-blue-600" />
                          </div>
                          {type.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${usageCount > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                          {usageCount} espacio{usageCount !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenSpaceTypeModal(type)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar tipo de espacio"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSpaceType(type.id, type.name)}
                            className={`p-1.5 rounded-lg transition-all ${usageCount > 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={usageCount > 0 ? 'No se puede eliminar: está en uso' : 'Eliminar tipo de espacio'}
                            disabled={usageCount > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {spaceTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                      No hay tipos de espacio registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ─── Modal Almacén ──────────────────────────────────────────────────── */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingWarehouseId ? 'Editar Almacén' : 'Nuevo Almacén'}
              </h2>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                <Input
                  placeholder="Ej: Almacén Principal"
                  value={warehouseForm.name || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Código QR</label>
                <Input
                  placeholder="Ej: ALM-001"
                  value={warehouseForm.qrCode || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, qrCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
                <Input
                  placeholder="Ej: Depósito central de distribución"
                  value={warehouseForm.description || ''}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsWarehouseModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleSaveWarehouse} disabled={!warehouseForm.name || !warehouseForm.qrCode} className="w-full sm:w-auto">
                {editingWarehouseId ? 'Guardar Cambios' : 'Crear Almacén'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Espacio de Almacén ────────────────────────────────────────── */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
                {editingSpaceId ? 'Editar Espacio Almacén' : 'NUEVO ESPACIO ALMACÉN'}
              </h2>
              <button onClick={() => setIsSpaceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Seleccionar Almacén */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Seleccionar Almacén</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  value={spaceForm.warehouseId || ''}
                  onChange={(e) => { setSpaceForm({ ...spaceForm, warehouseId: e.target.value }); setSpaceFormGroupId(''); }}
                >
                  <option value="">Seleccione un almacén...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Nombre Referencia */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Nombre / Referencia de Espacio</label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ej: Pasillo A, Estante 4..."
                  value={spaceForm.name || ''}
                  onChange={(e) => { setSpaceForm({ ...spaceForm, name: e.target.value }); setSpaceFormError(''); }}
                />
              </div>

              {/* Tipo de Espacio */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Tipo de Espacio</label>
                <div className="flex flex-col gap-2">
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    value={spaceForm.spaceTypeId || ''}
                    onChange={(e) => setSpaceForm({ ...spaceForm, spaceTypeId: e.target.value })}
                  >
                    <option value="">Seleccione tipo...</option>
                    {spaceTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {!isCreatingSpaceType ? (
                    <button
                      onClick={() => setIsCreatingSpaceType(true)}
                      className="text-xs text-blue-600 font-semibold hover:text-blue-800 text-left cursor-pointer flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Crear nuevo tipo de espacio
                    </button>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Ej: Pallet, Mostrador..."
                        className="flex-1 text-xs px-2 py-1.5 border rounded-md"
                        value={newSpaceType}
                        onChange={(e) => setNewSpaceType(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleCreateSpaceType} className="bg-slate-900 text-white px-2 py-1 text-xs rounded hover:bg-slate-800 transition-colors">Guardar</button>
                      <button onClick={() => setIsCreatingSpaceType(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo de Uso de Espacio */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Tipo de Uso de Espacio</label>
                <select
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  value={spaceForm.spaceUsageType || 'Almacenamiento'}
                  onChange={(e) => setSpaceForm({ ...spaceForm, spaceUsageType: e.target.value as 'Despachos' | 'Almacenamiento' })}
                >
                  <option value="Almacenamiento">📦 Almacenamiento</option>
                  <option value="Despachos">🚪 Despachos</option>
                </select>
              </div>

              {/* Cercanía */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Cercanía de Espacio <span className="text-blue-600 normal-case ml-1 font-medium bg-blue-50 px-2 py-0.5 rounded text-[10px]">solo N°</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="Valor numérico (Ej: 1, 2, 3)"
                  value={spaceForm.proximity === 0 ? '' : spaceForm.proximity}
                  onChange={(e) => setSpaceForm({ ...spaceForm, proximity: Number(e.target.value) })}
                />
              </div>

              {/* Grupo de Espacio */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-indigo-500" />
                  Grupo de Cercanía <span className="normal-case font-normal text-slate-400">(opcional)</span>
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                    value={spaceFormGroupId}
                    onChange={(e) => { setSpaceFormGroupId(e.target.value); setSpaceFormGroupError(''); }}
                    disabled={!spaceForm.warehouseId}
                  >
                    <option value="">Sin grupo asignado</option>
                    {spaceGroups
                      .filter(g => !g.warehouseId || String(g.warehouseId) === String(spaceForm.warehouseId))
                      .map(g => {
                        // Detectar si este espacio ya está en OTRO grupo distinto a este
                        const spaceAlreadyHere = editingSpaceId ? g.spaceIds.includes(Number(editingSpaceId)) : false;
                        const spaceInOtherGroup = editingSpaceId && !spaceAlreadyHere
                          ? getGroupsForSpace(editingSpaceId).length > 0
                          : false;
                        return (
                          <option key={g.id} value={g.id} disabled={spaceInOtherGroup && !spaceAlreadyHere}>
                            {g.name} ({g.spaceIds.length} esp.){spaceInOtherGroup && !spaceAlreadyHere ? ' ⚠️ ocupado' : ''}
                          </option>
                        );
                      })}
                  </select>
                  {/* Advertencia si el espacio ya está asignado a otro grupo */}
                  {editingSpaceId && spaceFormGroupId && (() => {
                    const selectedGroup = spaceGroups.find(g => String(g.id) === spaceFormGroupId);
                    const otherGroups = getGroupsForSpace(editingSpaceId).filter(g => String(g.id) !== spaceFormGroupId);
                    if (otherGroups.length > 0) {
                      return (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1 flex items-start gap-1.5">
                          <span className="shrink-0 mt-0.5">⚠️</span>
                          <span>Este espacio ya pertenece al grupo <strong>"{otherGroups[0].name}"</strong>. Al guardar, se moverá al grupo seleccionado <strong>"{selectedGroup?.name}"</strong>.</span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {spaceFormGroupError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">{spaceFormGroupError}</p>
                  )}
                  {!spaceForm.warehouseId && (
                    <span className="text-xs text-slate-400 italic">Selecciona un almacén para ver los grupos disponibles</span>
                  )}
                  {spaceForm.warehouseId && !isCreatingSpaceFormGroup ? (
                    <button
                      onClick={() => { setIsCreatingSpaceFormGroup(true); setNewSpaceFormGroupName(''); setSpaceFormGroupError(''); }}
                      className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 text-left cursor-pointer flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Crear nuevo grupo
                    </button>
                  ) : spaceForm.warehouseId && isCreatingSpaceFormGroup ? (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nombre del grupo..."
                          className="flex-1 text-xs px-2 py-1.5 border border-indigo-200 rounded-md focus:ring-1 focus:ring-indigo-400 outline-none"
                          value={newSpaceFormGroupName}
                          onChange={(e) => { setNewSpaceFormGroupName(e.target.value); setSpaceFormGroupError(''); }}
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            const trimmed = newSpaceFormGroupName.trim();
                            if (!trimmed || !spaceForm.warehouseId) return;
                            // Validar nombre duplicado
                            const duplicado = spaceGroups.find(
                              g => g.name.trim().toLowerCase() === trimmed.toLowerCase()
                            );
                            if (duplicado) {
                              setSpaceFormGroupError(`El grupo "${trimmed}" ya existe. Elige un nombre diferente.`);
                              return;
                            }
                            try {
                              const newGrp = await createGroup(trimmed, [], spaceForm.warehouseId);
                              if (newGrp) setSpaceFormGroupId(String(newGrp.id));
                              setIsCreatingSpaceFormGroup(false);
                              setNewSpaceFormGroupName('');
                              setSpaceFormGroupError('');
                            } catch (err: any) {
                              setSpaceFormGroupError(err?.message || 'Error al crear el grupo.');
                            }
                          }}
                          className="bg-indigo-600 text-white px-2 py-1 text-xs rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                          Crear
                        </button>
                        <button onClick={() => { setIsCreatingSpaceFormGroup(false); setSpaceFormGroupError(''); }} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3" /></button>
                      </div>
                      {spaceFormGroupError && (
                        <p className="text-xs text-red-600">{spaceFormGroupError}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {spaceFormError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                <span>⚠️</span>
                <span>{spaceFormError}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsSpaceModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button
                onClick={handleSaveSpace}
                disabled={!spaceForm.warehouseId || !spaceForm.name || !spaceForm.spaceTypeId || !spaceForm.spaceUsageType}
                className="w-full sm:w-auto"
              >
                {editingSpaceId ? 'Guardar Cambios' : 'Crear Espacio'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Tipo de Espacio ───────────────────────────────────────────── */}
      {isSpaceTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingSpaceTypeId ? 'Editar Tipo de Espacio' : 'Nuevo Tipo de Espacio'}
              </h2>
              <button onClick={() => setIsSpaceTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del tipo</label>
              <Input
                placeholder="Ej: Pallet, Estante, Mostrador..."
                value={spaceTypeForm.name || ''}
                onChange={(e) => setSpaceTypeForm({ ...spaceTypeForm, name: e.target.value })}
                autoFocus
              />
              {spaceTypeError && (
                <p className="text-sm text-red-600 mt-2">{spaceTypeError}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsSpaceTypeModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleSaveSpaceType} disabled={!spaceTypeForm.name?.trim()} className="w-full sm:w-auto">
                {editingSpaceTypeId ? 'Guardar Cambios' : 'Crear Tipo'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modal Crear/Editar Grupo ────────────────────────────────────────── */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingGroupId ? 'Editar Grupo' : isStandaloneGroupModal ? 'Nuevo Grupo de Espacios' : 'Agrupar Espacios'}
              </h2>
              <button onClick={() => { setIsGroupModalOpen(false); setIsStandaloneGroupModal(false); setGroupModalWarehouseId(''); if (!isStandaloneGroupModal) { setIsSelectMode(false); setSelectedSpaceIds(new Set()); } }} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Selector de almacén (solo en modo standalone) */}
            {isStandaloneGroupModal && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Almacén <span className="text-red-400 font-semibold">*</span>
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                  value={groupModalWarehouseId}
                  onChange={(e) => setGroupModalWarehouseId(e.target.value)}
                >
                  <option value="">-- Selecciona un almacén --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {!groupModalWarehouseId && (
                  <p className="text-xs text-amber-600 mt-1 ml-1">Debes seleccionar un almacén para crear el grupo.</p>
                )}
              </div>
            )}

            {/* Selector de modo (solo al crear, no al editar) */}
            {!editingGroupId && (
              <div className="mb-5 flex gap-2">
                <button
                  onClick={() => { setGroupModalMode('new'); setGroupModalError(''); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold border transition-all ${
                    groupModalMode === 'new'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-indigo-50'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5 inline-block mr-1" />
                  Crear nuevo grupo
                </button>
                <button
                  onClick={() => { setGroupModalMode('existing'); setGroupModalError(''); }}
                  disabled={visibleGroups.length === 0}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold border transition-all ${
                    groupModalMode === 'existing'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-indigo-50'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={visibleGroups.length === 0 ? 'No hay grupos existentes' : 'Añadir a grupo existente'}
                >
                  <Folder className="w-3.5 h-3.5 inline-block mr-1" />
                  Añadir a grupo existente
                </button>
              </div>
            )}

            {/* Campo nombre (modo 'new' o edición) */}
            {(editingGroupId || groupModalMode === 'new') && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del grupo</label>
                <Input
                  placeholder="Ej: Grupo Cuarto 1, Zona Norte..."
                  value={groupModalName}
                  onChange={(e) => { setGroupModalName(e.target.value); setGroupModalError(''); }}
                  autoFocus
                />
              </div>
            )}

            {/* Selector de grupo existente */}
            {!editingGroupId && groupModalMode === 'existing' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar grupo</label>
                <select
                  className="w-full bg-white border border-indigo-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                  value={groupModalExistingId}
                  onChange={e => { setGroupModalExistingId(e.target.value); setGroupModalError(''); }}
                >
                  <option value="">-- Selecciona un grupo --</option>
                  {visibleGroups.map(g => (
                    <option key={g.id} value={String(g.id)}>{g.name} ({g.spaceIds.length} esp.)</option>
                  ))}
                </select>
                {groupModalExistingId && (() => {
                  const tg = spaceGroups.find(g => String(g.id) === groupModalExistingId);
                  return tg ? (
                    <p className="text-xs text-slate-500 mt-1.5 ml-1">
                      Se añadirán {selectedSpaceIds.size} espacio{selectedSpaceIds.size !== 1 ? 's' : ''} al grupo «{tg.name}».
                      El grupo tendrá en total {new Set([...tg.spaceIds.map(String), ...Array.from(selectedSpaceIds)]).size} espacio{new Set([...tg.spaceIds.map(String), ...Array.from(selectedSpaceIds)]).size !== 1 ? 's' : ''}.
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            {/* Espacios seleccionados (oculto en modo standalone sin selección) */}
            {(!isStandaloneGroupModal || selectedSpaceIds.size > 0) && (
              <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 font-medium mb-2">
                  <FolderPlus className="w-4 h-4 inline-block mr-1 text-indigo-500" />
                  {selectedSpaceIds.size} espacio{selectedSpaceIds.size !== 1 ? 's' : ''} seleccionado{selectedSpaceIds.size !== 1 ? 's' : ''}
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-slate-500 pr-2">
                  {Array.from(selectedSpaceIds).map(id => {
                    const s = warehouseSpaces.find(ws => ws.id === id);
                    return s ? <div key={id} className="py-1 border-b border-slate-100 last:border-0 truncate">• {s.name}</div> : null;
                  })}
                </div>
              </div>
            )}
            {isStandaloneGroupModal && selectedSpaceIds.size === 0 && (
              <div className="mb-6 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <p className="text-xs text-indigo-600 flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  <span>El grupo se creará vacío. Puedes asignar espacios desde la tabla usando el modo <strong>Seleccionar</strong>.</span>
                </p>
              </div>
            )}

            {groupModalError && (
              <p className="text-sm text-red-600 mb-4 flex items-center gap-1">
                <X className="w-3 h-3" /> {groupModalError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => { setIsGroupModalOpen(false); setIsStandaloneGroupModal(false); setGroupModalWarehouseId(''); if (!isStandaloneGroupModal) { setIsSelectMode(false); setSelectedSpaceIds(new Set()); } }} className="w-full sm:w-auto">Cancelar</Button>
              <Button
                onClick={handleSaveGroup}
                disabled={
                  // En standalone solo se necesita nombre; en modo selección también espacios
                  (!isStandaloneGroupModal && selectedSpaceIds.size === 0) ||
                  (editingGroupId ? !groupModalName.trim() : groupModalMode === 'new' ? !groupModalName.trim() : !groupModalExistingId)
                }
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
              >
                {editingGroupId ? 'Guardar Cambios' : groupModalMode === 'existing' ? 'Añadir al Grupo' : 'Crear Grupo'}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* ─── Modal Bulk Update Proximity ────────────────────────────────────────── */}
      {isBulkProximityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Cambiar Cercanía
              </h2>
              <button onClick={() => setIsBulkProximityModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nueva Cercanía (Aplica a {selectedSpaceIds.size} espacios)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                placeholder="Valor numérico (Ej: 1, 2, 3)"
                value={bulkProximityValue}
                onChange={(e) => setBulkProximityValue(e.target.value === '' ? '' : Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsBulkProximityModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleBulkUpdateProximity} disabled={bulkProximityValue === ''} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bulk Update Space Type ────────────────────────────────────────── */}
      {isBulkSpaceTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Cambiar Tipo de Espacio
              </h2>
              <button onClick={() => setIsBulkSpaceTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo Tipo (Aplica a {selectedSpaceIds.size} espacios)</label>
              <select
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={bulkSpaceTypeId}
                onChange={(e) => setBulkSpaceTypeId(e.target.value)}
              >
                <option value="">Seleccione tipo...</option>
                {spaceTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsBulkSpaceTypeModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleBulkUpdateSpaceType} disabled={!bulkSpaceTypeId} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bulk Update Usage Type ────────────────────────────────────────── */}
      {isBulkUsageTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Cambiar Tipo de Uso
              </h2>
              <button onClick={() => setIsBulkUsageTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Aplica el nuevo tipo de uso a los <strong>{selectedSpaceIds.size}</strong> espacio{selectedSpaceIds.size !== 1 ? 's' : ''} seleccionado{selectedSpaceIds.size !== 1 ? 's' : ''}.
            </p>
            <div className="mb-6 flex flex-col gap-3">
              <button
                onClick={() => setBulkUsageTypeValue('Almacenamiento')}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  bulkUsageTypeValue === 'Almacenamiento'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-2xl">📦</span>
                <div>
                  <p className="font-semibold text-sm">Almacenamiento</p>
                  <p className="text-xs text-slate-500">Espacio destinado a guardar productos</p>
                </div>
                {bulkUsageTypeValue === 'Almacenamiento' && (
                  <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                )}
              </button>
              <button
                onClick={() => setBulkUsageTypeValue('Despachos')}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  bulkUsageTypeValue === 'Despachos'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <span className="text-2xl">🚪</span>
                <div>
                  <p className="font-semibold text-sm">Despachos</p>
                  <p className="text-xs text-slate-500">Espacio destinado a salida/despacho de mercancía</p>
                </div>
                {bulkUsageTypeValue === 'Despachos' && (
                  <Check className="w-4 h-4 text-blue-600 ml-auto" />
                )}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsBulkUsageTypeModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button onClick={handleBulkUpdateUsageType} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      <SmartSpaceImportModal
        isOpen={isSmartImportModalOpen}
        existingSpaces={warehouseSpaces}
        onClose={() => {
          setIsSmartImportModalOpen(false);
          setPendingSpaceImports([]);
        }}
        parsedData={pendingSpaceImports}
        warehouses={warehouses}
        spaceTypes={spaceTypes}
        spaceGroups={spaceGroups}
        onConfirmImport={handleConfirmSmartImport}
        onCreateWarehouse={async (w) => { await saveWarehouse(w as Warehouse); }}
        onCreateSpaceType={async (st) => { await saveSpaceType(st as SpaceType); }}
        onCreateSpaceGroup={handleCreateSpaceGroupForImport}
      />
    </div>
  );
};

export default Infrastructure;
