import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FileSpreadsheet, PlusCircle, ListChecks } from 'lucide-react';

export const RdiLayout: React.FC = () => {
  const tabs = [
    {
      to: '/rdi/new',
      label: 'Registro RDI',
      icon: PlusCircle,
    },
    {
      to: '/rdi/list',
      label: 'Lista RDI',
      icon: ListChecks,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Registro de Discrepancias (RDI)</h1>
            <p className="text-xs text-slate-500">
              Control de faltantes y sobrantes de inventario con distribución por espacio y auditoría
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
};

export default RdiLayout;
