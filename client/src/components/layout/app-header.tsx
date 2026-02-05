import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Settings, Bug, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NotificationsSettingsModal } from "@/components/modals/notifications-settings-modal";
import { DebugLogsModal } from "@/components/modals/debug-logs-modal";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

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
  const [showNotificationsSettings, setShowNotificationsSettings] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [, setLocation] = useLocation();
  const { has } = usePermissions();
  const { logout, isLoggingOut } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <>
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src="/rodmar-circular-192.png" 
                  alt="RodMar" 
                  className="w-full h-full object-contain"
                />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {has("module.ADMIN.view") && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin")}
                      className="cursor-pointer"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Administración
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => setShowNotificationsSettings(true)}
                    className="cursor-pointer"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Notificaciones
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDebugLogs(true)}
                    className="cursor-pointer"
                  >
                    <Bug className="mr-2 h-4 w-4" />
                    Logs de Depuración
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    disabled={isLoggingOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <NotificationsSettingsModal 
        open={showNotificationsSettings}
        onClose={() => setShowNotificationsSettings(false)}
      />
      <DebugLogsModal 
        open={showDebugLogs}
        onClose={() => setShowDebugLogs(false)}
      />
    </>
  );
}
