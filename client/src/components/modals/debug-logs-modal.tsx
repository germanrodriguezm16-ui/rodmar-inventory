import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDebugLogger } from '@/hooks/useDebugLogger';
import { Bug, Trash2, Play, Square, Copy, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DebugLogsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DebugLogsModal({ open, onClose }: DebugLogsModalProps) {
  const { logs, isActive, startLogging, stopLogging, clearLogs } = useDebugLogger();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      startLogging();
    } else {
      stopLogging();
    }
  }, [open, startLogging, stopLogging]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warn': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  const copyLogs = async () => {
    try {
      const logsText = logs.map(log => {
        const time = formatTime(log.timestamp);
        const level = log.level.toUpperCase();
        return `[${time}] ${level} ${log.message}${log.data ? '\n  Data: ' + JSON.stringify(log.data, null, 2) : ''}`;
      }).join('\n\n');
      
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      toast({
        title: 'Logs copiados',
        description: 'Los logs se han copiado al portapapeles.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron copiar los logs.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-w-[90vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-blue-600" />
            Logs de Depuración
            {isActive && <span className="ml-2 text-xs text-green-600">● Activo</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 px-6 pb-4 shrink-0">
          {!isActive ? (
            <Button onClick={startLogging} size="sm" variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          ) : (
            <Button onClick={stopLogging} size="sm" variant="outline">
              <Square className="h-4 w-4 mr-2" />
              Detener
            </Button>
          )}
          <Button onClick={clearLogs} size="sm" variant="outline">
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {logs.length} logs
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden border-t border-b">
          <div className="h-full overflow-y-auto p-4 bg-muted/30 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No hay logs. Activa el logging para comenzar.
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2 items-start break-words">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">{formatTime(log.timestamp)}</span>
                    <span className={`shrink-0 w-12 ${getLevelColor(log.level)}`}>{log.level}</span>
                    <span className="flex-1 break-words overflow-wrap-anywhere">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 shrink-0 flex gap-2">
          <Button onClick={copyLogs} variant="outline" size="icon" title="Copiar logs">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button onClick={onClose} className="flex-1">Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
