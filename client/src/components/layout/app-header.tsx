import { Bell, Settings, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  currentModule: string;
}

const moduleNames = {
  principal: "Principal",
  minas: "Minas",
  compradores: "Compradores", 
  volqueteros: "Volqueteros",
  transacciones: "Transacciones",
  rodmar: "RodMar"
};

export default function AppHeader({ currentModule }: AppHeaderProps) {
  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="text-primary-foreground w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">RodMar</h1>
              <p className="text-xs text-muted-foreground">
                {moduleNames[currentModule as keyof typeof moduleNames] || "Principal"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
