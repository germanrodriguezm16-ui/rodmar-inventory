import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Verificar soporte y obtener VAPID public key
  useEffect(() => {
    const checkSupport = async () => {
      if (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      ) {
        setIsSupported(true);
        
        // Obtener VAPID public key del servidor
        try {
          const response = await fetch(apiUrl('/api/push/vapid-public-key'), {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            setVapidPublicKey(data.publicKey);
          } else {
            console.warn('⚠️  VAPID public key no disponible');
          }
        } catch (error) {
          console.error('Error obteniendo VAPID public key:', error);
        }
      } else {
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  // Verificar si ya está suscrito
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported || !vapidPublicKey) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error verificando suscripción:', error);
      }
    };

    checkSubscription();
  }, [isSupported, vapidPublicKey]);

  // Solicitar permisos y suscribirse
  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidPublicKey) {
      toast({
        title: 'Notificaciones no disponibles',
        description: 'Tu navegador no soporta notificaciones push o no están configuradas.',
        variant: 'destructive'
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Solicitar permiso
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: 'Permisos denegados',
          description: 'Se necesitan permisos para enviar notificaciones.',
          variant: 'destructive'
        });
        setIsLoading(false);
        return false;
      }

      // Registrar service worker si no está registrado
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Suscribirse a push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Enviar suscripción al servidor
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      const response = await fetch(apiUrl('/api/push/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ subscription: subscriptionData })
      });

      if (!response.ok) {
        throw new Error('Error al registrar suscripción');
      }

      setIsSubscribed(true);
      toast({
        title: 'Notificaciones activadas',
        description: 'Recibirás notificaciones cuando se creen transacciones pendientes.'
      });

      return true;
    } catch (error) {
      console.error('Error suscribiéndose a push:', error);
      toast({
        title: 'Error',
        description: 'No se pudo activar las notificaciones. Intenta de nuevo.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, toast]);

  // Desuscribirse
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Eliminar del servidor
        await fetch(apiUrl('/api/push/unsubscribe'), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });

        // Desuscribirse localmente
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast({
        title: 'Notificaciones desactivadas',
        description: 'Ya no recibirás notificaciones push.'
      });

      return true;
    } catch (error) {
      console.error('Error desuscribiéndose de push:', error);
      toast({
        title: 'Error',
        description: 'No se pudo desactivar las notificaciones.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe
  };
}

// Utilidades para convertir entre formatos
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

