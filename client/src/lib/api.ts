const isDev = import.meta.env.DEV;

/**
 * Helper para obtener la URL base del API
 * En producción en Vercel usa rutas relativas (proxy), en desarrollo usa URL relativa
 * Si VITE_API_URL está configurada, la usa (para desarrollo local o otros entornos)
 */
export function getApiUrl(): string {
  // Si estamos en Vercel (producción), usar rutas relativas para que el proxy funcione
  const isVercel = window.location.hostname.includes('vercel.app');
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // En Vercel, siempre usar rutas relativas (el proxy manejará el routing)
  if (isVercel && import.meta.env.PROD) {
    return '';
  }
  
  // En desarrollo o si VITE_API_URL está configurada, usarla
  if (baseUrl) {
    return baseUrl;
  }
  
  // Debug solo en desarrollo
  if (isDev) {
    console.log('🔍 DEBUG getApiUrl:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      baseUrl,
      PROD: import.meta.env.PROD,
      MODE: import.meta.env.MODE,
      windowOrigin: window.location.origin,
      isVercel
    });
  }
  
  // En otros casos, usar ruta relativa
  return '';
}

/**
 * Helper para construir URLs completas del API
 */
export function apiUrl(path: string): string {
  const baseUrl = getApiUrl();
  // Si path ya empieza con /, no agregar otro
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

