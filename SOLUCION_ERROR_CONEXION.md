# 🔧 Solución: Error de Conexión a Supabase (ENOTFOUND)

## ❌ Error Actual

```
Error: getaddrinfo ENOTFOUND db.ftzkvgawbigqfndualpu.supabase.co
```

## 🔍 Causas Posibles

1. **Proyecto Pausado** (Más probable)
   - Los proyectos gratuitos de Supabase se pausan después de 1 semana de inactividad
   - Necesitas activarlo manualmente

2. **Problema de DNS/Red**
   - Problemas temporales de conectividad
   - IPv6 vs IPv4

3. **URL Incorrecta**
   - Aunque es menos probable si antes funcionaba

---

## ✅ Solución 1: Activar Proyecto en Supabase (Recomendado)

### Pasos:

1. **Ve a Supabase Dashboard:**
   - Abre [https://app.supabase.com](https://app.supabase.com)
   - Inicia sesión

2. **Verifica el estado del proyecto:**
   - Busca tu proyecto `ftzkvgawbigqfndualpu`
   - Si está pausado, verás un mensaje como "Project is paused"

3. **Activa el proyecto:**
   - Haz clic en **"Restore"** o **"Resume"**
   - Espera 1-2 minutos a que se active completamente

4. **Verifica la conexión:**
   ```powershell
   npm run db:push
   ```

---

## ✅ Solución 2: Usar Connection Pooling (Más Estable)

El Connection Pooler de Supabase es más estable y no se pausa tan fácilmente.

### Pasos:

1. **Obtén la URL de Connection Pooling:**
   - Ve a Supabase → Settings → Database
   - Busca **"Connection pooling"**
   - Haz clic en la pestaña **"URI"**
   - Copia la URL (debe tener el puerto **6543**)

2. **Formato esperado:**
   ```
   postgresql://postgres.ftzkvgawbigqfndualpu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
   ```

3. **Actualiza el `.env`:**
   - Abre el archivo `.env`
   - Reemplaza la `DATABASE_URL` con la URL del pooler
   - Guarda el archivo

4. **Reinicia el servidor:**
   - Detén el servidor (Ctrl+C)
   - Inicia de nuevo: `npm run dev`

---

## ✅ Solución 3: Verificar Conectividad

### Probar DNS:

```powershell
# Verificar que el DNS se resuelva
Resolve-DnsName db.ftzkvgawbigqfndualpu.supabase.co
```

### Probar conexión directa:

```powershell
# Usar telnet o Test-NetConnection
Test-NetConnection -ComputerName db.ftzkvgawbigqfndualpu.supabase.co -Port 5432
```

---

## 🔄 Proceso Completo de Solución

### Paso 1: Verificar Estado en Supabase

1. Abre [Supabase Dashboard](https://app.supabase.com)
2. Ve a tu proyecto
3. Verifica si está pausado o activo

### Paso 2: Activar si está Pausado

1. Haz clic en **"Restore"** o **"Resume"**
2. Espera 1-2 minutos

### Paso 3: Probar Conexión

```powershell
# Verificar configuración
.\check-connection.ps1

# Probar conexión real
npm run db:push
```

### Paso 4: Si Sigue Fallando, Usar Pooling

1. Obtén URL de Connection Pooling
2. Actualiza `.env`
3. Reinicia servidor

---

## 📝 Notas Importantes

- **Los datos NO se pierden** cuando el proyecto está pausado
- **Solo se pausa el acceso**, no se elimina nada
- **Activar es instantáneo** (1-2 minutos)
- **Connection Pooling es más estable** y recomendado para producción

---

## 🚀 Después de Solucionar

Una vez que la conexión funcione:

1. **Verifica que el servidor se conecte:**
   - Deberías ver: `✅ Conexión a base de datos configurada`
   - Sin errores de `ENOTFOUND`

2. **Prueba la aplicación:**
   - Abre `http://localhost:5000`
   - Verifica que puedas ver/cargar datos

3. **Para producción (Railway):**
   - Usa Connection Pooling en Railway también
   - Es más estable y eficiente

---

## 💡 Prevención Futura

Para evitar que se pause:

1. **Usa Connection Pooling** (no se pausa tan fácilmente)
2. **Haz queries periódicas** (puedes crear un cron job simple)
3. **Considera el plan Pro** si necesitas que nunca se pause
4. **Monitorea el estado** del proyecto en Supabase Dashboard

---

**Última actualización:** Después de error ENOTFOUND

