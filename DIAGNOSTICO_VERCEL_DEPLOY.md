# 🔍 Diagnóstico: Vercel No Hace Deploy Automático

## ✅ Lo que ya está bien:
- ✅ Repositorio conectado: `germanrodriguezm16-ui/rodmar-inventory`
- ✅ Eventos habilitados (deployment_status, repository_dispatch)
- ✅ Pull Request Comments habilitado

## 🔍 Pasos para Diagnosticar:

### 1. Verificar la Rama de Producción

**En Vercel:**
1. Ve a **Settings** → **General**
2. Verifica que **"Production Branch"** sea `main`
3. Si no es `main`, cámbiala a `main`

---

### 2. Verificar Webhooks en GitHub

**En GitHub:**
1. Ve a tu repositorio: `germanrodriguezm16-ui/rodmar-inventory`
2. Ve a **Settings** → **Webhooks**
3. Busca un webhook de Vercel (debería tener URL como `https://api.vercel.com/v1/integrations/deploy/...`)
4. Verifica:
   - ✅ **Status**: Active (verde)
   - ✅ **Recent Deliveries**: Debería mostrar entregas recientes
   - ✅ **Events**: Debería incluir "Push"

**Si NO existe el webhook:**
- Vercel debería crearlo automáticamente, pero a veces falla
- Solución: Desconecta y reconecta el repositorio en Vercel

**Si el webhook existe pero está inactivo:**
- Haz clic en el webhook
- Verifica que esté configurado para la rama `main`
- Si hay errores en "Recent Deliveries", revisa los logs

---

### 3. Verificar el Último Push

**En tu terminal:**
```bash
# Ver el último commit
git log -1

# Ver la rama actual
git branch

# Verificar que estés en main
git checkout main
```

**En GitHub:**
1. Ve a tu repositorio
2. Verifica que el último commit esté en la rama `main`
3. El commit debería ser: `"Fase 2: Modal de crear transacción - Modo Solicitar"`

**Si el último push fue ANTES de conectar Vercel (2 de diciembre):**
- Vercel solo despliega commits nuevos después de la conexión
- Solución: Haz un push nuevo para activar el deploy

---

### 4. Verificar Builds Anteriores

**En Vercel:**
1. Ve a **Deployments**
2. Revisa si hay deployments anteriores
3. Si hay deployments fallidos, revisa los logs:
   - Haz clic en el deployment fallido
   - Ve a **"Build Logs"**
   - Busca errores

**Errores comunes:**
- ❌ `npm ci` falla → Problema con `package-lock.json`
- ❌ `npm run build:client` falla → Error en el código
- ❌ Variables de entorno faltantes → `VITE_API_URL` no configurada

---

### 5. Forzar un Deploy Manual (Test)

**Opción A: Desde Vercel:**
1. Ve a **Deployments**
2. Haz clic en **"..."** (tres puntos) → **"Redeploy"**
3. O haz clic en **"Deploy"** → **"Deploy Latest Commit"**

**Opción B: Desde GitHub (Trigger):**
1. Haz un cambio pequeño:
   ```bash
   echo "# Test deploy" >> test-deploy.md
   git add test-deploy.md
   git commit -m "Test: Trigger Vercel deploy"
   git push
   ```

2. **En Vercel:**
   - Ve a **Deployments**
   - Deberías ver un nuevo deployment iniciándose

3. **Si NO se inicia:**
   - El problema está en los webhooks o la configuración
   - Ve al paso 2 (verificar webhooks)

---

### 6. Verificar Configuración de Build

**En Vercel:**
1. Ve a **Settings** → **Build and Deployment**
2. Verifica:
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm ci`
   - **Root Directory**: `./` (raíz)

**Si está diferente, cámbialo y guarda**

---

### 7. Verificar Variables de Entorno

**En Vercel:**
1. Ve a **Settings** → **Environment Variables**
2. Verifica que `VITE_API_URL` esté configurada
3. Debe estar en **Production**, **Preview** y **Development**

**Si falta:**
- Agrega `VITE_API_URL` con la URL de Railway
- Haz un nuevo deploy después de agregarla

---

## 🎯 Solución Rápida (Recomendada)

Si nada de lo anterior funciona, **reconecta el repositorio**:

1. **En Vercel:**
   - Ve a **Settings** → **Git**
   - Haz clic en **"Disconnect"**
   - Confirma

2. **Reconectar:**
   - Haz clic en **"Connect Git Repository"**
   - Selecciona **GitHub**
   - Busca: `germanrodriguezm16-ui/rodmar-inventory`
   - Selecciona rama: `main`
   - Haz clic en **"Import"**

3. **Verificar configuración:**
   - Framework: Vite
   - Build Command: `npm run build:client`
   - Output Directory: `dist/public`
   - Root Directory: `./`

4. **Haz clic en "Deploy"**

5. **Después del deploy:**
   - Haz un push nuevo a `main`
   - Debería desplegarse automáticamente

---

## 📋 Checklist de Diagnóstico

- [ ] Rama de producción es `main`
- [ ] Webhook de Vercel existe en GitHub
- [ ] Webhook está activo (verde)
- [ ] Último push fue después de conectar Vercel
- [ ] No hay deployments fallidos bloqueando
- [ ] Build Command correcto: `npm run build:client`
- [ ] Output Directory correcto: `dist/public`
- [ ] Variables de entorno configuradas
- [ ] Deploy manual funciona
- [ ] Push nuevo activa deploy automático

---

## 🆘 Si Nada Funciona

1. **Contacta soporte de Vercel:**
   - Ve a [vercel.com/support](https://vercel.com/support)
   - Explica: "Repositorio conectado pero no hace deploy automático"

2. **Alternativa temporal:**
   - Usa Vercel CLI para desplegar manualmente:
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

3. **O configura GitHub Actions:**
   - Crea `.github/workflows/deploy.yml`
   - Automatiza el deploy con cada push

---

## 💡 Nota Importante

**Vercel solo despliega automáticamente commits que se hacen DESPUÉS de conectar el repositorio.**

Si conectaste Vercel el 2 de diciembre, solo los commits hechos después de esa fecha activarán el deploy automático.

**Solución:** Haz un push nuevo para activar el primer deploy automático.

