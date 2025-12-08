import webpush from 'web-push';
import { storage } from './storage';
import type { PushSubscription } from '@shared/schema';

// Configurar web-push con VAPID keys
// Estas keys deben estar en las variables de entorno
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:rodmar@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('⚠️  VAPID keys no configuradas. Las notificaciones push no funcionarán.');
}

/**
 * Envía una notificación push a todos los dispositivos suscritos de un usuario
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('⚠️  No se pueden enviar notificaciones: VAPID keys no configuradas');
    return { sent: 0, failed: 0 };
  }

  try {
    const subscriptions = await storage.getPushSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`📱 No hay suscripciones push para el usuario ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/rodmar-circular-192.png',
      badge: '/rodmar-circular-192.png',
      data: data || {},
      vibrate: [200, 100, 200],
      tag: 'rodmar-notification',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Abrir RodMar'
        }
      ]
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            payload
          );
          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          // Si la suscripción es inválida (410 Gone), eliminarla
          if (error.statusCode === 410) {
            console.log(`🗑️  Eliminando suscripción inválida ${subscription.id}`);
            await storage.deletePushSubscription(userId, subscription.endpoint);
          }
          return { success: false, subscriptionId: subscription.id, error: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    console.log(`📱 Notificación enviada: ${sent} exitosas, ${failed} fallidas`);
    return { sent, failed };
  } catch (error) {
    console.error('❌ Error al enviar notificaciones push:', error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Envía notificación cuando se crea una nueva transacción pendiente
 */
export async function notifyPendingTransaction(
  userId: string,
  transaccion: {
    id: number;
    paraQuienTipo: string;
    paraQuienNombre: string;
    valor: string;
    codigoSolicitud?: string;
  }
): Promise<void> {
  const valorFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(parseFloat(transaccion.valor));

  const tipoCapitalizado = transaccion.paraQuienTipo.charAt(0).toUpperCase() + 
    transaccion.paraQuienTipo.slice(1);

  await sendPushNotification(
    userId,
    'Nueva transacción pendiente',
    `${tipoCapitalizado} ${transaccion.paraQuienNombre} – ${valorFormateado}`,
    {
      type: 'pending-transaction',
      transaccionId: transaccion.id,
      codigoSolicitud: transaccion.codigoSolicitud,
      url: '/transacciones?pending=true'
    }
  );
}

/**
 * Obtiene la clave pública VAPID para el frontend
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

