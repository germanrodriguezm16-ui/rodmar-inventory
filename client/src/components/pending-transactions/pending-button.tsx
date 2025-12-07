import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

interface PendingButtonProps {
  onClick: () => void;
}

export function PendingButton({ onClick }: PendingButtonProps) {
  // Consultar el conteo de transacciones pendientes
  const { data: count = 0 } = useQuery<number>({
    queryKey: ["/api/transacciones/pendientes/count"],
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Solo mostrar el botón si hay pendientes
  if (!count || count === 0) {
    return null;
  }

  return (
    <>
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
        className="fixed bottom-24 left-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg z-[100] bg-orange-500 hover:bg-orange-600 text-white transition-all hover:scale-110 blinking"
        onClick={onClick}
        aria-label={`Ver ${count} transacción${count > 1 ? 'es' : ''} pendiente${count > 1 ? 's' : ''}`}
      >
        <div className="relative">
          <span className="text-lg sm:text-xl font-bold">P</span>
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
      </Button>
    </>
  );
}

