/**
 * Sistema de logging eficiente para depuración
 * - Solo guarda los últimos 100 logs en memoria
 * - No afecta el rendimiento de la app
 * - Buffer circular para eficiencia
 */

// Importar el debug logger para integración
let debugLoggerInstance: any = null;

export function setDebugLoggerInstance(instance: any) {
  debugLoggerInstance = instance;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Solo mantener los últimos 100 logs
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  /**
   * Agregar un log
   */
  log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data) : undefined
    };

    // Agregar al inicio del array
    this.logs.unshift(entry);

    // Mantener solo los últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notificar a los listeners (solo si hay alguien escuchando)
    if (this.listeners.size > 0) {
      this.notifyListeners();
    }

    // También loggear en consola (siempre, no solo en desarrollo)
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    
    // Agregar emojis para que el debug logger los capture
    const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : level === 'debug' ? '🔍' : '📱';
    const logMessage = `${emoji} [${category}] ${message}`;
    console[consoleMethod](logMessage, data || '');
    
    // También enviar directamente al debug logger si está disponible
    if (debugLoggerInstance && debugLoggerInstance.addManualLog) {
      try {
        debugLoggerInstance.addManualLog(level === 'success' ? 'info' : level, logMessage, data);
      } catch (e) {
        // Ignorar errores si el debug logger no está listo
      }
    }
  }

  /**
   * Log de información
   */
  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  /**
   * Log de advertencia
   */
  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  /**
   * Log de error
   */
  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  /**
   * Log de debug
   */
  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  /**
   * Log de éxito
   */
  success(category: string, message: string, data?: any): void {
    this.log('success', category, message, data);
  }

  /**
   * Obtener todos los logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Limpiar todos los logs
   */
  clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  /**
   * Suscribirse a cambios en los logs
   */
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(callback);
    // Notificar inmediatamente con los logs actuales
    callback(this.getLogs());
    
    // Retornar función de desuscripción
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notificar a todos los listeners
   */
  private notifyListeners(): void {
    const logs = this.getLogs();
    this.listeners.forEach(callback => {
      try {
        callback(logs);
      } catch (error) {
        console.error('Error en listener de logs:', error);
      }
    });
  }

  /**
   * Obtener logs filtrados por categoría
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Obtener logs filtrados por nivel
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

// Instancia singleton
export const logger = new Logger();

