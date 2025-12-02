# 🔄 Guía de Migración desde Replit a Supabase

Esta guía te ayudará a migrar todos tus datos desde la base de datos de Replit a Supabase.

## 📋 Requisitos Previos

1. ✅ Supabase configurado y conectado (ya lo tienes)
2. ✅ Tablas creadas en Supabase (ya las creaste)
3. ✅ Acceso a la `DATABASE_URL` de Replit

## 🔑 Paso 1: Obtener la DATABASE_URL de Replit

1. Ve a tu proyecto en Replit
2. Haz clic en el ícono de **Secrets** (🔒) en la barra lateral izquierda
3. Busca el secret llamado `DATABASE_URL`
4. Copia el valor completo (debería verse algo como: `postgresql://usuario:password@host:5432/database`)

## ⚙️ Paso 2: Configurar la Variable de Entorno

Tienes dos opciones:

### Opción A: Agregar al archivo `.env`

Abre el archivo `.env` en la raíz del proyecto y agrega:

```env
# Tu conexión actual a Supabase (ya la tienes)
DATABASE_URL=postgresql://postgres.ftzkvgawbigqfndualpu:hisvDImRolYqEIET@aws-1-us-east-2.pooler.supabase.com:6543/postgres

# Nueva: Conexión a Replit (agrega esta línea)
REPLIT_DATABASE_URL=postgresql://usuario:password@host:5432/database
```

**⚠️ IMPORTANTE:** Reemplaza `postgresql://usuario:password@host:5432/database` con la URL real de Replit que copiaste.

### Opción B: Variable de entorno temporal

Si prefieres no modificar el `.env`, puedes ejecutar:

```powershell
# Windows PowerShell
$env:REPLIT_DATABASE_URL="postgresql://usuario:password@host:5432/database"
npm run migrate:replit
```

## 🚀 Paso 3: Ejecutar la Migración

Una vez configurada la variable de entorno, ejecuta:

```bash
npm run migrate:replit
```

O directamente:

```bash
node migrate-from-replit.mjs
```

## 📊 ¿Qué hace el script?

El script de migración:

1. ✅ Se conecta a ambas bases de datos (Replit y Supabase)
2. ✅ Lee todos los datos de Replit en este orden:
   - Users (usuarios)
   - Minas
   - Compradores
   - Volqueteros
   - Viajes
   - Transacciones
   - Inversiones
   - Fusion Backups
3. ✅ Verifica qué registros ya existen en Supabase (para evitar duplicados)
4. ✅ Inserta solo los registros nuevos
5. ✅ Muestra un resumen completo de la migración

## ✅ Paso 4: Verificar la Migración

Después de ejecutar el script:

1. Abre tu aplicación en `http://localhost:5000`
2. Verifica que todos tus datos aparezcan correctamente
3. Revisa cada módulo (Minas, Compradores, Volqueteros, Viajes, Transacciones)

## 🛡️ Seguridad

- ✅ El script **NO elimina** datos de Replit
- ✅ El script **NO sobrescribe** datos existentes en Supabase
- ✅ Solo **agrega** registros nuevos
- ✅ Si un registro ya existe (mismo ID), se omite

## ❓ Solución de Problemas

### Error: "REPLIT_DATABASE_URL no está configurada"
- Verifica que agregaste la variable al `.env` o la configuraste como variable de entorno
- Asegúrate de que el archivo `.env` esté en la raíz del proyecto

### Error: "DATABASE_URL (Supabase) no está configurada"
- Verifica que tu `.env` tenga la `DATABASE_URL` de Supabase configurada

### Error de conexión a Replit
- Verifica que la URL de Replit sea correcta
- Asegúrate de que la base de datos de Replit esté activa y accesible
- Si usas Neon, verifica que el proyecto no esté pausado

### Error de conexión a Supabase
- Verifica que la `DATABASE_URL` de Supabase sea correcta
- Asegúrate de que el proyecto de Supabase esté activo

### Algunos registros no se migraron
- El script omite registros que ya existen (mismo ID)
- Si necesitas re-migrar, primero elimina los registros duplicados en Supabase
- O modifica los IDs en Replit antes de migrar

## 📝 Notas Importantes

- ⏱️ La migración puede tardar varios minutos si tienes muchos datos
- 💾 El script procesa los datos en lotes de 100 registros para optimizar memoria
- 🔄 Puedes ejecutar el script múltiples veces de forma segura (solo migrará datos nuevos)
- 📊 El script muestra un resumen detallado al final

## 🎉 ¡Listo!

Una vez completada la migración, todos tus datos de Replit estarán disponibles en Supabase y podrás seguir trabajando normalmente.

