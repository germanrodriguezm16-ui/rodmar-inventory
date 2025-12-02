import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Mountain, 
  Handshake, 
  Users, 
  ArrowLeftRight, 
  User, 
  Truck,
  Bell,
  Settings,
  Plus
} from "lucide-react";

const modules = [
  { id: "principal", path: "/", label: "Principal", icon: Home },
  { id: "minas", path: "/minas", label: "Minas", icon: Mountain },
  { id: "compradores", path: "/compradores", label: "Compradores", icon: Handshake },
  { id: "volqueteros", path: "/volqueteros", label: "Volqueteros", icon: Users },
  { id: "transacciones", path: "/transacciones", label: "Transacciones", icon: ArrowLeftRight },
  { id: "rodmar", path: "/rodmar", label: "RodMar", icon: User },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  
  const currentModule = modules.find(m => m.path === location) || modules[0];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Truck className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">RodMar</h1>
                <p className="text-xs text-muted-foreground">{currentModule.label}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = location === module.path;
            
            return (
              <button
                key={module.id}
                onClick={() => setLocation(module.path)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <p className="text-xs font-medium">{module.label}</p>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <Button className="fab" size="icon">
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
