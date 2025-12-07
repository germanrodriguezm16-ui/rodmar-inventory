# 🔧 Solución: Webhook de Vercel No Funciona

## 🎯 Problema
El repositorio está conectado en Vercel, pero los pushes a GitHub no activan el deploy automático.

## ✅ Solución Paso a Paso

### Paso 1: Verificar Webhook en GitHub

1. **Ve a GitHub:**
   - Abre: `https://github.com/germanrodriguezm16-ui/rodmar-inventory`
   - Ve a **Settings** → **Webhooks**

2. **Busca el webhook de Vercel:**
   - Debería tener URL: `https://api.vercel.com/v1/integrations/deploy/...`
   - O: `https://vercel.com/api/webhooks/...`

3. **Si NO existe el webhook:**
   - Ve al **Paso 2** (Reconectar repositorio)

4. **Si existe pero está fallando:**
   - Haz clic en el webhook
   - Ve a **"Recent Deliveries"**
   - Revisa los últimos intentos
   - Si ves errores (rojos), anota el mensaje de error

---

### Paso 2: Reconectar el Repositorio en Vercel

**Esta es la solución más efectiva:**

1. **En Vercel:**
   - Ve a tu proyecto: `rodmar-inventory`
   - Ve a **Settings** → **Git**
   - Haz clic en **"Disconnect"**
   - Confirma la desconexión

2. **Reconectar:**
   - Haz clic en **"Connect Git Repository"**
   - Selecciona **GitHub**
   - Busca: `germanrodriguezm16-ui/rodmar-inventory`
   - Selecciona la rama: `main`
   - Haz clic en **"Import"**

3. **Verificar configuración:**
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (raíz)
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm ci`

4. **Haz clic en "Deploy"** para el primer deploy

5. **Después del deploy:**
   - Haz un push nuevo a `main`
   - Debería activarse automáticamente

---

### Paso 3: Verificar Permisos de GitHub

1. **En GitHub:**
   - Ve a **Settings** → **Applications** → **Authorized OAuth Apps**
   - Busca **Vercel**
   - Verifica que tenga permisos:
     - ✅ **Repository access**: Full control
     - ✅ **Webhooks**: Read and write

2. **Si no tiene permisos:**
   - Haz clic en **"Revoke"**
   - Vuelve a Vercel y reconecta el repositorio
   - GitHub pedirá permisos nuevamente → Acepta

---

### Paso 4: Verificar Configuración de Build

1. **En Vercel:**
   - Ve a **Settings** → **Build and Deployment**
   - Verifica:
     - **Production Branch**: `main`
     - **Build Command**: `npm run build:client`
     - **Output Directory**: `dist/public`
     - **Install Command**: `npm ci`
     - **Root Directory**: `./`

2. **Si algo está mal, corrígelo y guarda**

---

### Paso 5: Deploy Manual (Solución Temporal)

Mientras solucionas el webhook, puedes desplegar manualmente:

**Opción A: Desde Vercel Dashboard**
1. Ve a **Deployments**
2. Haz clic en **"..."** (tres puntos) → **"Redeploy"**
3. O haz clic en **"Deploy"** → **"Deploy Latest Commit"**

**Opción B: Desde Terminal (Vercel CLI)**
```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Hacer login
vercel login

# Desplegar
vercel --prod
```

---

### Paso 6: Verificar Variables de Entorno

1. **En Vercel:**
   - Ve a **Settings** → **Environment Variables**
   - Verifica que `VITE_API_URL` esté configurada
   - Debe estar en **Production**, **Preview** y **Development**

2. **Si falta:**
   - Agrega `VITE_API_URL` con la URL de Railway
   - Ejemplo: `https://tu-app.up.railway.app`

---

## 🔍 Diagnóstico Avanzado

### Verificar Logs del Webhook

1. **En GitHub:**
   - Ve a **Settings** → **Webhooks**
   - Haz clic en el webhook de Vercel
   - Ve a **"Recent Deliveries"**
   - Revisa los últimos 5 intentos

2. **Si ves errores:**
   - Haz clic en un delivery fallido
   - Revisa el **"Response"**
   - Los errores comunes son:
     - `401 Unauthorized` → Problema de permisos
     - `404 Not Found` → Webhook mal configurado
     - `500 Internal Server Error` → Problema en Vercel

### Verificar en Vercel

1. **En Vercel:**
   - Ve a **Settings** → **Git**
   - Verifica que muestre:
     - ✅ **Connected Repository**: `germanrodriguezm16-ui/rodmar-inventory`
     - ✅ **Production Branch**: `main`
     - ✅ **Deploy Hooks**: Activos

---

## 🎯 Solución Recomendada (Más Rápida)

**Reconectar el repositorio es la solución más efectiva:**

1. **Desconectar** en Vercel (Settings → Git → Disconnect)
2. **Reconectar** (Connect Git Repository → GitHub → Seleccionar repo)
3. **Hacer deploy manual** la primera vez
4. **Hacer un push nuevo** para verificar que funciona

---

## 📋 Checklist Final

- [ ] Webhook de Vercel existe en GitHub
- [ ] Webhook está activo (verde)
- [ ] Webhook tiene entregas recientes exitosas
- [ ] Permisos de GitHub correctos
- [ ] Configuración de build correcta
- [ ] Rama de producción es `main`
- [ ] Variables de entorno configuradas
- [ ] Deploy manual funciona
- [ ] Push nuevo activa deploy automático

---

## 🆘 Si Nada Funciona

1. **Contacta soporte de Vercel:**
   - Ve a [vercel.com/support](https://vercel.com/support)
   - Explica: "Webhook no activa deploy automático después de push"

2. **Alternativa: GitHub Actions**
   - Crea `.github/workflows/deploy.yml`
   - Automatiza el deploy con cada push

3. **Usa Vercel CLI:**
   - Despliega manualmente con `vercel --prod`
   - Puedes automatizarlo con un script

---

**Nota:** A veces Vercel tarda unos minutos en procesar el webhook. Si acabas de hacer el push, espera 2-3 minutos antes de preocuparte.



