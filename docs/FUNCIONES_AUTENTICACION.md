# Documentación Técnica: Funciones de Autenticación y Queries

## Índice
1. [Funciones de Autenticación](#funciones-de-autenticación)
2. [Queries de React Query](#queries-de-react-query)
3. [Rutas del Backend](#rutas-del-backend)
4. [Middleware de Autenticación](#middleware-de-autenticación)

---

## Funciones de Autenticación

### `getAuthToken(): string | null`
**Ubicación:** `client/src/hooks/useAuth.ts`

**Descripción:**
Obtiene el token JWT almacenado en el `localStorage` del navegador.

**Implementación:**
```typescript
export function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}
```

**Uso:**
```typescript
import { getAuthToken } from "@/hooks/useAuth";

const token = getAuthToken();
if (token) {
  headers["Authorization"] = `Bearer ${token}`;
}
```

**Valores de retorno:**
- `string`: Token JWT si existe
- `null`: Si no hay token almacenado

**Notas:**
- El token se guarda durante el proceso de login
- Se elimina automáticamente cuando expira o es inválido
- Se almacena bajo la clave `"auth_token"` en `localStorage`

---

### `removeAuthToken(): void`
**Ubicación:** `client/src/hooks/useAuth.ts`

**Descripción:**
Elimina el token de autenticación del `localStorage` y limpia el estado de autenticación.

**Implementación:**
```typescript
export function removeAuthToken(): void {
  localStorage.removeItem("auth_token");
}
```

**Uso:**
```typescript
import { removeAuthToken } from "@/hooks/useAuth";

if (response.status === 401) {
  removeAuthToken(); // Token inválido o expirado
  throw new Error('No autenticado');
}
```

**Cuándo usar:**
- Cuando se recibe un error 401 (No autenticado)
- Cuando el token es inválido o expirado
- Al hacer logout del usuario

---

### `setAuthToken(token: string): void`
**Ubicación:** `client/src/hooks/useAuth.ts`

**Descripción:**
Guarda el token JWT en el `localStorage`.

**Implementación:**
```typescript
export function setAuthToken(token: string): void {
  localStorage.setItem("auth_token", token);
}
```

**Uso:**
```typescript
import { setAuthToken } from "@/hooks/useAuth";

// Después de un login exitoso
setAuthToken(response.token);
```

**Parámetros:**
- `token: string` - Token JWT recibido del servidor

---

## Queries de React Query

### Query: Transacciones LCDM (Principal)
**Ubicación:** `client/src/components/modules/rodmar.tsx` (línea ~118)

**Query Key:**
```typescript
["/api/transacciones/lcdm?includeHidden=true"]
```

**Query Function:**
```typescript
queryFn: async ({ queryKey }) => {
  const url = queryKey[0] as string;
  const fullUrl = apiUrl(url);
  
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn('[LCDM] ⚠️ No token available!');
    removeAuthToken();
    throw new Error('No autenticado');
  }
  
  const response = await fetch(fullUrl, {
    credentials: "include",
    headers,
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('No autenticado');
    }
    throw new Error(`Error: ${response.status}`);
  }
  
  const data = await parseJsonWithDateInterception(response);
  return Array.isArray(data) ? data : (data.data || []);
}
```

**Opciones:**
- `staleTime: 300000` - 5 minutos
- `refetchOnMount: false`
- `refetchOnWindowFocus: false`
- `enabled: has("module.RODMAR.LCDM.view")` - Solo si tiene permiso

**Características:**
- Obtiene todas las transacciones sin paginación (`includeHidden=true`)
- Maneja errores 401 limpiando el token
- Usa `parseJsonWithDateInterception` para fechas UTC
- Solo se ejecuta si el usuario tiene el permiso requerido

---

### Query: Transacciones Postobón (Principal)
**Ubicación:** `client/src/components/modules/rodmar.tsx` (línea ~152)

**Query Key:**
```typescript
["/api/transacciones/postobon?filterType=todas&includeHidden=true"]
```

**Query Function:**
Similar a la query de LCDM pero con `filterType=todas` en la URL.

**Opciones:**
- `enabled: has("module.RODMAR.Postobon.view")` - Solo si tiene permiso

---

### Query: Transacciones LCDM (Paginada)
**Ubicación:** `client/src/components/modules/rodmar.tsx` (línea ~2036, componente `LcdmTransactionsTab`)

**Query Key:**
```typescript
["/api/transacciones/lcdm", currentPage, pageSize]
```

**Query Function:**
```typescript
queryFn: async () => {
  const limit = getLimitForServer();
  const params = new URLSearchParams({
    page: currentPage.toString(),
    limit: limit.toString(),
  });
  
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(apiUrl(`/api/transacciones/lcdm?${params.toString()}`), {
    credentials: "include",
    headers,
  });
  
  return response.json();
}
```

**Respuesta esperada:**
```typescript
{
  data: Transaccion[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasMore: boolean
  },
  hiddenCount?: number
}
```

---

### Query: Transacciones Postobón (Paginada)
**Ubicación:** `client/src/components/modules/rodmar.tsx` (línea ~1023, componente `PostobonTransactionsTab`)

**Query Key:**
```typescript
["/api/transacciones/postobon", currentPage, pageSize, filterType]
```

**Query Function:**
Similar a la query paginada de LCDM pero con parámetro adicional `filterType`.

**Parámetros:**
- `filterType`: 'todas' | 'santa-rosa' | 'cimitarra'

---

## Rutas del Backend

### `GET /api/transacciones/lcdm`
**Ubicación:** `server/routes.ts`

**Middleware:** `requireAuth`

**Parámetros de Query:**
- `page?: number` - Número de página (default: 1)
- `limit?: number` - Resultados por página (default: 50)
- `includeHidden?: boolean` - Si es `true`, devuelve todas las transacciones sin paginación
- `search?: string` - Búsqueda por texto
- `fechaDesde?: string` - Filtro de fecha inicial (YYYY-MM-DD)
- `fechaHasta?: string` - Filtro de fecha final (YYYY-MM-DD)

**Lógica de Filtrado por Usuario:**
```typescript
// Verificar si el usuario es ADMIN
let userId: string | undefined = req.user?.id || "main_user";
const isAdmin = req.user?.roleId 
  ? await db.select().from(roles).where(eq(roles.id, req.user.roleId))
      .then(r => r[0]?.nombre === 'ADMIN') 
  : false;

// Si es admin, no filtrar por userId (ver todas las transacciones)
if (isAdmin) {
  userId = undefined;
}
```

**Respuesta (con paginación):**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2,
    "hasMore": true
  },
  "hiddenCount": 5
}
```

**Respuesta (sin paginación, includeHidden=true):**
```json
[...] // Array directo de transacciones
```

**Filtrado:**
- Filtra transacciones donde `deQuienTipo === 'lcdm'` o `paraQuienTipo === 'lcdm'`
- Si no es admin, también filtra por `userId`

---

### `GET /api/transacciones/postobon`
**Ubicación:** `server/routes.ts`

**Middleware:** `requireAuth`

**Parámetros de Query:**
- `page?: number` - Número de página (default: 1)
- `limit?: number` - Resultados por página (default: 50)
- `filterType?: string` - 'todas' | 'santa-rosa' | 'cimitarra' (default: 'todas')
- `includeHidden?: boolean` - Si es `true`, devuelve todas las transacciones sin paginación
- `search?: string` - Búsqueda por texto
- `fechaDesde?: string` - Filtro de fecha inicial
- `fechaHasta?: string` - Filtro de fecha final

**Lógica de Filtrado:**
- Misma lógica de admin que LCDM
- Filtra transacciones donde `deQuienTipo === 'postobon'` o `paraQuienTipo === 'postobon'`
- Si `filterType !== 'todas'`, filtra adicionalmente por `postobonCuenta`

**Respuesta:**
Similar a la ruta de LCDM.

---

## Middleware de Autenticación

### `requireAuth`
**Ubicación:** `server/middleware/auth.ts`

**Descripción:**
Middleware de Express que verifica la autenticación del usuario mediante JWT token.

**Implementación:**
```typescript
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    
    // Verificar token
    const tokenData = verifyToken(token);
    if (!tokenData) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const userId = tokenData.userId;
    
    // Obtener usuario de la base de datos
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Agregar información del usuario al request
    req.user = {
      id: user[0].id,
      phone: user[0].phone || undefined,
      email: user[0].email || undefined,
      firstName: user[0].firstName || undefined,
      lastName: user[0].lastName || undefined,
      roleId: user[0].roleId || undefined,
    };

    return next();
  } catch (error) {
    console.error("Error en autenticación:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};
```

**Uso:**
```typescript
app.get("/api/transacciones/lcdm", requireAuth, async (req, res) => {
  // req.user está disponible aquí
  const userId = req.user?.id;
  const roleId = req.user?.roleId;
  // ...
});
```

**Request Object Extendido:**
```typescript
interface Request {
  user?: {
    id: string;
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roleId?: number | null;
  };
}
```

**Errores posibles:**
- `401`: No hay token en el header
- `401`: Token inválido o expirado
- `401`: Usuario no encontrado en la base de datos
- `500`: Error interno del servidor

---

## Utilidades

### `parseJsonWithDateInterception(response: Response): Promise<any>`
**Ubicación:** `client/src/lib/queryClient.ts`

**Descripción:**
Parsea una respuesta JSON interceptando strings que parecen fechas UTC para mantenerlos como strings y evitar conversiones automáticas.

**Implementación:**
```typescript
export async function parseJsonWithDateInterception(res: Response) {
  const text = await res.text();
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

  const result = JSON.parse(text, (key, value) => {
    if (typeof value === 'string' && DATE_REGEX.test(value)) {
      return value; // Mantener como string
    }
    return value;
  });

  return result;
}
```

**Uso:**
```typescript
const response = await fetch(url);
const data = await parseJsonWithDateInterception(response);
```

**Por qué es necesario:**
- JavaScript convierte automáticamente strings ISO 8601 a objetos Date
- Esto puede cambiar la zona horaria de las fechas
- Mantener las fechas como strings preserva la información original

---

### `apiUrl(path: string): string`
**Ubicación:** `client/src/lib/api.ts`

**Descripción:**
Construye URLs completas del API usando la URL base configurada.

**Implementación:**
```typescript
export function apiUrl(path: string): string {
  const baseUrl = getApiUrl(); // Obtiene VITE_API_URL o ''
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}
```

**Uso:**
```typescript
const fullUrl = apiUrl("/api/transacciones/lcdm?includeHidden=true");
// En producción: "https://api.example.com/api/transacciones/lcdm?includeHidden=true"
// En desarrollo: "/api/transacciones/lcdm?includeHidden=true"
```

**Comportamiento:**
- En producción: Usa `VITE_API_URL` si está configurada
- En desarrollo: Usa URL relativa (mismo origen)

---

## Flujo Completo de una Petición

1. **Usuario navega a pestaña LCDM/Postobón**
2. **React Query ejecuta la query** (si tiene permisos)
3. **Query function obtiene token** con `getAuthToken()`
4. **Query function construye URL** con `apiUrl()`
5. **Query function hace fetch** con headers de autenticación
6. **Backend recibe petición** → `requireAuth` middleware verifica token
7. **Backend verifica rol ADMIN** (si aplica)
8. **Backend obtiene transacciones** (filtradas o no según rol)
9. **Backend devuelve respuesta** (paginada o array directo)
10. **Frontend parsea respuesta** con `parseJsonWithDateInterception()`
11. **React Query actualiza cache** y re-renderiza componente

---

## Manejo de Errores

### Error 401 (No autenticado)
**Causas:**
- Token no presente en el header
- Token inválido o expirado
- Usuario no encontrado en la base de datos

**Acción en Frontend:**
```typescript
if (response.status === 401) {
  removeAuthToken(); // Limpiar token
  throw new Error('No autenticado'); // React Query maneja el error
}
```

**Acción en Backend:**
```typescript
return res.status(401).json({ error: "No autenticado" });
```

### Error 403 (Sin permisos)
**Causa:**
- Usuario no tiene el permiso requerido

**Acción:**
- Las queries no se ejecutan (`enabled: false`)
- El componente no muestra la pestaña

---

## Consideraciones de Seguridad

1. **Tokens JWT:**
   - Se almacenan en `localStorage` (vulnerable a XSS)
   - Se envían en cada petición en el header `Authorization`
   - Se validan en el servidor en cada petición

2. **Filtrado por Usuario:**
   - Usuarios no-admin solo ven sus propias transacciones
   - Solo usuarios ADMIN pueden ver todas las transacciones
   - El filtrado se hace en el backend, no en el frontend

3. **Permisos:**
   - Se verifican en el frontend (`enabled: has("permiso")`)
   - El backend también debería verificar permisos (no implementado actualmente)

---

## Mejoras Futuras Sugeridas

1. **Verificación de permisos en backend:**
   - Agregar middleware que verifique permisos específicos
   - Evitar que usuarios sin permisos accedan a datos

2. **Refresh tokens:**
   - Implementar refresh tokens para renovar tokens expirados
   - Evitar que el usuario tenga que hacer login frecuentemente

3. **Rate limiting:**
   - Limitar número de peticiones por usuario/IP
   - Prevenir abuso de la API

4. **Logging:**
   - Registrar intentos de acceso no autorizados
   - Monitorear uso de la API

