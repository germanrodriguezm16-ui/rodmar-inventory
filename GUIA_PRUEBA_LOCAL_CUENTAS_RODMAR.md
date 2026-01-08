# Guía para Probar Cuentas RodMar Localmente

## ✅ Pre-requisitos

1. ✅ Scripts SQL ejecutados en Drizzle Studio (ya lo hiciste)
2. ✅ Tabla `rodmar_cuentas` creada con las 6 cuentas
3. ✅ Permisos creados y asignados al rol ADMIN

---

## Paso 1: Iniciar el Servidor Backend

Abre una terminal y ejecuta:

```powershell
cd RodMarInventory
npm run dev
```

**Espera** a que veas un mensaje como:
```
✅ Servidor corriendo en puerto 5000
✅ Conexión a base de datos configurada
```

**Importante:** Deja esta terminal abierta y corriendo.

---

## Paso 2: Iniciar el Cliente Frontend

Abre **otra terminal nueva** (deja la anterior corriendo) y ejecuta:

```powershell
cd RodMarInventory
npm run dev:client
```

O si tienes un script diferente:

```powershell
npm run dev:client
```

**Espera** a que veas algo como:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

**Nota:** El puerto puede ser diferente (5173, 5174, etc.)

---

## Paso 3: Acceder a la Aplicación

1. Abre tu navegador
2. Ve a la URL que muestra Vite (normalmente `http://localhost:5173`)
3. **Inicia sesión** con tu usuario

---

## Paso 4: Probar las Funcionalidades

### 4.1 Verificar que las Cuentas se Cargaron

1. Ve al módulo **"RodMar"**
2. Haz clic en la pestaña **"Cuentas"**
3. **Deberías ver** las 6 cuentas con sus balances:
   - Bemovil
   - Corresponsal
   - Efectivo
   - Cuentas German
   - Cuentas Jhon
   - Otros

✅ **Si ves las cuentas**: El backend está funcionando correctamente.

---

### 4.2 Probar Crear Nueva Cuenta

1. En la pestaña "Cuentas", haz clic en el botón **"Nueva Cuenta"** (arriba a la derecha)
2. Llena el formulario:
   - **Nombre**: "Cuenta Prueba"
   - **Código**: "CUENTA_PRUEBA" (mayúsculas, guiones bajos)
3. Haz clic en **"Agregar Cuenta"**
4. **Verifica**:
   - ✅ Aparece un toast de éxito
   - ✅ La nueva cuenta aparece en la lista
   - ✅ El permiso se creó automáticamente

---

### 4.3 Probar Editar Nombre de Cuenta

1. Haz **long press** (touch sostenido) o **click derecho** en una cuenta (ej: "Bemovil")
2. Se abrirá un menú contextual
3. Selecciona **"Editar nombre"**
4. Cambia el nombre a "Bemovil Pro" (por ejemplo)
5. Haz clic en **"Actualizar"**
6. **Verifica**:
   - ✅ El nombre cambió en la lista
   - ✅ El código NO cambió (sigue siendo "BEMOVIL")
   - ✅ Las transacciones existentes siguen funcionando
   - ✅ El permiso sigue funcionando (usando el código)

---

### 4.4 Probar Eliminar Cuenta

#### Caso 1: Eliminar cuenta SIN transacciones (debería funcionar)

1. Crea una cuenta de prueba (si no la tienes)
2. Haz **long press** o **click derecho** en esa cuenta
3. Selecciona **"Eliminar"**
4. Confirma la eliminación
5. **Verifica**:
   - ✅ La cuenta desaparece de la lista
   - ✅ Aparece un mensaje de éxito

#### Caso 2: Intentar eliminar cuenta CON transacciones (debería fallar)

1. Haz **long press** o **click derecho** en "Bemovil" (que probablemente tiene transacciones)
2. Selecciona **"Eliminar"**
3. **Verifica**:
   - ✅ Aparece un error: "No se puede eliminar esta cuenta porque tiene transacciones asociadas"
   - ✅ La cuenta NO se eliminó

---

### 4.5 Probar Crear Transacción con Cuentas Nuevas

1. Ve al módulo **"Transacciones"** o crea una nueva transacción
2. En el formulario:
   - **De quién**: Selecciona "RodMar"
   - **Cuenta RodMar**: Deberías ver TODAS las cuentas (las 6 originales + las nuevas que creaste)
   - Selecciona una cuenta
   - Completa el resto del formulario
3. Guarda la transacción
4. **Verifica**:
   - ✅ La transacción se creó correctamente
   - ✅ Usa el ID numérico de la cuenta (no el slug)
   - ✅ Aparece en la lista de transacciones

---

### 4.6 Verificar que los IDs Numéricos Funcionan

1. Ve a la pestaña **"Cuentas"** en RodMar
2. **Inspecciona** la red en DevTools (F12 → Network)
3. Busca la petición a `/api/rodmar-accounts`
4. **Verifica** que la respuesta incluye:
   ```json
   {
     "id": 1,
     "cuenta": "Bemovil",
     "codigo": "BEMOVIL",
     "balance": ...
   }
   ```
   - ✅ Debe tener campo `id` (numérico)
   - ✅ Debe tener campo `codigo`
   - ✅ Debe tener campo `cuenta` o `nombre`

---

## Paso 5: Verificar en la Base de Datos (Opcional)

Si quieres verificar directamente en la BD:

1. Abre Drizzle Studio: `npm run db:studio`
2. Ejecuta esta query:
   ```sql
   SELECT * FROM "rodmar_cuentas" ORDER BY "id";
   ```
3. **Deberías ver** todas las cuentas con sus IDs numéricos

---

## ✅ Checklist de Verificación

Marca cada punto cuando lo pruebes:

- [ ] Las 6 cuentas originales se muestran en la lista
- [ ] Puedo crear una nueva cuenta
- [ ] Puedo editar el nombre de una cuenta
- [ ] Puedo eliminar una cuenta sin transacciones
- [ ] NO puedo eliminar una cuenta con transacciones (muestra error)
- [ ] Al crear transacciones, puedo seleccionar las cuentas desde el dropdown
- [ ] Las transacciones se guardan correctamente con IDs numéricos
- [ ] Los balances se calculan correctamente
- [ ] El menú contextual (long press) funciona
- [ ] Los permisos funcionan correctamente

---

## 🐛 Si Algo No Funciona

### Error: "No se pueden cargar las cuentas"
- Verifica que el servidor está corriendo (`npm run dev`)
- Revisa la consola del navegador (F12) para ver errores
- Verifica que ejecutaste los scripts SQL correctamente

### Error: "No tengo permiso para ver cuentas"
- Verifica que tu usuario tiene el rol ADMIN
- Verifica que los permisos se asignaron correctamente (Script 3)

### Error: "No puedo crear transacciones"
- Verifica que el formulario muestra las cuentas en el dropdown
- Revisa la consola del navegador para ver errores de API

### Las cuentas no aparecen en el formulario
- Verifica que el endpoint `/api/rodmar-cuentas` funciona
- Abre DevTools → Network y busca esa petición
- Verifica que retorna las cuentas con IDs numéricos

---

## 📝 Notas Importantes

1. **Transacciones existentes**: Las transacciones antiguas pueden usar slugs ("bemovil") y las nuevas usarán IDs ("1"). Ambas funcionan gracias a la compatibilidad implementada.

2. **Permisos**: Los permisos ahora usan códigos (`BEMOVIL`) en lugar de nombres. Los permisos antiguos seguirán funcionando durante la transición.

3. **Navegación**: Al hacer click normal en una cuenta, debería llevarte al detalle. Al hacer long press, muestra el menú contextual.

---

## 🎉 Cuando Todo Funcione

Una vez que verifiques que todo funciona:
1. Los cambios NO se han subido a producción (como pediste)
2. Puedes seguir probando y ajustando
3. Cuando estés listo, podemos hacer commit y push

