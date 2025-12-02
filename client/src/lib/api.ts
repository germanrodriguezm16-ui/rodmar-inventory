/**
 * Helper para obtener la URL base del API
 * En producción usa VITE_API_URL, en desarrollo usa URL relativa
 */
export function getApiUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // Debug siempre para ver qué está pasando
  console.log('🔍 DEBUG getApiUrl:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    baseUrl,
    PROD: import.meta.env.PROD,
    MODE: import.meta.env.MODE,
    windowOrigin: window.location.origin
  });
  
  // Debug en producción si no está configurada
  if (!baseUrl && import.meta.env.PROD) {
    console.error('❌ VITE_API_URL no está configurada en producción!');
    console.error('   Las peticiones irán a:', window.location.origin, '(incorrecto)');
    console.error('   Deberían ir a Railway. Configura VITE_API_URL en Vercel y haz redeploy.');
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

