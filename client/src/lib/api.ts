/**
 * Helper para obtener la URL base del API
 * En producción usa VITE_API_URL, en desarrollo usa URL relativa
 */
export function getApiUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // Debug en producción si no está configurada
  if (!baseUrl && import.meta.env.PROD) {
    console.warn('⚠️ VITE_API_URL no está configurada en producción. Las peticiones irán a:', window.location.origin);
  }
  
  return baseUrl;
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

