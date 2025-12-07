import { useState, lazy, Suspense } from "react";
import AppHeader from "@/components/layout/app-header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Principal from "@/components/modules/principal";

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
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);

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
