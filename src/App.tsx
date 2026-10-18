import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LockProvider } from './context/LockContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy loading para división de código (Code Splitting)
const CatalogPage      = lazy(() => import('./features/catalog/pages/CatalogPage').then(m => ({ default: m.CatalogPage })));
const CategoriesPage   = lazy(() => import('./features/catalog/pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const ProvidersPage    = lazy(() => import('./features/catalog/pages/ProvidersPage').then(m => ({ default: m.ProvidersPage })));
const Infrastructure   = lazy(() => import('./pages/Infrastructure'));
const Warehouse        = lazy(() => import('./pages/Warehouse'));
const Disincorporation = lazy(() => import('./pages/Disincorporation'));
const Settings         = lazy(() => import('./pages/Settings'));
const StockMovements   = lazy(() => import('./pages/StockMovements').then(m => ({ default: m.StockMovements })));
const LocksPage        = lazy(() => import('./features/locks/pages/LocksPage').then(m => ({ default: m.LocksPage })));

// ── Módulo Abastecimiento ──────────────────────────────────────────────────
const PurchasingLayout       = lazy(() => import('./pages/purchasing/PurchasingLayout'));
const PickingList            = lazy(() => import('./pages/purchasing/PickingList').then(m => ({ default: m.PickingList })));
const PickingCreate          = lazy(() => import('./pages/purchasing/PickingCreate').then(m => ({ default: m.PickingCreate })));
const ProductIdentifierLabel = lazy(() => import('./pages/purchasing/ProductIdentifierLabel').then(m => ({ default: m.ProductIdentifierLabel })));
const ProductBarcodeLabel    = lazy(() => import('./pages/purchasing/ProductBarcodeLabel').then(m => ({ default: m.ProductBarcodeLabel })));

// ── Módulo Despachos ────────────────────────────────────────────────────────
const DispatchesLayout  = lazy(() => import('./pages/dispatches/DispatchesLayout'));
const DispatchList      = lazy(() => import('./pages/dispatches/DispatchList'));
const DispatchCreate    = lazy(() => import('./pages/dispatches/DispatchCreate'));
const DispatchDetail    = lazy(() => import('./pages/dispatches/DispatchDetail'));
const DispatchPrint     = lazy(() => import('./pages/dispatches/DispatchPrint'));
const DispatchPrintNote = lazy(() => import('./pages/dispatches/DispatchPrintNote'));

// ── Módulo Stock Mínimo ─────────────────────────────────────────────────────
const MinStockLayout   = lazy(() => import('./pages/min-stock/MinStockLayout'));
const MinStockGeneral  = lazy(() => import('./pages/min-stock/MinStockGeneral'));
const MinStockDispatch = lazy(() => import('./pages/min-stock/MinStockDispatch'));
const MinStockArchived = lazy(() => import('./pages/min-stock/MinStockArchived'));

// ── Módulo Picking Transferencia ───────────────────────────────────────────
const TransferPickingLayout = lazy(() => import('./pages/transfer-picking/TransferPickingLayout'));
const TransferPickingCreate = lazy(() => import('./pages/transfer-picking/TransferPickingCreate'));
const TransferPickingList   = lazy(() => import('./pages/transfer-picking/TransferPickingList'));

// ── Módulo Registro RDI ────────────────────────────────────────────────────
const RdiLayout = lazy(() => import('./pages/rdi/RdiLayout'));
const RdiCreate = lazy(() => import('./pages/rdi/RdiCreate'));
const RdiList   = lazy(() => import('./pages/rdi/RdiList'));

// ── Módulo Registro Averías ────────────────────────────────────────────────
const DamagesLayout = lazy(() => import('./pages/damages/DamagesLayout'));
const DamagesCreate = lazy(() => import('./pages/damages/DamagesCreate'));
const DamagesList   = lazy(() => import('./pages/damages/DamagesList'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <LockProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="providers" element={<ProvidersPage />} />
                <Route path="infrastructure" element={<Infrastructure />} />
                <Route path="warehouse" element={<Warehouse />} />
                <Route path="disincorporation" element={<Disincorporation />} />
                <Route path="movements" element={<StockMovements />} />
                <Route path="settings" element={<Settings />} />
                <Route path="locks" element={<LocksPage />} />

                {/* ── Módulo Abastecimiento con Layout y 4 sub-rutas ─── */}
                <Route path="purchasing" element={<PurchasingLayout />}>
                  <Route index element={<Navigate to="list" replace />} />
                  <Route path="list"          element={<PickingList />} />
                  <Route path="new"           element={<PickingCreate />} />
                  <Route path="product-label" element={<ProductIdentifierLabel />} />
                  <Route path="code-label"    element={<ProductBarcodeLabel />} />
                </Route>

                {/* ── Módulo Despachos con Layout y 5 sub-rutas ─────── */}
                <Route path="dispatches" element={<DispatchesLayout />}>
                  <Route index element={<Navigate to="list" replace />} />
                  <Route path="list"       element={<DispatchList />} />
                  <Route path="new"        element={<DispatchCreate />} />
                  <Route path="detail"     element={<DispatchDetail />} />
                  <Route path="print"      element={<DispatchPrint />} />
                  <Route path="print-note" element={<DispatchPrintNote />} />
                </Route>

                {/* ── Módulo Stock Mínimo con Layout y 3 sub-rutas ───── */}
                <Route path="min-stock" element={<MinStockLayout />}>
                  <Route index element={<Navigate to="general" replace />} />
                  <Route path="general"  element={<MinStockGeneral />} />
                  <Route path="dispatch" element={<MinStockDispatch />} />
                  <Route path="archived" element={<MinStockArchived />} />
                </Route>

                {/* ── Módulo Picking Transferencia con Layout y 2 sub-rutas ─ */}
                <Route path="transfer-picking" element={<TransferPickingLayout />}>
                  <Route index element={<Navigate to="list" replace />} />
                  <Route path="new"  element={<TransferPickingCreate />} />
                  <Route path="list" element={<TransferPickingList />} />
                </Route>

                {/* ── Módulo Registro RDI con Layout y 2 sub-rutas ───── */}
                <Route path="rdi" element={<RdiLayout />}>
                  <Route index element={<Navigate to="list" replace />} />
                  <Route path="new"  element={<RdiCreate />} />
                  <Route path="list" element={<RdiList />} />
                </Route>

                {/* ── Módulo Registro Averías con Layout y 2 sub-rutas ─ */}
                <Route path="damages" element={<DamagesLayout />}>
                  <Route index element={<Navigate to="list" replace />} />
                  <Route path="new"  element={<DamagesCreate />} />
                  <Route path="list" element={<DamagesList />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </LockProvider>
    </AuthProvider>
  );
}