const isDev = import.meta.env.DEV;

/**
 * Helper para obtener la URL base del API
 * En producción usa VITE_API_URL, en desarrollo usa URL relativa
 */
export function getApiUrl(): string {
  // En desarrollo, NO usar VITE_API_URL (usar proxy de Vite)
  // Solo usar VITE_API_URL en producción
  const baseUrl = import.meta.env.PROD ? (import.meta.env.VITE_API_URL || '') : '';
  
  // Debug en producción si no está configurada (siempre mostrar error crítico)
  // Los errores críticos siempre se muestran, incluso en producción
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

