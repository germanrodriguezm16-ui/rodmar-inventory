# Cómo encontrar la URL de conexión en Supabase

## Método 1: Desde la página Database (no Settings)
1. En el menú izquierdo, haz clic en **"Database"** (no "Settings")
2. Busca una pestaña o sección que diga:
   - **"Connection string"**
   - **"Connection info"** 
   - **"Connection pooling"**
   - **"URI"**
3. Debería aparecer una URL que empiece con `postgresql://`

## Método 2: Desde el SQL Editor
1. Ve a **"SQL Editor"** en el menú izquierdo
2. Crea una nueva query o abre una existente
3. A veces la URL aparece en la parte superior o en un menú de conexión

## Método 3: Desde Project Settings → General
1. Ve a **Settings** → **General**
2. Busca información del proyecto
3. Puede haber un campo con la URL de conexión

## Método 4: Probar diferentes formatos
Si no encuentras la URL, puedo probar con diferentes regiones comunes. Solo dime si alguna de estas funciona cuando pruebe.

## Alternativa: Usar la API REST
También podemos usar la API REST de Supabase en lugar de PostgreSQL directo, pero es menos eficiente.


