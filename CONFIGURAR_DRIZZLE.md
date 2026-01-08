# Configurar Drizzle Studio para Desarrollo Local

## Opción 1: Script Automático (RECOMENDADO) ⚡

Ejecuta este script PowerShell que te guiará paso a paso:

```powershell
cd RodMarInventory
.\configurar-env.ps1
```

El script te pedirá tu `DATABASE_URL` de Railway y creará el archivo `.env` automáticamente.

---

## Opción 2: Manual

1. **Crea un archivo `.env`** en la carpeta `RodMarInventory`:

```powershell
cd RodMarInventory
New-Item -Path ".env" -ItemType File
```

2. **Abre el archivo `.env`** y agrega:

```env
DATABASE_URL=tu-url-de-railway-aqui
```

3. **Obtén tu DATABASE_URL de Railway:**
   - Ve a [railway.app](https://railway.app)
   - Selecciona tu proyecto
   - Ve a tu servicio PostgreSQL
   - Click en la pestaña **"Variables"**
   - Copia el valor de `DATABASE_URL`

4. **Pega la URL en el archivo `.env`** (sin espacios, todo en una línea)

---

## Usar Drizzle Studio

Una vez configurado el `.env`:

```powershell
cd RodMarInventory
npm run db:studio
```

Se abrirá automáticamente en `http://localhost:4983`

---

## Verificar que funciona

Después de abrir Drizzle Studio:
- Deberías ver todas tus tablas en el panel izquierdo
- Puedes hacer click en cualquier tabla para ver los datos
- Usa la pestaña "SQL" para ejecutar queries

---

## ⚠️ IMPORTANTE

- El archivo `.env` **NO** se sube a Git (está en `.gitignore`)
- **NUNCA** compartas tu `DATABASE_URL` públicamente
- Si cambias de base de datos, actualiza el `.env`



