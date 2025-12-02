# 🚀 Guía Rápida - Inicio Local

## Pasos para ejecutar la aplicación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar base de datos

**Opción A: PostgreSQL local**

1. Instala PostgreSQL si no lo tienes
2. Crea una base de datos:
   ```sql
   CREATE DATABASE rodmar_db;
   ```
3. Crea un archivo `.env` en la raíz del proyecto:
   ```env
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/rodmar_db
   SESSION_SECRET=mi-secret-key-super-segura
   PORT=5000
   NODE_ENV=development
   ```

**Opción B: Base de datos remota (Neon, Supabase, etc.)**

1. Crea un archivo `.env`:
   ```env
   DATABASE_URL=postgresql://usuario:password@host:5432/database
   SESSION_SECRET=mi-secret-key-super-segura
   PORT=5000
   NODE_ENV=development
   ```

### 3. Inicializar base de datos

```bash
# Esto creará las tablas automáticamente
npm run db:push
```

### 4. Iniciar el servidor

```bash
npm run dev
```

### 5. Abrir en el navegador

Abre tu navegador en: **http://localhost:5000**

## ✅ Verificación

Si todo está bien, deberías ver:
- El servidor corriendo en el puerto 5000
- La aplicación cargando en el navegador
- Sin errores en la consola

## 🐛 Solución de problemas

### Error: "DATABASE_URL is not defined"
- Asegúrate de tener el archivo `.env` con `DATABASE_URL`

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- Confirma que la URL de conexión sea correcta
- Verifica que la base de datos exista

### Error: "Module not found"
- Ejecuta `npm install` nuevamente
- Verifica que todas las dependencias estén instaladas

### La aplicación carga pero no hay datos
- Ejecuta `npm run db:push` para crear las tablas
- La aplicación creará datos iniciales automáticamente

## 📝 Notas

- En desarrollo, la autenticación es automática (no necesitas login)
- Los datos se guardan en PostgreSQL
- El servidor se recarga automáticamente cuando cambias código

