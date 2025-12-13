import { apiUrl } from './api';
import { getAuthToken } from '@/hooks/useAuth';

/**
 * Helper para hacer peticiones fetch con autenticación JWT automática
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(apiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  });
}

