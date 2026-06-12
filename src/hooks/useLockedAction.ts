import { useState, useCallback, useRef } from 'react';
import { useLock } from '../context/LockContext';
import { LockModule, LockAction } from '../types';

export interface UseLockedActionReturn {
  /** Ejecuta el callback si la acción está libre o ya verificada en cache.
   *  Si está bloqueada, abre el modal primero. */
  execute: (callback: () => void | Promise<void>) => void;
  /** true mientras el modal de llave está abierto */
  isLockModalOpen: boolean;
  /** Cerrar el modal manualmente */
  closeLockModal: () => void;
  /** Props para pasar al componente <LockModal> */
  lockModalProps: {
    isOpen: boolean;
    module: LockModule;
    action: LockAction;
    onVerify: (key: string) => Promise<boolean>;
    onSuccess: () => void;
    onCancel: () => void;
  };
}

/**
 * Hook que encapsula el flujo completo de acción protegida.
 *
 * Uso:
 *   const { execute, lockModalProps } = useLockedAction('CATALOG', 'DELETE');
 *   <button onClick={() => execute(() => deleteProduct(id))}>Eliminar</button>
 *   <LockModal {...lockModalProps} />
 */
export const useLockedAction = (
  module: LockModule,
  action: LockAction
): UseLockedActionReturn => {
  const { isLocked, verify } = useLock();
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  // Guardamos el callback pendiente en una ref para ejecutarlo tras verificación exitosa
  const pendingCallbackRef = useRef<(() => void | Promise<void>) | null>(null);

  const execute = useCallback((callback: () => void | Promise<void>) => {
    if (!isLocked(module, action)) {
      // Sin bloqueo o ya verificado en cache → ejecutar directo
      callback();
      return;
    }
    // Bloqueo activo → guardar callback y abrir modal
    pendingCallbackRef.current = callback;
    setIsLockModalOpen(true);
  }, [isLocked, module, action]);

  const handleVerify = useCallback(async (key: string): Promise<boolean> => {
    return await verify(module, action, key);
  }, [verify, module, action]);

  const handleSuccess = useCallback(() => {
    setIsLockModalOpen(false);
    if (pendingCallbackRef.current) {
      pendingCallbackRef.current();
      pendingCallbackRef.current = null;
    }
  }, []);

  const closeLockModal = useCallback(() => {
    setIsLockModalOpen(false);
    pendingCallbackRef.current = null;
  }, []);

  return {
    execute,
    isLockModalOpen,
    closeLockModal,
    lockModalProps: {
      isOpen: isLockModalOpen,
      module,
      action,
      onVerify: handleVerify,
      onSuccess: handleSuccess,
      onCancel: closeLockModal,
    },
  };
};
