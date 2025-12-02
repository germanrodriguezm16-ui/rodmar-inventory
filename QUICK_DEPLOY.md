# 🚀 Deployment Rápido - Railway + Vercel

## ⚡ Setup en 10 minutos

### 1️⃣ Backend en Railway (5 min)

1. Ve a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Conecta tu repo y selecciona el proyecto
3. En **Variables**, agrega:
   ```
   DATABASE_URL=tu-url-de-supabase
   NODE_ENV=production
   SESSION_SECRET=genera-uno-aleatorio
   USE_PG_SESSIONS=true
   CORS_ORIGIN=https://tu-app.vercel.app
   ```
4. Railway detectará automáticamente `railway.json` y desplegará
5. Copia la URL del servicio (ej: `https://tu-app.up.railway.app`)

### 2️⃣ Frontend en Vercel (5 min)

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repo de GitHub
3. Configuración:
   - **Framework**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist/public`
4. En **Environment Variables**, agrega:
   ```
   VITE_API_URL=https://tu-app.up.railway.app
   ```
   (Usa la URL de Railway del paso anterior)
5. Haz clic en **Deploy**

### 3️⃣ Actualizar CORS

1. En Railway, actualiza `CORS_ORIGIN` con la URL de Vercel
2. Railway redeployará automáticamente

### ✅ Listo!

- Frontend: `https://tu-app.vercel.app`
- Backend: `https://tu-app.up.railway.app`
- Base de Datos: Supabase (ya configurada)

---

## 📝 Variables de Entorno

### Railway (Backend)
```env
DATABASE_URL=postgresql://postgres:password@host:5432/postgres?sslmode=require
NODE_ENV=production
SESSION_SECRET=tu-secret-aleatorio
USE_PG_SESSIONS=true
CORS_ORIGIN=https://tu-app.vercel.app
```

### Vercel (Frontend)
```env
VITE_API_URL=https://tu-app.up.railway.app
```

---

## 🔄 Actualizaciones Automáticas

- **Railway**: Cada `git push` → deploy automático
- **Vercel**: Cada `git push` → deploy automático

---

## 🐛 Problemas Comunes

**CORS Error?**
→ Verifica que `CORS_ORIGIN` en Railway sea exactamente la URL de Vercel

**No conecta a la DB?**
→ Verifica `DATABASE_URL` en Railway y que Supabase no esté pausado

**WebSockets no funcionan?**
→ Verifica que `VITE_API_URL` esté configurada en Vercel

---

Para más detalles, ver [DEPLOYMENT_RAILWAY_VERCEL.md](./DEPLOYMENT_RAILWAY_VERCEL.md)

