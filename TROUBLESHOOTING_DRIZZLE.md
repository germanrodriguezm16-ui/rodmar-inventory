# Solución de Problemas - Drizzle Studio

## Error: 404 Not Found en localhost:4983

Si ves un 404, generalmente significa que:
1. El servidor se inició pero falló al conectarse a la base de datos
2. Hay un proceso zombie usando el puerto

### Solución Rápida:

**Paso 1: Cerrar todos los procesos de Node**
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Paso 2: Verificar que el .env tenga DATABASE_URL correcta**
```powershell
cd RodMarInventory
Get-Content .env
```

**Paso 3: Reiniciar Drizzle Studio**
```powershell
npm run db:studio
```

---

## Error: EADDRINUSE (Puerto en uso)

```powershell
# Matar proceso usando el puerto 4983
Get-NetTCPConnection -LocalPort 4983 -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## Error: DATABASE_URL no configurada

Si ves: `"DATABASE_URL, ensure the database is provisioned"`

**Solución:**
1. Crea o edita el archivo `.env` en `RodMarInventory/`
2. Agrega: `DATABASE_URL=tu-url-aqui`
3. Obtén la URL de Railway: Railway → Proyecto → PostgreSQL → Variables → DATABASE_URL

---

## Si Nada Funciona

**Usa la consola SQL de tu proveedor directamente:**

### Railway:
1. Ve a Railway → Tu proyecto → PostgreSQL
2. Pestaña "Data" o "Query"
3. Ejecuta los scripts de `SCRIPTS_SQL_DRIZZLE.md`

### Supabase:
1. Ve a Supabase → Tu proyecto → SQL Editor
2. Ejecuta los scripts de `SCRIPTS_SQL_DRIZZLE.md`

---

## Verificar que Drizzle Studio está corriendo correctamente

Deberías ver en la terminal algo como:
```
✓ Drizzle Studio running on http://localhost:4983
```

Si no ves ese mensaje, hay un error de conexión a la base de datos.



