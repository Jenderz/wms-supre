-- ============================================================
-- Migración 017: Normalizar warehouse_id en space_groups
--   - Grupos con warehouse_id NULL que tienen espacios asignados
--     heredan el warehouse_id de sus espacios (el más frecuente).
--   - La unicidad de nombre pasa a ser por (name, warehouse_id),
--     validada en la capa de aplicación (SpaceGroup::assertUniqueName).
--   - Los grupos vacíos con warehouse_id NULL se dejan intactos:
--     el frontend solo los muestra con filtro "Todos los almacenes"
--     y quedan re-vinculados automáticamente al editarlos, pues el
--     modelo ahora deduce el almacén de los espacios asignados.
-- ============================================================

-- 1. Para cada grupo huérfano (warehouse_id NULL), elegir el warehouse_id
--    con más espacios asociados (empate: menor id de almacén).
UPDATE space_groups sg
JOIN (
    SELECT t.group_id, t.warehouse_id
    FROM (
        SELECT sgi.group_id, ws.warehouse_id, COUNT(*) AS cnt
        FROM space_group_items sgi
        INNER JOIN warehouse_spaces ws ON ws.id = sgi.warehouse_space_id
        WHERE sgi.group_id IN (SELECT id FROM space_groups WHERE warehouse_id IS NULL)
        GROUP BY sgi.group_id, ws.warehouse_id
    ) t
    JOIN (
        SELECT m.group_id, MAX(m.cnt) AS maxcnt
        FROM (
            SELECT sgi.group_id, ws.warehouse_id, COUNT(*) AS cnt
            FROM space_group_items sgi
            INNER JOIN warehouse_spaces ws ON ws.id = sgi.warehouse_space_id
            WHERE sgi.group_id IN (SELECT id FROM space_groups WHERE warehouse_id IS NULL)
            GROUP BY sgi.group_id, ws.warehouse_id
        ) m
        GROUP BY m.group_id
    ) mx ON mx.group_id = t.group_id AND mx.maxcnt = t.cnt
) Sel ON Sel.group_id = sg.id
SET sg.warehouse_id = Sel.warehouse_id
WHERE sg.warehouse_id IS NULL;

-- 2. Grupos vacíos siguen con warehouse_id NULL (intencional).
--    No se añade UNIQUE(name, warehouse_id) por compatibilidad: la
--    unicidad se valida en SpaceGroup::assertUniqueName (por almacén).

-- Nota (integridad desde la aplicación, SpaceGroup.php):
--   - create()/update() exigen warehouse_id (lo deducen del primer
--     espacio si no viene en el payload) y validan que todos los
--     espacios del grupo pertenezcan a ese almacén
--     (assertSpacesBelongToWarehouse), garantizando grupos estrictamente
--     por almacén de ahora en adelante.
--   - Si un grupo tuviera espacios de varios almacenes tras la migración,
--     el UPDATE anterior asigna el almacén mayoritario; la validación
--     de la capa de aplicación evita mezclas nuevas.