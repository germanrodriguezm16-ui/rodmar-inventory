# 🔄 Configurar Connection Pooling de Supabase

## ¿Por qué Connection Pooling?

Después de resetear la contraseña, a veces la conexión directa puede tener problemas. **Connection Pooling** es más estable porque:

- ✅ No se pausa tan fácilmente
- ✅ Maneja mejor las reconexiones
- ✅ Más eficiente para producción
- ✅ Mejor rendimiento

---

## 📋 Pasos para Configurar

### Paso 1: Obtener URL de Connection Pooling

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto `ftzkvgawbigqfndualpu`
3. Ve a **Settings** → **Database**
4. Busca la sección **"Connection pooling"**
5. Haz clic en la pestaña **"URI"** o **"Connection string"**
6. Copia la URL completa

**Formato esperado:**
```
postgresql://postgres.ftzkvgawbigqfndualpu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

**Nota:** El puerto debe ser **6543** (no 5432)

### Paso 2: Actualizar .env

1. Abre el archivo `.env` en la raíz del proyecto
2. Busca la línea `DATABASE_URL=`
3. Reemplaza la URL completa con la URL del Connection Pooling
4. **Asegúrate de incluir tu contraseña** (`zSLQCeRUFIIxiFph`)
5. Guarda el archivo

**Ejemplo:**
```env
DATABASE_URL=postgresql://postgres.ftzkvgawbigqfndualpu:zSLQCeRUFIIxiFph@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Paso 3: Reiniciar el Servidor

1. Detén el servidor actual (Ctrl+C en la terminal)
2. Inicia de nuevo:
   ```powershell
   npm run dev
   ```

### Paso 4: Verificar Conexión

```powershell
# Probar conexión
node test-connection.js

# O sincronizar esquema
npm run db:push
```

---

## 🔍 Diferencias entre Conexión Directa y Pooling

### Conexión Directa (Puerto 5432)
```
postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres
```
- ❌ Se puede pausar más fácilmente
- ❌ Menos estable
- ✅ Más simple

### Connection Pooling (Puerto 6543)
```
postgresql://postgres.ftzkvgawbigqfndualpu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```
- ✅ Más estable
- ✅ No se pausa tan fácilmente
- ✅ Mejor para producción
- ✅ Maneja reconexiones automáticamente

---

## 🆘 Si No Encuentras Connection Pooling

Si no ves la opción de Connection Pooling en Supabase:

1. **Verifica que el proyecto esté en el plan correcto:**
   - Connection Pooling está disponible en todos los planes
   - Puede estar en una sección diferente

2. **Busca en diferentes lugares:**
   - Settings → Database → Connection pooling
   - Settings → Database → Connection string → Pooling mode
   - Database → Connection info

3. **Alternativa - Usar la URL directa con región:**
   - A veces la URL directa funciona mejor si incluyes la región
   - Formato: `postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres?sslmode=require`

---

## ✅ Después de Configurar

Una vez configurado Connection Pooling:

1. **El servidor debería conectarse sin problemas**
2. **Verás:** `✅ Conexión a base de datos configurada`
3. **No habrá errores de `ENOTFOUND`**

---

**Nota:** Si después de configurar Pooling sigue fallando, puede ser un problema temporal de Supabase. Espera unos minutos y vuelve a intentar.

