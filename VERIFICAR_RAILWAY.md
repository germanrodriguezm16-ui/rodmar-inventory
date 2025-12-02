# 🔍 Verificación Rápida: Railway No Responde

## El Problema

El error `ERR_NAME_NOT_RESOLVED` significa que el navegador **no puede encontrar** el servidor de Railway. Esto NO es un problema de código, sino de infraestructura.

## ✅ Verificación Inmediata (5 minutos)

### 1. Abre Railway Dashboard
Ve a: https://railway.app/dashboard

### 2. Verifica el Estado del Servicio

**Busca tu servicio "rodmar-inventory-production" y verifica:**

- ✅ **Estado "Active"** (verde) = Servicio funcionando
- ⏸️ **Estado "Paused"** (gris) = Servicio pausado (este es el problema)
- ❌ **Estado "Error"** (rojo) = Servicio con error

### 3. Si está Pausado:

1. Haz clic en el servicio
2. Busca el botón **"Resume"** o **"Start"**
3. Haz clic para reactivar
4. Espera 1-2 minutos
5. Verifica que el estado cambie a "Active"

### 4. Verifica la URL Pública

1. En Railway Dashboard → Tu servicio
2. Ve a la pestaña **"Settings"** o **"Networking"**
3. Busca la sección **"Domains"** o **"Public Domain"**
4. Copia la URL exacta (debería ser algo como `https://rodmar-inventory-production.up.railway.app`)

### 5. Prueba la URL Directamente

Abre en tu navegador:
```
https://rodmar-inventory-production.up.railway.app/api/minas
```

**Resultados esperados:**

- ✅ **Si funciona:** Verás un JSON con las minas → El servicio está activo
- ❌ **Si NO funciona:** Verás un error de conexión → El servicio está pausado o caído

### 6. Verifica los Logs de Railway

1. En Railway Dashboard → Tu servicio
2. Ve a la pestaña **"Logs"**
3. Busca mensajes de error o advertencias
4. Si ves mensajes como "Service paused" o "No activity", confirma que está pausado

## 🔧 Soluciones

### Solución 1: Reactivar el Servicio (Más Común)

Si el servicio está pausado:
1. Haz clic en **"Resume"** o **"Start"**
2. Espera 1-2 minutos
3. Prueba de nuevo en el navegador

### Solución 2: Verificar el Dominio

Si el dominio cambió:
1. Copia la nueva URL de Railway
2. Ve a Vercel Dashboard → Settings → Environment Variables
3. Actualiza `VITE_API_URL` con la nueva URL
4. Haz redeploy en Vercel

### Solución 3: Verificar Variables de Entorno en Railway

1. En Railway Dashboard → Tu servicio → Settings
2. Ve a **"Variables"**
3. Verifica que `DATABASE_URL` esté configurada
4. Verifica que `CORS_ORIGIN` sea `https://rodmar-inventory.vercel.app`
5. Si falta alguna, agrégalas y haz redeploy

## 📋 Checklist Rápido

- [ ] Railway Dashboard abierto
- [ ] Servicio está "Active" (no pausado)
- [ ] URL pública verificada
- [ ] Prueba directa en navegador funciona
- [ ] Logs de Railway sin errores críticos
- [ ] Variables de entorno en Railway configuradas
- [ ] `VITE_API_URL` en Vercel coincide con Railway

## 🚨 Si Nada Funciona

1. **Revisa los logs de Railway** para ver errores específicos
2. **Verifica el plan de Railway** - algunos planes pausan servicios después de inactividad
3. **Considera usar un dominio personalizado** si el dominio de Railway es inestable
4. **Contacta soporte de Railway** si el problema persiste

---

**Comparte conmigo:**
1. ¿El servicio está "Active" o "Paused" en Railway?
2. ¿Qué ves cuando abres `https://rodmar-inventory-production.up.railway.app/api/minas` en el navegador?
3. ¿Hay algún error en los logs de Railway?

