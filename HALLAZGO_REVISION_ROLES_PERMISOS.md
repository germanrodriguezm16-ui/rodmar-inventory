# Hallazgos: Revisión de Roles y Permisos

## 📋 Código Revisado

### Endpoint PUT `/api/admin/roles/:id` (líneas 5640-5713)

**Flujo actual:**
1. Obtiene el rol actual de la BD
2. Normaliza el nombre del frontend: `nombre.toUpperCase().trim()`
3. Compara `normalizedNombre !== currentRole.nombre`
4. Si son diferentes, verifica que no exista otro rol con ese nombre
5. Actualiza el rol (solo si el nombre cambió)
6. Elimina todos los permisos del rol
7. Inserta los nuevos permisos

### Inconsistencia encontrada

**Al crear roles** (línea 5612):
```typescript
nombre: nombre.toUpperCase(),  // Sin .trim()
```

**Al actualizar roles** (línea 5661):
```typescript
const normalizedNombre = nombre.toUpperCase().trim();  // Con .trim()
```

**Problema potencial:**
- Si un rol fue creado con espacios (antes de que se implementara `.trim()`), el nombre en la BD podría tener espacios
- Al comparar, `normalizedNombre` (con trim) vs `currentRole.nombre` (sin trim si fue creado antes) siempre serían diferentes
- Esto causaría que siempre intente actualizar el nombre

### Validación de permisos

El endpoint requiere el permiso `module.ADMIN.view` para funcionar.

### Manejo de errores

El código captura el error 23505 (unique constraint violation) y retorna el mensaje "Ya existe un rol con ese nombre".

## 🔍 Posibles causas del error

1. **Normalización inconsistente**: El nombre en la BD no está normalizado (tiene espacios) y la comparación falla
2. **Error real de duplicación**: Existe otro rol con el mismo nombre (después de normalizar)
3. **Problema con la actualización**: Drizzle ORM podría estar intentando actualizar el nombre incluso cuando no cambió

## 💡 Recomendación

Normalizar también `currentRole.nombre` antes de comparar:
```typescript
const normalizedCurrentNombre = currentRole.nombre.toUpperCase().trim();
if (normalizedNombre !== normalizedCurrentNombre) {
  // ...
}
```

Pero el usuario dice que "el problema parece ser otro". Necesito más información sobre qué comportamiento específico está viendo.




