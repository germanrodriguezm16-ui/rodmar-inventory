# 🚀 Guía Completa de Despliegue - Paso a Paso

Esta guía te llevará desde cero hasta tener tu aplicación desplegada en **Supabase**, **Railway** y **Vercel**.

---

## 📋 Índice

1. [Preparar el Repositorio Git](#1-preparar-el-repositorio-git)
2. [Subir a GitHub](#2-subir-a-github)
3. [Configurar Supabase](#3-configurar-supabase)
4. [Desplegar Backend en Railway](#4-desplegar-backend-en-railway)
5. [Desplegar Frontend en Vercel](#5-desplegar-frontend-en-vercel)
6. [Configurar Variables de Entorno](#6-configurar-variables-de-entorno)
7. [Verificar y Probar](#7-verificar-y-probar)

---

## 1. Preparar el Repositorio Git

### Paso 1.1: Inicializar Git

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
cd RodMarInventory
git init
```

### Paso 1.2: Agregar todos los archivos

```powershell
git add .
```

### Paso 1.3: Hacer el primer commit

```powershell
git commit -m "Initial commit: RodMar Inventory System"
```

---

## 2. Subir a GitHub

### Paso 2.1: Crear repositorio en GitHub

1. Ve a [GitHub.com](https://github.com) e inicia sesión
2. Haz clic en el botón **"+"** (arriba a la derecha) → **"New repository"**
3. Configura:
   - **Repository name**: `rodmar-inventory` (o el nombre que prefieras)
   - **Description**: "Sistema de inventario RodMar"
   - **Visibility**: 
     - ✅ **Private** (recomendado para proyectos con datos sensibles)
     - O **Public** (si quieres que sea público)
   - ❌ **NO** marques "Add a README file" (ya tienes archivos)
   - ❌ **NO** marques "Add .gitignore" (ya tienes uno)
4. Haz clic en **"Create repository"**

### Paso 2.2: Conectar tu repositorio local con GitHub

GitHub te mostrará instrucciones. Ejecuta estos comandos (reemplaza `TU_USUARIO` con tu usuario de GitHub):

```powershell
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rodmar-inventory.git
git push -u origin main
```

**Nota**: Si GitHub te pide autenticación:
- Si usas HTTPS: GitHub ya no acepta contraseñas. Necesitas un **Personal Access Token**
  - Ve a: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  - Genera un nuevo token con permisos `repo`
  - Úsalo como contraseña cuando Git te la pida
- O mejor aún: Configura **SSH** (más seguro y fácil a largo plazo)

---

## 3. Configurar Supabase

### Paso 3.1: Obtener DATABASE_URL

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Settings** → **Database**
3. Busca la sección **Connection String** → **URI**
4. Copia la URL completa. Se ve así:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. **Reemplaza** `[YOUR-PASSWORD]` con tu contraseña real de la base de datos
   - Si no la recuerdas, ve a **Settings** → **Database** → **Database Password** y resetea la contraseña

### Paso 3.2: Verificar que la base de datos esté actualizada

Asegúrate de que tu esquema de base de datos esté sincronizado:

```powershell
npm run db:push
```

---

## 4. Desplegar Backend en Railway

### Paso 4.1: Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Haz clic en **"Login"** → **"Start a New Project"**
3. Inicia sesión con GitHub (recomendado)

### Paso 4.2: Crear nuevo proyecto

1. Haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Autoriza Railway a acceder a tu GitHub si es necesario
4. Selecciona tu repositorio `rodmar-inventory`
5. Railway detectará automáticamente la configuración

### Paso 4.3: Configurar variables de entorno

1. En el dashboard de Railway, haz clic en tu servicio
2. Ve a la pestaña **"Variables"**
3. Agrega las siguientes variables:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
PORT=5000
NODE_ENV=production
SESSION_SECRET=[GENERA_UN_SECRET_ALEATORIO]
USE_PG_SESSIONS=true
CORS_ORIGIN=https://tu-app.vercel.app
```

**Cómo generar SESSION_SECRET** (en PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Nota sobre CORS_ORIGIN**: 
- Por ahora déjalo vacío o pon `*` temporalmente
- Lo actualizarás después de desplegar Vercel con la URL real

### Paso 4.4: Configurar el dominio

1. En Railway, ve a **"Settings"** → **"Networking"**
2. Haz clic en **"Generate Domain"** o **"Custom Domain"**
3. Copia la URL generada (ej: `tu-app.up.railway.app`)
4. **Guarda esta URL** - la necesitarás para Vercel

### Paso 4.5: Verificar el despliegue

1. Railway comenzará a construir y desplegar automáticamente
2. Espera a que el estado sea **"Active"** (verde)
3. Haz clic en la URL del dominio para verificar que el backend responde
4. Deberías ver algo como `{"message":"API funcionando"}` o similar

---

## 5. Desplegar Frontend en Vercel

### Paso 5.1: Crear cuenta en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en **"Sign Up"**
3. Inicia sesión con GitHub (recomendado)

### Paso 5.2: Importar proyecto

1. En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**
2. Selecciona tu repositorio `rodmar-inventory`
3. Vercel detectará automáticamente que es un proyecto Vite

### Paso 5.3: Configurar el proyecto

Vercel debería detectar automáticamente:
- **Framework Preset**: Vite
- **Build Command**: `npm run build:client`
- **Output Directory**: `dist/public`
- **Install Command**: `npm ci`

Si no lo detecta automáticamente, configúralo manualmente.

### Paso 5.4: Agregar variable de entorno

Antes de hacer deploy, agrega la variable de entorno:

1. En la sección **"Environment Variables"**
2. Agrega:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://tu-app.up.railway.app` (la URL de Railway que copiaste)
3. Haz clic en **"Add"**

### Paso 5.5: Desplegar

1. Haz clic en **"Deploy"**
2. Espera a que termine el build (2-5 minutos)
3. Vercel te dará una URL (ej: `tu-app.vercel.app`)
4. **Copia esta URL** - la necesitarás para actualizar Railway

---

## 6. Configurar Variables de Entorno

### Paso 6.1: Actualizar CORS_ORIGIN en Railway

1. Ve a Railway → Tu servicio → **"Variables"**
2. Actualiza `CORS_ORIGIN` con la URL de Vercel:
   ```
   CORS_ORIGIN=https://tu-app.vercel.app
   ```
3. Railway reiniciará automáticamente el servicio

### Paso 6.2: Verificar variables en Vercel

1. Ve a Vercel → Tu proyecto → **"Settings"** → **"Environment Variables"**
2. Verifica que `VITE_API_URL` esté configurada correctamente
3. Si la cambiaste, haz un nuevo deploy:
   - Ve a **"Deployments"**
   - Haz clic en los tres puntos del último deployment → **"Redeploy"**

---

## 7. Verificar y Probar

### Paso 7.1: Probar el frontend

1. Abre la URL de Vercel en tu navegador
2. Deberías ver la aplicación funcionando
3. Abre la consola del navegador (F12) y verifica:
   - ✅ No hay errores de conexión
   - ✅ Las peticiones a la API van a Railway
   - ✅ WebSocket se conecta correctamente

### Paso 7.2: Probar el backend

1. Abre la URL de Railway en tu navegador
2. Deberías ver una respuesta JSON del API
3. Prueba un endpoint: `https://tu-app.up.railway.app/api/transacciones` (si tienes autenticación, necesitarás estar logueado)

### Paso 7.3: Probar WebSockets

1. Abre la aplicación en Vercel
2. Abre la consola del navegador
3. Deberías ver: `✅ Conectado a Socket.io`
4. Crea o edita una transacción
5. Deberías ver: `📡 Evento recibido: transaction-updated`

---

## 🔧 Solución de Problemas

### Error: "Cannot connect to API"
- Verifica que `VITE_API_URL` en Vercel sea correcta
- Verifica que `CORS_ORIGIN` en Railway incluya la URL de Vercel
- Verifica que Railway esté activo (estado verde)

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` en Railway sea correcta
- Asegúrate de que la contraseña esté incluida en la URL
- Verifica que Supabase permita conexiones externas

### Error: "WebSocket connection failed"
- Verifica que Railway esté activo
- Verifica que `VITE_API_URL` apunte a Railway (no a Vercel)
- Revisa la consola del navegador para más detalles

### El frontend no se actualiza después de cambios
- Vercel hace deploy automático cuando haces push a GitHub
- Si no se actualiza, ve a Vercel → Deployments y verifica el estado
- Puedes forzar un redeploy manualmente

---

## 📝 Notas Importantes

- ✅ **Nunca** commitees archivos `.env` al repositorio
- ✅ Las variables de entorno se configuran en Railway y Vercel, no en archivos
- ✅ Railway y Vercel hacen deploy automático cuando haces `git push`
- ✅ Si cambias variables de entorno, puede que necesites reiniciar el servicio
- ✅ Mantén las URLs actualizadas: si cambias el dominio, actualiza las variables

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando en:
- **Frontend**: `https://tu-app.vercel.app`
- **Backend**: `https://tu-app.up.railway.app`
- **Base de datos**: Supabase (conectada desde Railway)

¿Necesitas ayuda con algún paso? ¡Dime!

