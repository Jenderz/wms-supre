/**
 * DispatchesLayout.tsx
 * Layout contenedor del módulo Despachos con navegación por tabs entre sub-módulos.
 * Actúa como "shell" que renderiza el sub-módulo activo según la ruta.
 */
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  List, PlusCircle, FileSearch, Printer, FileText, Truck,
} from 'lucide-react';

const DISPATCH_TABS = [
  {
    label: 'Lista de Despachos',
    path: '/dispatches/list',
    icon: List,
    description: 'Ver todas las órdenes',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Crear Directo',
    path: '/dispatches/new',
    icon: PlusCircle,
    description: 'Nueva orden manual',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Detalle',
    path: '/dispatches/detail',
    icon: FileSearch,
    description: 'Ver / gestionar orden',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    label: 'Nota Personalizada',
    path: '/dispatches/print-note',
    icon: FileText,
    description: 'Nota de entrega PDF',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
] as const;

const DispatchesLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="space-y-6">
      {/* ── Pestañas de navegación ────────────────────────────────── */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6 scrollbar-hide">
        {DISPATCH_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/dispatches/list' && location.pathname === '/dispatches');

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`pb-4 px-6 text-sm font-medium transition-colors relative whitespace-nowrap ${
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </NavLink>
          );
        })}
      </div>

      {/* ── Contenido del sub-módulo activo ───────────────────────────── */}
      <div className="min-h-[500px]">
        <Outlet />
      </div>
    </div>
  );
};

export default DispatchesLayout;
