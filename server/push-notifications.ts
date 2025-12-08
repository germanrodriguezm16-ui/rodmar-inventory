import webpush from 'web-push';
import { storage } from './storage';
import type { PushSubscription } from '@shared/schema';

// Configurar web-push con VAPID keys
// Estas keys deben estar en las variables de entorno
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let vapidSubject = process.env.VAPID_SUBJECT || 'mailto:rodmar@example.com';

// Asegurar que el subject tenga el formato correcto (mailto: o https://)
if (vapidSubject && !vapidSubject.startsWith('mailto:') && !vapidSubject.startsWith('https://')) {
  // Si es solo un email, agregar mailto:
  if (vapidSubject.includes('@')) {
    vapidSubject = `mailto:${vapidSubject}`;
  } else {
    // Si no es un email ni URL, usar un valor por defecto
    vapidSubject = 'mailto:rodmar@example.com';
  }
}

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('✅ VAPID keys configuradas correctamente');
  } catch (error) {
    console.error('❌ Error configurando VAPID keys:', error);
  }
} else {
  console.warn('⚠️  VAPID keys no configuradas. Las notificaciones push no funcionarán.');
  if (!vapidPublicKey) console.warn('   - VAPID_PUBLIC_KEY faltante');
  if (!vapidPrivateKey) console.warn('   - VAPID_PRIVATE_KEY faltante');
  if (!vapidSubject) console.warn('   - VAPID_SUBJECT faltante');
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
          console.log(`📤 Enviando notificación push a suscripción ${subscription.id} (endpoint: ${subscription.endpoint.substring(0, 50)}...)`);
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
          console.log(`✅ Notificación enviada exitosamente a suscripción ${subscription.id}`);
          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          console.error(`❌ Error enviando notificación a suscripción ${subscription.id}:`, error.message, error.statusCode);
          // Si la suscripción es inválida (410 Gone), eliminarla
          if (error.statusCode === 410) {
            console.log(`🗑️  Eliminando suscripción inválida ${subscription.id}`);
            await storage.deletePushSubscription(userId, subscription.endpoint);
          }
          return { success: false, subscriptionId: subscription.id, error: error.message, statusCode: error.statusCode };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    // Log detallado de resultados
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(`✅ Suscripción ${index + 1}: Enviada exitosamente`);
        } else {
          console.error(`❌ Suscripción ${index + 1}: Falló - ${result.value.error} (Status: ${result.value.statusCode || 'N/A'})`);
        }
      } else {
        console.error(`❌ Suscripción ${index + 1}: Error - ${result.reason}`);
      }
    });

    console.log(`📱 Resumen: ${sent} exitosas, ${failed} fallidas de ${subscriptions.length} suscripciones`);
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
): Promise<{ sent: number; failed: number }> {
  const valorFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(parseFloat(transaccion.valor));

  const tipoCapitalizado = transaccion.paraQuienTipo.charAt(0).toUpperCase() + 
    transaccion.paraQuienTipo.slice(1);

  const result = await sendPushNotification(
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

  return result;
}

/**
 * Obtiene la clave pública VAPID para el frontend
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

