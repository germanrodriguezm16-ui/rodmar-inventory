# 🚂 Despliegue en Railway - Guía Paso a Paso

## 📋 Requisitos Previos

- ✅ Cuenta de Railway creada
- ✅ Iniciado sesión con GitHub
- ✅ Repositorio en GitHub: `germanrodriguezm16-ui/rodmar-inventory`

---

## Paso 1: Crear Nuevo Proyecto

1. **En Railway Dashboard:**
   - Ve a [railway.app](https://railway.app)
   - Haz clic en **"New Project"** (botón verde o "+" en la esquina superior)

2. **Seleccionar Repositorio:**
   - Selecciona **"Deploy from GitHub repo"**
   - Si es la primera vez, autoriza Railway a acceder a tus repositorios de GitHub
   - Busca y selecciona: `rodmar-inventory`
   - Haz clic en **"Deploy Now"**

3. **Railway comenzará a construir:**
   - Verás el proceso de build en tiempo real
   - Puede tardar 2-5 minutos

---

## Paso 2: Configurar Variables de Entorno

**IMPORTANTE:** Configura estas variables ANTES de que termine el primer deploy.

1. **En el dashboard de Railway:**
   - Haz clic en tu servicio (debería llamarse `rodmar-inventory`)
   - Ve a la pestaña **"Variables"**

2. **Agregar Variables:**
   Haz clic en **"New Variable"** y agrega cada una:

   ```env
   DATABASE_URL=postgresql://postgres.ftzkvgawbigqfndualpu:zSLQCeRUFIIxiFph@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=no-verify
   ```

   ```env
   PORT=5000
   ```

   ```env
   NODE_ENV=production
   ```

   ```env
   SESSION_SECRET=t53hqpD3QO1PGsG9PaWb3GyDyBQ5kawTlXYFwX0afUU=
   ```

   ```env
   USE_PG_SESSIONS=true
   ```

   ```env
   CORS_ORIGIN=https://tu-app.vercel.app
   ```
   ⚠️ **Nota:** Deja `CORS_ORIGIN` temporalmente vacío o pon `*` por ahora. Lo actualizarás después de desplegar Vercel.

3. **Verificar:**
   - Deberías ver 6 variables configuradas
   - Railway reiniciará automáticamente el servicio

---

## Paso 3: Configurar el Dominio

1. **En Railway:**
   - Ve a la pestaña **"Settings"**
   - Busca la sección **"Networking"** o **"Domains"**

2. **Generar Dominio:**
   - Haz clic en **"Generate Domain"** o **"Custom Domain"**
   - Railway generará una URL como: `tu-app.up.railway.app`
   - **Copia esta URL** - la necesitarás para Vercel

3. **Verificar Estado:**
   - Espera a que el estado sea **"Active"** (verde)
   - Puede tardar 1-2 minutos

---

## Paso 4: Verificar el Despliegue

1. **Verificar Build:**
   - En la pestaña **"Deployments"**
   - Deberías ver el estado como **"Active"** (verde)
   - Si hay errores, haz clic para ver los logs

2. **Probar el Backend:**
   - Abre la URL de Railway en tu navegador
   - Deberías ver una respuesta JSON o el mensaje del API
   - Prueba: `https://tu-app.up.railway.app/api/status`
   - Deberías ver: `{"app":"RodMar Inventory","version":"2.0.0","status":"running",...}`

3. **Verificar Logs:**
   - En Railway, ve a la pestaña **"Logs"**
   - Deberías ver:
     - `✅ Conexión a base de datos configurada`
     - `✅ Socket.io inicializado`
     - `🚀 RodMar Inventory v2.0.0 serving on...`
   - **NO deberías ver errores de `ENOTFOUND`**

---

## Paso 5: Actualizar CORS_ORIGIN (Después de Vercel)

Una vez que despliegues en Vercel:

1. **Obtén la URL de Vercel:**
   - Ejemplo: `https://rodmar-inventory.vercel.app`

2. **Actualiza en Railway:**
   - Ve a **Variables**
   - Edita `CORS_ORIGIN`
   - Cambia a: `https://rodmar-inventory.vercel.app` (tu URL real de Vercel)
   - Railway reiniciará automáticamente

---

## 🔧 Solución de Problemas

### Error: "Build failed"

**Causas comunes:**
- Variables de entorno faltantes
- Error en el código

**Solución:**
1. Revisa los logs en Railway
2. Verifica que todas las variables estén configuradas
3. Asegúrate de que el código esté en la rama `main` en GitHub

### Error: "Cannot connect to database"

**Solución:**
1. Verifica que `DATABASE_URL` sea correcta
2. Asegúrate de que la contraseña esté incluida
3. Verifica que Supabase esté activo

### El servicio no inicia

**Solución:**
1. Verifica los logs en Railway
2. Asegúrate de que `PORT=5000` esté configurado
3. Verifica que `NODE_ENV=production` esté configurado

---

## ✅ Checklist de Despliegue

- [ ] Proyecto creado en Railway
- [ ] Repositorio conectado
- [ ] Variables de entorno configuradas (6 variables)
- [ ] Dominio generado
- [ ] Estado del servicio: "Active"
- [ ] Backend responde en la URL de Railway
- [ ] Logs muestran conexión exitosa a base de datos
- [ ] No hay errores en los logs

---

## 📝 Notas Importantes

- **Railway hace deploy automático** cuando haces `git push` a `main`
- **Las variables de entorno** se pueden actualizar sin hacer nuevo deploy
- **El dominio** se puede cambiar en Settings → Networking
- **Los logs** son útiles para debugging

---

**Próximo paso:** Desplegar Frontend en Vercel (ver `GUIA_DESPLIEGUE_COMPLETA.md`)

