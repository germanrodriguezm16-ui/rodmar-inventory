# 🔧 Solución: VITE_API_URL no se está usando

## ❌ Problema

Las peticiones van a `https://rodmar-inventory.vercel.app/api/...` en lugar de `https://rodmar-inventory-production.up.railway.app/api/...`

## 🔍 Diagnóstico

Después del nuevo deploy, abre la consola del navegador (F12) y busca estos logs:

```
🔍 DEBUG getApiUrl: {
  VITE_API_URL: "...",
  baseUrl: "...",
  PROD: true,
  MODE: "production",
  windowOrigin: "https://rodmar-inventory.vercel.app"
}
```

**Si `VITE_API_URL` está vacío o `undefined`:**
- La variable no se está inyectando en el build
- Necesitas verificar la configuración en Vercel

**Si `VITE_API_URL` tiene un valor pero `baseUrl` está vacío:**
- Hay un problema con cómo se está leyendo

## ✅ Solución Paso a Paso

### Paso 1: Verificar Variable en Vercel

1. Ve a Vercel → Tu proyecto → **Settings** → **Environment Variables**
2. Busca `VITE_API_URL`
3. Verifica que el valor sea exactamente:
   ```
   https://rodmar-inventory-production.up.railway.app
   ```
   (Sin `/` al final, sin espacios)

### Paso 2: Verificar que esté en todos los entornos

1. Haz clic en `VITE_API_URL` para editarla
2. Verifica que "Environments" esté en **"All Environments"**
3. Si no, cámbialo a "All Environments"
4. Guarda

### Paso 3: Forzar Nuevo Build

**Opción A: Redeploy Manual**
1. Ve a **Deployments**
2. Haz clic en los tres puntos (⋮) del último deployment
3. Selecciona **"Redeploy"**
4. Espera a que termine (2-5 minutos)

**Opción B: Hacer un cambio trivial**
1. Haz un pequeño cambio en cualquier archivo (ej: agregar un espacio)
2. Haz commit y push
3. Vercel hará deploy automáticamente

### Paso 4: Verificar en el Build Log

1. Ve a **Deployments** → Haz clic en el último deployment
2. Ve a la pestaña **"Build Logs"**
3. Busca en los logs si aparece `VITE_API_URL`
4. Deberías ver algo como:
   ```
   VITE_API_URL=https://rodmar-inventory-production.up.railway.app
   ```

### Paso 5: Verificar en el Navegador

Después del nuevo deploy:

1. Abre `https://rodmar-inventory.vercel.app`
2. Abre la consola (F12)
3. Busca el log: `🔍 DEBUG getApiUrl`
4. Verifica que `VITE_API_URL` tenga el valor correcto
5. Verifica que las peticiones vayan a Railway, no a Vercel

## 🆘 Si Sigue Sin Funcionar

### Verificar que la variable esté disponible en build time

En Vercel, las variables `VITE_*` deben estar disponibles durante el build. Si agregaste la variable después del primer deploy, necesitas hacer un nuevo deploy.

### Verificar el formato de la variable

Asegúrate de que:
- ✅ El nombre sea exactamente: `VITE_API_URL` (mayúsculas)
- ✅ El valor sea: `https://rodmar-inventory-production.up.railway.app` (sin espacios, sin `/` al final)
- ✅ Esté en "All Environments"

### Verificar en el código compilado

1. Abre `https://rodmar-inventory.vercel.app`
2. Abre DevTools → **Sources** o **Network**
3. Busca el archivo JavaScript principal (ej: `index-xxxxx.js`)
4. Busca `VITE_API_URL` en el código
5. Deberías ver el valor inyectado

## 📝 Notas Importantes

- Las variables `VITE_*` se inyectan en **tiempo de build**, no en tiempo de ejecución
- Si cambias la variable, **debes hacer un nuevo deploy**
- El valor se "bakea" en el código JavaScript compilado
- No puedes cambiar la variable sin hacer un nuevo build

---

**Después de seguir estos pasos, las peticiones deberían ir a Railway correctamente.**

