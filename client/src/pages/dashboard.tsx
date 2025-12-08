import { useState, lazy, Suspense, useEffect } from "react";
import AppHeader from "@/components/layout/app-header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Principal from "@/components/modules/principal";
import { useLocation } from "wouter";

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
    // Primero verificar localStorage/sessionStorage para datos de notificación
    let navData = null;
    try {
      const stored = localStorage.getItem('rodmar_notification_nav') || 
                     sessionStorage.getItem('rodmar_notification_nav');
      if (stored) {
        navData = JSON.parse(stored);
        console.log('📱 Datos de notificación encontrados:', navData);
        // Limpiar después de leer
        localStorage.removeItem('rodmar_notification_nav');
        sessionStorage.removeItem('rodmar_notification_nav');
      }
    } catch (e) {
      console.warn('Error leyendo datos de notificación:', e);
    }
    
    // Verificar query params de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const pendingParam = urlParams.get('pending') || (navData?.url?.includes('pending=true') ? 'true' : null);
    
    // Extraer ID de múltiples fuentes posibles (en orden de prioridad)
    let transactionIdParam = urlParams.get('id') || 
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
    
    console.log('🔍 Detección de notificación:', { pendingParam, transactionId, pendientesCount: pendientes.length });
    
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
          console.log('📋 Transacción encontrada:', transaccion ? 'Sí' : 'No');
          
          if (transaccion) {
            console.log('✅ Abriendo modal de detalle para transacción:', transactionId);
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
            console.log('⚠️ Transacción no encontrada, abriendo lista');
            setShowPendingModal(true);
          }
        } else {
          // Si no hay pendientes cargados, esperar un poco y volver a intentar
          console.log('⏳ Esperando a que se carguen los pendientes...');
          const timeoutId = setTimeout(() => {
            if (!buscarYAbrirDetalle()) {
              // Si después de esperar no se encuentra, abrir la lista
              console.log('⚠️ Transacción no encontrada después de esperar, abriendo lista');
              setShowPendingModal(true);
            }
          }, 1000);
          
          // Limpiar timeout si el componente se desmonta
          return () => clearTimeout(timeoutId);
        }
      } else {
        // Si no hay ID, abrir la lista de pendientes
        console.log('📋 No hay ID de transacción, abriendo lista de pendientes');
        setShowPendingModal(true);
      }
      
      // Limpiar los query params de la URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location, activeModule, pendientes]);

  // Escuchar mensajes del service worker para navegación desde notificaciones
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const url = event.data.url || event.data.absoluteUrl;
        if (!url) return;
        
        console.log('📨 Mensaje del service worker recibido:', event.data);
        
        try {
          const urlObj = new URL(url, window.location.origin);
          const pendingParam = urlObj.searchParams.get('pending');
          const transactionId = urlObj.searchParams.get('id');
          
          // Navegar usando wouter
          const pathWithQuery = urlObj.pathname + urlObj.search;
          setLocation(pathWithQuery);
          
          // Si es una notificación de transacción pendiente, abrir el modal
          if (pendingParam === 'true') {
            // Pequeño delay para asegurar que el routing se complete y los datos se carguen
            setTimeout(() => {
              if (activeModule !== 'transacciones') {
                setActiveModule('transacciones');
              }
              
              // Si hay un ID de transacción, buscar y abrir el modal de detalle directamente
              if (transactionId) {
                const transaccionIdNum = parseInt(transactionId, 10);
                console.log('🔎 Buscando transacción desde mensaje SW:', transaccionIdNum);
                
                // Función para buscar y abrir el modal de detalle
                const buscarYAbrirDetalle = () => {
                  const transaccion = pendientes.find((t: any) => t.id === transaccionIdNum);
                  console.log('📋 Transacción encontrada desde SW:', transaccion ? 'Sí' : 'No');
                  
                  if (transaccion) {
                    console.log('✅ Abriendo modal de detalle desde SW para transacción:', transaccionIdNum);
                    setSelectedPendingTransaction(transaccion);
                    setShowPendingDetailModal(true);
                    return true;
                  }
                  return false;
                };
                
                if (pendientes.length > 0) {
                  if (!buscarYAbrirDetalle()) {
                    // Si no se encuentra, esperar un poco más y volver a intentar
                    setTimeout(() => {
                      if (!buscarYAbrirDetalle()) {
                        console.log('⚠️ Transacción no encontrada desde SW, abriendo lista');
                        setShowPendingModal(true);
                      }
                    }, 1000);
                  }
                } else {
                  // Esperar a que se carguen los pendientes
                  console.log('⏳ Esperando pendientes desde SW...');
                  setTimeout(() => {
                    if (!buscarYAbrirDetalle()) {
                      console.log('⚠️ Transacción no encontrada desde SW después de esperar, abriendo lista');
                      setShowPendingModal(true);
                    }
                  }, 1000);
                }
              } else {
                console.log('📋 No hay ID desde SW, abriendo lista');
                setShowPendingModal(true);
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error procesando navegación desde notificación:', error);
          // Fallback: solo abrir el modal si es una notificación pendiente
          if (url.includes('pending=true')) {
            if (activeModule !== 'transacciones') {
              setActiveModule('transacciones');
            }
            setShowPendingModal(true);
          }
        }
      }
    };

    // Registrar listener para mensajes del service worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [activeModule, setLocation, pendientes]);

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
