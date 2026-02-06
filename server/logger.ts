/**
 * Logger centralizado para el backend
 * - Solo muestra logs en desarrollo (NODE_ENV !== 'production')
 * - Los errores siempre se muestran (importantes para producción)
 */

const isDev = process.env.NODE_ENV !== "production";

class ServerLogger {
  /**
   * Log de información (solo en desarrollo)
   */
  log(...args: any[]): void {
    if (isDev) {
      console.log(...args);
    }
  }

  /**
   * Log de información (solo en desarrollo)
   */
  info(...args: any[]): void {
    if (isDev) {
      console.log(...args);
    }
  }

  /**
   * Log de debug (solo en desarrollo)
   */
  debug(...args: any[]): void {
    if (isDev) {
      console.log(...args);
    }
  }

  /**
   * Log de advertencia (solo en desarrollo)
   */
  warn(...args: any[]): void {
    if (isDev) {
      console.warn(...args);
    }
  }

  /**
   * Log de error (SIEMPRE se muestra, incluso en producción)
   */
  error(...args: any[]): void {
    console.error(...args);
  }

  /**
   * Log condicional basado en flag de debug
   */
  debugIf(condition: boolean, ...args: any[]): void {
    if (condition && isDev) {
      console.log(...args);
    }
  }
}

export const logger = new ServerLogger();
