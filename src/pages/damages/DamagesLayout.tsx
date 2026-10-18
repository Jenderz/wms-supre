import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Flame, PlusCircle, ListFilter } from 'lucide-react';

export const DamagesLayout: React.FC = () => {
  const tabs = [
    {
      to: '/damages/new',
      label: 'Registro Averías',
      icon: PlusCircle,
    },
    {
      to: '/damages/list',
      label: 'Lista Averías',
      icon: ListFilter,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shadow-sm">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Registro de Averías y Bajas</h1>
            <p className="text-xs text-slate-500">
              Desincorporación física y administrativa por daños, vencimientos o mermas con control de corrección
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
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
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

export default DamagesLayout;
