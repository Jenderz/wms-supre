import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  ArrowRightLeft,
  BarChart3,
  Settings as SettingsIcon
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

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navSections = [
    {
      title: 'Análisis',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'COMPRAS', 'DEPOSITO', 'DESINCORPORACION'] },
        { name: 'Estadísticas', path: '/statistics', icon: BarChart3, roles: ['ADMIN'] },
      ]
    },
    {
      title: 'Operaciones',
      items: [
        { name: 'Abastecimiento', path: '/purchasing', icon: ShoppingCart, roles: ['ADMIN', 'COMPRAS'] },
        { name: 'Depósito (Recepción)', path: '/warehouse', icon: Warehouse, roles: ['ADMIN', 'DEPOSITO'] },
        { name: 'Desincorporación', path: '/disincorporation', icon: Trash2, roles: ['ADMIN', 'DESINCORPORACION'] },
      ]
    },
    {
      title: 'Catálogos',
      items: [
        { name: 'Productos', path: '/catalog', icon: Package, roles: ['ADMIN', 'COMPRAS'] },
        { name: 'Categorías', path: '/categories', icon: Tags, roles: ['ADMIN', 'COMPRAS'] },
        { name: 'Tiendas', path: '/infrastructure', icon: Building2, roles: ['ADMIN', 'DEPOSITO', 'COMPRAS'] },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { name: 'Configuración', path: '/settings', icon: SettingsIcon, roles: ['ADMIN'] },
      ]
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
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

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-6">
        {navSections.map((section) => {
          const allowedItems = section.items.filter(item => item.roles.includes(user.role));
          if (allowedItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {allowedItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                        isActive 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'hover:bg-slate-50 hover:text-slate-900'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
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
