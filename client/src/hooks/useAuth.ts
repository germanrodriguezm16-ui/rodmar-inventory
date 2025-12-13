import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/api";

interface User {
  id: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: number | null;
}

interface AuthResponse {
  token: string;
  user: User;
  permissions: string[];
}

const TOKEN_KEY = "rodmar_auth_token";

// Helper para obtener el token del localStorage
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Helper para guardar el token en localStorage
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

// Helper para eliminar el token del localStorage
export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Obtener usuario actual y permisos
  const { data, isLoading, error } = useQuery<AuthResponse | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) {
        return null;
      }

      const response = await fetch(apiUrl("/api/auth/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (response.status === 401) {
        // Token inválido o expirado, limpiar
        removeAuthToken();
        return null;
      }

      if (!response.ok) {
        throw new Error("Error al obtener usuario");
      }

      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutación para login
  const loginMutation = useMutation({
    mutationFn: async ({ phone, password }: { phone: string; password: string }) => {
      console.log("🔐 Intentando login con:", { phone: phone.substring(0, 3) + "***" });
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password }),
      });

      console.log("📡 Respuesta del login:", response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = "Error al iniciar sesión";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
          console.error("❌ Error del servidor:", errorMessage);
        } catch (e) {
          console.error("❌ Error parseando respuesta:", e);
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Login exitoso:", data.user?.id);
      
      // Guardar token en localStorage
      if (data.token) {
        setAuthToken(data.token);
        console.log("🔑 Token guardado en localStorage:", data.token.substring(0, 20) + "...");
        // Verificar que se guardó correctamente
        const savedToken = getAuthToken();
        if (savedToken) {
          console.log("✅ Token verificado en localStorage:", savedToken.substring(0, 20) + "...");
        } else {
          console.error("❌ Error: Token no se guardó correctamente en localStorage");
        }
      } else {
        console.error("❌ Error: No se recibió token en la respuesta del login");
      }
      
      return data as AuthResponse;
    },
    onSuccess: (data) => {
      console.log("✅ Login completado, actualizando caché");
      // Invalidar y actualizar caché
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.setQueryData(["userPermissions", data.user.id], { permissions: data.permissions });
      
      // Esperar un momento para asegurar que el token esté disponible antes de invalidar queries
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        setLocation("/");
      }, 100);
    },
    onError: (error) => {
      console.error("❌ Error en login mutation:", error);
    },
  });

  // Mutación para logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      const response = await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : {},
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error al cerrar sesión");
      }

      return response.json();
    },
    onSuccess: () => {
      // Eliminar token del localStorage
      removeAuthToken();
      // Limpiar caché
      queryClient.clear();
      setLocation("/login");
    },
  });

  const login = async (phone: string, password: string) => {
    console.log("🔐 [useAuth] login() llamado");
    try {
      const result = await loginMutation.mutateAsync({ phone, password });
      console.log("✅ [useAuth] login() completado exitosamente");
      return result;
    } catch (error) {
      console.error("❌ [useAuth] login() falló:", error);
      throw error;
    }
  };

  const logout = () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user: data?.user || null,
    permissions: data?.permissions || [],
    isLoading,
    isAuthenticated: !!data?.user,
    error,
    login,
    logout,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}
