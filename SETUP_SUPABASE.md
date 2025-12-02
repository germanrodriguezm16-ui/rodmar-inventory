# Configuración de Supabase para RodMar Inventory

## Cómo encontrar la URL de conexión en Supabase

### Opción 1: Desde Database Settings
1. Ve a **Settings** → **Database** (en el menú izquierdo)
2. Busca la sección **"Connection string"** o **"Connection pooling"**
3. Haz clic en la pestaña **"URI"** o **"Connection string"**
4. Copia la URL completa

### Opción 2: Construir la URL manualmente
Si no aparece, puedes construirla con esta información:

1. **Project Reference**: `ftzkvgawbigqfndualpu` (lo veo en tu URL)
2. **Database Password**: La que creaste al crear el proyecto
3. **Region**: Necesitas verla en Settings → General

**Formato de la URL:**
```
postgresql://postgres.ftzkvgawbigqfndualpu:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

O formato directo:
```
postgresql://postgres:[TU_PASSWORD]@db.ftzkvgawbigqfndualpu.supabase.co:5432/postgres
```

### Opción 3: Desde la página de Database
1. Ve a **Database** en el menú izquierdo (no Settings)
2. Busca un botón o sección que diga **"Connection info"** o **"Connection string"**
3. Ahí debería aparecer la URL

### Opción 4: Resetear la contraseña
Si no recuerdas la contraseña:
1. Ve a **Settings** → **Database**
2. Busca **"Database password"** o **"Reset database password"**
3. Resetea la contraseña y guárdala

## Información que necesito de ti:

1. **¿Cuál es la región de tu proyecto?** (puedes verla en Settings → General)
2. **¿Recuerdas la contraseña de la base de datos?** (la que pusiste al crear el proyecto)
3. **¿Puedes ver alguna sección que diga "Connection string" o "Connection info" en Database Settings?**

Con esa información puedo construir la URL completa para ti.


