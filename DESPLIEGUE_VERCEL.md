# ▲ Despliegue en Vercel - Guía Paso a Paso

## 📋 Requisitos Previos

- ✅ Backend desplegado en Railway
- ✅ URL de Railway (ej: `https://rodmar-inventory-production.up.railway.app`)
- ✅ Cuenta de Vercel (puedes iniciar sesión con GitHub)

---

## Paso 1: Crear Proyecto en Vercel

1. **Ve a Vercel:**
   - Abre [vercel.com](https://vercel.com)
   - Inicia sesión con GitHub (si no lo has hecho)

2. **Importar Proyecto:**
   - Haz clic en **"Add New..."** → **"Project"**
   - Busca y selecciona: `rodmar-inventory`
   - Haz clic en **"Import"**

3. **Configuración del Proyecto:**
   - Vercel debería detectar automáticamente que es un proyecto Vite
   - Verifica que muestre:
     - **Framework Preset**: Vite
     - **Build Command**: `npm run build:client`
     - **Output Directory**: `dist/public`
     - **Install Command**: `npm ci`

---

## Paso 2: Configurar Variables de Entorno

**ANTES de hacer deploy**, configura la variable de entorno:

1. **En la página de configuración del proyecto:**
   - Busca la sección **"Environment Variables"**
   - Haz clic en **"Add"** o **"+ New"**

2. **Agrega esta variable:**
   - **Name**: `VITE_API_URL`
   - **Value**: `https://tu-url.up.railway.app` (la URL de Railway que copiaste)
   - **Environment**: Selecciona todas (Production, Preview, Development)
   - Haz clic en **"Save"**

**Ejemplo:**
```
VITE_API_URL = https://rodmar-inventory-production.up.railway.app
```

---

## Paso 3: Desplegar

1. **Haz clic en "Deploy"**
2. **Espera el build** (2-5 minutos)
3. **Vercel te dará una URL** (ej: `https://rodmar-inventory.vercel.app`)
4. **Copia esta URL** - la necesitarás para actualizar Railway

---

## Paso 4: Actualizar CORS_ORIGIN en Railway

Una vez que tengas la URL de Vercel:

1. **Ve a Railway:**
   - Ve a tu servicio `rodmar-inventory`
   - Pestaña **"Variables"**

2. **Actualiza CORS_ORIGIN:**
   - Edita la variable `CORS_ORIGIN`
   - Cambia el valor a tu URL de Vercel:
     ```
     https://rodmar-inventory.vercel.app
     ```
   - Guarda

3. **Railway reiniciará automáticamente** el servicio

---

## Paso 5: Verificar el Despliegue

### Verificar Frontend:

1. **Abre la URL de Vercel** en tu navegador
2. **Deberías ver** la aplicación funcionando
3. **Abre la consola del navegador** (F12):
   - ✅ No deberías ver errores de conexión
   - ✅ Las peticiones deberían ir a Railway
   - ✅ Deberías ver: `✅ Conectado a Socket.io`

### Verificar Backend:

1. **Abre la URL de Railway** en tu navegador
2. **Prueba**: `https://tu-url.up.railway.app/api/status`
3. **Deberías ver**: `{"app":"RodMar Inventory","version":"2.0.0","status":"running",...}`

---

## 🔧 Solución de Problemas

### Error: "Cannot connect to API"

**Causa:** `VITE_API_URL` incorrecta o no configurada

**Solución:**
1. Verifica que `VITE_API_URL` en Vercel sea correcta
2. Debe ser la URL completa de Railway (con `https://`)
3. Haz un nuevo deploy después de cambiar la variable

### Error: "CORS policy"

**Causa:** `CORS_ORIGIN` en Railway no coincide con la URL de Vercel

**Solución:**
1. Verifica que `CORS_ORIGIN` en Railway sea exactamente la URL de Vercel
2. Debe incluir `https://` y no tener `/` al final
3. Reinicia el servicio en Railway

### El frontend carga pero no hay datos

**Causa:** WebSocket no se conecta o API no responde

**Solución:**
1. Verifica que Railway esté activo
2. Verifica que `VITE_API_URL` apunte a Railway (no a Vercel)
3. Revisa la consola del navegador para errores

---

## ✅ Checklist de Despliegue

- [ ] Proyecto importado en Vercel
- [ ] `VITE_API_URL` configurada con URL de Railway
- [ ] Deploy completado exitosamente
- [ ] URL de Vercel obtenida
- [ ] `CORS_ORIGIN` actualizado en Railway con URL de Vercel
- [ ] Frontend carga correctamente
- [ ] Backend responde en Railway
- [ ] WebSocket se conecta (ver consola del navegador)
- [ ] No hay errores en la consola

---

## 📝 Notas Importantes

- **Vercel hace deploy automático** cuando haces `git push` a `main`
- **Las variables de entorno** se pueden actualizar sin hacer nuevo deploy
- **El dominio** se puede personalizar en Settings → Domains
- **Los logs** están disponibles en la pestaña "Deployments" → "View Function Logs"

---

**¡Listo!** Tu aplicación debería estar funcionando completamente:
- **Frontend**: `https://tu-app.vercel.app`
- **Backend**: `https://tu-app.up.railway.app`
- **Base de datos**: Supabase (conectada desde Railway)

