# Análisis: Error al Editar Rol - "Ya existe un rol con este nombre"

## 🔍 Problema Identificado

Cuando intentas editar un rol desde el panel administrativo y actualizar solo los permisos (sin cambiar el nombre), aparece el error: **"Ya existe un rol con este nombre"**.

---

## 📍 Ubicación del Código

**Archivo:** `RodMarInventory/server/routes.ts`
**Endpoint:** `PUT /api/admin/roles/:id`
**Líneas:** 5640-5685

---

## 🔎 Causa Raíz

El problema está en el endpoint de actualización de roles. El código actual:

```typescript:5640:5685:RodMarInventory/server/routes.ts
app.put("/api/admin/roles/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const { nombre, descripcion, permissionIds } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del rol es requerido" });
    }

    // Actualizar el rol
    const [updatedRole] = await db
      .update(roles)
      .set({
        nombre: nombre.toUpperCase(),  // ⚠️ PROBLEMA: Siempre actualiza el nombre
        descripcion: descripcion || null,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();
    
    // ... resto del código
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(400).json({ error: "Ya existe un rol con ese nombre" }); // ⚠️ Aquí se captura el error
    }
  }
});
```

**Problemas identificados:**

1. **No se obtiene el rol actual antes de actualizar**: El código no verifica qué nombre tiene el rol actualmente.

2. **Siempre actualiza el campo `nombre`**: Incluso si el nombre no cambió, el código intenta actualizarlo al mismo valor.

3. **No hay validación previa**: No se verifica si el nombre realmente cambió antes de intentar actualizarlo.

4. **Restricción UNIQUE en la base de datos**: La tabla `roles` tiene una restricción UNIQUE en el campo `nombre` (ver `shared/schema.ts` línea 20).

5. **PostgreSQL puede lanzar error 23505**: Aunque técnicamente actualizar un campo al mismo valor no debería violar una restricción UNIQUE, PostgreSQL puede lanzar este error en ciertas situaciones (especialmente con triggers, índices, o cuando hay espacios/caracteres especiales).

---

## 🎯 Solución Propuesta

La solución correcta es:

1. **Obtener el rol actual** antes de actualizar.
2. **Verificar si el nombre realmente cambió** (comparando el nombre normalizado).
3. **Actualizar condicionalmente**:
   - Si el nombre NO cambió: No incluir el campo `nombre` en la actualización (o construir el objeto de actualización condicionalmente).
   - Si el nombre SÍ cambió: Verificar primero que no exista otro rol con ese nombre (excluyendo el rol actual), y luego actualizar.
4. **Manejar el error 23505 de manera más específica**: Verificar que realmente es un conflicto de nombre antes de mostrar el mensaje.

---

## 📝 Código Corregido (Propuesta)

```typescript
app.put("/api/admin/roles/:id", requireAuth, requirePermission("module.ADMIN.view"), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const { nombre, descripcion, permissionIds } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del rol es requerido" });
    }

    // 1. Obtener el rol actual
    const [currentRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!currentRole) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // 2. Normalizar el nombre (mayúsculas y trim)
    const normalizedNombre = nombre.toUpperCase().trim();

    // 3. Construir objeto de actualización condicionalmente
    const updateData: { nombre?: string; descripcion: string | null; updatedAt: Date } = {
      descripcion: descripcion || null,
      updatedAt: new Date(),
    };

    // 4. Solo actualizar el nombre si realmente cambió
    if (normalizedNombre !== currentRole.nombre) {
      // Verificar que no exista otro rol con ese nombre
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.nombre, normalizedNombre))
        .limit(1);

      if (existingRole && existingRole.id !== roleId) {
        return res.status(400).json({ error: "Ya existe un rol con ese nombre" });
      }

      updateData.nombre = normalizedNombre;
    }

    // 5. Actualizar el rol (solo con los campos que cambiaron)
    const [updatedRole] = await db
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, roleId))
      .returning();

    // 6. Actualizar permisos
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      const rolePerms = permissionIds.map((permissionId: number) => ({
        roleId: roleId,
        permissionId,
      }));

      await db.insert(rolePermissions).values(rolePerms);
    }

    res.json(updatedRole);
  } catch (error: any) {
    console.error("Error updating role:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Ya existe un rol con ese nombre" });
    } else {
      res.status(500).json({ error: "Error al actualizar rol" });
    }
  }
});
```

---

## ✅ Beneficios de la Solución

1. **Resuelve el error**: Permite editar permisos sin cambiar el nombre sin errores.
2. **Validación previa**: Verifica que el nombre no exista en otro rol antes de actualizar.
3. **Más eficiente**: Solo actualiza los campos que realmente cambiaron.
4. **Más seguro**: Previene conflictos de nombres duplicados.
5. **Mejor experiencia de usuario**: El error solo aparece cuando realmente hay un conflicto real.

---

## 🧪 Casos de Prueba

Después de aplicar la solución, verificar:

1. ✅ **Editar solo permisos** (sin cambiar el nombre) - Debe funcionar sin errores.
2. ✅ **Editar nombre a uno nuevo que no existe** - Debe funcionar correctamente.
3. ✅ **Editar nombre a uno que ya existe en otro rol** - Debe mostrar el error correctamente.
4. ✅ **Editar nombre manteniendo el mismo valor** - Debe funcionar sin errores.
5. ✅ **Editar nombre con espacios/caracteres especiales** - Debe normalizar correctamente.

---

## 📌 Notas Adicionales

- El mismo patrón se podría aplicar a otras entidades que tienen restricciones UNIQUE similares.
- La validación previa es más eficiente que depender solo del manejo de errores de PostgreSQL.
- El código actual funciona para crear roles (POST), pero necesita esta mejora para actualizar (PUT).


