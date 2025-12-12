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
  user: User;
  permissions: string[];
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Obtener usuario actual y permisos
  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        // No autenticado
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
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al iniciar sesión");
      }

      return response.json() as Promise<AuthResponse>;
    },
    onSuccess: (data) => {
      // Invalidar y actualizar caché
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.setQueryData(["userPermissions", data.user.id], { permissions: data.permissions });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setLocation("/");
    },
  });

  // Mutación para logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error al cerrar sesión");
      }

      return response.json();
    },
    onSuccess: () => {
      // Limpiar caché
      queryClient.clear();
      setLocation("/login");
    },
  });

  const login = (phone: string, password: string) => {
    return loginMutation.mutateAsync({ phone, password });
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
