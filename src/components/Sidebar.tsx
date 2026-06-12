import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Building2, 
  ShoppingCart, 
  Warehouse, 
  LogOut,
  Trash2,
  Zap,
  Tags,
  Activity,
  Settings as SettingsIcon,
  Shield,
  ChevronDown,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

type NavItem = {
  name: string;
  path?: string;
  icon: any;
  roles: string[];
  permission: string | null;
  subItems?: { name: string; path: string; roles: string[]; permission: string | null }[];
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems: NavItem[] = [
    {
      name: 'Análisis',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'COMPRAS', 'DEPOSITO', 'DESINCORPORACION'],
      permission: null,
      subItems: [
        { name: 'Dashboard', path: '/', roles: ['ADMIN', 'COMPRAS', 'DEPOSITO', 'DESINCORPORACION'], permission: null },
        { name: 'Historial', path: '/movements', roles: ['ADMIN'], permission: 'VIEW_STOCK_MOVEMENTS' },
      ]
    },
    { name: 'Productos', path: '/catalog', icon: Package, roles: ['ADMIN', 'COMPRAS'], permission: null },
    { name: 'Almacenes', path: '/infrastructure', icon: Building2, roles: ['ADMIN', 'DEPOSITO', 'COMPRAS'], permission: null },
    { name: 'Inventario', path: '/warehouse', icon: ClipboardList, roles: ['ADMIN', 'DEPOSITO', 'COMPRAS'], permission: null },
    {
      name: 'Operaciones',
      icon: ShoppingCart,
      roles: ['ADMIN', 'COMPRAS', 'DEPOSITO', 'DESINCORPORACION'],
      permission: null,
      subItems: [
        { name: 'Abastecimiento', path: '/purchasing', roles: ['ADMIN', 'COMPRAS'], permission: null },
        { name: 'Recepción de Mercancía', path: '/warehouse', roles: ['ADMIN', 'DEPOSITO'], permission: null },
        { name: 'Desincorporación', path: '/disincorporation', roles: ['ADMIN', 'DESINCORPORACION'], permission: null },
      ]
    },
    {
      name: 'Configuración',
      icon: SettingsIcon,
      roles: ['ADMIN'],
      permission: null,
      subItems: [
        { name: 'Ajustes',           path: '/settings', roles: ['ADMIN'], permission: null },
        { name: 'Llaves de Acceso',  path: '/locks',    roles: ['ADMIN'], permission: null },
      ]
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Análisis': true
  });

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const location = useLocation();

  const isAllowed = (roles: string[], permission: string | null) => {
    if (permission) {
      return user.role === 'ADMIN' || (roles.includes(user.role) && (user.permissions ?? []).includes(permission));
    }
    return roles.includes(user.role);
  };

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 text-slate-700 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SUPRE <span className="text-blue-600">WMS</span></h1>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Usuario: <span className="text-slate-900 font-medium">{user.name}</span>
          <br />
          Rol: <span className="text-blue-600 font-medium">{user.role}</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-6">
        {navItems.map((item) => {
          if (!isAllowed(item.roles, item.permission)) return null;

          if (item.subItems) {
            const allowedSubItems = item.subItems.filter(sub => isAllowed(sub.roles, sub.permission));
            if (allowedSubItems.length === 0) return null;

            const isExpanded = expanded[item.name];
            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleExpand(item.name)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="pl-11 pr-3 space-y-1 pb-2">
                    {allowedSubItems.map(subItem => (
                      <NavLink
                        key={subItem.name}
                        to={subItem.path}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'block py-1.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 relative',
                            isActive 
                              ? 'text-blue-700 bg-blue-50' 
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 shadow-[2px_0_4px_rgba(37,99,235,0.4)] rounded-r-full" />}
                            {subItem.name}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Item sin hijos
          if (!item.path) return null;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-slate-50 hover:text-slate-900 text-slate-700'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
