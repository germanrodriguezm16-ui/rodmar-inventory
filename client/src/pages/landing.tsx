import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Mountain, Building2, ArrowRight, CheckCircle, RefreshCw } from "lucide-react";
import { clearCache } from "@/lib/queryClient";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleClearCacheAndLogin = () => {
    clearCache();
    // Esperar un momento para que el cache se limpie
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <div className="bg-blue-600 rounded-full p-4 mr-4">
              <Truck className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
              RodMar
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Sistema integral de gestión minera. Controla tus operaciones de transporte, 
            finanzas y socios comerciales desde una plataforma centralizada.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            >
              Iniciar Sesión
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleClearCacheAndLogin} 
              variant="outline"
              size="lg" 
              className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Limpiar Cache y Entrar
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/80 backdrop-blur-sm border-blue-200 dark:bg-gray-800/80 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Mountain className="h-8 w-8 text-green-600 mr-3" />
                <CardTitle className="text-xl">Gestión de Minas</CardTitle>
              </div>
              <CardDescription>
                Administra tus relaciones con minas, controla balances y 
                historiales de transacciones detallados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Control de balances en tiempo real
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Historial completo de viajes
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Exportación a Excel
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-blue-200 dark:bg-gray-800/80 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Building2 className="h-8 w-8 text-blue-600 mr-3" />
                <CardTitle className="text-xl">Compradores</CardTitle>
              </div>
              <CardDescription>
                Gestiona compradores, precios de venta y 
                valores a consignar automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Cálculos automáticos de consignación
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Seguimiento de pagos de flete
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Reportes financieros detallados
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-blue-200 dark:bg-gray-800/80 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Truck className="h-8 w-8 text-purple-600 mr-3" />
                <CardTitle className="text-xl">Volqueteros</CardTitle>
              </div>
              <CardDescription>
                Administra conductores, vehículos y pagos de flete 
                con seguimiento completo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Agrupación por conductor
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Control de múltiples placas
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Balances dinámicos
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-blue-600 text-white border-blue-700 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">¿Listo para comenzar?</CardTitle>
              <CardDescription className="text-blue-100">
                Accede a tu cuenta para gestionar tus operaciones mineras de forma eficiente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button 
                  onClick={handleLogin}
                  variant="secondary" 
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 w-full"
                >
                  Ingresar al Sistema
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                
                <Button 
                  onClick={handleClearCacheAndLogin}
                  variant="outline"
                  size="lg"
                  className="bg-transparent border-white text-white hover:bg-white/10 px-8 py-3 w-full"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Limpiar Cache y Entrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}