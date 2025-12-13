# Changelog - Cambios Recientes

## Fecha: Enero 2025

### Problema Resuelto: Transacciones de LCDM y Postobón no visibles para usuarios ADMIN

#### Descripción del Problema
Los usuarios con rol ADMIN no podían ver las transacciones en las pestañas "LCDM" y "Postobón" del módulo RodMar. El sistema devolvía errores 401 (No autenticado) al intentar acceder a estas transacciones.

#### Causa Raíz
1. **Backend**: Las rutas `/api/transacciones/lcdm` y `/api/transacciones/postobon` estaban filtrando las transacciones por `userId`, lo que impedía que los administradores vieran transacciones creadas por otros usuarios o con `userId` nulo.

2. **Frontend**: Los componentes `LcdmTransactionsTab` y `PostobonTransactionsTab` estaban haciendo queries sin incluir el token de autenticación en los headers, causando errores 401.

---

## Cambios en el Backend

### Archivo: `server/routes.ts`

#### Ruta: `GET /api/transacciones/lcdm`

**Cambios realizados:**
- Se agregó verificación del rol ADMIN del usuario autenticado
- Si el usuario es ADMIN, se pasa `userId = undefined` a los métodos de storage, permitiendo ver todas las transacciones
- Si el usuario no es ADMIN, se mantiene el filtro por `userId` (comportamiento original)

**Código relevante:**
```typescript
app.get("/api/transacciones/lcdm", requireAuth, async (req, res) => {
  try {
    // Verificar si el usuario es ADMIN - si lo es, no filtrar por userId
    let userId: string | undefined = req.user?.id || "main_user";
    const isAdmin = req.user?.roleId ? await db.select().from(roles).where(eq(roles.id, req.user.roleId)).then(r => r[0]?.nombre === 'ADMIN') : false;
    
    // Si es admin, no filtrar por userId (ver todas las transacciones)
    if (isAdmin) {
      userId = undefined;
    }
    
    // ... resto del código
  }
});
```

**Funcionalidad:**
- Verifica el rol del usuario autenticado consultando la tabla `roles`
- Si es ADMIN, establece `userId = undefined` para que `storage.getTransacciones()` y `storage.getTransaccionesIncludingHidden()` no filtren por usuario
- Mantiene compatibilidad con usuarios no-admin que solo ven sus propias transacciones

#### Ruta: `GET /api/transacciones/postobon`

**Cambios realizados:**
- Misma lógica que la ruta de LCDM: verificación de rol ADMIN y bypass del filtro `userId` si es necesario

**Parámetros soportados:**
- `page`: Número de página (default: 1)
- `limit`: Cantidad de resultados por página (default: 50)
- `filterType`: Tipo de filtro - 'todas', 'santa-rosa', 'cimitarra'
- `includeHidden`: Si es 'true', incluye transacciones ocultas sin paginación
- `search`: Búsqueda por texto
- `fechaDesde`: Filtro de fecha inicial
- `fechaHasta`: Filtro de fecha final

**Comportamiento:**
- Si `includeHidden=true`: Devuelve todas las transacciones (incluyendo ocultas) como array directo
- Si `includeHidden=false` o no está presente: Devuelve respuesta paginada con estructura `{ data: [...], pagination: {...} }`

---

## Cambios en el Frontend

### Archivo: `client/src/components/modules/rodmar.tsx`

#### Queries Principales (Componente RodMar)

**Query para LCDM:**
```typescript
const { data: lcdmTransactionsData } = useQuery({
  queryKey: ["/api/transacciones/lcdm?includeHidden=true"],
  queryFn: async ({ queryKey }) => {
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
    
    const response = await fetch(apiUrl("/api/transacciones/lcdm?includeHidden=true"), {
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
  },
  enabled: has("module.RODMAR.LCDM.view"),
});
```

**Características:**
- Usa `includeHidden=true` para obtener todas las transacciones sin paginación
- Incluye token de autenticación en headers
- Maneja errores 401 limpiando el token
- Usa `parseJsonWithDateInterception` para manejar fechas UTC correctamente
- Solo se ejecuta si el usuario tiene el permiso `module.RODMAR.LCDM.view`

**Query para Postobón:**
- Similar a la query de LCDM pero con `filterType=todas` en la URL
- Requiere permiso `module.RODMAR.Postobon.view`

#### Componente: `LcdmTransactionsTab`

**Query con Paginación:**
```typescript
const { data: transactionsData } = useQuery({
  queryKey: ["/api/transacciones/lcdm", currentPage, pageSize],
  queryFn: async () => {
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
  },
});
```

**Cambios realizados:**
- ✅ Agregado token de autenticación en headers
- ✅ Agregado headers de cache control
- ✅ Agregado `credentials: "include"` para mantener cookies de sesión

**Query para Transacciones Ocultas:**
- Query separada que obtiene todas las transacciones (incluyendo ocultas) para contar cuántas están ocultas
- Usa `includeHidden=true` en la URL
- Ya tenía el token correctamente implementado

#### Componente: `PostobonTransactionsTab`

**Query con Paginación:**
- Similar a `LcdmTransactionsTab` pero con parámetro adicional `filterType`
- Soporta filtros: 'todas', 'santa-rosa', 'cimitarra'

**Cambios realizados:**
- ✅ Agregado token de autenticación en headers (mismo patrón que LCDM)
- ✅ Agregado headers de cache control
- ✅ Agregado `credentials: "include"`

---

## Funciones y Utilidades

### Función: `getAuthToken()`
**Ubicación:** `client/src/hooks/useAuth.ts`

**Descripción:**
Obtiene el token de autenticación almacenado en `localStorage` bajo la clave `auth_token`.

**Uso:**
```typescript
import { getAuthToken } from "@/hooks/useAuth";
const token = getAuthToken(); // string | null
```

### Función: `removeAuthToken()`
**Ubicación:** `client/src/hooks/useAuth.ts`

**Descripción:**
Elimina el token de autenticación de `localStorage` y limpia el estado de autenticación.

**Uso:**
```typescript
import { removeAuthToken } from "@/hooks/useAuth";
removeAuthToken();
```

### Función: `parseJsonWithDateInterception()`
**Ubicación:** `client/src/lib/queryClient.ts`

**Descripción:**
Parsea una respuesta JSON interceptando strings que parecen fechas UTC para mantenerlos como strings y evitar conversiones automáticas que cambien la zona horaria.

**Uso:**
```typescript
import { parseJsonWithDateInterception } from "@/lib/queryClient";
const data = await parseJsonWithDateInterception(response);
```

### Función: `apiUrl()`
**Ubicación:** `client/src/lib/api.ts`

**Descripción:**
Construye URLs completas del API usando la URL base configurada en `VITE_API_URL` o una URL relativa en desarrollo.

**Uso:**
```typescript
import { apiUrl } from "@/lib/api";
const fullUrl = apiUrl("/api/transacciones/lcdm?includeHidden=true");
```

---

## Permisos Requeridos

Para que un usuario pueda ver las transacciones de LCDM y Postobón, debe tener los siguientes permisos asignados:

1. **`module.RODMAR.LCDM.view`**: Permite ver la pestaña y transacciones de LCDM
2. **`module.RODMAR.Postobon.view`**: Permite ver la pestaña y transacciones de Postobón

**Nota:** Estos permisos están incluidos en el rol ADMIN por defecto. Si un usuario no tiene estos permisos, las queries no se ejecutarán (`enabled: has("module.RODMAR.LCDM.view")`).

---

## Flujo de Autenticación

1. **Usuario inicia sesión** → Se genera un JWT token
2. **Token se guarda** en `localStorage` como `auth_token`
3. **Cada petición API** incluye el token en el header: `Authorization: Bearer <token>`
4. **Backend verifica** el token usando `requireAuth` middleware
5. **Si el usuario es ADMIN**, el backend no filtra por `userId`
6. **Si el token es inválido o expirado**, el frontend limpia el token y redirige al login

---

## Manejo de Errores

### Error 401 (No autenticado)
- **Causa:** Token no presente, inválido o expirado
- **Acción:** 
  - Se llama a `removeAuthToken()` para limpiar el token
  - Se lanza un error que React Query maneja
  - El usuario debería ser redirigido al login

### Error 403 (Sin permisos)
- **Causa:** Usuario no tiene el permiso requerido
- **Acción:** Las queries no se ejecutan (`enabled: false`)

---

## Consideraciones de Rendimiento

1. **Cache:** Las queries usan `staleTime: 300000` (5 minutos) para evitar refetches innecesarios
2. **Paginación:** Las queries principales usan `includeHidden=true` para obtener todos los datos de una vez, mientras que los componentes de tabs usan paginación del servidor
3. **Prefetching:** Los componentes de tabs implementan prefetching automático de páginas siguientes en segundo plano

---

## Testing

Para verificar que los cambios funcionan correctamente:

1. **Como usuario ADMIN:**
   - Iniciar sesión con credenciales de admin
   - Navegar al módulo RodMar
   - Verificar que las pestañas LCDM y Postobón muestran transacciones
   - Verificar que se ven transacciones de todos los usuarios

2. **Como usuario no-admin:**
   - Iniciar sesión con credenciales de usuario regular
   - Navegar al módulo RodMar
   - Verificar que solo se ven las transacciones propias del usuario

3. **Verificar autenticación:**
   - Abrir las herramientas de desarrollador
   - Verificar que las peticiones incluyen el header `Authorization: Bearer <token>`
   - Verificar que no hay errores 401 en la consola

---

## Notas Adicionales

- Los cambios son **retrocompatibles**: usuarios no-admin siguen viendo solo sus transacciones
- El sistema de permisos sigue funcionando: si un usuario no tiene los permisos requeridos, las queries no se ejecutan
- El token se valida en cada petición, por lo que si expira, el usuario será redirigido al login automáticamente

