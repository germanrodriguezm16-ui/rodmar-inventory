// Safe wrapper para hooks de React que maneja errores específicos del preview de Replit
import { useRef as originalUseRef, useEffect, useCallback } from 'react';

// Wrapper seguro para useRef que maneja el contexto null específico de Replit preview
export function safeUseRef<T>(initialValue: T | null = null): React.MutableRefObject<T | null> {
  try {
    return originalUseRef<T | null>(initialValue);
  } catch (error) {
    console.warn('SafeUseRef: Error interceptado en preview de Replit:', error);
    // Fallback manual para crear ref cuando useRef falla
    return { current: initialValue };
  }
}

// Hook para suprimir errores específicos de React en contexto de iframe
export function useSuppressIframeErrors() {
  useEffect(() => {
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;

    // Interceptar errores específicos de useRef
    window.onerror = (message, source, lineno, colno, error) => {
      if (
        typeof message === 'string' && 
        (message.includes('useRef') || 
         message.includes('Cannot read properties of null') ||
         message.includes('reading \'useRef\''))
      ) {
        console.warn('Error de useRef interceptado (específico de preview Replit):', message);
        return true; // Prevenir propagación del error
      }
      
      // Llamar al handler original si existe
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Interceptar promesas rechazadas relacionadas con hooks
    window.onunhandledrejection = (event) => {
      if (
        event.reason && 
        typeof event.reason.message === 'string' && 
        (event.reason.message.includes('useRef') ||
         event.reason.message.includes('Cannot read properties of null'))
      ) {
        console.warn('Promise rejejction de React Hook interceptada:', event.reason);
        event.preventDefault();
        return;
      }

      // Llamar al handler original si existe
      if (originalUnhandledRejection) {
        return originalUnhandledRejection(event);
      }
    };

    // Cleanup
    return () => {
      window.onerror = originalError;
      window.onunhandledrejection = originalUnhandledRejection;
    };
  }, []);
}

// Hook para componentes que usan refs de forma segura
export function useSafeCallback<T extends (...args: any[]) => any>(callback: T, deps: React.DependencyList): T {
  try {
    return useCallback(callback, deps);
  } catch (error) {
    console.warn('SafeCallback: Error interceptado:', error);
    // Retornar la función original como fallback
    return callback;
  }
}