// RodMar PWA Service Worker
// Versión optimizada para PWABuilder y tiendas de aplicaciones

const CACHE_NAME = 'rodmar-pwa-v3.0.0';
const STATIC_CACHE = 'rodmar-static-v3.0.0';
const DYNAMIC_CACHE = 'rodmar-dynamic-v3.0.0';

// Recursos críticos para funcionamiento offline
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/rodmar-final-192-1751393827453.png',
  '/rodmar-final-512-1751393827453.png',
  '/rodmar-white-192-1751394032734.png',
  '/rodmar-white-512-1751394032734.png'
];

// Patrones de API para cache offline
const API_PATTERNS = [
  '/api/viajes',
  '/api/minas', 
  '/api/compradores',
  '/api/volqueteros',
  '/api/transacciones'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('RodMar PWA: Installing Service Worker v3.0.0');
  event.waitUntil(
    Promise.all([
      // Cache de recursos estáticos
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('RodMar PWA: Caching core assets for offline use');
        return cache.addAll(CORE_ASSETS);
      }),
      // Preparar cache dinámico
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('RodMar PWA: Dynamic cache initialized');
        return Promise.resolve();
      })
    ]).then(() => {
      console.log('RodMar PWA: Installation complete, skipping waiting');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('RodMar PWA: Installation failed:', error);
    })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('RodMar PWA: Activating Service Worker');
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('RodMar PWA: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar control de todas las páginas
      self.clients.claim()
    ]).then(() => {
      console.log('RodMar PWA: Service Worker activated and ready');
    })
  );
});

// Manejo de peticiones con estrategias avanzadas
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar peticiones GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Estrategia según tipo de recurso
  if (url.pathname.startsWith('/api/')) {
    // APIs: Network first con fallback a cache
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname === '/manifest.json' || url.pathname.includes('rodmar-')) {
    // Manifest e iconos: No cache para actualizaciones
    event.respondWith(handleManifestRequest(request));
  } else if (CORE_ASSETS.includes(url.pathname)) {
    // Recursos core: Cache first
    event.respondWith(handleCoreAssetRequest(request));
  } else {
    // Otros recursos: Stale while revalidate
    event.respondWith(handleGeneralRequest(request));
  }
});

// Network first para APIs con fallback offline
async function handleApiRequest(request) {
  try {
    console.log('RodMar PWA: Fetching API data from network');
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Guardar respuesta exitosa en cache
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('RodMar PWA: Network failed, serving from cache');
    
    // Intentar servir desde cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Respuesta offline para APIs
    return new Response(
      JSON.stringify({
        offline: true,
        error: 'Sin conexión',
        message: 'Los datos mostrados pueden estar desactualizados',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}

// No cache para manifest e iconos (fuerza actualización)
async function handleManifestRequest(request) {
  try {
    console.log('RodMar PWA: Fetching manifest/icons without cache');
    return await fetch(request, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('RodMar PWA: Failed to fetch manifest/icon:', error);
    // Fallback a cache si existe
    const cached = await caches.match(request);
    return cached || new Response('', { status: 404 });
  }
}

// Cache first para recursos core
async function handleCoreAssetRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('RodMar PWA: Serving core asset from cache');
    return cached;
  }
  
  try {
    console.log('RodMar PWA: Caching core asset from network');
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('RodMar PWA: Failed to fetch core asset:', error);
    throw error;
  }
}

// Stale while revalidate para recursos generales
async function handleGeneralRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  // Actualizar en background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.log('RodMar PWA: Network failed for general request');
    return null;
  });
  
  // Servir desde cache si está disponible
  if (cached) {
    console.log('RodMar PWA: Serving from cache, updating in background');
    return cached;
  }
  
  // Si no hay cache, esperar a la red
  console.log('RodMar PWA: No cache available, waiting for network');
  const networkResponse = await fetchPromise;
  return networkResponse || new Response('Offline', { status: 503 });
}

// Background sync para sincronización offline completa
self.addEventListener('sync', (event) => {
  console.log('RodMar PWA: Background sync triggered:', event.tag);
  
  if (event.tag === 'rodmar-data-sync') {
    event.waitUntil(syncOfflineData());
  } else if (event.tag === 'rodmar-user-actions-sync') {
    event.waitUntil(syncUserActions());
  }
});

// Sincronizar datos offline cuando se restaure la conexión
async function syncOfflineData() {
  try {
    console.log('RodMar PWA: Syncing offline data');
    const cache = await caches.open(DYNAMIC_CACHE);
    
    // Actualizar datos de APIs principales
    for (const pattern of API_PATTERNS) {
      try {
        const response = await fetch(pattern);
        if (response.ok) {
          await cache.put(pattern, response.clone());
          console.log('RodMar PWA: Synced', pattern);
        }
      } catch (error) {
        console.log('RodMar PWA: Sync failed for', pattern);
      }
    }
    
    // Notificar a clientes sobre sincronización
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'DATA_SYNCED',
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('RodMar PWA: Sync error:', error);
  }
}

// Sincronizar acciones del usuario realizadas offline
async function syncUserActions() {
  try {
    console.log('RodMar PWA: Syncing user actions performed offline');
    
    // Obtener acciones pendientes del IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        if (response.ok) {
          await removePendingAction(action.id);
          console.log('RodMar PWA: User action synced successfully');
        }
      } catch (error) {
        console.log('RodMar PWA: Failed to sync user action:', error);
      }
    }
    
    // Notificar a clientes sobre sincronización de acciones
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'USER_ACTIONS_SYNCED',
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('RodMar PWA: User actions sync error:', error);
  }
}

// Funciones auxiliares para manejo de acciones offline
async function getPendingActions() {
  // Implementación simplificada - en una app real usarías IndexedDB
  return [];
}

async function removePendingAction(actionId) {
  // Implementación simplificada - en una app real usarías IndexedDB
  console.log('RodMar PWA: Removing pending action:', actionId);
}

// Función helper para enviar logs al cliente
function sendLogToClient(level, category, message, data) {
  try {
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({
            type: 'LOG',
            level: level,
            category: category,
            message: message,
            data: data,
            timestamp: Date.now()
          });
        }
      });
    });
  } catch (e) {
    // Ignorar errores al enviar logs
  }
}

// Función helper para loggear y enviar al cliente
function logAndSend(level, category, message, data) {
  const emoji = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  }[level] || 'ℹ️';
  console.log(`${emoji} [${category}] ${message}`, data || '');
  sendLogToClient(level, category, message, data);
}

// Notificaciones push
self.addEventListener('push', (event) => {
  logAndSend('info', 'SERVICE_WORKER', 'Push notification received', { hasData: !!event.data });
  
  let notificationData = {
    title: 'RodMar Notification',
    body: 'Nueva notificación',
    icon: '/rodmar-circular-192.png',
    badge: '/rodmar-circular-192.png',
    data: {},
    vibrate: [200, 100, 200],
    tag: 'rodmar-notification',
    requireInteraction: false
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || notificationData.data,
        vibrate: payload.vibrate || notificationData.vibrate,
        tag: payload.tag || notificationData.tag,
        requireInteraction: payload.requireInteraction || notificationData.requireInteraction,
        actions: payload.actions || [
          {
            action: 'open',
            title: 'Abrir RodMar'
          }
        ]
      };
    } catch (e) {
      // Si no es JSON, usar como texto
      notificationData.body = event.data.text();
    }
  }
  
  sendLogToClient('info', 'SERVICE_WORKER', 'Mostrando notificación push', {
    title: notificationData.title,
    body: notificationData.body,
    hasData: !!notificationData.data,
    data: notificationData.data
  });
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData).then(() => {
      sendLogToClient('info', 'SERVICE_WORKER', 'Notificación mostrada exitosamente', {
        title: notificationData.title
      });
    }).catch((error) => {
      sendLogToClient('error', 'SERVICE_WORKER', 'Error mostrando notificación', {
        error: error.message
      });
    })
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  logAndSend('info', 'SERVICE_WORKER', 'Notification clicked event fired', {
    title: event.notification.title,
    body: event.notification.body,
    hasData: !!event.notification.data,
    data: event.notification.data
  });
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  
  let urlToOpen = '/';
  
  // Si hay una URL específica en los datos, usarla
  if (notificationData.url) {
    urlToOpen = notificationData.url;
    logAndSend('info', 'SERVICE_WORKER', 'Usando URL de notificationData', { url: urlToOpen });
  } else if (notificationData.type === 'pending-transaction') {
    // Si es una notificación de transacción pendiente, abrir la lista de pendientes
    const transactionId = notificationData.transaccionId;
    logAndSend('info', 'SERVICE_WORKER', 'Tipo: pending-transaction', { transactionId });
    if (transactionId) {
      urlToOpen = `/transacciones?pending=true&id=${transactionId}`;
    } else {
      urlToOpen = '/transacciones?pending=true';
    }
  }
  
  // Construir URL absoluta
  const absoluteUrl = new URL(urlToOpen, self.location.origin).href;
  
  // Guardar datos de navegación
  const navData = {
    url: urlToOpen,
    timestamp: Date.now(),
    notificationData: notificationData,
    // Asegurar que el transaccionId esté disponible directamente
    transaccionId: notificationData.transaccionId || notificationData.id || (urlToOpen.match(/[?&]id=(\d+)/)?.[1])
  };
  
  logAndSend('info', 'SERVICE_WORKER', 'Notification clicked, procesando navegación', {
    url: urlToOpen,
    transactionId: navData.transaccionId,
    navData: navData
  });
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      logAndSend('info', 'SERVICE_WORKER', `Clientes encontrados: ${clientList.length}`, { 
        count: clientList.length,
        clients: clientList.map(c => ({ url: c.url, focused: c.focused }))
      });
      
      // Buscar si ya hay una ventana abierta
      let clientFound = false;
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          logAndSend('info', 'SERVICE_WORKER', 'Cliente encontrado, enviando mensaje', { url: client.url });
          clientFound = true;
          
          // Enviar mensaje al cliente con todos los datos
          const messageData = {
            type: 'NAVIGATE',
            url: urlToOpen,
            absoluteUrl: absoluteUrl,
            notificationData: notificationData,
            transaccionId: navData.transaccionId,
            timestamp: navData.timestamp,
            navData: navData
          };
          
          logAndSend('info', 'SERVICE_WORKER', 'Enviando mensaje NAVIGATE al cliente', messageData);
          client.postMessage(messageData);
          logAndSend('success', 'SERVICE_WORKER', 'Mensaje enviado, enfocando cliente');
          return client.focus();
        }
      }
      
      // Si no hay ventana abierta, abrir una nueva
      if (!clientFound) {
        logAndSend('info', 'SERVICE_WORKER', 'No hay cliente abierto, abriendo nueva ventana');
        if (clients.openWindow) {
          // Siempre abrir solo la ruta base para evitar 404
          const baseUrl = new URL('/', self.location.origin).href;
          logAndSend('info', 'SERVICE_WORKER', 'Abriendo URL base', { baseUrl });
          
          // Guardar datos en IndexedDB para que la app los lea al cargar
          return saveNotificationDataToIndexedDB(navData).then(() => {
            logAndSend('success', 'SERVICE_WORKER', 'Datos guardados en IndexedDB', { transactionId: navData.transaccionId });
            return clients.openWindow(baseUrl).then((windowClient) => {
              logAndSend('info', 'SERVICE_WORKER', `Nueva ventana abierta: ${windowClient ? 'Sí' : 'No'}`, { hasWindowClient: !!windowClient });
              if (windowClient) {
                // Esperar un momento para que la página cargue y luego enviar el mensaje
                setTimeout(() => {
                  const messageData = {
                    type: 'NAVIGATE',
                    url: urlToOpen,
                    absoluteUrl: absoluteUrl,
                    notificationData: notificationData,
                    transaccionId: navData.transaccionId,
                    timestamp: navData.timestamp,
                    navData: navData
                  };
                  logAndSend('info', 'SERVICE_WORKER', 'Enviando mensaje a nueva ventana', messageData);
                  windowClient.postMessage(messageData);
                }, 1500);
              }
            });
          }).catch((error) => {
            logAndSend('error', 'SERVICE_WORKER', 'Error abriendo ventana', { error: error.message });
            // Fallback: intentar abrir sin guardar en IndexedDB
            return clients.openWindow(baseUrl);
          });
        } else {
          logAndSend('error', 'SERVICE_WORKER', 'clients.openWindow no está disponible');
        }
      }
    }).catch((error) => {
      logAndSend('error', 'SERVICE_WORKER', 'Error en notificationclick', { error: error.message });
    })
  );
});

// Evento de instalación de la PWA
self.addEventListener('beforeinstallprompt', (event) => {
  console.log('RodMar PWA: Install prompt available');
  // El evento se manejará en la aplicación principal
});

// Confirmación de instalación de la PWA
self.addEventListener('appinstalled', (event) => {
  console.log('RodMar PWA: App successfully installed');
  
  // Notificar a la aplicación sobre la instalación
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'APP_INSTALLED',
        timestamp: new Date().toISOString()
      });
    });
  });
});

// Función para guardar datos de notificación en IndexedDB
function saveNotificationDataToIndexedDB(navData) {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('rodmar_notifications', 1);
      
      request.onerror = () => {
        sendLogToClient('warn', 'SERVICE_WORKER', 'Error abriendo IndexedDB, usando fallback');
        // Fallback: intentar usar sessionStorage a través de un mensaje
        resolve();
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['notifications'], 'readwrite');
        const store = transaction.objectStore('notifications');
        
        const data = {
          id: 'latest',
          ...navData,
          timestamp: Date.now()
        };
        
        store.put(data);
        transaction.oncomplete = () => {
          sendLogToClient('debug', 'SERVICE_WORKER', 'Datos guardados en IndexedDB', { transactionId: navData.transaccionId });
          resolve();
        };
        transaction.onerror = () => {
          sendLogToClient('warn', 'SERVICE_WORKER', 'Error guardando en IndexedDB');
          resolve(); // Continuar aunque falle
        };
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: 'id' });
        }
      };
    } catch (error) {
      sendLogToClient('warn', 'SERVICE_WORKER', 'Error con IndexedDB', { error: error.message });
      resolve(); // Continuar aunque falle
    }
  });
}

console.log('RodMar PWA: Service Worker v3.0.0 loaded successfully');