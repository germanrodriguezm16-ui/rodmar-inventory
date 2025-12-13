import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../lib/api";
import { getAuthToken } from "./useAuth";

interface PermissionsResponse {
  permissions: string[];
}

/**
 * Hook para obtener y verificar permisos del usuario actual
 */
export function usePermissions() {
  const { data, isLoading, error } = useQuery<PermissionsResponse>({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl("/api/user/permissions"), {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch permissions");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 1,
  });

  const permissions = data?.permissions || [];

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const has = (permissionKey: string): boolean => {
    return permissions.includes(permissionKey);
  };

  /**
   * Verifica si el usuario tiene alguno de los permisos especificados
   */
  const hasAny = (permissionKeys: string[]): boolean => {
    return permissionKeys.some((key) => permissions.includes(key));
  };

  /**
   * Verifica si el usuario tiene todos los permisos especificados
   */
  const hasAll = (permissionKeys: string[]): boolean => {
    return permissionKeys.every((key) => permissions.includes(key));
  };

  return {
    permissions,
    has,
    hasAny,
    hasAll,
    isLoading,
    error,
  };
}

