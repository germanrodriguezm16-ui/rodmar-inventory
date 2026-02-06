import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import { getAuthToken, removeAuthToken } from "@/hooks/useAuth";

const isDev = import.meta.env.DEV;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = apiUrl(url);
  
  if (isDev) {
    // Solo loggear en desarrollo
  }
  
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  
  await throwIfResNotOk(res);
  return res;
}

// Función auxiliar para interceptar JSON parsing en cualquier response
export async function parseJsonWithDateInterception(res: Response) {
  const text = await res.text();
  
  // Regex pre-compilado para mejor rendimiento
  const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  
  const result = JSON.parse(text, (key, value) => {
    // Si el valor es un string que parece una fecha UTC, mantenerlo como string
    if (typeof value === 'string' && dateRegex.test(value)) {
      return value; // Mantener como string para evitar conversión UTC automática
    }
    return value;
  });
  
  return result;
}

type UnauthorizedBehavior = "returnNull" | "throw";
// Regex pre-compilado para mejor rendimiento en parsing de fechas
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = apiUrl(url);
    
    // Debug solo si está habilitado explícitamente
    const DEBUG_QUERIES = import.meta.env.VITE_DEBUG_QUERIES === 'true';
    // Los logs de debug solo se muestran si DEBUG_QUERIES está activado
    
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Token inválido o expirado, limpiar
      removeAuthToken();
      return null;
    }

    await throwIfResNotOk(res);
    
    // Interceptar el parsing de JSON para manejar fechas UTC correctamente
    const text = await res.text();
    
    const result = JSON.parse(text, (key, value) => {
      // Si el valor es un string que parece una fecha UTC, mantenerlo como string
      if (typeof value === 'string' && DATE_REGEX.test(value)) {
        return value; // Mantener como string para evitar conversión UTC automática
      }
      return value;
    });
    
    return result;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // No refetch al cambiar de pestaña - WebSockets maneja actualizaciones
      staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
      gcTime: 600000, // 10 minutos - mantener en cache más tiempo
      retry: 1, 
      refetchOnMount: false, // No refetch al montar - WebSockets maneja actualizaciones
      refetchOnReconnect: true, // Refetch al reconectar (importante si se pierde conexión WebSocket)
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Función para limpiar completamente el caché
export const clearCache = () => {
  queryClient.clear();
  // Log removido - solo en desarrollo si es necesario
};
