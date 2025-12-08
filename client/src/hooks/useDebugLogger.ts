import { useState, useCallback, useRef, useEffect } from 'react';

export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
  source?: string;
}

const MAX_LOGS = 100; // Solo mantener los últimos 100 logs
const LOG_PATTERNS = [
  /^🔔/, /^📱/, /^📨/, /^📤/, /^💾/, /^🔍/, /^🔎/, /^📋/, /^✅/, /^⚠️/, /^❌/,
  /^📬/, /^⏳/, /^RodMar PWA:/, /^Service Worker:/, /^Detección de notificación:/
];

class DebugLogger {
  private logs: DebugLog[] = [];
  private listeners: Set<(logs: DebugLog[]) => void> = new Set();
  private originalConsoleLog: typeof console.log;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleError: typeof console.error;
  private isIntercepting = false;

  constructor() {
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.originalConsoleError = console.error.bind(console);
  }

  private shouldLog(message: string): boolean {
    // Solo interceptar logs que coincidan con nuestros patrones
    return LOG_PATTERNS.some(pattern => pattern.test(message));
  }

  private addLog(level: DebugLog['level'], message: string, data?: any, source?: string) {
    const log: DebugLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      data,
      source
    };

    this.logs.push(log);
    
    // Mantener solo los últimos MAX_LOGS
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }

    // Notificar a los listeners
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  startIntercepting() {
    if (this.isIntercepting) return;
    this.isIntercepting = true;

    // Interceptar console.log
    console.log = (...args: any[]) => {
      this.originalConsoleLog(...args);
      const message = args[0]?.toString() || '';
      if (this.shouldLog(message)) {
        this.addLog('info', message, args.slice(1), 'console.log');
      }
    };

    // Interceptar console.warn
    console.warn = (...args: any[]) => {
      this.originalConsoleWarn(...args);
      const message = args[0]?.toString() || '';
      if (this.shouldLog(message)) {
        this.addLog('warn', message, args.slice(1), 'console.warn');
      }
    };

    // Interceptar console.error
    console.error = (...args: any[]) => {
      this.originalConsoleError(...args);
      const message = args[0]?.toString() || '';
      if (this.shouldLog(message)) {
        this.addLog('error', message, args.slice(1), 'console.error');
      }
    };
  }

  stopIntercepting() {
    if (!this.isIntercepting) return;
    this.isIntercepting = false;

    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
  }

  subscribe(listener: (logs: DebugLog[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLogs(): DebugLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
  }

  addManualLog(level: DebugLog['level'], message: string, data?: any) {
    this.addLog(level, message, data, 'manual');
  }
}

// Singleton instance
const debugLogger = new DebugLogger();

export function useDebugLogger() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const startLogging = useCallback(() => {
    if (!isActiveRef.current) {
      setIsActive(true);
      debugLogger.startIntercepting();
      setLogs(debugLogger.getLogs());
    }
  }, []);

  const stopLogging = useCallback(() => {
    if (isActiveRef.current) {
      setIsActive(false);
      debugLogger.stopIntercepting();
    }
  }, []);

  const clearLogs = useCallback(() => {
    debugLogger.clearLogs();
    setLogs([]);
  }, []);

  useEffect(() => {
    if (isActive) {
      const unsubscribe = debugLogger.subscribe((newLogs) => {
        setLogs(newLogs);
      });
      return unsubscribe;
    }
  }, [isActive]);

  return {
    logs,
    isActive,
    startLogging,
    stopLogging,
    clearLogs,
    addManualLog: debugLogger.addManualLog.bind(debugLogger)
  };
}

