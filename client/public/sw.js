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

// Notificaciones push
self.addEventListener('push', (event) => {
  console.log('RodMar PWA: Push notification received');
  
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
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('RodMar PWA: Notification clicked', event.notification.data);
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  let urlToOpen = '/';
  
  // Si hay una URL específica en los datos, usarla
  if (notificationData.url) {
    urlToOpen = notificationData.url;
  } else if (notificationData.type === 'pending-transaction') {
    // Si es una notificación de transacción pendiente, abrir la lista de pendientes
    urlToOpen = '/transacciones?pending=true';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Buscar si ya hay una ventana abierta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(urlToOpen).then(() => client.focus());
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
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

console.log('RodMar PWA: Service Worker v3.0.0 loaded successfully');