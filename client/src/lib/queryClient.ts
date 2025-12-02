import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  console.log(`Making ${method} request to ${url}`, data);
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log(`Response: ${res.status} ${res.statusText}`);
  
  await throwIfResNotOk(res);
  return res;
}

// Función auxiliar para interceptar JSON parsing en cualquier response
export async function parseJsonWithDateInterception(res: Response) {
  const text = await res.text();
  
  // Debug temporal para verificar que está funcionando
  console.log('JSON INTERCEPTOR (apiRequest) - Raw response:', text.substring(0, 200));
  
  const result = JSON.parse(text, (key, value) => {
    // Si el valor es un string que parece una fecha UTC, mantenerlo como string
    if (typeof value === 'string' && 
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
      console.log('JSON INTERCEPTOR (apiRequest) - Preserving date string:', key, value);
      return value; // Mantener como string para evitar conversión UTC automática
    }
    return value;
  });
  
  console.log('JSON INTERCEPTOR (apiRequest) - Final result sample:', JSON.stringify(result).substring(0, 300));
  return result;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Agregar timestamp para evitar caché del navegador
    const url = queryKey[0] as string;
    // En producción usa VITE_API_URL, en desarrollo usa URL relativa
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
    
    // Debug: verificar que VITE_API_URL esté configurada
    if (!baseUrl && import.meta.env.PROD) {
      console.error('❌ VITE_API_URL no está configurada en producción!');
      console.error('   Las peticiones irán a:', window.location.origin, '(incorrecto)');
      console.error('   Deberían ir a Railway. Configura VITE_API_URL en Vercel.');
    }
    
    const cacheBuster = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    
    const res = await fetch(cacheBuster, {
      credentials: "include",
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Interceptar el parsing de JSON para manejar fechas UTC correctamente
    const text = await res.text();
    
    const result = JSON.parse(text, (key, value) => {
      // Si el valor es un string que parece una fecha UTC, mantenerlo como string
      if (typeof value === 'string' && 
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
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
  console.log("🗑️ Cache completamente limpiado");
};
