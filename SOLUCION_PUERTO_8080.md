# Solución: Error de Conexión a localhost:8080

## Problema
El frontend está intentando conectarse a `localhost:8080` pero el servidor está en `localhost:5000`.

## Solución Aplicada ✅

He configurado un **proxy en Vite** para que:
- Las peticiones a `/api/*` se redirijan automáticamente a `http://localhost:5000`
- Las conexiones WebSocket a `/socket.io` también se redirijan a `http://localhost:5000`

**Ahora NO necesitas configurar `VITE_API_URL` en desarrollo local.**

---

## Pasos para Probar

### 1. Detén el servidor frontend actual (Ctrl+C)

### 2. Reinicia el servidor frontend:

```powershell
cd RodMarInventory
npm run dev:client
```

### 3. Asegúrate de que el backend está corriendo en otra terminal:

```powershell
cd RodMarInventory
npm run dev
```

**Deberías ver**: `✅ Servidor corriendo en puerto 5000`

### 4. Recarga la página en el navegador

Ahora debería conectarse correctamente porque:
- ✅ Vite proxy redirige `/api/*` → `localhost:5000`
- ✅ Vite proxy redirige `/socket.io` → `localhost:5000`
- ✅ No necesitas configurar variables de entorno

---

## Verificar que Funciona

1. Abre DevTools (F12) → Console
2. **Deberías ver** mensajes de conexión exitosa
3. **NO deberías ver** más errores `ERR_CONNECTION_REFUSED` para `localhost:8080`
4. La aplicación debería cargar correctamente

---

## Si Sigue Sin Funcionar

Verifica que:
1. ✅ El backend está corriendo en `localhost:5000` (revisa la terminal donde ejecutaste `npm run dev`)
2. ✅ El frontend está corriendo en `localhost:5173` (o el puerto que muestra Vite)
3. ✅ Reiniciaste el frontend después de cambiar `vite.config.ts`



