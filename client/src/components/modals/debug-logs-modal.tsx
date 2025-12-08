import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLogger } from '@/hooks/useLogger';
import { type LogEntry, type LogLevel } from '@/lib/logger';
import { Trash2, Copy, Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DebugLogsModalProps {
  open: boolean;
  onClose: () => void;
}

const levelColors: Record<LogLevel, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  debug: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const levelIcons: Record<LogLevel, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  debug: '🔍',
};

export function DebugLogsModal({ open, onClose }: DebugLogsModalProps) {
  const { logs, clear } = useLogger();
  const { toast } = useToast();
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Obtener categorías únicas
  const categories = useMemo(() => {
    const cats = new Set(logs.map(log => log.category));
    return Array.from(cats).sort();
  }, [logs]);

  // Filtrar logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const levelMatch = filter === 'all' || log.level === filter;
      const categoryMatch = categoryFilter === 'all' || log.category === categoryFilter;
      return levelMatch && categoryMatch;
    });
  }, [logs, filter, categoryFilter]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const handleClear = () => {
    clear();
    toast({
      title: 'Logs limpiados',
      description: 'Todos los logs han sido eliminados.',
    });
  };

  const handleCopy = () => {
    const text = filteredLogs.map(log => {
      const time = formatTime(log.timestamp);
      const dataStr = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : '';
      return `[${time}] ${levelIcons[log.level]} [${log.category}] ${log.message}${dataStr}`;
    }).join('\n\n');
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Logs copiados',
        description: 'Los logs han sido copiados al portapapeles.',
      });
    }).catch(() => {
      toast({
        title: 'Error',
        description: 'No se pudieron copiar los logs.',
        variant: 'destructive',
      });
    });
  };

  const handleDownload = () => {
    const text = filteredLogs.map(log => {
      const time = formatTime(log.timestamp);
      const dataStr = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : '';
      return `[${time}] ${levelIcons[log.level]} [${log.category}] ${log.message}${dataStr}`;
    }).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rodmar-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Logs descargados',
      description: 'Los logs han sido descargados.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Logs de Depuración</span>
            <Badge variant="secondary" className="ml-2">
              {filteredLogs.length} / {logs.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Registro de eventos y errores de la aplicación. Los logs se mantienen solo en memoria para optimizar el rendimiento.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nivel:</span>
            <div className="flex gap-1">
              {(['all', 'error', 'warn', 'info', 'success', 'debug'] as const).map((level) => (
                <Button
                  key={level}
                  variant={filter === level ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(level)}
                  className="h-7 text-xs"
                >
                  {level === 'all' ? 'Todos' : level.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Categoría:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-7 px-2 text-xs border rounded-md bg-background"
              >
                <option value="all">Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>

        {/* Lista de logs */}
        <ScrollArea className="flex-1 border rounded-md p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No hay logs para mostrar
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="text-sm border-l-2 pl-3 py-2 rounded-r bg-muted/30"
                  style={{ borderLeftColor: getLevelColor(log.level) }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{levelIcons[log.level]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={levelColors[log.level]} variant="secondary">
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 break-words">{log.message}</p>
                      {log.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Ver datos
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Button onClick={onClose} className="w-full">Cerrar</Button>
      </DialogContent>
    </Dialog>
  );
}

function getLevelColor(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    info: '#3b82f6',
    warn: '#eab308',
    error: '#ef4444',
    success: '#22c55e',
    debug: '#6b7280',
  };
  return colors[level] || '#6b7280';
}
