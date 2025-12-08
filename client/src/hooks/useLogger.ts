import { useState, useCallback, useEffect } from 'react';
import { logger as baseLogger, type LogEntry, type LogLevel } from '@/lib/logger';

// Extender el tipo LogLevel para incluir 'success'
export type ExtendedLogLevel = LogLevel | 'success';

// Wrapper para el logger existente que agrega soporte para 'success'
export function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>(baseLogger.getLogs());

  useEffect(() => {
    const unsubscribe = baseLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  const log = useCallback((
    level: ExtendedLogLevel,
    category: string,
    message: string,
    data?: any
  ) => {
    // Convertir 'success' a 'info' para el logger base
    const baseLevel = level === 'success' ? 'info' : level;
    baseLogger.log(baseLevel, category, message, data);
  }, []);

  const clear = useCallback(() => {
    baseLogger.clear();
  }, []);

  return {
    logs,
    log,
    clear,
    info: (category: string, message: string, data?: any) => baseLogger.info(category, message, data),
    warn: (category: string, message: string, data?: any) => baseLogger.warn(category, message, data),
    error: (category: string, message: string, data?: any) => baseLogger.error(category, message, data),
    success: (category: string, message: string, data?: any) => baseLogger.info(category, message, data), // success como info
  };
}

// Re-exportar el logger existente
export { logger } from '@/lib/logger';
export type { LogEntry, LogLevel } from '@/lib/logger';

