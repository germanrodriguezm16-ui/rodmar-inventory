import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// import ErrorBoundary from "@/components/ErrorBoundary";
// import PreviewErrorSuppressor from "@/components/PreviewErrorSuppressor";
// import { ReplicPreviewFix } from "@/components/ReplicPreviewFix";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import MinaDetail from "@/pages/mina-detail";
import CompradorDetail from "@/pages/comprador-detail";
import VolqueteroDetail from "@/pages/volquetero-detail";
import RodMarCuentaDetail from "@/pages/rodmar-cuenta-detail";
import Admin from "@/pages/admin";
import LoginPage from "@/pages/login";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { NavigationVisibilityContext, useNavigationVisibilityState } from "@/hooks/use-navigation-visibility";
import { useSocket } from "@/hooks/useSocket";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado y no está en /login, redirigir a login
  if (!isAuthenticated && location !== "/login") {
    return <LoginPage />;
  }

  // Si está autenticado y está en /login, redirigir a home
  if (isAuthenticated && location === "/login") {
    return <Dashboard initialModule="principal" />;
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <Dashboard initialModule="transacciones" />} />
      <Route path="/principal">
        <Dashboard initialModule="principal" />
      </Route>
      <Route path="/transacciones">
        <Dashboard initialModule="transacciones" />
      </Route>
      <Route path="/minas">
        <Dashboard initialModule="minas" />
      </Route>
      <Route path="/minas/:id" component={MinaDetail} />
      <Route path="/compradores">
        <Dashboard initialModule="compradores" />
      </Route>
      <Route path="/compradores/:id" component={CompradorDetail} />
      <Route path="/volqueteros">
        <Dashboard initialModule="volqueteros" />
      </Route>
      <Route path="/volqueteros/:id" component={VolqueteroDetail} />
      <Route path="/rodmar">
        <Dashboard initialModule="rodmar" />
      </Route>
      <Route path="/rodmar/cuenta/:cuentaSlug" component={RodMarCuentaDetail} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const navigationVisibility = useNavigationVisibilityState();

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent navigationVisibility={navigationVisibility} />
    </QueryClientProvider>
  );
}

function AppContent({ navigationVisibility }: { navigationVisibility: ReturnType<typeof useNavigationVisibilityState> }) {
  // Inicializar Socket.io para actualizaciones en tiempo real (después de QueryClientProvider)
  useSocket();

  return (
    <NavigationVisibilityContext.Provider value={navigationVisibility}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </NavigationVisibilityContext.Provider>
  );
}

export default App;
