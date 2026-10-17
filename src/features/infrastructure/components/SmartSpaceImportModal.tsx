import React, { useState, useMemo } from 'react';
import { Warehouse, WarehouseSpace, SpaceType } from '../../../types';
import { X, CheckCircle, AlertTriangle, Plus, Upload, Sparkles, QrCode, Edit3 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface ParsedRow {
  ID?: string;
  Almacen?: string;
  AlmacenID?: string;
  AlmacenQR?: string;
  Nombre?: string;
  TipoEspacio?: string;
  TipoEspacioID?: string;
  TipoUsoEspacio?: string;
  Cercania?: string;
  CodigoQR?: string;
  Grupo?: string;
  GrupoID?: string;
  [key: string]: any;
}

import { SpaceGroup } from '../hooks/useSpaceGroups';

interface SmartSpaceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedData: ParsedRow[];
  warehouses: Warehouse[];
  spaceTypes: SpaceType[];
  existingSpaces: WarehouseSpace[];
  spaceGroups: SpaceGroup[];
  onConfirmImport: (validData: WarehouseSpace[]) => void;
  onCreateWarehouse: (warehouse: Partial<Warehouse>) => Promise<Warehouse | void>;
  onCreateSpaceType: (spaceType: Partial<SpaceType>) => Promise<SpaceType | void>;
  onCreateSpaceGroup: (name: string, warehouseId: string | number) => Promise<SpaceGroup | void>;
}

export const SmartSpaceImportModal: React.FC<SmartSpaceImportModalProps> = ({
  isOpen,
  onClose,
  parsedData,
  warehouses,
  spaceTypes,
  existingSpaces,
  spaceGroups,
  onConfirmImport,
  onCreateWarehouse,
  onCreateSpaceType,
  onCreateSpaceGroup
}) => {
  const [creatingWarehouseForRow, setCreatingWarehouseForRow] = useState<number | null>(null);
  const [creatingTypeForRow, setCreatingTypeForRow] = useState<number | null>(null);
  const [creatingGroupForRow, setCreatingGroupForRow] = useState<number | null>(null);

  // Sub-forms states
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseQR, setNewWarehouseQR] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  // Mapa de grupos asignados manualmente por fila (index → groupId string)
  const [rowGroupOverrides, setRowGroupOverrides] = useState<Record<number, string>>({});

  // Mapa de códigos QR editables por fila (index → qrCode)
  const [editableQrCodes, setEditableQrCodes] = useState<Record<number, string>>({});

  const validatedRows = useMemo(() => {
    const newQrMap: Record<number, string> = {};

    const rows = parsedData.map((row, index) => {
      // Intentar encontrar almacén por ID, Nombre o QR (si viene en el CSV)
      const foundWarehouse = warehouses.find(w =>
        (row.AlmacenID && String(w.id) === String(row.AlmacenID)) ||
        (row.Almacen && w.name.toLowerCase() === row.Almacen.toLowerCase()) ||
        (row.AlmacenQR && w.qrCode === row.AlmacenQR)
      );

      // Intentar encontrar tipo de espacio por ID o Nombre
      const foundSpaceType = spaceTypes.find(t =>
        (row.TipoEspacioID && String(t.id) === String(row.TipoEspacioID)) ||
        (row.TipoEspacio && t.name.toLowerCase() === row.TipoEspacio.toLowerCase())
      );

      // Intentar encontrar grupo por ID o Nombre (y que corresponda al almacén)
      const foundSpaceGroup = spaceGroups.find(g =>
        (row.GrupoID && String(g.id) === String(row.GrupoID)) ||
        (row.Grupo && g.name.toLowerCase() === row.Grupo.toLowerCase() && (!foundWarehouse || String(g.warehouseId) === String(foundWarehouse.id)))
      );

      // El usuario puede haber seleccionado un grupo del dropdown (o explícitamente "Sin grupo")
      const hasManualOverride = index in rowGroupOverrides;
      const overriddenGroupId = rowGroupOverrides[index];
      
      const isGroupValid = (!row.Grupo && !row.GrupoID) || !!foundSpaceGroup || hasManualOverride;

      // Detectar si el espacio del CSV ya existe en el sistema
      // La comparación de nombre es exacta (case-sensitive) para permitir
      // crear espacios que solo difieren en mayúsculas/minúsculas.
      const foundExistingSpace = existingSpaces.find(s =>
        (row.ID && String(s.id) === String(row.ID)) ||
        (row.CodigoQR && s.qrCode === row.CodigoQR) ||
        (row.Nombre && foundWarehouse && s.name === row.Nombre && String(s.warehouseId) === String(foundWarehouse.id))
      );

      const isNewSpace = !foundExistingSpace;

      // Generar QR automático para espacios nuevos (si no viene en CSV)
      if (isNewSpace && !(index in editableQrCodes)) {
        const autoQr = row.CodigoQR ||
          `${(row.Nombre || 'ESP').toUpperCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        newQrMap[index] = autoQr;
      }

      // Normalizar TipoUsoEspacio: aceptar variaciones de case, fallback a 'Almacenamiento'
      const rawUsageType = (row.TipoUsoEspacio || '').trim().toLowerCase();
      const spaceUsageType: 'Despachos' | 'Almacenamiento' =
        rawUsageType === 'despachos' ? 'Despachos' : 'Almacenamiento';

      return {
        originalIndex: index,
        row,
        foundWarehouse,
        foundSpaceType,
        foundSpaceGroup,
        isGroupValid,
        foundExistingSpace,
        isNewSpace,
        spaceUsageType,
        isReady: !!foundWarehouse && !!foundSpaceType && isGroupValid && !!row.Nombre
      };
    });

    // Solo inicializar nuevos QRs que aún no existen en el estado
    if (Object.keys(newQrMap).length > 0) {
      setEditableQrCodes(prev => ({ ...newQrMap, ...prev }));
    }

    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData, warehouses, spaceTypes, existingSpaces, spaceGroups, rowGroupOverrides]);

  const allReady = validatedRows.length > 0 && validatedRows.every(r => r.isReady);
  const newSpacesCount = validatedRows.filter(r => r.isNewSpace).length;
  const existingSpacesCount = validatedRows.filter(r => !r.isNewSpace).length;

  const handleOpenCreateWarehouse = (index: number, row: ParsedRow) => {
    setNewWarehouseName(row.Almacen || '');
    setNewWarehouseQR(row.AlmacenQR || `ALM-${Date.now().toString().slice(-6)}`);
    setCreatingWarehouseForRow(index);
  };

  const handleConfirmCreateWarehouse = async () => {
    if (!newWarehouseName || !newWarehouseQR) return;
    await onCreateWarehouse({
      name: newWarehouseName,
      qrCode: newWarehouseQR,
      description: 'Creado desde importación inteligente'
    });
    setCreatingWarehouseForRow(null);
  };

  const handleOpenCreateType = (index: number, row: ParsedRow) => {
    setNewTypeName(row.TipoEspacio || '');
    setCreatingTypeForRow(index);
  };

  const handleConfirmCreateType = async () => {
    if (!newTypeName) return;
    await onCreateSpaceType({ name: newTypeName });
    setCreatingTypeForRow(null);
  };

  const handleOpenCreateGroup = (index: number, row: ParsedRow) => {
    setNewGroupName(row.Grupo || '');
    setCreatingGroupForRow(index);
  };

  const handleConfirmCreateGroup = async (warehouseId: string | number) => {
    if (!newGroupName) return;
    await onCreateSpaceGroup(newGroupName, warehouseId);
    setCreatingGroupForRow(null);
  };

  const handleQrChange = (index: number, value: string) => {
    setEditableQrCodes(prev => ({ ...prev, [index]: value }));
  };

  const handleImport = () => {
    const dataToImport = validatedRows.filter(r => r.isReady).map(r => {
      // BUG #3 FIX: Usar SIEMPRE el QR del estado editable (el que el usuario vio
      // en preview), nunca regenerar con Date.now() en este momento.
      const finalQr = r.isNewSpace
        ? (editableQrCodes[r.originalIndex] ?? r.row.CodigoQR ?? '')
        : (r.foundExistingSpace?.qrCode ?? r.row.CodigoQR ?? '');

      // BUG #5 FIX: Resolver groupId de forma determinista.
      //   - Si el CSV/selector tiene grupo → enviarlo.
      //   - Si el usuario eligió "Sin grupo" (override vacío) → null para quitar grupo.
      //   - Si no se especificó nada → undefined (omitir clave, el backend no toca grupos).
      let resolvedGroupId: number | null | undefined;
      if (r.foundSpaceGroup?.id !== undefined) {
        resolvedGroupId = Number(r.foundSpaceGroup.id);
      } else if (r.originalIndex in rowGroupOverrides) {
        const overrideVal = rowGroupOverrides[r.originalIndex];
        resolvedGroupId = overrideVal ? Number(overrideVal) : null;
      } else {
        resolvedGroupId = undefined; // sin cambio de grupo
      }

      return {
        // BUG #2 FIX: Los espacios NUEVOS nunca llevan id, sin importar lo que
        // diga el CSV. Solo los existentes usan el id encontrado en el sistema.
        id: r.isNewSpace ? undefined : (r.foundExistingSpace?.id ?? undefined),
        warehouseId: r.foundWarehouse!.id,
        spaceTypeId: r.foundSpaceType!.id,
        spaceUsageType: r.spaceUsageType,
        // Solo incluir groupId si se determinó un valor (null = quitar, número = asignar)
        ...(resolvedGroupId !== undefined ? { groupId: resolvedGroupId } : {}),
        name: r.row.Nombre!,
        proximity: Number(r.row.Cercania) || 0,
        qrCode: finalQr,
      } as WarehouseSpace;
    });
    onConfirmImport(dataToImport);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Importador Inteligente de Espacios
            </h2>
            <p className="text-sm text-slate-500 mt-1">Revisa y resuelve dependencias antes de importar.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resumen de nuevos vs existentes */}
        {validatedRows.length > 0 && (newSpacesCount > 0 || existingSpacesCount > 0) && (
          <div className="px-6 pt-4 pb-0 flex gap-3">
            {newSpacesCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {newSpacesCount} espacio{newSpacesCount !== 1 ? 's' : ''} nuevo{newSpacesCount !== 1 ? 's' : ''} se crearán
              </div>
            )}
            {existingSpacesCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold px-3 py-2 rounded-xl">
                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                {existingSpacesCount} espacio{existingSpacesCount !== 1 ? 's' : ''} existente{existingSpacesCount !== 1 ? 's' : ''} se actualizarán
              </div>
            )}
          </div>
        )}

        {/* Filas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {validatedRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron datos válidos en el archivo CSV.
            </div>
          ) : (
            <div className="space-y-3">
              {validatedRows.map((item) => (
                <div
                  key={item.originalIndex}
                  className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-all ${
                    item.isReady
                      ? item.isNewSpace
                        ? 'border-amber-200 ring-1 ring-amber-100'
                        : 'border-emerald-200'
                      : 'border-red-200'
                  }`}
                >
                  {/* Banner: Espacio Nuevo */}
                  {item.isNewSpace && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-amber-800">✦ Espacio nuevo</span>
                        <span className="text-xs text-amber-700 ml-1">— se creará en el almacén seleccionado.</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    {/* Info del CSV */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Espacio</span>
                        <span className="text-sm font-medium text-slate-800">
                          {item.row.Nombre || <span className="text-red-500 italic">Sin nombre</span>}
                        </span>
                        {!item.isNewSpace && item.foundExistingSpace && (
                          <span className="block text-xs text-slate-400 mt-0.5">
                            Actualiza: <span className="font-mono text-slate-500">{item.foundExistingSpace.name}</span>
                          </span>
                        )}
                      </div>

                      {/* Almacén */}
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Almacén</span>
                        {item.foundWarehouse ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {item.foundWarehouse.name}
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {item.row.Almacen || item.row.AlmacenID || 'Desconocido'}
                            </span>
                            {creatingWarehouseForRow === item.originalIndex ? (
                              <div className="flex flex-col gap-2 bg-white border border-blue-100 p-3 rounded-xl shadow-sm mt-1 z-10 relative">
                                <input
                                  className="text-sm border border-slate-200 rounded px-2 py-1.5"
                                  placeholder="Nombre Almacén"
                                  value={newWarehouseName}
                                  onChange={(e) => setNewWarehouseName(e.target.value)}
                                />
                                <input
                                  className="text-sm border border-slate-200 rounded px-2 py-1.5"
                                  placeholder="Código QR"
                                  value={newWarehouseQR}
                                  onChange={(e) => setNewWarehouseQR(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleConfirmCreateWarehouse} className="flex-1 text-xs">Crear</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setCreatingWarehouseForRow(null)} className="text-xs">Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenCreateWarehouse(item.originalIndex, item.row)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 w-fit"
                              >
                                <Plus className="w-3 h-3" /> Crear Almacén
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tipo de Espacio */}
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipo de Espacio</span>
                        {item.foundSpaceType ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {item.foundSpaceType.name}
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {item.row.TipoEspacio || item.row.TipoEspacioID || 'Desconocido'}
                            </span>
                            {creatingTypeForRow === item.originalIndex ? (
                              <div className="flex flex-col gap-2 bg-white border border-blue-100 p-3 rounded-xl shadow-sm mt-1 z-10 relative">
                                <input
                                  className="text-sm border border-slate-200 rounded px-2 py-1.5"
                                  placeholder="Nombre del Tipo"
                                  value={newTypeName}
                                  onChange={(e) => setNewTypeName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleConfirmCreateType} className="flex-1 text-xs">Crear</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setCreatingTypeForRow(null)} className="text-xs">Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenCreateType(item.originalIndex, item.row)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 w-fit"
                              >
                                <Plus className="w-3 h-3" /> Crear Tipo
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                        {/* Grupo de Espacio */}
                        <div>
                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupo</span>
                          {rowGroupOverrides[item.originalIndex] ? (
                            /* Grupo asignado manualmente (incluye "Sin grupo" si es vacío) */
                            rowGroupOverrides[item.originalIndex] !== '' ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {spaceGroups.find(g => String(g.id) === String(rowGroupOverrides[item.originalIndex]))?.name || 'Seleccionado'}
                                <button onClick={() => {
                                  const newOverrides = { ...rowGroupOverrides };
                                  delete newOverrides[item.originalIndex];
                                  setRowGroupOverrides(newOverrides);
                                }} className="ml-1 text-emerald-500 hover:text-emerald-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                Sin grupo
                                <button onClick={() => {
                                  const newOverrides = { ...rowGroupOverrides };
                                  delete newOverrides[item.originalIndex];
                                  setRowGroupOverrides(newOverrides);
                                }} className="ml-1 text-slate-400 hover:text-slate-600">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          ) : item.foundSpaceGroup ? (
                            /* El grupo fue encontrado en CSV */
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {item.foundSpaceGroup.name}
                            </span>
                          ) : (
                            /* Grupo no encontrado o no especificado */
                            <div className="flex flex-col gap-2">
                              {(item.row.Grupo || item.row.GrupoID) && (
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {item.row.Grupo || item.row.GrupoID}
                                </span>
                              )}
                              
                              <select
                                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-400 outline-none"
                                value={rowGroupOverrides[item.originalIndex] ?? ''}
                                onChange={(e) => setRowGroupOverrides(prev => ({ ...prev, [item.originalIndex]: e.target.value }))}
                                disabled={!item.foundWarehouse}
                              >
                                <option value="" disabled selected={!(item.originalIndex in rowGroupOverrides)}>Seleccionar grupo...</option>
                                <option value="">Sin grupo (opcional)</option>
                                {spaceGroups
                                  .filter(g => !g.warehouseId || (item.foundWarehouse && String(g.warehouseId) === String(item.foundWarehouse.id)))
                                  .map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                              </select>

                              {creatingGroupForRow === item.originalIndex ? (
                                <div className="flex flex-col gap-2 bg-white border border-blue-100 p-3 rounded-xl shadow-sm mt-1 z-10 relative">
                                  <input
                                    className="text-sm border border-slate-200 rounded px-2 py-1.5"
                                    placeholder="Nombre del Grupo"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => item.foundWarehouse && handleConfirmCreateGroup(item.foundWarehouse.id)} disabled={!item.foundWarehouse} className="flex-1 text-xs">Crear</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCreatingGroupForRow(null)} className="text-xs">Cancelar</Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenCreateGroup(item.originalIndex, item.row)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 w-fit mt-1"
                                  disabled={!item.foundWarehouse}
                                  title={!item.foundWarehouse ? 'Selecciona primero un almacén' : ''}
                                >
                                  <Plus className="w-3 h-3" /> Crear nuevo grupo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                    </div>

                    {/* Estado General Fila */}
                    <div className="shrink-0">
                      {item.isReady ? (
                        item.isNewSpace ? (
                          <div className="flex items-center justify-center w-10 h-10 bg-amber-100 text-amber-600 rounded-full">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-center w-10 h-10 bg-red-100 text-red-500 rounded-full">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campo editable de Código QR — solo para espacios nuevos */}
                  {item.isNewSpace && (
                    <div className="border-t border-amber-100 pt-3 mt-1">
                      <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" />
                        Código QR del nuevo espacio
                        <span className="text-amber-500 font-normal normal-case">(puedes editarlo antes de importar)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Edit3 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                          <input
                            type="text"
                            className="w-full pl-8 pr-3 py-2 text-sm font-mono border border-amber-200 bg-amber-50 rounded-xl focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none transition-all text-amber-900 placeholder-amber-300"
                            placeholder="Ej: ESP-A1-001"
                            value={editableQrCodes[item.originalIndex] ?? ''}
                            onChange={(e) => handleQrChange(item.originalIndex, e.target.value)}
                          />
                        </div>
                        {editableQrCodes[item.originalIndex] && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-mono shrink-0 max-w-[140px] truncate" title={editableQrCodes[item.originalIndex]}>
                            {editableQrCodes[item.originalIndex]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-slate-500 flex gap-4">
            <span>
              Filas listas: <span className="font-bold text-slate-800">{validatedRows.filter(r => r.isReady).length}</span> de <span className="font-bold text-slate-800">{validatedRows.length}</span>
            </span>
            {newSpacesCount > 0 && (
              <span className="text-amber-600 font-medium">
                · {newSpacesCount} nuevo{newSpacesCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!allReady || validatedRows.length === 0}
              className="flex-1 sm:flex-none gap-2"
            >
              <Upload className="w-4 h-4" />
              Confirmar Importación
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
