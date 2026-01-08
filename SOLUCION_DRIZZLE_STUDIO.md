# Solución: Drizzle Studio No Se Conecta

## Problema
`ERR_CONNECTION_REFUSED` - Drizzle Studio no se está ejecutando porque falta la variable `DATABASE_URL`.

## Soluciones

### Opción 1: Crear archivo .env (RECOMENDADA)

1. **Crea un archivo `.env`** en la carpeta `RodMarInventory` con este contenido:

```env
DATABASE_URL=tu-url-de-base-de-datos-aqui
```

2. **Obtén tu DATABASE_URL desde:**
   - **Railway**: Proyecto → PostgreSQL → Variables → `DATABASE_URL`
   - **Supabase**: Settings → Database → Connection String (usar "Pooling mode")

3. **Ejecuta Drizzle Studio:**
```bash
cd RodMarInventory
npm run db:studio
```

---

### Opción 2: Ejecutar con variable de entorno temporal (Windows PowerShell)

```powershell
cd RodMarInventory
$env:DATABASE_URL="tu-url-de-base-de-datos-aqui"
npm run db:studio
```

---

### Opción 3: Usar la Consola de tu Proveedor (MÁS RÁPIDA)

Si no puedes configurar Drizzle Studio, **ejecuta los scripts SQL directamente** en la consola de tu proveedor:

#### Railway:
1. Ve a tu proyecto en Railway
2. Click en tu servicio PostgreSQL
3. Click en la pestaña **"Data"** o **"Query"**
4. Pega los scripts de `SCRIPTS_SQL_DRIZZLE.md`

#### Supabase:
1. Ve a tu proyecto en Supabase
2. Click en **"SQL Editor"** en el menú lateral
3. Click en **"New query"**
4. Pega y ejecuta los scripts de `SCRIPTS_SQL_DRIZZLE.md`

---

### Opción 4: Usar el Script TypeScript

Si prefieres automatizar, usa el script TypeScript que ya incluye la configuración:

```bash
cd RodMarInventory
$env:DATABASE_URL="tu-url-de-base-de-datos-aqui"
npx tsx server/migrate-rodmar-cuentas.ts
```

---

## ⚠️ IMPORTANTE

- **NUNCA** subas el archivo `.env` a Git (ya debería estar en `.gitignore`)
- **NO** compartas tu `DATABASE_URL` públicamente
- Usa la **Opción 3** (consola del proveedor) si necesitas hacerlo rápido sin configurar nada localmente



