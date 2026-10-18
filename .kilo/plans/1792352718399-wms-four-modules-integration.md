# Plan de Integración: 4 Nuevos Módulos WMS (Stock Mínimo, Picking Transferencia, Registro RDI y Registro Averías)

## 1. Objetivo y Alcance
Integrar **4 nuevos módulos** en el menú principal (`Sidebar`) con sus respectivos submódulos, siguiendo estrictamente las reglas de negocio de `@Wms supreparts 23-09-26.pdf` y la línea visual de las 9 imágenes de referencia, garantizando **cero regresiones** sobre los módulos existentes (`Catálogo`, `Abastecimiento`, `Almacén`, `Despachos`, `Desincorporación`, `Historial`, `Configuración`).

### Módulos y Submódulos a Integrar
1. **Stock Mínimo** (`/min-stock`)
   - `Stock Mínimo General` (`/min-stock/general`)
   - `Stock Mínimo Espacio Despacho` (`/min-stock/dispatch`)
   - `Stock Mínimo Archivado` (`/min-stock/archived`)
2. **Picking Transferencia** (`/transfer-picking`)
   - `Picking Transferencia` (Creación / Edición: `/transfer-picking/new`)
   - `Lista Picking Transferencia` (`/transfer-picking/list`)
3. **Registro RDI** (`/rdi`)
   - `Registro RDI` (Creación: `/rdi/new`)
   - `Lista RDI` (`/rdi/list`)
4. **Registro Averías** (`/damages`)
   - `Registro Averías` (Creación: `/damages/new`)
   - `Lista Averías` (`/damages/list`)

---

## 2. Decisiones de Diseño Confirmadas
1. **Menú Principal y Retiro de `Desincorporación` en Sidebar (Cero Regresiones)**:
   - Se agregan los 4 módulos nuevos (`Stock Mínimo`, `Picking Transferencia`, `Registro RDI`, `Registro Averías`) al `Sidebar.tsx` y `App.tsx`.
   - Se retira el ítem antiguo de **`Desincorporación`** del menú lateral (`Sidebar.tsx`), ya que queda reemplazado operativamente por **Registro Averías** (bajas/daños/mermas) y **Registro RDI** (faltantes/sobrantes).
   - Por integridad y cero regresiones, la ruta `/disincorporation` y el endpoint/tabla `/disincorporations` en backend se mantienen intactos para no romper `Statistics.tsx`, `LocksPage.tsx` ni el historial previo.
2. **Sincronización Bidireccional en Picking Transferencia**:
   - En estado `Borrador` (`DRAFT`): guarda la preselección de productos y distribución por espacios sin descontar stock en el almacén origen ni crear lote en el almacén destino.
   - Al pulsar **Enviar Picking transferencia** (o pasar de `Borrador` a `Pendiente`): descuenta las cantidades de los espacios seleccionados en el **Almacén Origen**, registra el movimiento de salida/transferencia y crea automáticamente un registro vinculado en `picking_lots` para el **Almacén Destino** en estado `PENDING` (`1 ítem = 1 bulto`).
   - Al pasar a `Conformado` (`CONFORMED`) desde **Lista Picking Transferencia** o desde **Abastecimiento > Lista de Picking**: se ingresa el stock al Almacén Destino una única vez y ambos registros (`transfer_pickings` y `picking_lots`) quedan sincronizados en estado `CONFORMED`.
3. **Archivado con Fecha Límite en Stock Mínimo**:
   - Al archivar ítems desde `Stock Mínimo General`, se propone por defecto una **Fecha Límite Archivado** de **+30 días (1 mes)** con opción de ajustarla en un modal ligero de confirmación.
   - Al cumplirse la `Fecha Límite Archivado` (o al usar el botón **Desarchivar seleccionados**), los ítems se desarchivan automáticamente y regresan a `Stock Mínimo General`.
4. **Ciclo de Estados e Impacto en Inventario para RDI y Averías**:
   - Cada producto agregado en el formulario genera su registro individual secuencial en la lista (`RDI-0001`, `RDI-0002`... / `AVE-0001`, `AVE-0002`...).
   - En `Borrador` (`DRAFT`): no modifica el inventario (`stock_applied = 0`).
   - Al guardar como `Pendiente` (`PENDING`) o cambiar en la lista de `Borrador` a `Pendiente` (o directo de `Borrador` a `Conformado`): se ejecuta el ajuste de stock una única vez (`stock_applied = 1`):
     - **RDI `FALTANTE`**: resta de los espacios seleccionados.
     - **RDI `SOBRANTE`**: suma en los espacios seleccionados.
     - **Avería con `Corrección Inventario = Sí`**: resta de los espacios seleccionados.
     - **Avería con `Corrección Inventario = No`**: no afecta inventario; el selector de espacio permanece deshabilitado en el formulario y la celda `ESPACIO ALMACÉN` aparece en blanco en `Lista Averías`.
   - El cambio de `Pendiente` a `Conformado` desde el menú flotante de la lista cierra/audita el registro sin duplicar el ajuste de stock.

---

## 3. Diseño de Base de Datos (Migración SQL)

Crear el archivo `backend/database/migrations/017_wms_new_modules.sql` (ejecutado vía `backend/migrate.php` sin afectar tablas actuales):

### 3.1. Tabla `min_stock_archived`
- `id INT AUTO_INCREMENT PRIMARY KEY`
- `product_id INT NOT NULL` (FK -> `products.id` ON DELETE CASCADE)
- `warehouse_id INT NOT NULL` (FK -> `warehouses.id` ON DELETE CASCADE)
- `archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `archive_deadline_at DATETIME NOT NULL`
- `archived_by INT NULL` (FK -> `users.id` ON DELETE SET NULL)
- `UNIQUE KEY uk_min_stock_archived (product_id, warehouse_id)`

### 3.2. Tablas `transfer_pickings` y `transfer_picking_items`
- `transfer_pickings`:
  - `id INT AUTO_INCREMENT PRIMARY KEY`
  - `lot_number VARCHAR(50) NOT NULL UNIQUE` (`TRANF-0001`, `TRANF-0002`...)
  - `origin_warehouse_id INT NOT NULL` (FK -> `warehouses.id`)
  - `destination_warehouse_id INT NOT NULL` (FK -> `warehouses.id`)
  - `responsible_user_id INT NOT NULL` (FK -> `users.id`)
  - `description TEXT NULL`
  - `status ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT'`
  - `linked_picking_lot_id INT NULL` (FK -> `picking_lots.id` ON DELETE SET NULL)
  - `stock_deducted TINYINT(1) NOT NULL DEFAULT 0`
  - `created_by INT NOT NULL` (FK -> `users.id`)
  - `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `conformed_at DATETIME NULL`
- `transfer_picking_items`:
  - `id INT AUTO_INCREMENT PRIMARY KEY`
  - `transfer_picking_id INT NOT NULL` (FK -> `transfer_pickings.id` ON DELETE CASCADE)
  - `product_id INT NOT NULL` (FK -> `products.id`)
  - `quantity DECIMAL(12,4) NOT NULL`
  - `number_of_packages INT NOT NULL DEFAULT 1` (regla: 1 ítem = 1 bulto)
  - `spaces_distribution JSON NOT NULL` (`[{ "warehouseSpaceId": 1, "spaceName": "P1 C1 E1", "quantity": 5 }]`)

### 3.3. Tabla `rdi_records`
- `id INT AUTO_INCREMENT PRIMARY KEY`
- `code VARCHAR(50) NOT NULL UNIQUE` (`RDI-0001`, `RDI-0002`...)
- `warehouse_id INT NOT NULL` (FK -> `warehouses.id`)
- `product_id INT NOT NULL` (FK -> `products.id`)
- `rdi_type ENUM('FALTANTE','SOBRANTE') NOT NULL`
- `quantity DECIMAL(12,4) NOT NULL`
- `spaces_distribution JSON NOT NULL` (`[{ "warehouseSpaceId": 1, "spaceName": "P1 C1 E1", "quantity": 3 }]`)
- `status ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT'`
- `stock_applied TINYINT(1) NOT NULL DEFAULT 0`
- `responsible_user_id INT NOT NULL` (FK -> `users.id`)
- `description TEXT NULL`
- `created_by INT NOT NULL` (FK -> `users.id`)
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `conformed_at DATETIME NULL`

### 3.4. Tabla `damage_records` (Averías)
- `id INT AUTO_INCREMENT PRIMARY KEY`
- `code VARCHAR(50) NOT NULL UNIQUE` (`AVE-0001`, `AVE-0002`...)
- `warehouse_id INT NOT NULL` (FK -> `warehouses.id`)
- `product_id INT NOT NULL` (FK -> `products.id`)
- `inventory_correction TINYINT(1) NOT NULL DEFAULT 1` (`1 = Sí`, `0 = No`)
- `quantity DECIMAL(12,4) NOT NULL`
- `spaces_distribution JSON NULL`
- `status ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT'`
- `stock_applied TINYINT(1) NOT NULL DEFAULT 0`
- `responsible_user_id INT NOT NULL` (FK -> `users.id`)
- `description TEXT NULL`
- `created_by INT NOT NULL` (FK -> `users.id`)
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `conformed_at DATETIME NULL`

---

## 4. Arquitectura Backend (PHP REST API)

### 4.1. Nuevos Modelos (`backend/src/Models/`)
1. `MinStockModel.php`:
   - `purgeExpiredArchives()`: elimina registros de `min_stock_archived` donde `archive_deadline_at <= NOW()`.
   - `getGeneralMinStock()`: obtiene por `(product_id, warehouse_id)` los productos con `min_stock > 0` cuyo stock total en el almacén sea `<= min_stock` y que no estén archivados en `min_stock_archived`, incluyendo `lastMovementAt` desde `stock_movements`.
   - `getDispatchSpaceMinStock()`: obtiene filas de `stock` asociadas a espacios con `space_usage_type = 'Despachos'` donde `min_stock_dispatch > 0` y `quantity <= min_stock_dispatch`, incluyendo `lastMovementAt`.
   - `getArchivedMinStock()`: retorna los registros activos en `min_stock_archived` con datos de producto, almacén, stock actual, `archivedAt` y `archiveDeadlineAt`.
   - `archiveItems(array $items, string $deadlineAt, int $userId)` y `unarchiveItems(array $items)`.
2. `TransferPicking.php`:
   - CRUD completo de `transfer_pickings` y `transfer_picking_items`.
   - Generador automático de código secuencial `TRANF-0001`.
   - Método transaccional `sendTransfer(int $id, int $userId)`: valida stock por espacio en almacén origen, descuenta con `Stock::adjustQuantity`, registra `stock_movements` (`type = 'TRANSFER'`, `reason = 'TRANSFER'`), crea el lote en `picking_lots` en estado `PENDING` para el almacén destino (`1 ítem = 1 bulto`), y guarda `linked_picking_lot_id` + `stock_deducted = 1`.
   - Método transaccional `conformTransfer(int $id, int $userId)`: si aún no estaba en `PENDING`, ejecuta primero el descuento de origen; luego conforma el lote destino ingresando el stock al almacén destino (`Stock::upsert` aditivo en pendiente de asignación + movimiento `IN / RECEPTION`) y marca `transfer_pickings` y `picking_lots` como `CONFORMED`.
3. `RdiRecord.php`:
   - Listado con filtros (`rdiType`, `warehouseId`, `status`, búsqueda), creación por lote de ítems (generando `RDI-0001`, `RDI-0002`...), actualización de estado y eliminación (solo en `DRAFT` o por `ADMIN`).
   - Método transaccional `applyStockIfNeeded`: cuando el registro pasa de `DRAFT` a `PENDING` o `CONFORMED` y `stock_applied = 0`, suma (`SOBRANTE`) o resta (`FALTANTE`) las cantidades en cada `warehouseSpaceId` de `spaces_distribution` y crea el registro en `stock_movements` (`type = 'IN'|'OUT'`, `reason = 'ADJUSTMENT'`).
4. `DamageRecord.php`:
   - Listado con filtros (`inventoryCorrection`, `warehouseId`, `status`, búsqueda), creación por lote de ítems (generando `AVE-0001`, `AVE-0002`...), actualización de estado y eliminación.
   - Método transaccional `applyStockIfNeeded`: cuando `inventory_correction = 1` (`Sí`), `stock_applied = 0` y el estado pasa a `PENDING` o `CONFORMED`, resta las cantidades de cada `warehouseSpaceId` en `spaces_distribution` y registra el movimiento en `stock_movements` (`type = 'OUT'`, `reason = 'DISINCORPORATION'`). Si `inventory_correction = 0` (`No`), nunca modifica `stock`.

### 4.2. Nuevos Controladores y Rutas (`backend/src/Controllers/` y `backend/public/index.php`)
- `MinStockController.php` -> `/min-stock/general`, `/min-stock/dispatch`, `/min-stock/archived`, `/min-stock/archive`, `/min-stock/unarchive`.
- `TransferPickingController.php` -> `/transfer-pickings`, `/transfer-pickings/{id}`, `/transfer-pickings/{id}/status`.
- Actualizar `PickingLotController::conform()` para que, si existe un `transfer_pickings` con `linked_picking_lot_id = $id`, actualice su estado a `CONFORMED` y `conformed_at = NOW()` dentro de la misma transacción.
- `RdiRecordController.php` -> `/rdi-records`, `/rdi-records/{id}/status`, `/rdi-records/{id}`.
- `DamageRecordController.php` -> `/damage-records`, `/damage-records/{id}/status`, `/damage-records/{id}`.

---

## 5. Arquitectura Frontend (React + TypeScript + Tailwind)

### 5.1. Tipos y Cliente API (`src/types.ts` y `src/services/api.ts`)
- Agregar interfaces tipadas en `src/types.ts`:
  - `SpaceDistributionItem`, `MinStockGeneralRow`, `MinStockDispatchRow`, `MinStockArchivedRow`
  - `TransferPicking`, `TransferPickingItem`, `TransferPickingStatus` (`'DRAFT' | 'PENDING' | 'CONFORMED'`)
  - `RdiRecord`, `RdiType` (`'FALTANTE' | 'SOBRANTE'`), `RdiStatus` (`'DRAFT' | 'PENDING' | 'CONFORMED'`)
  - `DamageRecord`, `DamageStatus` (`'DRAFT' | 'PENDING' | 'CONFORMED'`)
- Agregar servicios en `src/services/api.ts`: `MinStockApi`, `TransferPickingApi`, `RdiApi`, `DamageApi`.

### 5.2. Componentes Compartidos y Reutilización sin Duplicación
1. **Selector Desplegable de Distribución por Espacio (`src/components/SpaceDistributionPopover.tsx`)**:
   - Replica fielmente el diseño de las imágenes 4, 5, 6 y 10 (`Espacios Almacen` / `Distribución por Espacio`, badge `X/Y asignado`, lista de espacios con badge verde `DESPACHO` cuando `spaceUsageType === 'Despachos'`, `Stock: N`, input `Envío: [ ]`, y pie `Total asignado: X de Y u.`).
   - Reutilizado en `Picking Transferencia`, `Registro RDI` y `Registro Averías`.
2. **Menú Flotante de Estado (`src/components/StatusFloatingMenu.tsx`)**:
   - Píldora interactiva para cambiar estado entre `Borrador`, `Pendiente` y `Conformado` con los colores e íconos exactos de las imágenes de referencia (`Borrador` gris, `Pendiente` ámbar, `Conformado` esmeralda).
   - Reutilizado en `Lista Picking Transferencia`, `Lista RDI` y `Lista Averías`.
3. **Reutilización de Modales de Inventario (`Editar Administrador` y `Editar Stock por Espacios`)**:
   - En `Stock Mínimo General`, `Stock Mínimo Espacio Despacho` y `Stock Mínimo Archivado`, los botones `Editar Administrador` y `Editar Stock por Espacios` invocarán los modales existentes de `InventoryTab` (extrayéndolos en componentes modales reutilizables o abriéndolos con la misma lógica de `useWarehouse`) para garantizar un comportamiento idéntico al de `Almacén > Inventario`.

### 5.3. Vistas y Submódulos (`src/pages/`)
1. **Módulo 1: Stock Mínimo (`src/pages/min-stock/`)**
   - `MinStockLayout.tsx`: navegación superior tipo breadcrumb/píldoras (`stock mínimo general` > `stock mínimo espacio despacho` > `stock minimos archivados`) idéntica a las imágenes 7, 8 y 9.
   - `MinStockGeneral.tsx`: barra de búsqueda, botón `Escanear` (`QRScannerModal`), selector de Almacén, **filtro stock** (`Stock en 0`, `Stock mínimo (> 0)`, `Todos`), `Imprimir seleccionados` (PDF con `jspdf-autotable`), `Archivar seleccionados` (abre modal con fecha límite por defecto a +30 días), tabla con ordenamiento en `stock`, `alerta Stock mínimo general` y `Fecha ultima movimiento`, y botón `Editar Administrador`.
   - `MinStockDispatch.tsx`: barra de búsqueda, `Escanear`, selector de Almacén, **filtro stock** (`stock bajo`, `stock en 0`, `Todos`), `Imprimir seleccionados`, tabla con columna `ESPACIO ALMACEN` y acciones `Editar Administrador` + `Editar Stock por Espacios`.
   - `MinStockArchived.tsx`: barra de búsqueda, `escanear`, filtro `almacen`, `imprimir seleccionados`, `desarchivar seleccionados`, columnas `FECHA DE ARCHIVADO` y `FECHA LIMITE ARCHIVADO`, y botón `Editar Administrador`.
2. **Módulo 2: Picking Transferencia (`src/pages/transfer-picking/`)**
   - `TransferPickingLayout.tsx`: navegación superior (`Picking transferencia` > `lista picking transferencia`).
   - `TransferPickingCreate.tsx`: tarjeta `Información de Transferencia` (`Almacén Origen *`, `Almacén Destino *`, `Responsable *`), tarjeta `AGREGAR PRODUCTOS AL PICKING` (buscador, `Escanear`, `Descripcion`), tabla `Items del Picking transferencia` con columnas `FOTO`, `PRODUCTO`, `CAT.`, `BULTOS` (automático `1` por ítem), `STOCK ACTUAL`, `STOCK A TRANSFERIR` (`- / +`), `ESPACIO ALMACÉN` (`SpaceDistributionPopover`), `TOTAL RESTANTE`, `ACCIÓN`, botón `Vaciar Lista`, y botones inferiores `Imprimir picking transferencia`, `Guardar Borrador` y `Enviar Picking transferencia`.
   - `TransferPickingList.tsx`: filtros superiores (`Almacén Origen`, `Almacén Destino`, `Responsable`, `Estado`, buscador + `Escanear`), tabla con `LOTE` (`TRANF-XXXX`), `ALMACÉN ORIGEN`, `ALMACÉN DESTINO`, `RESPONSABLE`, `DESCRIPCIÓN`, `ITEMS`, `BULTOS`, `ESTADO`, `FECHA` y `ACCIONES` (Ver detalle, Imprimir PDF, Editar si no está conformado, Eliminar).
3. **Módulo 3: Registro RDI (`src/pages/rdi/`)**
   - `RdiLayout.tsx`: navegación superior (`Registro RDI` > `lista RDI`).
   - `RdiCreate.tsx`: tarjeta `REGISTRO RDI` (`Almacén Origen *`, `Tipo RDI *` [`FALTANTE` | `SOBRANTE`], `Agregar Producto` con buscador y `Escanear`), tarjeta `DESCRIPCIÓN / OBSERVACIÓN` (`Responsable *`, `Detalle / Observación`), tabla `Detalle RDI` con `IMAGEN`, `PRODUCTO`, `STOCK ACTUAL`, `STOCK RDI` (`- / +`), `TIPO RDI`, `ESPACIO ALMACÉN` (`SpaceDistributionPopover`), `TOTAL RESTANTE` (`stock - rdi` en faltante, `stock + rdi` en sobrante), y botones `GUARDAR BORRADOR` y `GUARDAR REGISTRO RDI`.
   - `RdiList.tsx`: filtros superiores (`TIPO RDI`, `ALMACÉN`, `ESTADO`, `Imprimir seleccionados`, buscador + `Escanear`), tabla `Registros de Discrepancias (RDI)` con selección múltiple, `COD-REGISTRO` (`RDI-XXXX`), `IMAGEN`, `PRODUCTO`, `STOCK RDI` (`-X u.` / `+X u.`), `TIPO RDI` (badge ámbar `FALTANTE` / verde `SOBRANTE`), `ALMACÉN`, `ESPACIO ALMACÉN`, `ESTADO` (menú flotante `Borrador` / `Pendiente` / `Conformado`), `RESPONSABLE` (con avatar de iniciales), `DESCRIPCIÓN`, `FECHA` y paginación.
4. **Módulo 4: Registro Averías (`src/pages/damages/`)**
   - `DamagesLayout.tsx`: navegación superior (`Registro averías` > `lista averías`).
   - `DamagesCreate.tsx`: tarjeta `PARÁMETROS DE AVERÍA` (`Almacén Origen *`, `Corrección Inventario *` [`Sí` | `No`], `Agregar Producto` + `Escanear`), tarjeta `DESCRIPCIÓN / OBSERVACIÓN` (`Responsable *`, `Observación`), tabla `Detalle de Averías` con `IMAGEN`, `PRODUCTO`, `STOCK ACTUAL`, `STOCK DESINCORPORAR` (`- / +`), `ESPACIO ALMACÉN` (`SpaceDistributionPopover` habilitado cuando `Corrección Inventario = Sí` y deshabilitado cuando es `No`), `TOTAL RESTANTE`, resumen `Total a dar de baja: X Unidades`, y botones `GUARDAR BORRADOR` y `GUARDAR REGISTRO AVERÍA`.
   - `DamagesList.tsx`: filtros superiores (`CORRECCIÓN INVENTARIO`, `ALMACÉN`, `ESTADO`, `Imprimir seleccionados`, buscador + `Escanear`), tabla con selección múltiple, `COD-REGISTRO` (`AVE-XXXX`), `IMAGEN`, `PRODUCTO`, `STOCK AVERÍAS` (badge rosa `X u.`), `CORRECCIÓN INV.` (badge verde `Sí` / ámbar `No`), `ALMACÉN`, `ESPACIO ALMACÉN` (en blanco cuando `Corrección Inv. = No`), `ESTADO` (menú flotante `Borrador` / `Pendiente` / `Conformado`), `RESPONSABLE`, `DESCRIPCIÓN` y paginación.

---

## 6. Plan de Ejecución Paso a Paso y Validación
1. **Fase 1 — Base de Datos y Backend**:
   - Crear `backend/database/migrations/017_wms_new_modules.sql` y ejecutar `php backend/migrate.php`.
   - Implementar los 4 modelos (`MinStockModel.php`, `TransferPicking.php`, `RdiRecord.php`, `DamageRecord.php`), sus controladores y registrar las rutas en `backend/public/index.php`.
   - Conectar la sincronización bidireccional en `PickingLotController::conform()`.
2. **Fase 2 — Tipos, Servicios API y Componentes Reutilizables**:
   - Actualizar `src/types.ts` y `src/services/api.ts`.
   - Crear `SpaceDistributionPopover.tsx`, `StatusFloatingMenu.tsx` y extraer/exponer los modales `AdminEditModal` y `SpaceStockEditModal` desde `InventoryTab.tsx` sin alterar el funcionamiento actual de `Almacén > Inventario`.
3. **Fase 3 — Implementación de los 4 Módulos Frontend y Enrutamiento**:
   - Implementar las páginas de `Stock Mínimo`, `Picking Transferencia`, `Registro RDI` y `Registro Averías`.
   - Integrar las rutas en `src/App.tsx` y los accesos en `src/components/Sidebar.tsx`.
4. **Fase 4 — Verificación y Pruebas**:
   - Verificar compilación limpia de TypeScript y bundle de producción (`npm run build`).
   - Validar sintaxis PHP (`php -l`) en todos los modelos, controladores y `index.php`.
   - Comprobar flujos críticos: filtro stock en 0 vs > 0, archivado/desarchivado con fecha límite, descuento en origen + creación y conformación sincronizada de lote en destino en Picking Transferencia, suma/resta por espacio en RDI (`FALTANTE`/`SOBRANTE`) y bloqueo de espacio + no descuento cuando `Corrección Inventario = No` en Averías.

---

## 7. Anexo para Implementación Manual y Auditoría Posterior

### 7.1. Script SQL Listo para Copiar (`backend/database/migrations/017_wms_new_modules.sql`)
```sql
CREATE TABLE IF NOT EXISTS min_stock_archived (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    product_id          INT NOT NULL,
    warehouse_id        INT NOT NULL,
    archived_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archive_deadline_at DATETIME NOT NULL,
    archived_by         INT NULL,
    UNIQUE KEY uk_min_stock_archived (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_min_stock_deadline (archive_deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfer_pickings (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    lot_number               VARCHAR(50) NOT NULL UNIQUE,
    origin_warehouse_id      INT NOT NULL,
    destination_warehouse_id INT NOT NULL,
    responsible_user_id      INT NOT NULL,
    description              TEXT NULL,
    status                   ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    linked_picking_lot_id    INT NULL,
    stock_deducted           TINYINT(1) NOT NULL DEFAULT 0,
    created_by               INT NOT NULL,
    created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at             DATETIME NULL,
    FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (linked_picking_lot_id) REFERENCES picking_lots(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_transfer_status (status),
    INDEX idx_transfer_linked_lot (linked_picking_lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfer_picking_items (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    transfer_picking_id INT NOT NULL,
    product_id          INT NOT NULL,
    quantity            DECIMAL(12,4) NOT NULL,
    number_of_packages  INT NOT NULL DEFAULT 1,
    spaces_distribution JSON NOT NULL,
    FOREIGN KEY (transfer_picking_id) REFERENCES transfer_pickings(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rdi_records (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id        INT NOT NULL,
    product_id          INT NOT NULL,
    rdi_type            ENUM('FALTANTE','SOBRANTE') NOT NULL,
    quantity            DECIMAL(12,4) NOT NULL,
    spaces_distribution JSON NOT NULL,
    status              ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    stock_applied       TINYINT(1) NOT NULL DEFAULT 0,
    responsible_user_id INT NOT NULL,
    description         TEXT NULL,
    created_by          INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at        DATETIME NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_rdi_status (status),
    INDEX idx_rdi_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS damage_records (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    code                 VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id         INT NOT NULL,
    product_id           INT NOT NULL,
    inventory_correction TINYINT(1) NOT NULL DEFAULT 1,
    quantity             DECIMAL(12,4) NOT NULL,
    spaces_distribution  JSON NULL,
    status               ENUM('DRAFT','PENDING','CONFORMED') NOT NULL DEFAULT 'DRAFT',
    stock_applied        TINYINT(1) NOT NULL DEFAULT 0,
    responsible_user_id  INT NOT NULL,
    description          TEXT NULL,
    created_by           INT NOT NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conformed_at         DATETIME NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_damage_status (status),
    INDEX idx_damage_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7.2. Checklist de Auditoría (Cuando Pidas Revisar tu Implementación)
1. **Stock Mínimo**:
   - Filtro `Stock en 0` vs `Stock bajo (> 0 y <= minStock)` en General y Espacio Despacho.
   - Purga automática de archivados vencidos (`archive_deadline_at <= NOW()`).
   - Apertura de modales `Editar Administrador` y `Editar Stock por Espacios` sin duplicar lógica de `InventoryTab`.
2. **Picking Transferencia**:
   - `1 ítem = 1 bulto` automático.
   - `Guardar Borrador` no toca stock ni crea lote en destino.
   - `Enviar Picking transferencia` (o pasar a `Pendiente`) descuenta de los espacios de `Almacén Origen` (`stock_deducted = 1`) y crea lote `PENDING` en `picking_lots` de `Almacén Destino`.
   - Sincronización bidireccional al pasar a `Conformado`.
3. **Registro RDI y Registro Averías**:
   - En `Borrador` no altera stock (`stock_applied = 0`).
   - Al guardar directo o pasar a `Pendiente`/`Conformado`, aplica el ajuste una única vez (`stock_applied = 1`).
   - En Averías con `Corrección Inventario = No`, el selector de espacio está deshabilitado en el formulario, la columna `ESPACIO ALMACÉN` queda vacía en la lista y nunca se descuenta stock.

---

## 8. Resultado de Auditoría de la Implementación Manual y Correcciones Puntuales

La revisión completa de los 22 archivos creados/modificados confirma que la estructura general, migración SQL (`018_wms_new_modules.sql`), rutas en `backend/public/index.php`, sincronización en `PickingLotController.php`, menú lateral (`Sidebar.tsx`), rutas (`App.tsx`) y vistas de los 4 módulos están implementados al **95%**.

Solo quedan **4 correcciones quirúrgicas** para blindar casos borde en producción:

1. **[Crítico - Backend] `RdiRecord::applyStockIfNeeded()` para `SOBRANTE` en espacios sin fila previa en `stock`** (`backend/src/Models/RdiRecord.php` líneas 284–296):
   - `Stock::adjustQuantity()` hace un `UPDATE` sobre `stock`; si el espacio aún no tenía registro para ese producto (`Stock: 0`), el `UPDATE` afecta 0 filas y no suma el sobrante.
   - **Acción:** Cuando `!$isFaltante` (`SOBRANTE`), usar `$stockModel->upsert(['productId' => $pid, 'warehouseId' => $wid, 'warehouseSpaceId' => $spId, 'quantity' => $spQty, 'isAdditive' => true])` en lugar de `adjustQuantity()`.
2. **[Importante - Validación Frontend y Backend] Bloquear envío a `PENDING` si `spacesDistribution` está vacío (`assigned === 0`)**:
   - En `TransferPickingCreate.tsx` (línea 264), `RdiCreate.tsx` (línea 219) y `DamagesCreate.tsx` (línea 210), la condición `if (assigned > 0 && Math.abs(assigned - it.quantity) > 0.0001)` permite enviar en `PENDING` un producto con `assigned === 0` (sin espacios seleccionados).
   - **Acción:** Cambiar la condición a `if (Math.abs(assigned - it.quantity) > 0.0001)` cuando `status === 'PENDING'`, y validar en backend (`TransferPicking::sendTransfer`, `RdiRecord::applyStockIfNeeded`, `DamageRecord::applyStockIfNeeded`) que la suma de `spaces_distribution` coincida con `quantity` antes de marcar `stock_deducted = 1` / `stock_applied = 1`.
3. **[Importante - Estado en Formularios] Recalcular `stockActual` y limpiar `spacesDistribution` al cambiar de Almacén**:
   - En `TransferPickingCreate.tsx`, `RdiCreate.tsx` y `DamagesCreate.tsx`, si el usuario agrega productos a la tabla y luego cambia el selector de `Almacén Origen`, los ítems ya agregados conservan el `stockActual` y los espacios del almacén anterior.
   - **Acción:** Al cambiar el almacén origen, actualizar `stockActual` y `spacesDistribution` de los ítems en la lista para el nuevo almacén seleccionado.
4. **[UX - Escáner QR en las 6 Vistas de Lista] Búsqueda inmediata al escanear**:
   - En `MinStockGeneral.tsx`, `MinStockDispatch.tsx`, `MinStockArchived.tsx`, `TransferPickingList.tsx`, `RdiList.tsx` y `DamagesList.tsx`, el callback `onScan={code => { setSearch(code); setIsScannerOpen(false); loadData(); }}` ejecuta `loadData()` antes de que React actualice el estado `search`.
   - **Acción:** Permitir que `loadData(searchOverride?: string)` reciba el código escaneado y llamarlo como `loadData(code)`.
