import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, ArrowRight } from "lucide-react";
import Dashboard from "./dashboard";

export default function Home() {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with user info and logout */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-full">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Bienvenido, {user?.firstName || user?.email || "Usuario"}
              </p>
              <p className="text-sm text-muted-foreground">RodMar - Sistema de Gestión Minera</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Main dashboard content */}
      <Dashboard />
    </div>
  );
}