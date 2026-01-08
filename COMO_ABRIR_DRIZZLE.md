# Cómo Abrir Drizzle

Hay varias formas de acceder a tu base de datos para ejecutar los scripts SQL:

## Opción 1: Drizzle Studio (Interfaz Visual) ⭐ RECOMENDADA

Drizzle Studio es una interfaz web visual para ver y editar tu base de datos.

### Pasos:

1. **Abre una terminal** en la carpeta del proyecto:
   ```bash
   cd RodMarInventory
   ```

2. **Ejecuta Drizzle Studio**:
   ```bash
   npm run db:studio
   ```

3. **Se abrirá automáticamente** en tu navegador en `http://localhost:4983` (o el puerto que indique)

4. **En Drizzle Studio puedes**:
   - Ver todas las tablas
   - Ver y editar datos
   - Ejecutar queries SQL directamente
   - Ver la estructura de las tablas

### Para ejecutar los scripts SQL:
- Haz clic en la pestaña "SQL" o busca el editor SQL
- Pega los scripts de `SCRIPTS_SQL_DRIZZLE.md`
- Ejecuta cada script uno por uno

---

## Opción 2: Consola de tu Proveedor de Base de Datos

Si estás usando **Railway** o **Supabase**, puedes ejecutar SQL directamente desde su consola:

### Railway:
1. Ve a tu proyecto en Railway
2. Haz clic en tu servicio de PostgreSQL
3. Ve a la pestaña "Data" o "Query"
4. Ejecuta los scripts SQL ahí

### Supabase:
1. Ve a tu proyecto en Supabase
2. Ve a "SQL Editor" en el menú lateral
3. Crea una nueva query
4. Pega y ejecuta los scripts

---

## Opción 3: psql (Línea de Comandos)

Si tienes `psql` instalado y la URL de conexión:

```bash
# Conectarte a la base de datos
psql "tu-database-url-aqui"

# Luego ejecutar los scripts SQL
\i scripts/migrate-rodmar-cuentas.sql
```

---

## Opción 4: Usar el Script TypeScript (Alternativa)

Si prefieres no ejecutar SQL manualmente, puedes usar el script TypeScript:

```bash
cd RodMarInventory
npx tsx server/migrate-rodmar-cuentas.ts
```

Este script hace lo mismo que los scripts SQL pero de forma automatizada.

---

## ⚠️ Recomendación

**Usa Drizzle Studio** (`npm run db:studio`) porque:
- ✅ Es visual y fácil de usar
- ✅ Puedes ver los datos antes y después
- ✅ Puedes ejecutar SQL directamente
- ✅ No necesitas instalar herramientas adicionales
- ✅ Es la forma más segura de verificar que todo funcionó

---

## Verificación después de ejecutar los scripts

En Drizzle Studio, ejecuta estas queries para verificar:

```sql
-- Ver cuentas creadas
SELECT * FROM "rodmar_cuentas" ORDER BY "id";

-- Ver permisos creados
SELECT * FROM "permissions" WHERE "key" LIKE 'module.RODMAR.account.%' ORDER BY "key";
```

