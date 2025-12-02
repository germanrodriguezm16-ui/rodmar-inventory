# 🔧 Solución: ERR_NAME_NOT_RESOLVED

## Problema

El error `ERR_NAME_NOT_RESOLVED` significa que el navegador no puede resolver el dominio `rodmar-inventory-production.up.railway.app`. Esto puede deberse a:

1. **Servicio de Railway pausado o caído**
2. **Dominio de Railway cambiado**
3. **Problema de DNS temporal**

## Verificación Paso a Paso

### Paso 1: Verificar que Railway esté activo

1. Ve a [Railway Dashboard](https://railway.app)
2. Abre tu proyecto
3. Verifica que el servicio esté **"Active"** (no pausado)
4. Si está pausado, haz clic en **"Resume"**

### Paso 2: Verificar la URL correcta de Railway

1. En Railway Dashboard → Tu servicio → Pestaña **"Settings"**
2. Busca la sección **"Domains"** o **"Networking"**
3. Copia la URL pública (debería ser algo como `https://rodmar-inventory-production.up.railway.app`)
4. **Verifica que coincida** con la que está en `VITE_API_URL` en Vercel

### Paso 3: Probar la URL directamente

Abre en tu navegador:
```
https://rodmar-inventory-production.up.railway.app/api/minas
```

**Si funciona:**
- Deberías ver un JSON con las minas
- El problema es temporal o de caché del navegador

**Si NO funciona:**
- El servicio está caído o pausado
- Necesitas reactivarlo en Railway

### Paso 4: Verificar variables de entorno en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com)
2. Abre tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que `VITE_API_URL` sea exactamente:
   ```
   https://rodmar-inventory-production.up.railway.app
   ```
   (sin barra al final, con `https://`)

### Paso 5: Forzar redeploy en Vercel

Si cambiaste `VITE_API_URL`:
1. Ve a **Deployments**
2. Haz clic en los tres puntos del último deployment
3. Selecciona **"Redeploy"**

## Soluciones Temporales

### Opción 1: Verificar si Railway está pausado

Railway pausa servicios inactivos después de un tiempo. Si tu servicio está pausado:
1. Ve a Railway Dashboard
2. Haz clic en **"Resume"** o **"Start"**
3. Espera 1-2 minutos a que se active

### Opción 2: Verificar logs de Railway

1. En Railway Dashboard → Tu servicio → Pestaña **"Logs"**
2. Busca errores o mensajes que indiquen por qué el servicio no responde

### Opción 3: Verificar el dominio correcto

El dominio de Railway puede cambiar. Verifica:
1. Railway Dashboard → Settings → Networking
2. Copia la URL pública exacta
3. Actualiza `VITE_API_URL` en Vercel con esa URL exacta
4. Haz redeploy en Vercel

## Nota sobre WebSockets

Los WebSockets también fallarán si Railway no está activo. Una vez que Railway esté funcionando, los WebSockets deberían conectarse automáticamente.

---

**Comparte:**
1. ¿El servicio de Railway está activo o pausado?
2. ¿Qué URL ves en Railway Dashboard → Settings → Networking?
3. ¿Qué ves cuando abres `https://rodmar-inventory-production.up.railway.app/api/minas` directamente en el navegador?

