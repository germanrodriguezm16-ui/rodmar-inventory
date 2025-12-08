import { useState, lazy, Suspense, useEffect } from "react";
import AppHeader from "@/components/layout/app-header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Principal from "@/components/modules/principal";
import { useLocation } from "wouter";
import { logger } from "@/lib/logger";

// Lazy loading de componentes pesados
const Minas = lazy(() => import("@/pages/minas"));
const Compradores = lazy(() => import("@/pages/compradores"));
const Volqueteros = lazy(() => import("@/pages/volqueteros"));
const Transacciones = lazy(() => import("@/pages/transacciones"));
const RodMar = lazy(() => import("@/components/modules/rodmar"));
import RegisterCargueModal from "@/components/forms/register-cargue-modal";
import RegisterDescargueModal from "@/components/forms/register-descargue-modal";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import { PendingListModal } from "@/components/pending-transactions/pending-list-modal";
import { PendingDetailModal } from "@/components/pending-transactions/pending-detail-modal";
import { GestionarTransaccionesModal } from "@/components/modals/gestionar-transacciones-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";

type Module = "principal" | "minas" | "compradores" | "volqueteros" | "transacciones" | "rodmar";

interface DashboardProps {
  initialModule?: Module;
}

export default function Dashboard({ initialModule = "principal" }: DashboardProps) {
  const [activeModule, setActiveModule] = useState<Module>(initialModule);
  const [showCargueModal, setShowCargueModal] = useState(false);
  const [showDescargueModal, setShowDescargueModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showPendingDetailModal, setShowPendingDetailModal] = useState(false);
  const [selectedPendingTransaction, setSelectedPendingTransaction] = useState<any>(null);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [location, setLocation] = useLocation();

  // Log inicial del sistema
  useEffect(() => {
    logger.info('SYSTEM', 'Dashboard cargado', { initialModule, timestamp: Date.now() });
  }, []);

  // Consultar el conteo de transacciones pendientes
  const { data: pendingCount = 0 } = useQuery<number>({
    queryKey: ["/api/transacciones/pendientes/count"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/transacciones/pendientes/count"), {
        credentials: "include",
      });
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const hasPending = pendingCount > 0;

  // Obtener lista de transacciones pendientes para buscar por ID
  const { data: pendientes = [] } = useQuery<any[]>({
    queryKey: ["/api/transacciones/pendientes"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/transacciones/pendientes"), {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Detectar query params o datos de notificación para abrir modal de pendientes
  useEffect(() => {
    // Función para leer de IndexedDB
    const readFromIndexedDB = (): Promise<any> => {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.open('rodmar_notifications', 1);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['notifications'], 'readonly');
            const store = transaction.objectStore('notifications');
            const getRequest = store.get('latest');
            
            getRequest.onsuccess = () => {
              const data = getRequest.result;
              if (data) {
                // Eliminar después de leer
                const deleteTransaction = db.transaction(['notifications'], 'readwrite');
                const deleteStore = deleteTransaction.objectStore('notifications');
                deleteStore.delete('latest');
                resolve(data);
              } else {
                resolve(null);
              }
            };
            
            getRequest.onerror = () => resolve(null);
          };
          
          request.onerror = () => resolve(null);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('notifications')) {
              db.createObjectStore('notifications', { keyPath: 'id' });
            }
          };
        } catch (e) {
          resolve(null);
        }
      });
    };
    
    // Leer datos de notificación de múltiples fuentes
    let navData = null;
    
    // 1. Intentar leer de IndexedDB primero (más confiable para nuevas ventanas)
    readFromIndexedDB().then((indexedDBData) => {
      if (indexedDBData) {
        navData = indexedDBData;
        logger.info('NOTIFICATION', 'Datos de notificación encontrados en IndexedDB', navData);
      }
      
      // 2. Intentar leer de localStorage/sessionStorage
      try {
        const stored = localStorage.getItem('rodmar_notification_nav') || 
                       sessionStorage.getItem('rodmar_notification_nav');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!navData || parsed.timestamp > (navData.timestamp || 0)) {
            navData = parsed;
            logger.info('NOTIFICATION', 'Datos de notificación encontrados en localStorage', navData);
          }
          // Limpiar después de leer
          localStorage.removeItem('rodmar_notification_nav');
          sessionStorage.removeItem('rodmar_notification_nav');
        }
      } catch (e) {
        logger.error('NOTIFICATION', 'Error leyendo datos de notificación', { error: e });
      }
      
      // Procesar los datos si se encontraron
      if (navData) {
        procesarNotificacionDesdeDatos(navData);
      }
    });
    
    // Verificar query params de la URL (solo si no hay datos de notificación)
    const urlParams = new URLSearchParams(window.location.search);
    const pendingParamFromUrl = urlParams.get('pending');
    const transactionIdFromUrl = urlParams.get('id');
    
    // Si hay datos de notificación, usarlos; si no, usar URL params
    const pendingParam = navData ? (navData.url?.includes('pending=true') || navData.notificationData?.type === 'pending-transaction' ? 'true' : null) : (pendingParamFromUrl || null);
    
    // Extraer ID de múltiples fuentes posibles (en orden de prioridad)
    let transactionIdParam = transactionIdFromUrl ||
                            navData?.transaccionId ||  // Directo del navData
                            navData?.notificationData?.transaccionId ||
                            navData?.notificationData?.id ||
                            (navData?.url?.match(/[?&]id=(\d+)/)?.[1]);
    
    // Si la URL contiene el ID, extraerlo
    if (!transactionIdParam && navData?.url) {
      const urlMatch = navData.url.match(/[?&]id=(\d+)/);
      if (urlMatch) {
        transactionIdParam = urlMatch[1];
      }
    }
    
    const transactionId = transactionIdParam ? parseInt(transactionIdParam, 10) : null;
    
    logger.debug('NOTIFICATION', 'Detección de notificación', { 
      pendingParam, 
      transactionId, 
      pendientesCount: pendientes.length, 
      tieneNavData: !!navData 
    });
    
    if (pendingParam === 'true') {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        console.log('🔎 Buscando transacción con ID:', transactionId);
        
        // Función para buscar y abrir el modal de detalle
        const buscarYAbrirDetalle = () => {
          const transaccion = pendientes.find((t: any) => t.id === transactionId);
          logger.info('NOTIFICATION', `Transacción encontrada: ${transaccion ? 'Sí' : 'No'}`, { transactionId, found: !!transaccion });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle para transacción ${transactionId}`, { transactionId });
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente si ya hay pendientes cargados
        if (pendientes.length > 0) {
          if (!buscarYAbrirDetalle()) {
            // Si no se encuentra, abrir la lista de pendientes
            logger.warn('NOTIFICATION', 'Transacción no encontrada, abriendo lista', { transactionId });
            setShowPendingModal(true);
          }
        } else {
          // Si no hay pendientes cargados, esperar un poco y volver a intentar
          logger.info('NOTIFICATION', 'Esperando a que se carguen los pendientes...', { transactionId });
          const timeoutId = setTimeout(() => {
            if (!buscarYAbrirDetalle()) {
              // Si después de esperar no se encuentra, abrir la lista
              logger.warn('NOTIFICATION', 'Transacción no encontrada después de esperar, abriendo lista', { transactionId });
              setShowPendingModal(true);
            }
          }, 1000);
          
          // Limpiar timeout si el componente se desmonta
          return () => clearTimeout(timeoutId);
        }
      } else {
        // Si no hay ID, abrir la lista de pendientes
        logger.info('NOTIFICATION', 'No hay ID de transacción, abriendo lista de pendientes');
        setShowPendingModal(true);
      }
      
      // Limpiar los query params de la URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location, activeModule, pendientes]);

  // Función para procesar datos de notificación desde datos almacenados
  const procesarNotificacionDesdeDatos = (navData: any) => {
    if (!navData) return;
    
    logger.info('NOTIFICATION', 'Procesando notificación desde datos almacenados', navData);
    
    const url = navData.url || '';
    const transactionId = navData.transaccionId || 
                         navData.notificationData?.transaccionId || 
                         navData.notificationData?.id ||
                         (url.match(/[?&]id=(\d+)/)?.[1]);
    
    const pendingParam = url.includes('pending=true') || navData.notificationData?.type === 'pending-transaction';
    
    if (pendingParam) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
        logger.debug('NOTIFICATION', 'Buscando transacción con ID desde datos almacenados', { transactionId: transaccionIdNum });
        
        // Función para buscar y abrir el modal de detalle
        const buscarYAbrirDetalle = () => {
          const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
          logger.debug('NOTIFICATION', 'Transacción encontrada desde datos almacenados', { 
            encontrada: !!transaccion, 
            transactionId: transaccionIdNum,
            transaccionId: transaccion?.id 
          });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle desde datos almacenados para transacción ${transaccionIdNum}`, { transactionId: transactionIdNum });
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente si ya hay pendientes cargados
        if (pendientes.length > 0) {
          if (!buscarYAbrirDetalle()) {
            logger.warn('NOTIFICATION', 'Transacción no encontrada, esperando y reintentando', { transactionId: transaccionIdNum });
            setTimeout(() => {
              if (!buscarYAbrirDetalle()) {
                logger.warn('NOTIFICATION', 'Transacción no encontrada después de esperar, abriendo lista', { transactionId: transaccionIdNum });
                setShowPendingModal(true);
              }
            }, 1500);
          }
        } else {
          logger.debug('NOTIFICATION', 'Esperando a que se carguen los pendientes desde datos almacenados', { transactionId: transaccionIdNum });
          setTimeout(() => {
            if (!buscarYAbrirDetalle()) {
              logger.warn('NOTIFICATION', 'Transacción no encontrada después de esperar, abriendo lista', { transactionId: transaccionIdNum });
              setShowPendingModal(true);
            }
          }, 1500);
        }
      } else {
        logger.info('NOTIFICATION', 'No hay ID de transacción desde datos almacenados, abriendo lista de pendientes');
        setShowPendingModal(true);
      }
    }
  };

  // Función para procesar datos de notificación y abrir el modal correspondiente
  const procesarNotificacion = (navData: any) => {
    if (!navData) return;
    
    logger.info('NOTIFICATION', 'Procesando datos de notificación', navData);
    
    const url = navData.url || '';
    const transactionId = navData.transaccionId || 
                         navData.notificationData?.transaccionId || 
                         navData.notificationData?.id ||
                         (url.match(/[?&]id=(\d+)/)?.[1]);
    
    const pendingParam = url.includes('pending=true') || navData.notificationData?.type === 'pending-transaction';
    
    if (pendingParam) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
        logger.debug('NOTIFICATION', 'Buscando transacción con ID', { transactionId: transaccionIdNum });
        
        // Función para buscar y abrir el modal de detalle
        const buscarYAbrirDetalle = () => {
          const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
          logger.debug('NOTIFICATION', 'Transacción encontrada', { 
            encontrada: !!transaccion, 
            transactionId: transaccionIdNum,
            transaccionId: transaccion?.id 
          });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle para transacción ${transactionIdNum}`, { transactionId: transactionIdNum });
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente si ya hay pendientes cargados
        if (pendientes.length > 0) {
          if (!buscarYAbrirDetalle()) {
            logger.warn('NOTIFICATION', 'Transacción no encontrada, esperando y reintentando', { transactionId: transaccionIdNum });
            setTimeout(() => {
              if (!buscarYAbrirDetalle()) {
                logger.warn('NOTIFICATION', 'Transacción no encontrada después de esperar, abriendo lista', { transactionId: transaccionIdNum });
                setShowPendingModal(true);
              }
            }, 1500);
          }
        } else {
          logger.debug('NOTIFICATION', 'Esperando a que se carguen los pendientes', { transactionId: transaccionIdNum });
          setTimeout(() => {
            if (!buscarYAbrirDetalle()) {
              logger.warn('NOTIFICATION', 'Transacción no encontrada después de esperar, abriendo lista', { transactionId: transaccionIdNum });
              setShowPendingModal(true);
            }
          }, 1500);
        }
      } else {
        logger.info('NOTIFICATION', 'No hay ID de transacción, abriendo lista de pendientes');
        setShowPendingModal(true);
      }
    }
  };

  // Escuchar mensajes del service worker para navegación desde notificaciones
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      logger.debug('SW_MESSAGE', 'Mensaje recibido en Dashboard', { type: event.data?.type, data: event.data });
      
      // Manejar logs del service worker
      if (event.data && event.data.type === 'LOG') {
        const level = event.data.level || 'info';
        const category = event.data.category || 'SERVICE_WORKER';
        const message = event.data.message || '';
        const data = event.data.data;
        
        if (level === 'error') {
          logger.error(category, message, data);
        } else if (level === 'warn') {
          logger.warn(category, message, data);
        } else if (level === 'success') {
          logger.success(category, message, data);
        } else {
          logger.info(category, message, data);
        }
        return;
      }
      
      if (event.data && event.data.type === 'NAVIGATE') {
        logger.info('NOTIFICATION', 'Mensaje NAVIGATE detectado, procesando notificación', event.data);
        
        // Guardar datos en localStorage para que la verificación periódica los encuentre
        try {
          const navDataToStore = event.data.navData || {
            url: event.data.url,
            timestamp: event.data.timestamp || Date.now(),
            notificationData: event.data.notificationData,
            transaccionId: event.data.transaccionId
          };
          localStorage.setItem('rodmar_notification_nav', JSON.stringify(navDataToStore));
          logger.debug('NOTIFICATION', 'Datos guardados en localStorage', navDataToStore);
        } catch (e) {
          logger.error('NOTIFICATION', 'Error guardando en localStorage', { error: e });
        }
        
        // Procesar la notificación inmediatamente
        const navData = event.data.navData || event.data;
        logger.debug('NOTIFICATION', 'Procesando notificación con navData', navData);
        procesarNotificacion(navData);
      }
    };

    // Registrar listener para mensajes del service worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [activeModule, pendientes]);

  // Verificar periódicamente si hay datos de notificación en localStorage
  // (por si el mensaje del service worker no se recibió)
  useEffect(() => {
    const checkNotificationData = () => {
      try {
        const stored = localStorage.getItem('rodmar_notification_nav') || 
                       sessionStorage.getItem('rodmar_notification_nav');
        if (stored) {
          const navData = JSON.parse(stored);
          // Solo procesar si los datos son recientes (menos de 5 segundos)
          const age = Date.now() - (navData.timestamp || 0);
          if (age < 5000) {
            console.log('🔔 Datos de notificación encontrados en almacenamiento:', navData);
            procesarNotificacion(navData);
            // Limpiar después de procesar
            localStorage.removeItem('rodmar_notification_nav');
            sessionStorage.removeItem('rodmar_notification_nav');
          }
        }
      } catch (e) {
        // Ignorar errores
      }
    };

    // Verificar inmediatamente
    checkNotificationData();
    
    // Verificar cada segundo durante los primeros 5 segundos después de montar
    const intervalId = setInterval(checkNotificationData, 1000);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 5000);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [pendientes, activeModule]);

  const renderModule = () => {
    const LoadingFallback = () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );

    switch (activeModule) {
      case "principal":
        return <Principal onOpenCargue={() => setShowCargueModal(true)} onOpenDescargue={() => setShowDescargueModal(true)} />;
      case "minas":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Minas />
          </Suspense>
        );
      case "compradores":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Compradores />
          </Suspense>
        );
      case "volqueteros":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Volqueteros />
          </Suspense>
        );
      case "transacciones":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Transacciones 
              onOpenTransaction={() => setShowTransactionModal(true)} 
              hideBottomNav={true}
            />
          </Suspense>
        );
      case "rodmar":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <RodMar />
          </Suspense>
        );
      default:
        return <Principal onOpenCargue={() => setShowCargueModal(true)} onOpenDescargue={() => setShowDescargueModal(true)} />;
    }
  };

  const handleQuickAction = () => {
    // El botón flotante ahora abre el modal de gestionar transacciones
    setShowGestionarModal(true);
  };

  const handleCompletar = () => {
    // Abrir el modal de transacciones pendientes
    setShowPendingModal(true);
  };

  return (
    <div className="min-h-screen bg-background pb-[64px]">
      <AppHeader currentModule={activeModule} />
      
      <main className="flex-1">
        {renderModule()}
      </main>

      <BottomNavigation 
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />

      {/* Floating Action Button - visible en todos los módulos */}
      {/* Si hay pendientes: mostrar "P" naranja parpadeante, si no: mostrar Plus normal */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .blinking {
          animation: blink 1.5s ease-in-out infinite;
        }
      `}</style>
      <Button
        size="icon"
        className={`fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg z-[100] ${
          hasPending 
            ? "bg-orange-500 hover:bg-orange-600 text-white blinking" 
            : ""
        }`}
        onClick={handleQuickAction}
        aria-label={hasPending ? `Gestionar transacciones (${pendingCount} pendiente${pendingCount > 1 ? 's' : ''})` : "Gestionar transacciones"}
      >
        {hasPending ? (
          <span className="text-lg sm:text-xl font-bold">P</span>
        ) : (
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        )}
      </Button>

      {/* Modals */}
      <RegisterCargueModal 
        open={showCargueModal}
        onClose={() => setShowCargueModal(false)}
      />
      
      <RegisterDescargueModal 
        open={showDescargueModal}
        onClose={() => setShowDescargueModal(false)}
      />
      
      <NewTransactionModal 
        open={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
      
      <PendingListModal 
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
      />

      {selectedPendingTransaction && (
        <PendingDetailModal
          open={showPendingDetailModal}
          transaccion={selectedPendingTransaction}
          onClose={() => {
            setShowPendingDetailModal(false);
            setSelectedPendingTransaction(null);
          }}
        />
      )}

      <GestionarTransaccionesModal
        open={showGestionarModal}
        onClose={() => setShowGestionarModal(false)}
        onCrear={() => setShowTransactionModal(true)}
        onSolicitar={() => setShowSolicitarModal(true)}
        onCompletar={handleCompletar}
      />

      <SolicitarTransaccionModal
        open={showSolicitarModal}
        onClose={() => setShowSolicitarModal(false)}
      />
    </div>
  );
}
