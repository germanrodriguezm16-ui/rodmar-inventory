import { Switch, Route } from "wouter";
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
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { NavigationVisibilityContext, useNavigationVisibilityState } from "@/hooks/use-navigation-visibility";
import { useSocket } from "@/hooks/useSocket";

function Router() {
  // Autenticación deshabilitada - siempre mostrar dashboard
  return (
    <Switch>
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
