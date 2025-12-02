# Variables de Entorno - Template

Copia este contenido a un archivo `.env` en la raíz del proyecto (o configura estas variables en Railway/Vercel).

## Para Railway (Backend)

```env
# Base de Datos Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require

# Servidor
PORT=5000
NODE_ENV=production

# Sesiones
SESSION_SECRET=genera-un-secret-aleatorio-aqui
USE_PG_SESSIONS=true

# CORS (URL de tu frontend en Vercel)
CORS_ORIGIN=https://tu-app.vercel.app
```

## Para Vercel (Frontend)

```env
# URL del Backend (URL de Railway)
VITE_API_URL=https://tu-app.up.railway.app
```

## Cómo obtener DATABASE_URL de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Settings** → **Database**
3. Busca **Connection String** → **URI**
4. Copia la URL completa
5. Reemplaza `[YOUR-PASSWORD]` con tu contraseña de base de datos

## Cómo generar SESSION_SECRET

```bash
# En Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# En Linux/Mac:
openssl rand -base64 32
```

## Notas Importantes

- ⚠️ **NUNCA** commitees el archivo `.env` al repositorio
- ✅ Usa variables de entorno en Railway y Vercel
- ✅ Mantén `DATABASE_URL` y `SESSION_SECRET` seguras
- ✅ `CORS_ORIGIN` debe ser la URL exacta de tu frontend en Vercel
- ✅ `VITE_API_URL` debe ser la URL exacta de tu backend en Railway

