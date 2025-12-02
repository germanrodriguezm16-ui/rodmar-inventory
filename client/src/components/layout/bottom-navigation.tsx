import { Home, Mountain, Building2, Truck, ArrowUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalNavigation } from "@/hooks/use-global-navigation";
import { useNavigationVisibility } from "@/hooks/use-navigation-visibility";

interface BottomNavigationProps {
  activeModule?: string;
  onModuleChange?: (module: "principal" | "minas" | "compradores" | "volqueteros" | "transacciones" | "rodmar") => void;
}

export default function BottomNavigation({ activeModule, onModuleChange }: BottomNavigationProps) {
  const { navigateToModule, getCurrentModule } = useGlobalNavigation();
  const { isNavigationHidden } = useNavigationVisibility();
  
  // Si la navegación está oculta, no renderizar nada
  if (isNavigationHidden) {
    return null;
  }
  
  // Si no se proporciona activeModule, detectarlo automáticamente
  const currentModule = activeModule || getCurrentModule();
  const navItems = [
    { id: "principal", icon: Home, label: "Principal" },
    { id: "minas", icon: Mountain, label: "Minas" },
    { id: "compradores", icon: Building2, label: "Compradores" },
    { id: "volqueteros", icon: Truck, label: "Volqueteros" },
    { id: "transacciones", icon: ArrowUpDown, label: "Transacc" },
    { id: "rodmar", icon: User, label: "RodMar" },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border shadow-lg" 
      style={{ zIndex: 9999, position: 'fixed' }}
    >
      <div className="flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`flex-1 flex-col h-auto py-2 px-1 rounded-none ${
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
              <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}