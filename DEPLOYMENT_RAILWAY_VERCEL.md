# 🚀 Guía de Deployment: Railway + Vercel + Supabase

Esta guía te ayudará a desplegar tu aplicación RodMar Inventory usando:
- **Supabase**: Base de datos (ya configurada)
- **Railway**: Backend (API + WebSockets)
- **Vercel**: Frontend (React)

---

## 📋 Prerrequisitos

1. ✅ Cuenta en [Supabase](https://supabase.com) (ya la tienes)
2. ✅ Cuenta en [Railway](https://railway.app) (gratis)
3. ✅ Cuenta en [Vercel](https://vercel.com) (gratis)
4. ✅ Repositorio Git (GitHub, GitLab, o Bitbucket)

---

## 🔧 Paso 1: Preparar el Repositorio

### 1.1 Asegúrate de tener estos archivos en tu repositorio:

```
RodMarInventory/
├── railway.json          ✅ (ya creado)
├── vercel.json           ✅ (ya creado)
├── package.json          ✅ (con scripts actualizados)
├── server/               ✅
├── client/               ✅
└── .gitignore           ✅ (asegúrate de excluir .env, node_modules, dist)
```

### 1.2 Variables de Entorno Necesarias

**Para Railway (Backend):**
- `DATABASE_URL` - URL de conexión de Supabase
- `PORT` - Railway lo asigna automáticamente
- `NODE_ENV=production`
- `SESSION_SECRET` - Genera uno seguro
- `USE_PG_SESSIONS=true`

**Para Vercel (Frontend):**
- `VITE_API_URL` - URL de tu backend en Railway

---

## 🚂 Paso 2: Desplegar Backend en Railway

### 2.1 Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) e inicia sesión
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu repositorio y selecciona el proyecto

### 2.2 Configurar Variables de Entorno

En el dashboard de Railway:

1. Ve a tu proyecto → **Variables**
2. Agrega las siguientes variables:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
NODE_ENV=production
SESSION_SECRET=tu-secret-aleatorio-aqui
USE_PG_SESSIONS=true
```

**Para obtener DATABASE_URL de Supabase:**
1. Ve a tu proyecto en Supabase
2. Settings → Database
3. Connection String → URI
4. Copia la URL completa

**Para generar SESSION_SECRET:**
```bash
# En tu terminal:
openssl rand -base64 32
```

### 2.3 Configurar Build y Deploy

Railway detectará automáticamente:
- **Build Command**: `npm run build:server` (definido en `railway.json`)
- **Start Command**: `npm start` (definido en `railway.json`)

### 2.4 Obtener URL del Backend

1. En Railway, ve a tu servicio
2. Haz clic en **"Settings"** → **"Networking"**
3. Haz clic en **"Generate Domain"**
4. Copia la URL (ejemplo: `https://tu-app.up.railway.app`)

**⚠️ IMPORTANTE:** Esta URL será tu `VITE_API_URL` para Vercel.

---

## ▲ Paso 3: Desplegar Frontend en Vercel

### 3.1 Crear Proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en **"Add New..."** → **"Project"**
3. Importa tu repositorio de GitHub
4. Configura el proyecto:

**Configuración del Proyecto:**
- **Framework Preset**: Vite
- **Root Directory**: `./` (raíz del proyecto)
- **Build Command**: `npm run build:client`
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`

### 3.2 Configurar Variables de Entorno

En Vercel, ve a **Settings** → **Environment Variables**:

```env
VITE_API_URL=https://tu-app.up.railway.app
```

**⚠️ IMPORTANTE:** Reemplaza `https://tu-app.up.railway.app` con la URL real de tu backend en Railway.

### 3.3 Configurar CORS en Railway

Necesitas permitir que Vercel haga requests a tu backend. En Railway, agrega esta variable:

```env
CORS_ORIGIN=https://tu-app.vercel.app
```

Luego, actualiza `server/index.ts` o `server/routes.ts` para usar esta variable en la configuración de CORS.

### 3.4 Deploy

1. Haz clic en **"Deploy"**
2. Vercel construirá y desplegará tu frontend
3. Obtendrás una URL (ejemplo: `https://tu-app.vercel.app`)

---

## 🔗 Paso 4: Conectar Frontend con Backend

### 4.1 Actualizar CORS en el Backend

Necesitas actualizar tu código del servidor para permitir requests desde Vercel.

**En `server/index.ts` o donde configures CORS:**

```typescript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

### 4.2 Actualizar Socket.io para Producción

**En `client/src/hooks/useSocket.ts`:**

Asegúrate de que use la variable de entorno:

```typescript
const socket = io(import.meta.env.VITE_API_URL || window.location.origin, {
  transports: ["websocket", "polling"],
  // ...
});
```

---

## ✅ Paso 5: Verificar el Deployment

### 5.1 Verificar Backend

1. Visita: `https://tu-app.up.railway.app/health`
2. Deberías ver: `{"status":"ok","timestamp":"..."}`

### 5.2 Verificar Frontend

1. Visita: `https://tu-app.vercel.app`
2. La aplicación debería cargar
3. Abre la consola del navegador (F12)
4. Verifica que no haya errores de CORS o conexión

### 5.3 Verificar WebSockets

1. En la consola del navegador, deberías ver: `✅ Conectado a Socket.io`
2. En los logs de Railway, deberías ver: `🔌 Cliente conectado: [socket-id]`

---

## 🔄 Paso 6: Actualizaciones Automáticas

### Railway (Backend)
- Cada `git push` a la rama principal desplegará automáticamente
- Los logs están disponibles en tiempo real en el dashboard

### Vercel (Frontend)
- Cada `git push` a la rama principal desplegará automáticamente
- Preview deployments para cada PR

---

## 🐛 Solución de Problemas

### Error: CORS bloqueado
**Solución:** Verifica que `CORS_ORIGIN` en Railway apunte a tu dominio de Vercel.

### Error: No se puede conectar a la base de datos
**Solución:** 
1. Verifica que `DATABASE_URL` esté correcta en Railway
2. Asegúrate de que tu proyecto de Supabase no esté pausado
3. Verifica que la IP de Railway esté permitida en Supabase (si aplica)

### Error: WebSockets no funcionan
**Solución:**
1. Verifica que Railway soporte WebSockets (sí lo hace)
2. Asegúrate de que `VITE_API_URL` esté configurada correctamente en Vercel
3. Verifica los logs de Railway para errores de conexión

### Error: Build falla en Railway
**Solución:**
1. Verifica que `railway.json` esté en la raíz
2. Asegúrate de que `package.json` tenga el script `build:server`
3. Revisa los logs de build en Railway

### Error: Build falla en Vercel
**Solución:**
1. Verifica que `vercel.json` esté en la raíz
2. Asegúrate de que `package.json` tenga el script `build:client`
3. Verifica que `VITE_API_URL` esté configurada

---

## 📊 Monitoreo y Logs

### Railway Logs
- Ve a tu proyecto → **Deployments** → Selecciona un deployment → **View Logs**
- Logs en tiempo real disponibles

### Vercel Logs
- Ve a tu proyecto → **Deployments** → Selecciona un deployment → **View Function Logs**
- Analytics disponibles en el dashboard

---

## 💰 Costos Estimados

### Free Tier (Suficiente para empezar):
- **Supabase**: 500MB base de datos, 2GB bandwidth
- **Railway**: $5 crédito gratis/mes (suficiente para ~100 horas)
- **Vercel**: 100GB bandwidth, deployments ilimitados

### Si necesitas más:
- **Railway**: ~$5-20/mes según uso
- **Vercel**: Gratis hasta cierto límite, luego ~$20/mes
- **Supabase**: Gratis hasta cierto límite, luego ~$25/mes

---

## 🔐 Seguridad

### Variables de Entorno
- ✅ Nunca commitees `.env` al repositorio
- ✅ Usa variables de entorno en Railway y Vercel
- ✅ Rota `SESSION_SECRET` periódicamente

### Base de Datos
- ✅ Mantén `DATABASE_URL` segura
- ✅ Usa conexiones SSL (Supabase lo hace automáticamente)
- ✅ Configura backups en Supabase

---

## 📝 Checklist Final

- [ ] Backend desplegado en Railway
- [ ] Variables de entorno configuradas en Railway
- [ ] URL del backend obtenida
- [ ] Frontend desplegado en Vercel
- [ ] `VITE_API_URL` configurada en Vercel
- [ ] CORS configurado correctamente
- [ ] WebSockets funcionando
- [ ] Base de datos conectada
- [ ] Aplicación accesible públicamente

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en Railway y Vercel
2. Verifica las variables de entorno
3. Consulta la documentación de [Railway](https://docs.railway.app) y [Vercel](https://vercel.com/docs)

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando en:
- **Frontend**: `https://tu-app.vercel.app`
- **Backend**: `https://tu-app.up.railway.app`
- **Base de Datos**: Supabase (ya configurada)

¡Disfruta de tu aplicación desplegada! 🚀

