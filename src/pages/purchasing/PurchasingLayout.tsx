/**
 * PurchasingLayout.tsx
 * Layout contenedor del módulo independiente de Abastecimiento con navegación por tabs.
 * Estructura modular: Lista de Picking, Nuevo Picking, Etiqueta Identificadora y Etiqueta QR/Código.
 */
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  List,
  PlusCircle,
  Tag,
  QrCode,
  PackageCheck
} from 'lucide-react';

const PURCHASING_TABS = [
  {
    label: 'Lista de Picking',
    path: '/purchasing/list',
    icon: List,
    description: 'Ver y gestionar lotes',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Nuevo Picking',
    path: '/purchasing/new',
    icon: PlusCircle,
    description: 'Crear o editar lote',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Etiqueta Identificadora',
    path: '/purchasing/product-label',
    icon: Tag,
    description: '60x40mm (Nombre/Cat/Cant)',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    label: 'Etiqueta QR / Código',
    path: '/purchasing/code-label',
    icon: QrCode,
    description: '60x40mm (Código/Barras/QR)',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
] as const;

const PurchasingLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="space-y-6">
      {/* ── Encabezado Principal del Módulo ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Abastecimiento
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Gestión de lotes de picking, abastecimiento e impresión de etiquetas térmicas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pestañas de navegación ── */}
      <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide">
        {PURCHASING_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/purchasing/list' && location.pathname === '/purchasing');

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${
                isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full shadow-[0_-1px_6px_rgba(37,99,235,0.4)]" />
              )}
            </NavLink>
          );
        })}
      </div>

      {/* ── Contenido del sub-módulo activo ── */}
      <div className="min-h-[500px]">
        <Outlet />
      </div>
    </div>
  );
};

export default PurchasingLayout;
