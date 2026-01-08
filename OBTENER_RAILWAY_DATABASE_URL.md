# 🔍 Cómo Obtener DATABASE_URL de Railway PostgreSQL

## Opción 1: Desde la Pestaña "Variables" (Lo que estás viendo)

En la lista de variables que estás viendo, busca una de estas:

1. **`DATABASE_URL`** - Esta es la que necesitamos (puede que no esté visible)
2. **`POSTGRES_URL`** - Alternativa
3. **`DATABASE_PUBLIC_URL`** - URL pública (puede funcionar, pero verifica)

### Si NO ves `DATABASE_URL` en la lista:

1. **Haz clic en los tres puntos (`...`) al lado de cualquier variable**
2. **O busca un botón "Reveal" o "Show"** para ver el valor completo
3. **O ve a la pestaña "Database"** (al lado de "Variables")

## Opción 2: Desde la Pestaña "Database"

1. Haz clic en la pestaña **"Database"** (al lado de "Variables")
2. Ahí deberías ver la **Connection String** completa
3. Copia esa URL completa

## Opción 3: Construir la URL Manualmente

Si tienes estas variables, puedes construir la URL:

- `POSTGRES_HOST` o `PGHOST`
- `POSTGRES_PORT` o `PGPORT` (normalmente 5432)
- `POSTGRES_DB` o `POSTGRES_DATABASE`
- `POSTGRES_USER` o `POSTGRES_USERNAME` (normalmente "postgres")
- `POSTGRES_PASSWORD` o `PGPASSWORD`

**Formato:**
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

## Opción 4: Usar Variable Reference (Recomendado para Producción)

Railway permite usar "Variable References" para conectar servicios:

1. Ve a tu servicio **"rodmar-inventory"** (el backend)
2. Ve a la pestaña **"Variables"**
3. Haz clic en **"New Variable"**
4. Nombre: `DATABASE_URL`
5. Valor: Haz clic en el ícono de referencia y selecciona `Postgres.DATABASE_URL`
6. Esto creará una referencia automática que se actualiza si cambia

**Pero para la migración, necesitamos la URL directa.**

---

## ✅ Lo que Necesitamos

Para el script de migración, necesitamos una URL completa que se vea así:

```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway
```

O:

```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

---

## 🔍 Pasos para Encontrarla

1. **En la pestaña "Variables" que estás viendo:**
   - Haz clic en los **tres puntos (`...`)** al lado de `DATABASE_PUBLIC_URL`
   - O busca un botón **"Reveal"** o **"Show Value"**
   - Esto debería mostrarte la URL completa

2. **O ve a la pestaña "Database":**
   - Haz clic en **"Database"** (al lado de "Variables")
   - Ahí debería aparecer la Connection String completa

3. **Si no la encuentras:**
   - Haz clic en **"New Variable"** en la parte superior
   - Railway puede sugerirte crear una referencia
   - O busca en la documentación de Railway cómo obtener la connection string

---

## 💡 Consejo

La variable `DATABASE_PUBLIC_URL` que ves probablemente sea la correcta, pero necesitas:
- Hacer clic en los tres puntos para ver el valor completo
- O copiar el valor y verificar que tenga el formato correcto

**¿Puedes hacer clic en los tres puntos (`...`) al lado de `DATABASE_PUBLIC_URL` y ver qué muestra?**











