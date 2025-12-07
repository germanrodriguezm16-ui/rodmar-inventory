# 🔧 Aplicar Migración: Campos de Transacciones Pendientes

## 🎯 Problema
El backend en Railway está devolviendo error 500 porque el código intenta leer columnas que no existen en la base de datos de producción:
- `estado`
- `detalle_solicitud`
- `codigo_solicitud`
- `tiene_voucher`

## ✅ Solución: Aplicar Migración SQL

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. **Ve a Supabase:**
   - Abre tu proyecto en [supabase.com](https://supabase.com)
   - Ve a **SQL Editor**

2. **Ejecuta el script:**
   - Copia el contenido de `migrations/add-pending-transaction-fields.sql`
   - Pégalo en el SQL Editor
   - Haz clic en **"Run"**

3. **Verifica:**
   - Deberías ver mensajes de éxito para cada columna
   - Si alguna columna ya existe, verás un mensaje informativo

---

### Opción 2: Desde Railway (Si tienes acceso a la base de datos)

1. **Ve a Railway:**
   - Abre tu proyecto en [railway.app](https://railway.app)
   - Ve a tu servicio de base de datos (Supabase)
   - Haz clic en **"Connect"** o **"Query"**

2. **Ejecuta el script:**
   - Copia el contenido de `migrations/add-pending-transaction-fields.sql`
   - Ejecútalo en la consola SQL

---

### Opción 3: Usar Drizzle Push (Desde tu máquina local)

**⚠️ CUIDADO:** Esto aplicará TODOS los cambios del schema, no solo estos campos.

1. **Configura la conexión:**
   ```bash
   # Asegúrate de tener DATABASE_URL apuntando a producción
   # (solo si quieres aplicar desde local)
   ```

2. **Aplicar migración:**
   ```bash
   npm run db:push
   ```

**⚠️ NO recomendado para producción** - Mejor usar el script SQL directamente.

---

## 🔍 Verificar que Funcionó

Después de aplicar la migración:

1. **En Supabase SQL Editor:**
   ```sql
   SELECT 
       column_name, 
       data_type, 
       is_nullable, 
       column_default
   FROM information_schema.columns 
   WHERE table_name = 'transacciones' 
   AND column_name IN ('estado', 'detalle_solicitud', 'codigo_solicitud', 'tiene_voucher')
   ORDER BY column_name;
   ```

2. **Deberías ver 4 filas:**
   - `estado` - text - NOT NULL - default: 'completada'
   - `detalle_solicitud` - text - nullable
   - `codigo_solicitud` - varchar(50) - nullable
   - `tiene_voucher` - boolean - NOT NULL - default: false

3. **Reinicia el servicio en Railway:**
   - Ve a Railway
   - Tu servicio backend
   - Haz clic en **"Restart"** o **"Redeploy"**

4. **Prueba la aplicación:**
   - Abre `https://rodmar-inventory.vercel.app`
   - Debería cargar sin errores 500
   - Las transacciones deberían aparecer

---

## 📋 Checklist

- [ ] Script SQL ejecutado en Supabase
- [ ] 4 columnas nuevas verificadas en la base de datos
- [ ] Servicio backend reiniciado en Railway
- [ ] Aplicación carga sin errores 500
- [ ] Transacciones se muestran correctamente

---

## 🆘 Si Algo Sale Mal

### Error: "column already exists"
- **Solución:** Es normal, significa que la columna ya estaba. El script es seguro de ejecutar múltiples veces.

### Error: "permission denied"
- **Solución:** Asegúrate de tener permisos de administrador en la base de datos.

### Error: "relation does not exist"
- **Solución:** Verifica que la tabla `transacciones` existe. Si no existe, el problema es más grave.

---

## 💡 Nota Importante

**El deploy automático en Vercel SÍ está funcionando** - el problema es que el backend en Railway necesita esta migración para funcionar correctamente con el nuevo código.

Una vez aplicada la migración, todo debería funcionar correctamente.



