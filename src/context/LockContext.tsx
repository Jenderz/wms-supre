import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { LockApi } from '../services/api';
import { LockKey, LockModule, LockAction } from '../types';
import { useAuth } from './AuthContext';

// TTL del cache en milisegundos (5 minutos)
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
}

interface LockContextType {
  locks: LockKey[];
  isLocked: (module: LockModule, action: LockAction) => boolean;
  verify: (module: LockModule, action: LockAction, key: string) => Promise<boolean>;
  clearCache: (module?: LockModule, action?: LockAction) => void;
  reload: () => Promise<void>;
  isLoading: boolean;
}

const LockContext = createContext<LockContextType | null>(null);

export const LockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [locks, setLocks] = useState<LockKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Cache en memoria: clave "MODULE:ACTION" → { expiresAt }
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await LockApi.getAll();
      setLocks(data as LockKey[]);
    } catch (err) {
      // 401 al no estar autenticado → no es un error crítico, simplemente sin llaves
      setLocks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Usuario autenticado → cargar llaves
      reload();
    } else {
      // Sin sesión → limpiar llaves y cache
      setLocks([]);
      cacheRef.current.clear();
    }
  }, [user, reload]);

  /**
   * Devuelve true si hay una llave activa para el módulo+acción dados.
   * Prioridad: específica (module, action) > módulo completo (module, '*').
   */
  const isLocked = useCallback((module: LockModule, action: LockAction): boolean => {
    // Comprobar si está en cache válido (desbloqueado recientemente)
    const cacheKey = `${module}:${action}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return false; // ya verificado recientemente → no bloquear
    }

    // Buscar llave específica
    const specific = locks.find(
      l => l.module === module && l.action === action && l.isActive
    );
    if (specific) return true;

    // Buscar llave de módulo completo
    const moduleWide = locks.find(
      l => l.module === module && l.action === '*' && l.isActive
    );
    return !!moduleWide;
  }, [locks]);

  /**
   * Llama al backend para verificar la clave.
   * Si es correcta, guarda en cache por TTL_MS.
   */
  const verify = useCallback(async (
    module: LockModule,
    action: LockAction,
    key: string
  ): Promise<boolean> => {
    try {
      const res = await LockApi.verify(module, action, key);
      if (res.success) {
        const cacheKey = `${module}:${action}`;
        cacheRef.current.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  /**
   * Limpia el cache. Si se especifica module+action, limpia solo esa entrada.
   * Si no se especifica, limpia todo el cache.
   */
  const clearCache = useCallback((module?: LockModule, action?: LockAction) => {
    if (module && action) {
      cacheRef.current.delete(`${module}:${action}`);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  return (
    <LockContext.Provider value={{ locks, isLocked, verify, clearCache, reload, isLoading }}>
      {children}
    </LockContext.Provider>
  );
};

export const useLock = (): LockContextType => {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock debe usarse dentro de <LockProvider>');
  return ctx;
};
