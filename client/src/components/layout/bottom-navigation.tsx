import { Home, Mountain, Building2, Truck, ArrowUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalNavigation } from "@/hooks/use-global-navigation";
import { useNavigationVisibility } from "@/hooks/use-navigation-visibility";
import { usePermissions } from "@/hooks/usePermissions";

interface BottomNavigationProps {
  activeModule?: string;
  onModuleChange?: (module: "principal" | "minas" | "compradores" | "volqueteros" | "transacciones" | "rodmar") => void;
}

export default function BottomNavigation({ activeModule, onModuleChange }: BottomNavigationProps) {
  const { navigateToModule, getCurrentModule } = useGlobalNavigation();
  const { isNavigationHidden } = useNavigationVisibility();
  const { has } = usePermissions();
  
  // Si la navegación está oculta, no renderizar nada
  if (isNavigationHidden) {
    return null;
  }
  
  // Si no se proporciona activeModule, detectarlo automáticamente
  const currentModule = activeModule || getCurrentModule();
  
  // Mapeo de módulos a permisos
  const modulePermissions: Record<string, string> = {
    principal: "", // Principal siempre visible
    minas: "module.MINAS.view",
    compradores: "module.COMPRADORES.view",
    volqueteros: "module.VOLQUETEROS.view",
    transacciones: "module.TRANSACCIONES.view",
    rodmar: "module.RODMAR.view",
  };
  
  const allNavItems = [
    { id: "principal", icon: Home, label: "Principal" },
    { id: "minas", icon: Mountain, label: "Minas" },
    { id: "compradores", icon: Building2, label: "Compradores" },
    { id: "volqueteros", icon: Truck, label: "Volqueteros" },
    { id: "transacciones", icon: ArrowUpDown, label: "Transacc" },
    { id: "rodmar", icon: User, label: "RodMar" },
  ];
  
  // Filtrar módulos según permisos (admin se maneja desde Settings)
  const navItems = allNavItems.filter((item) => {
    const permission = modulePermissions[item.id];
    // Si no hay permiso requerido (principal) o el usuario tiene el permiso
    return !permission || has(permission);
  });

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border shadow-lg safe-area-inset-bottom"
      style={{ zIndex: 9999, position: 'fixed' }}
    >
      <div className="flex items-stretch min-h-[56px] max-h-[64px]">
          {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`flex-1 flex-col items-center justify-center min-w-0 py-1.5 px-0.5 sm:py-2 sm:px-1 rounded-none h-full ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => {
                // Si se proporciona onModuleChange, usarla (Dashboard)
                if (onModuleChange) {
                  onModuleChange(item.id as any);
                } else {
                  // Si no, usar navegación global (páginas independientes)
                  navigateToModule(item.id);
                }
              }}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[10px] sm:text-xs font-medium truncate w-full text-center leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}