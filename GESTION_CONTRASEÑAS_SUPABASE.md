# 🔐 Gestión de Contraseñas y Configuración de Supabase

## ⚠️ Importante: Resetear Contraseña NO Afecta los Datos

**Cuando reseteas la contraseña de Supabase:**
- ✅ **Los datos NO se pierden** - Todos tus datos permanecen intactos
- ✅ **Las tablas NO se eliminan** - El esquema completo se mantiene
- ✅ **Solo cambia la autenticación** - Solo necesitas actualizar la `DATABASE_URL` en tu `.env`

**Lo que SÍ necesitas hacer:**
- Actualizar el archivo `.env` con la nueva contraseña
- Actualizar las variables de entorno en Railway/Vercel si ya están desplegados
- Reiniciar el servidor para que tome la nueva configuración

---

## 📋 Configuración Actual de Supabase

### Información del Proyecto

- **Project Reference**: `ftzkvgawbigqfndualpu`
- **URL Base**: `postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres`
- **Región**: Verificar en Settings → General

### Formato de DATABASE_URL

**Conexión Directa (Desarrollo):**
```
postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres?sslmode=require
```

**Connection Pooling (Producción - Recomendado):**
```
postgresql://postgres.ftzkvgawbigqfndualpu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 🔄 Proceso para Resetear Contraseña

### Paso 1: Resetear en Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Database**
4. Busca **"Database password"** o **"Reset database password"**
5. Haz clic en **"Reset database password"**
6. **Copia la nueva contraseña** (solo se muestra una vez)

### Paso 2: Actualizar .env Local

**Opción A: Manualmente**
1. Abre el archivo `.env` en la raíz del proyecto
2. Busca la línea `DATABASE_URL=`
3. Reemplaza `[PASSWORD]` o la contraseña antigua con la nueva
4. Guarda el archivo

**Opción B: Con PowerShell**
```powershell
# Reemplazar contraseña en .env
(Get-Content .env) -replace 'PASSWORD_ANTIGUA', 'PASSWORD_NUEVA' | Set-Content .env
```

### Paso 3: Verificar Conexión

```powershell
# Verificar DNS y configuración
.\check-connection.ps1

# Probar conexión real
npm run db:push
```

### Paso 4: Actualizar en Producción (Railway/Vercel)

Si ya tienes la app desplegada:

**Railway:**
1. Ve a tu proyecto en Railway
2. Haz clic en tu servicio
3. Ve a **Variables**
4. Busca `DATABASE_URL`
5. Actualiza la contraseña en la URL
6. Railway reiniciará automáticamente

**Vercel:**
- Vercel no necesita `DATABASE_URL` (solo el frontend)
- Solo necesitas actualizar en Railway

---

## 🛠️ Solución de Problemas de Conexión

### Error: "getaddrinfo ENOTFOUND"

**Causa:** Problema de resolución DNS o IPv6

**Soluciones:**
1. **Usar Connection Pooling en lugar de conexión directa:**
   - Ve a Supabase → Settings → Database
   - Usa la URL del "Connection pooling" (puerto 6543)
   - Formato: `postgresql://postgres.ftzkvgawbigqfndualpu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

2. **Verificar que el proyecto esté activo:**
   - Ve a Supabase Dashboard
   - Asegúrate de que el proyecto no esté pausado
   - Los proyectos gratuitos se pausan después de inactividad

3. **Esperar unos minutos:**
   - Si acabas de resetear la contraseña, espera 1-2 minutos
   - A veces hay un pequeño delay en la propagación

### Error: "Password authentication failed"

**Causa:** Contraseña incorrecta en `.env`

**Solución:**
1. Verifica que la contraseña en `.env` sea exactamente la que copiaste
2. Asegúrate de que no haya espacios extra
3. Si usas caracteres especiales, verifica que estén codificados correctamente en la URL

### Error: "SSL required"

**Causa:** Falta `?sslmode=require` en la URL

**Solución:**
- Asegúrate de que la `DATABASE_URL` termine con `?sslmode=require`

---

## 📝 Checklist de Configuración

### Configuración Inicial

- [ ] Crear proyecto en Supabase
- [ ] Obtener `DATABASE_URL` de Settings → Database
- [ ] Crear archivo `.env` en la raíz del proyecto
- [ ] Agregar `DATABASE_URL` con contraseña real
- [ ] Generar `SESSION_SECRET` (usar script o manualmente)
- [ ] Verificar conexión con `.\check-connection.ps1`
- [ ] Sincronizar esquema con `npm run db:push`
- [ ] Probar conexión iniciando el servidor

### Después de Resetear Contraseña

- [ ] Resetear contraseña en Supabase Dashboard
- [ ] Copiar nueva contraseña
- [ ] Actualizar `.env` local
- [ ] Verificar conexión local
- [ ] Actualizar `DATABASE_URL` en Railway (si está desplegado)
- [ ] Verificar que la app en producción funcione

---

## 🔒 Seguridad

### Buenas Prácticas

1. **Nunca commitees el archivo `.env`**
   - Ya está en `.gitignore`
   - Verifica que no esté en el repositorio

2. **Usa variables de entorno en producción**
   - No hardcodees contraseñas en el código
   - Usa Railway/Vercel variables de entorno

3. **Rota contraseñas periódicamente**
   - Especialmente si compartiste la contraseña
   - Actualiza en todos los lugares donde la uses

4. **Usa Connection Pooling en producción**
   - Mejor rendimiento
   - Mejor manejo de conexiones
   - Más estable

---

## 📚 Referencias

- [Supabase Database Settings](https://app.supabase.com/project/ftzkvgawbigqfndualpu/settings/database)
- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Documentación de PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

---

## 💡 Notas Importantes

- **Los datos migrados de Replit están seguros** - Resetear la contraseña no los afecta
- **El esquema de la base de datos se mantiene** - No necesitas volver a ejecutar migraciones
- **Solo actualiza la contraseña en `.env`** - El resto de la configuración permanece igual
- **Si la app ya funciona, solo necesitas actualizar la contraseña** - No necesitas reconfigurar todo

---

**Última actualización:** Después de resetear contraseña - `zSLQCeRUFIIxiFph`

