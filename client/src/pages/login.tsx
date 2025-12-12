import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("📝 [LOGIN] handleSubmit llamado", { phone: phone.substring(0, 3) + "***", hasPassword: !!password });
    
    if (!phone || !password) {
      console.warn("⚠️ [LOGIN] Formulario incompleto", { phone: !!phone, password: !!password });
      return;
    }

    console.log("📝 [LOGIN] Enviando formulario de login");
    try {
      const result = await login(phone, password);
      console.log("✅ [LOGIN] Login exitoso en handleSubmit:", result);
    } catch (error) {
      // El error ya se maneja en useAuth, pero lo logueamos para debug
      console.error("❌ [LOGIN] Error capturado en handleSubmit:", error);
      // No necesitamos hacer nada más, el error se muestra en loginError
    }
  };

  // Debug: mostrar estado del error
  useEffect(() => {
    if (loginError) {
      console.log("🔴 [LOGIN] loginError detectado:", loginError);
    }
  }, [loginError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">RodMar</CardTitle>
          <CardDescription className="text-center">
            Inicia sesión con tu número de celular
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Celular</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ej: 3001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoggingIn}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>

            {loginError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {loginError instanceof Error ? loginError.message : "Error al iniciar sesión"}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoggingIn || !phone || !password}
              onClick={(e) => {
                console.log("🖱️ [LOGIN] Botón clickeado", { phone: phone.substring(0, 3) + "***", hasPassword: !!password, isLoggingIn });
              }}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

