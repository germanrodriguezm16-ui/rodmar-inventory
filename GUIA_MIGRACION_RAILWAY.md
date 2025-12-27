# 🚂 Guía Completa: Migración de Supabase a Railway PostgreSQL

## ⚠️ IMPORTANTE: Antes de Empezar

**Git commits NO son backups de base de datos:**
- Los commits de Git guardan **código**, no **datos**
- Si algo sale mal, necesitas un **backup real de la base de datos**
- **NO** puedes restaurar datos desde un commit de Git

**Siempre haz backup ANTES de migrar.**

---

## 📋 Paso 1: Hacer Backup de Supabase

Tienes **3 opciones** para hacer backup:

### Opción A: Desde Supabase Dashboard (Más Fácil) ⭐ RECOMENDADO

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto `ftzkvgawbigqfndualpu`
3. Ve a **Settings** → **Database**
4. Busca la sección **"Database Backups"** o **"Backups"**
5. Si hay backups automáticos, descárgalos
6. O crea un backup manual si está disponible

**Nota:** Supabase puede tener backups automáticos, pero verifica que estén actualizados.

### Opción B: Usar pg_dump (Más Completo) ⭐ RECOMENDADO PARA MIGRACIÓN

Necesitas instalar PostgreSQL en tu computadora para usar `pg_dump`:

#### Instalar PostgreSQL en Windows:

1. **Descargar PostgreSQL:**
   - Ve a: https://www.postgresql.org/download/windows/
   - O usa el instalador directo: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Descarga la versión más reciente (15 o 16)

2. **Instalar:**
   - Ejecuta el instalador
   - Durante la instalación, **marca la opción "Command Line Tools"** (incluye `pg_dump` y `psql`)
   - Anota la contraseña del usuario `postgres` que crees (la necesitarás)
   - Completa la instalación

3. **Verificar instalación:**
   ```powershell
   # Abre PowerShell y ejecuta:
   pg_dump --version
   psql --version
   ```
   Deberías ver números de versión.

#### Hacer Backup con pg_dump:

1. **Obtén tu DATABASE_URL de Supabase:**
   - Ve a Supabase → Settings → Database
   - Copia la Connection String (URI)
   - Formato: `postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres`

2. **Crear carpeta para backups:**
   ```powershell
   # En PowerShell, desde la raíz del proyecto:
   New-Item -ItemType Directory -Path "backups" -Force
   ```

3. **Hacer backup completo:**
   ```powershell
   # Reemplaza [PASSWORD] con tu contraseña real de Supabase
   $env:PGPASSWORD="tu_contraseña_supabase"
   pg_dump -h db.ftzkvgawbigqfndualpu.supabase.co -p 5432 -U postgres -d postgres -F c -f "backups\supabase_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
   ```

   **O usando la URL completa:**
   ```powershell
   # Reemplaza [PASSWORD] con tu contraseña real
   pg_dump "postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres?sslmode=require" -F c -f "backups\supabase_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
   ```

4. **Verificar que el backup se creó:**
   ```powershell
   # Deberías ver un archivo .dump en la carpeta backups
   Get-ChildItem backups
   ```

### Opción C: Usar Script Node.js (Ya Creado) ⭐ RECOMENDADO SI NO QUIERES INSTALAR POSTGRESQL

Ya existe un script Node.js para hacer backup y migración. **Pero aún así recomiendo hacer backup manual primero.**

El script está en: `migrate-supabase-to-railway.ts`

---

## 📋 Paso 2: Crear Base de Datos en Railway

1. **Ve a Railway Dashboard:**
   - https://railway.app
   - Selecciona tu proyecto

2. **Crear nuevo servicio PostgreSQL:**
   - Haz clic en **"+ New"** o **"Add Service"**
   - Selecciona **"Database"** → **"Add PostgreSQL"**
   - Railway creará automáticamente una base de datos PostgreSQL

3. **Obtener DATABASE_URL de Railway:**
   - Haz clic en el servicio PostgreSQL que acabas de crear
   - Ve a la pestaña **"Variables"**
   - Busca `DATABASE_URL` o `POSTGRES_URL`
   - **Copia esta URL completa** (la necesitarás para el paso 3)

   **Formato esperado:**
   ```
   postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway
   ```

---

## 📋 Paso 3: Aplicar Esquema a Railway

Antes de migrar datos, necesitas crear las tablas en Railway:

1. **Actualizar DATABASE_URL temporalmente:**
   ```powershell
   # En tu archivo .env, cambia temporalmente DATABASE_URL a Railway
   # Guarda la URL de Supabase en otra variable por si acaso
   ```

2. **Aplicar esquema:**
   ```powershell
   # Desde la raíz del proyecto:
   npm run db:push
   ```

   Esto creará todas las tablas en Railway usando Drizzle.

3. **Verificar que las tablas se crearon:**
   - Puedes usar Drizzle Studio: `npm run db:studio`
   - O conectarte directamente a Railway PostgreSQL y verificar

---

## 📋 Paso 4: Migrar Datos

Tienes **2 opciones**:

### Opción A: Usar pg_restore (Si usaste pg_dump)

```powershell
# Reemplaza [RAILWAY_PASSWORD] y [RAILWAY_HOST] con los valores de Railway
pg_restore -h [RAILWAY_HOST] -p [RAILWAY_PORT] -U postgres -d railway -F c "backups\supabase_backup_YYYYMMDD_HHMMSS.dump"
```

**O usando la URL completa:**
```powershell
# Reemplaza con tu DATABASE_URL de Railway
pg_restore -d "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway" -F c "backups\supabase_backup_YYYYMMDD_HHMMSS.dump"
```

### Opción B: Usar Script Node.js (Ya Creado) ⭐ RECOMENDADO

Ya existe un script Node.js para migrar de Supabase a Railway: `migrate-supabase-to-railway.ts`

**Ventajas:**
- ✅ No necesitas instalar PostgreSQL
- ✅ Puedes ver el progreso en tiempo real
- ✅ Maneja errores mejor
- ✅ Puedes verificar datos antes de insertar
- ✅ Migra en el orden correcto de dependencias

**Cómo usarlo:**

1. **Configurar variables de entorno en `.env`:**
   ```env
   # URL de Supabase (origen)
   SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres?sslmode=require
   
   # URL de Railway PostgreSQL (destino)
   RAILWAY_DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway
   ```

2. **Ejecutar el script:**
   ```powershell
   npm run migrate:supabase-to-railway
   ```

3. **El script:**
   - Te pedirá confirmación (espera 5 segundos, presiona Ctrl+C si no has hecho backup)
   - Migrará todas las tablas en el orden correcto
   - Mostrará progreso en tiempo real
   - Te dará un resumen al final

---

## 📋 Paso 5: Verificar Migración

1. **Conectar a Railway PostgreSQL:**
   ```powershell
   # Usar Drizzle Studio con DATABASE_URL de Railway
   npm run db:studio
   ```

2. **Verificar datos:**
   - Revisa que todas las tablas tengan datos
   - Compara conteos de registros entre Supabase y Railway
   - Verifica algunos registros específicos

3. **Probar la aplicación:**
   - Actualiza `DATABASE_URL` en Railway (variables de entorno)
   - Reinicia el servicio en Railway
   - Prueba la aplicación en producción
   - Verifica que todo funcione correctamente

---

## 📋 Paso 6: Actualizar Configuración

1. **Actualizar DATABASE_URL en Railway:**
   - Ve a Railway → Tu servicio backend
   - Variables → Edita `DATABASE_URL`
   - Cambia de Supabase a Railway PostgreSQL
   - Guarda y Railway reiniciará automáticamente

2. **Actualizar .env local (opcional):**
   - Si quieres probar localmente con Railway, actualiza tu `.env`
   - O mantén Supabase para desarrollo local

3. **Verificar CORS y otras configuraciones:**
   - Asegúrate de que `CORS_ORIGIN` esté configurado correctamente
   - Verifica otras variables de entorno

---

## 📋 Paso 7: Plan de Rollback (Si Algo Sale Mal)

**Si necesitas volver a Supabase:**

1. **Restaurar DATABASE_URL en Railway:**
   - Cambia `DATABASE_URL` de vuelta a Supabase
   - Railway reiniciará automáticamente

2. **Si los datos en Supabase se corrompieron:**
   - Restaura desde el backup que hiciste en el Paso 1
   - Usa `pg_restore` para restaurar el backup a Supabase

---

## ⚠️ Checklist Antes de Migrar

- [ ] ✅ Backup completo de Supabase creado y verificado
- [ ] ✅ Base de datos PostgreSQL creada en Railway
- [ ] ✅ Esquema aplicado a Railway (tablas creadas)
- [ ] ✅ Plan de rollback preparado
- [ ] ✅ Ventana de mantenimiento programada (1-2 horas)
- [ ] ✅ Notificación a usuarios (si aplica)

---

## 🛠️ Herramientas Necesarias

### Si usas pg_dump/pg_restore:
- ✅ PostgreSQL instalado en Windows (incluye `pg_dump` y `psql`)

### Si usas script Node.js:
- ✅ Node.js ya instalado (ya lo tienes)
- ✅ Dependencias del proyecto (ya las tienes)

---

## 📊 Tiempo Estimado

Para **5,000 datos**:
- **Backup:** 5-10 minutos
- **Crear DB en Railway:** 2-3 minutos
- **Aplicar esquema:** 1-2 minutos
- **Migrar datos:** 10-20 minutos (depende del método)
- **Verificación:** 10-15 minutos
- **Total:** ~30-50 minutos

---

## ❓ ¿Qué Opción Prefieres?

**Opción 1: Usar pg_dump/pg_restore**
- ✅ Más rápido para muchos datos
- ❌ Requiere instalar PostgreSQL
- ✅ Backup en formato binario (más eficiente)

**Opción 2: Script Node.js de migración**
- ✅ No requiere instalar nada adicional
- ✅ Más control y visibilidad
- ✅ Mejor manejo de errores
- ❌ Puede ser un poco más lento

**¿Cuál prefieres?** Puedo ayudarte con cualquiera de las dos opciones.

