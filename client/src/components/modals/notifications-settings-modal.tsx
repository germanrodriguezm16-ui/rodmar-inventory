import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationsSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsSettingsModal({ open, onClose }: NotificationsSettingsModalProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();

  const handleToggle = async () => {
    if (isToggling) return;

    setIsToggling(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado de las notificaciones.',
        variant: 'destructive'
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Configuración de Notificaciones
          </DialogTitle>
          <DialogDescription>
            Gestiona las notificaciones push para recibir alertas sobre transacciones pendientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Estado de soporte */}
          {!isSupported && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Notificaciones no disponibles
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Tu navegador no soporta notificaciones push o no están configuradas en el servidor.
                </p>
              </div>
            </div>
          )}

          {/* Estado de suscripción */}
          {isSupported && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {isSubscribed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <Label className="text-base font-medium">
                      Notificaciones Push
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed 
                        ? 'Recibirás notificaciones cuando se creen transacciones pendientes'
                        : 'Activa para recibir notificaciones sobre transacciones pendientes'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isToggling || isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={isSubscribed}
                      onCheckedChange={handleToggle}
                      disabled={isToggling || isLoading}
                    />
                  )}
                </div>
              </div>

              {/* Información adicional */}
              {isSubscribed && (
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Bell className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Notificaciones activadas
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Recibirás alertas cuando se creen nuevas transacciones pendientes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón de cerrar */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

