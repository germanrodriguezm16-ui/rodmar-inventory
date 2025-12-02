# 🔧 Configurar Supabase - Guía Paso a Paso

## Paso 1: Obtener DATABASE_URL de Supabase

### Opción A: Desde el Dashboard (Recomendado)

1. **Ve a tu proyecto en Supabase:**
   - Abre [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Obtén la Connection String:**
   - Ve a **Settings** (⚙️) en el menú izquierdo
   - Haz clic en **Database**
   - Busca la sección **"Connection string"** o **"Connection pooling"**
   - Haz clic en la pestaña **"URI"** o **"Connection string"**
   - Copia la URL que aparece (se ve así):
     ```
     postgresql://postgres.ftzkvgawbigqfndualpu:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```

3. **Reemplaza `[YOUR-PASSWORD]`:**
   - Si no recuerdas tu contraseña:
     - En la misma página de **Settings** → **Database**
     - Busca **"Database password"** o **"Reset database password"**
     - Haz clic en **"Reset database password"**
     - Copia la nueva contraseña (solo se muestra una vez)
   - Reemplaza `[YOUR-PASSWORD]` en la URL con tu contraseña real

### Opción B: Construir la URL manualmente

Si no encuentras la Connection String, puedes construirla:

**Formato para Connection Pooling (Recomendado para producción):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Formato directo (Para desarrollo local):**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**Dónde encontrar:**
- `PROJECT_REF`: Lo encuentras en la URL de tu proyecto Supabase o en Settings → General
- `REGION`: Lo encuentras en Settings → General (ej: `us-east-1`, `eu-west-1`)
- `PASSWORD`: Tu contraseña de base de datos

## Paso 2: Crear archivo .env local

1. **Crea un archivo `.env` en la raíz del proyecto** (junto a `package.json`)

2. **Agrega esta configuración:**

```env
# Base de Datos Supabase
DATABASE_URL=postgresql://postgres:[TU_PASSWORD]@db.[TU_PROJECT_REF].supabase.co:5432/postgres?sslmode=require

# Servidor (desarrollo local)
PORT=5000
NODE_ENV=development

# Sesiones
SESSION_SECRET=tu-secret-aleatorio-aqui
USE_PG_SESSIONS=false

# CORS (para desarrollo local)
CORS_ORIGIN=http://localhost:5173
```

3. **Genera un SESSION_SECRET:**
   - Ejecuta en PowerShell:
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```
   - Copia el resultado y pégalo en `SESSION_SECRET`

## Paso 3: Verificar la conexión

Ejecuta este comando para probar la conexión:

```powershell
npm run check
```

O ejecuta el script de verificación:

```powershell
.\check-connection.ps1
```

## Paso 4: Sincronizar el esquema de la base de datos

Una vez que la conexión funcione, sincroniza el esquema:

```powershell
npm run db:push
```

Esto creará todas las tablas necesarias en Supabase.

## Paso 5: Verificar en Supabase

1. Ve a **Table Editor** en Supabase
2. Deberías ver todas las tablas creadas:
   - `transacciones`
   - `minas`
   - `compradores`
   - `volqueteros`
   - `rodmar_accounts`
   - etc.

## ✅ Listo

Tu base de datos Supabase está configurada. Ahora puedes:
- Ejecutar `npm run dev` para iniciar el servidor
- Los datos se guardarán en Supabase
- Puedes verlos en el dashboard de Supabase

## 🔒 Seguridad

- ⚠️ **NUNCA** subas el archivo `.env` a GitHub (ya está en `.gitignore`)
- ✅ Usa variables de entorno en Railway/Vercel para producción
- ✅ Mantén tu contraseña de Supabase segura

## 🆘 Solución de Problemas

### Error: "Connection refused"
- Verifica que la `DATABASE_URL` sea correcta
- Verifica que la contraseña esté incluida en la URL
- Verifica que el proyecto de Supabase esté activo

### Error: "SSL required"
- Asegúrate de que la URL incluya `?sslmode=require` al final

### Error: "Password authentication failed"
- Verifica que la contraseña sea correcta
- Si no la recuerdas, resetea la contraseña en Supabase

### Error: "Database does not exist"
- Verifica que el nombre de la base de datos sea `postgres` (por defecto en Supabase)

