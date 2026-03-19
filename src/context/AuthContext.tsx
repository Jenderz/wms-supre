import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { AuthApi, TokenService } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión desde localStorage si hay token guardado
    const stored = localStorage.getItem('supre_wms_user');
    if (stored && TokenService.get()) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('supre_wms_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await AuthApi.login(username, password) as { token: string; user: User };
      TokenService.save(response.token);
      localStorage.setItem('supre_wms_user', JSON.stringify(response.user));
      setUser(response.user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    TokenService.remove();
    localStorage.removeItem('supre_wms_user');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
