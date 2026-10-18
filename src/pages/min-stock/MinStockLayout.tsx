import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, Archive, Boxes } from 'lucide-react';

export const MinStockLayout: React.FC = () => {
  const tabs = [
    {
      to: '/min-stock/general',
      label: 'Stock Mínimo General',
      icon: ShieldAlert,
    },
    {
      to: '/min-stock/dispatch',
      label: 'Stock Mínimo Espacio Despacho',
      icon: AlertTriangle,
    },
    {
      to: '/min-stock/archived',
      label: 'Stock Mínimo Archivado',
      icon: Archive,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Header del módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-sm">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control de Stock Mínimo</h1>
            <p className="text-xs text-slate-500">
              Supervisión de umbrales críticos de inventario, espacios de despacho y productos archivados
            </p>
          </div>
        </div>
      </div>

      {/* Tabs superiores */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Contenido de submódulos */}
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
};

export default MinStockLayout;
