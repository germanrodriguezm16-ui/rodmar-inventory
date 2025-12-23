import { useState, lazy, Suspense, useEffect } from "react";
import AppHeader from "@/components/layout/app-header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Principal from "@/components/modules/principal";
import { useLocation } from "wouter";
import { logger, setDebugLoggerInstance } from "@/lib/logger";
import { debugLogger } from "@/hooks/useDebugLogger";

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
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { GestionarTransaccionesModal } from "@/components/modals/gestionar-transacciones-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getAuthToken } from "@/hooks/useAuth";
import { hasModulePermission, getFirstAvailableModule } from "@/lib/module-utils";

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
  const [showTransactionDetailModal, setShowTransactionDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [location, setLocation] = useLocation();
  const { has, permissions, isLoading: permissionsLoading } = usePermissions();
  
  // OPTIMIZACIÓN CARGA INICIAL:
  // Para que el módulo Principal (Viajes) cargue más rápido, diferimos la carga de la LISTA de pendientes.
  // El conteo se mantiene inmediato (badge/indicador), pero la lista se habilita:
  // - después de un pequeño delay (1-2s) o
  // - inmediatamente si el usuario abre el modal o llega una notificación.
  const [enablePendientesPrefetch, setEnablePendientesPrefetch] = useState(false);

  // Log inicial del sistema
  useEffect(() => {
    // Integrar el logger con el debug logger
    setDebugLoggerInstance(debugLogger);
    logger.info('SYSTEM', 'Dashboard cargado', { initialModule, timestamp: Date.now() });
  }, []);

  // Validar permisos del módulo inicial y redirigir si no tiene acceso
  useEffect(() => {
    if (permissionsLoading) return; // Esperar a que carguen los permisos
    
    // Verificar si el usuario tiene permiso para el módulo inicial
    if (!hasModulePermission(permissions, initialModule)) {
      // Si no tiene permiso, redirigir al primer módulo disponible
      const firstAvailable = getFirstAvailableModule(permissions);
      console.log(`[DASHBOARD] Usuario sin permiso para "${initialModule}", redirigiendo a "${firstAvailable}"`);
      setActiveModule(firstAvailable);
      // Actualizar la URL si es necesario
      if (location !== `/${firstAvailable}`) {
        setLocation(`/${firstAvailable}`);
      }
    } else {
      // Si tiene permiso, asegurar que el módulo activo coincida con el inicial
      setActiveModule(initialModule);
    }
  }, [initialModule, permissions, permissionsLoading, location, setLocation]);

  // Consultar el conteo de transacciones pendientes
  const { data: pendingCount = 0 } = useQuery<number>({
    queryKey: ["/api/transacciones/pendientes/count"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl("/api/transacciones/pendientes/count"), {
        credentials: "include",
        headers,
      });
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const hasPending = pendingCount > 0;

  const queryClient = useQueryClient();

  // Estado para rastrear si hay una notificación pendiente de procesar
  const [pendingNotification, setPendingNotification] = useState<any>(null);

  // Habilitar prefetch diferido de pendientes (no bloquea el primer paint del módulo Principal)
  useEffect(() => {
    const t = window.setTimeout(() => setEnablePendientesPrefetch(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Obtener lista de transacciones pendientes para buscar por ID
  const { data: pendientes = [] } = useQuery<any[]>({
    queryKey: ["/api/transacciones/pendientes"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl("/api/transacciones/pendientes"), {
        credentials: "include",
        headers,
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: Boolean(
      enablePendientesPrefetch ||
      showPendingModal ||
      showPendingDetailModal ||
      pendingNotification
    ),
    refetchInterval: 30000, // Refrescar cada 30 segundos (solo cuando está habilitada)
  });

  // Efecto para intentar procesar notificación cuando se cargan los pendientes
  useEffect(() => {
    if (pendingNotification && pendientes.length > 0) {
      console.log('🔄 [EFECTO] Pendientes cargados, reintentando procesar notificación', {
        pendingNotification,
        pendientesCount: pendientes.length,
        idsDisponibles: pendientes.map((t: any) => t.id)
      });
      
      const transactionId = pendingNotification.transaccionId || 
                           pendingNotification.notificationData?.transaccionId;
      
      if (transactionId) {
        const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
        const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
        
        if (transaccion) {
          console.log('✅ [EFECTO] Transacción encontrada después de cargar pendientes', {
            transaccionId: transaccion.id,
            buscando: transaccionIdNum
          });
          
          setSelectedPendingTransaction(transaccion);
          setShowPendingDetailModal(true);
          setPendingNotification(null); // Limpiar notificación pendiente
          
          logger.success('NOTIFICATION', `Modal abierto desde efecto después de cargar pendientes para transacción ${transaccionIdNum}`, {
            transactionId: transaccionIdNum
          });
        } else {
          console.log('❌ [EFECTO] Transacción aún no encontrada', {
            buscando: transaccionIdNum,
            idsDisponibles: pendientes.map((t: any) => t.id)
          });
        }
      }
    }
  }, [pendientes, pendingNotification]);

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
    const notificationType = navData?.notificationData?.type;
    const isPendingNotification = notificationType === 'pending-transaction' || 
                                  notificationType === 'pending-transaction-edited';
    const isCompletedNotification = notificationType === 'pending-transaction-completed';
    const pendingParam = navData ? (navData.url?.includes('pending=true') || isPendingNotification ? 'true' : null) : (pendingParamFromUrl || null);
    
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
      tieneNavData: !!navData,
      notificationType
    });
    
    // Manejar notificación de transacción completada
    if (isCompletedNotification && transactionId) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Buscar la transacción completada en todas las transacciones
      const buscarTransaccionCompletada = async () => {
        try {
          const token = getAuthToken();
          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          const response = await fetch(apiUrl(`/api/transacciones/${transactionId}`), {
            credentials: "include",
            headers,
          });
          if (response.ok) {
            const transaccion = await response.json();
            logger.success('NOTIFICATION', `Transacción completada encontrada, abriendo modal de detalle`, { transactionId });
            setSelectedTransaction(transaccion);
            setShowTransactionDetailModal(true);
            return true;
          }
        } catch (error) {
          console.error('Error buscando transacción completada:', error);
        }
        return false;
      };
      
      buscarTransaccionCompletada();
      
      // Limpiar los query params de la URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }
    
    if (pendingParam === 'true') {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Invalidar y refetchear pendientes en background (no bloqueante) para mantener caché actualizado
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] }).catch(() => {
        // Ignorar errores de refetch, es en background
      });
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        console.log('🔎 Buscando transacción con ID:', transactionId);
        
        // ESTRATEGIA OPTIMIZADA: Intentar múltiples fuentes en paralelo
        const buscarYAbrirDetalle = () => {
          // 1. Intentar inmediatamente con caché (más rápido)
          const transaccion = pendientes.find((t: any) => t.id === transactionId);
          logger.info('NOTIFICATION', `Transacción encontrada en caché: ${transaccion ? 'Sí' : 'No'}`, { transactionId, found: !!transaccion });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle para transacción ${transactionId} (desde caché)`, { transactionId });
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente con caché
        const encontradaEnCache = buscarYAbrirDetalle();
        
        if (!encontradaEnCache) {
          // 2. Si no está en caché, hacer fetch directo al servidor (rápido, ~100-300ms)
          logger.info('NOTIFICATION', 'Transacción no encontrada en caché, buscando en servidor...', { transactionId });
          
          const buscarEnServidor = async () => {
            try {
              // Intentar buscar como transacción pendiente primero
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers["Authorization"] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/pendientes`), {
                credentials: "include",
                headers,
              });
              
              if (response.ok) {
                const todasPendientes = await response.json();
                const transaccion = todasPendientes.find((t: any) => t.id === transactionId);
                
                if (transaccion) {
                  logger.success('NOTIFICATION', `Transacción encontrada en servidor, abriendo modal`, { transactionId });
                  setSelectedPendingTransaction(transaccion);
                  setShowPendingDetailModal(true);
                  return true;
                }
              }
            } catch (error) {
              console.error('Error buscando transacción en servidor:', error);
            }
            return false;
          };
          
          // Ejecutar búsqueda en servidor (no bloquea, se ejecuta en paralelo)
          buscarEnServidor().then((encontrada) => {
            if (!encontrada) {
              // Si tampoco se encuentra en servidor, abrir lista de pendientes
              logger.warn('NOTIFICATION', 'Transacción no encontrada, abriendo lista de pendientes', { transactionId });
              setShowPendingModal(true);
            }
          });
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
    
    const notificationType = navData.notificationData?.type;
    const isPendingNotification = notificationType === 'pending-transaction' || 
                                  notificationType === 'pending-transaction-edited';
    const isCompletedNotification = notificationType === 'pending-transaction-completed';
    const pendingParam = url.includes('pending=true') || isPendingNotification;
    
    // Manejar notificación de transacción completada
    if (isCompletedNotification && transactionId) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Buscar la transacción completada en todas las transacciones
      const buscarTransaccionCompletada = async () => {
        try {
          const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
          const response = await fetch(apiUrl(`/api/transacciones/${transaccionIdNum}`), {
            credentials: "include",
          });
          if (response.ok) {
            const transaccion = await response.json();
            logger.success('NOTIFICATION', `Transacción completada encontrada desde datos almacenados, abriendo modal de detalle`, { transactionId: transaccionIdNum });
            setSelectedTransaction(transaccion);
            setShowTransactionDetailModal(true);
            return true;
          }
        } catch (error) {
          console.error('Error buscando transacción completada desde datos almacenados:', error);
        }
        return false;
      };
      
      buscarTransaccionCompletada();
      return;
    }
    
    if (pendingParam) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Invalidar y refetchear pendientes en background (no bloqueante) para mantener caché actualizado
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] }).catch(() => {
        // Ignorar errores de refetch, es en background
      });
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
        logger.debug('NOTIFICATION', 'Buscando transacción con ID desde datos almacenados', { transactionId: transaccionIdNum });
        
        // ESTRATEGIA OPTIMIZADA: Intentar múltiples fuentes en paralelo
        const buscarYAbrirDetalle = () => {
          // 1. Intentar inmediatamente con caché (más rápido)
          const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
          logger.info('NOTIFICATION', `Transacción encontrada en caché: ${transaccion ? 'Sí' : 'No'}`, { transactionId: transaccionIdNum, found: !!transaccion });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle desde datos almacenados para transacción ${transaccionIdNum} (desde caché)`, { transactionId: transaccionIdNum });
            setPendingNotification(null); // Limpiar notificación pendiente
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente con caché
        const encontradaEnCache = buscarYAbrirDetalle();
        
        if (!encontradaEnCache) {
          // 2. Si no está en caché, hacer fetch directo al servidor (rápido, ~100-300ms)
          logger.info('NOTIFICATION', 'Transacción no encontrada en caché, buscando en servidor...', { transactionId: transaccionIdNum });
          
          const buscarEnServidor = async () => {
            try {
              // Intentar buscar como transacción pendiente primero
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers["Authorization"] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/pendientes`), {
                credentials: "include",
                headers,
              });
              
              if (response.ok) {
                const todasPendientes = await response.json();
                const transaccion = todasPendientes.find((t: any) => t.id === transaccionIdNum);
                
                if (transaccion) {
                  logger.success('NOTIFICATION', `Transacción encontrada en servidor desde datos almacenados, abriendo modal`, { transactionId: transaccionIdNum });
                  setPendingNotification(null); // Limpiar notificación pendiente
                  setSelectedPendingTransaction(transaccion);
                  setShowPendingDetailModal(true);
                  return true;
                }
              }
            } catch (error) {
              console.error('Error buscando transacción en servidor desde datos almacenados:', error);
            }
            return false;
          };
          
          // Ejecutar búsqueda en servidor (no bloquea, se ejecuta en paralelo)
          buscarEnServidor().then((encontrada) => {
            if (!encontrada) {
              // Si tampoco se encuentra en servidor, guardar como pendiente para reintentar
              logger.warn('NOTIFICATION', 'Transacción no encontrada, guardada como pendiente para reintentar', { transactionId: transaccionIdNum });
              setPendingNotification(navData);
            }
          });
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
    
    const notificationType = navData.notificationData?.type;
    const isPendingNotification = notificationType === 'pending-transaction' || 
                                  notificationType === 'pending-transaction-edited';
    const isCompletedNotification = notificationType === 'pending-transaction-completed';
    const pendingParam = url.includes('pending=true') || isPendingNotification;
    
    if (pendingParam) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Invalidar y refetchear pendientes en background (no bloqueante) para mantener caché actualizado
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] }).catch(() => {
        // Ignorar errores de refetch, es en background
      });
      
      // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
      if (transactionId) {
        const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
        logger.debug('NOTIFICATION', 'Buscando transacción con ID', { transactionId: transaccionIdNum });
        
        // ESTRATEGIA OPTIMIZADA: Intentar múltiples fuentes en paralelo
        const buscarYAbrirDetalle = () => {
          // 1. Intentar inmediatamente con caché (más rápido)
          const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
          logger.info('NOTIFICATION', `Transacción encontrada en caché: ${transaccion ? 'Sí' : 'No'}`, { transactionId: transaccionIdNum, found: !!transaccion });
          
          if (transaccion) {
            logger.success('NOTIFICATION', `Abriendo modal de detalle para transacción ${transaccionIdNum} (desde caché)`, { transactionId: transaccionIdNum });
            setSelectedPendingTransaction(transaccion);
            setShowPendingDetailModal(true);
            return true;
          }
          return false;
        };
        
        // Intentar buscar inmediatamente con caché
        const encontradaEnCache = buscarYAbrirDetalle();
        
        if (!encontradaEnCache) {
          // 2. Si no está en caché, hacer fetch directo al servidor (rápido, ~100-300ms)
          logger.info('NOTIFICATION', 'Transacción no encontrada en caché, buscando en servidor...', { transactionId: transaccionIdNum });
          
          const buscarEnServidor = async () => {
            try {
              // Intentar buscar como transacción pendiente primero
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers["Authorization"] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/pendientes`), {
                credentials: "include",
                headers,
              });
              
              if (response.ok) {
                const todasPendientes = await response.json();
                const transaccion = todasPendientes.find((t: any) => t.id === transaccionIdNum);
                
                if (transaccion) {
                  logger.success('NOTIFICATION', `Transacción encontrada en servidor, abriendo modal`, { transactionId: transaccionIdNum });
                  setSelectedPendingTransaction(transaccion);
                  setShowPendingDetailModal(true);
                  return true;
                }
              }
            } catch (error) {
              console.error('Error buscando transacción en servidor:', error);
            }
            return false;
          };
          
          // Ejecutar búsqueda en servidor (no bloquea, se ejecuta en paralelo)
          buscarEnServidor().then((encontrada) => {
            if (!encontrada) {
              // Si tampoco se encuentra en servidor, abrir lista de pendientes
              logger.warn('NOTIFICATION', 'Transacción no encontrada, abriendo lista de pendientes', { transactionId: transaccionIdNum });
              setShowPendingModal(true);
            }
          });
        }
      } else {
        // Si no hay ID, abrir la lista de pendientes
        logger.info('NOTIFICATION', 'No hay ID de transacción, abriendo lista de pendientes');
        setShowPendingModal(true);
      }
    }
    
    // Manejar notificación de transacción completada
    if (isCompletedNotification && transactionId) {
      // Cambiar al módulo de transacciones si no está ya ahí
      if (activeModule !== 'transacciones') {
        setActiveModule('transacciones');
      }
      
      // Buscar la transacción completada directamente en el servidor (ya optimizado)
      const buscarTransaccionCompletada = async () => {
        try {
          const transaccionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
          const response = await fetch(apiUrl(`/api/transacciones/${transaccionIdNum}`), {
            credentials: "include",
          });
          if (response.ok) {
            const transaccion = await response.json();
            logger.success('NOTIFICATION', `Transacción completada encontrada, abriendo modal de detalle`, { transactionId: transaccionIdNum });
            setSelectedTransaction(transaccion);
            setShowTransactionDetailModal(true);
            return true;
          }
        } catch (error) {
          console.error('Error buscando transacción completada:', error);
        }
        return false;
      };
      
      buscarTransaccionCompletada();
      return;
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
        
        // Loggear usando el logger personalizado (que ahora se integra con debug logger)
        if (level === 'error') {
          logger.error(category, message, data);
        } else if (level === 'warn') {
          logger.warn(category, message, data);
        } else if (level === 'success') {
          logger.success(category, message, data);
        } else if (level === 'debug') {
          logger.debug(category, message, data);
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
      {/* Botón flotante solo visible si tiene permiso para crear transacciones o ver pendientes */}
      {(has("action.TRANSACCIONES.create") || has("action.TRANSACCIONES.viewPending") || hasPending) && (
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
      )}

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
          open={showPendingDetailModal && !!selectedPendingTransaction}
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

      {selectedTransaction && (
        <TransactionDetailModal
          open={showTransactionDetailModal && !!selectedTransaction}
          transaction={selectedTransaction}
          onOpenChange={(open) => {
            setShowTransactionDetailModal(open);
            if (!open) {
              setSelectedTransaction(null);
            }
          }}
        />
      )}
    </div>
  );
}
