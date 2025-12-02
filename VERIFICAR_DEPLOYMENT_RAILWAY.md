# ✅ Verificar Deployment en Railway

## Checklist de Verificación

### 1. Variables de Entorno ✅
- [x] DATABASE_URL (verificar que NO tenga "PORT" al final)
- [x] PORT = 5000
- [x] NODE_ENV = production
- [x] SESSION_SECRET
- [x] USE_PG_SESSIONS = true
- [x] CORS_ORIGIN (puede ser `*` por ahora)

### 2. Estado del Deployment

**En Railway:**
1. Ve a la pestaña **"Deployments"**
2. Verifica que el último deployment esté:
   - ✅ **"Active"** (verde) - ¡Perfecto!
   - ⏳ **"Building"** - Espera a que termine
   - ❌ **"Failed"** - Revisa los logs

### 3. Verificar Logs

**En Railway:**
1. Ve a la pestaña **"Logs"**
2. Busca estos mensajes de éxito:
   - ✅ `✅ Conexión a base de datos configurada`
   - ✅ `✅ Socket.io inicializado`
   - ✅ `🚀 RodMar Inventory v2.0.0 serving on...`
3. **NO deberías ver:**
   - ❌ `ENOTFOUND`
   - ❌ `Cannot connect to database`
   - ❌ `DATABASE_URL no está configurada`

### 4. Probar el Backend

1. **Obtén la URL de Railway:**
   - Ve a **Settings** → **Networking**
   - Copia la URL (ej: `https://rodmar-inventory-production.up.railway.app`)

2. **Prueba estos endpoints:**
   - `https://tu-url.up.railway.app/api/status`
   - Deberías ver: `{"app":"RodMar Inventory","version":"2.0.0","status":"running",...}`
   
   - `https://tu-url.up.railway.app/health`
   - Deberías ver: `{"status":"ok","timestamp":"..."}`

### 5. Si Hay Errores

**Error: "Cannot connect to database"**
- Verifica que `DATABASE_URL` sea correcta (sin "PORT" al final)
- Verifica que la contraseña esté incluida
- Verifica que Supabase esté activo

**Error: "Port already in use"**
- Verifica que `PORT=5000` esté configurado
- Railway asigna puertos automáticamente, pero el código debe leer `PORT`

**Error en el build**
- Revisa los logs del deployment
- Verifica que el código esté en la rama `main` en GitHub

---

## 🎉 Si Todo Está Bien

Una vez que:
- ✅ Deployment está "Active"
- ✅ Logs muestran conexión exitosa
- ✅ `/api/status` responde correctamente

**¡El backend está desplegado!** 

**Próximo paso:** Desplegar el frontend en Vercel (ver `GUIA_DESPLIEGUE_COMPLETA.md`)

