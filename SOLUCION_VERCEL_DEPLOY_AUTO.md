# 🔧 Solución: Vercel No Hace Deploy Automático

## 🔍 Verificar el Problema

### Paso 1: Verificar Conexión del Repositorio

1. **Ve a tu proyecto en Vercel:**
   - Abre [vercel.com](https://vercel.com)
   - Selecciona tu proyecto `rodmar-inventory`

2. **Verifica la conexión:**
   - Ve a **Settings** → **Git**
   - Deberías ver:
     - ✅ **Connected Repository**: `germanrodriguezm16-ui/rodmar-inventory`
     - ✅ **Production Branch**: `main`
     - ✅ **Deploy Hooks**: Activos

3. **Si NO está conectado:**
   - Haz clic en **"Disconnect"** y luego **"Connect Git Repository"**
   - Selecciona tu repositorio de GitHub
   - Asegúrate de seleccionar la rama `main`

---

## 🔧 Solución 1: Reconectar el Repositorio

1. **En Vercel:**
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
   - **Root Directory**: `./` (raíz)
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm ci`

4. **Haz clic en "Deploy"** para el primer deploy

---

## 🔧 Solución 2: Verificar Webhooks de GitHub

1. **En GitHub:**
   - Ve a tu repositorio: `germanrodriguezm16-ui/rodmar-inventory`
   - Ve a **Settings** → **Webhooks**
   - Deberías ver un webhook de Vercel:
     - **URL**: `https://api.vercel.com/v1/integrations/deploy/...`
     - **Status**: ✅ Active (verde)

2. **Si NO existe el webhook:**
   - Vercel debería crearlo automáticamente al conectar
   - Si no aparece, reconecta el repositorio (Solución 1)

3. **Si el webhook está inactivo:**
   - Haz clic en el webhook
   - Verifica que esté configurado para:
     - ✅ **Push events**
     - ✅ **Branch**: `main`

---

## 🔧 Solución 3: Verificar Configuración del Proyecto

1. **En Vercel:**
   - Ve a **Settings** → **General**
   - Verifica:
     - ✅ **Production Branch**: `main`
     - ✅ **Auto-deploy**: Habilitado
     - ✅ **Deploy Hooks**: Activos

2. **Si "Auto-deploy" está deshabilitado:**
   - Actívalo
   - Guarda los cambios

---

## 🔧 Solución 4: Forzar un Deploy Manual

Si necesitas desplegar inmediatamente mientras solucionas el problema:

1. **En Vercel:**
   - Ve a **Deployments**
   - Haz clic en **"..."** (tres puntos) → **"Redeploy"**
   - O haz clic en **"Deploy"** → **"Deploy Latest Commit"**

2. **O desde la terminal:**
   ```bash
   # Instalar Vercel CLI (si no lo tienes)
   npm i -g vercel
   
   # Hacer login
   vercel login
   
   # Desplegar
   vercel --prod
   ```

---

## 🔧 Solución 5: Verificar Permisos de GitHub

1. **En GitHub:**
   - Ve a **Settings** → **Applications** → **Authorized OAuth Apps**
   - Busca **Vercel**
   - Verifica que tenga permisos:
     - ✅ **Repository access**: Full control
     - ✅ **Webhooks**: Read and write

2. **Si no tiene permisos:**
   - Haz clic en **"Revoke"**
   - Vuelve a Vercel y reconecta el repositorio
   - GitHub pedirá permisos nuevamente

---

## ✅ Verificar que Funciona

Después de aplicar las soluciones:

1. **Haz un cambio pequeño:**
   ```bash
   # Crear un archivo de prueba
   echo "# Test" >> test-deploy.md
   git add test-deploy.md
   git commit -m "Test: Verificar deploy automático"
   git push
   ```

2. **En Vercel:**
   - Ve a **Deployments**
   - Deberías ver un nuevo deployment iniciándose automáticamente
   - El estado debería cambiar a "Building" → "Ready"

3. **Si funciona:**
   - Elimina el archivo de prueba:
   ```bash
   git rm test-deploy.md
   git commit -m "Remove test file"
   git push
   ```

---

## 🐛 Problemas Comunes

### Error: "Repository not found"
**Solución:** Verifica que el repositorio sea público o que Vercel tenga acceso.

### Error: "Build failed"
**Solución:** Revisa los logs del deployment en Vercel para ver el error específico.

### Error: "Webhook delivery failed"
**Solución:** 
1. Elimina el webhook en GitHub
2. Reconecta el repositorio en Vercel
3. Vercel creará un nuevo webhook

---

## 📝 Checklist Final

- [ ] Repositorio conectado en Vercel
- [ ] Rama `main` configurada como producción
- [ ] Auto-deploy habilitado
- [ ] Webhook de GitHub activo
- [ ] Permisos de GitHub correctos
- [ ] Deploy manual funciona
- [ ] Deploy automático funciona (verificado con test)

---

## 🆘 Si Nada Funciona

1. **Contacta soporte de Vercel:**
   - Ve a [vercel.com/support](https://vercel.com/support)
   - Explica el problema

2. **Alternativa temporal:**
   - Usa Vercel CLI para desplegar manualmente:
   ```bash
   vercel --prod
   ```
   - O configura un GitHub Action para desplegar automáticamente

---

**Nota:** Railway generalmente detecta cambios automáticamente porque está más integrado con GitHub. Vercel requiere configuración explícita de webhooks, pero una vez configurado, debería funcionar igual de bien.

