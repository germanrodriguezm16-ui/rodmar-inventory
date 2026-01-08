# Debug: Problema al editar rol

## Análisis del código actual

El código actual hace:

1. Normaliza el nombre del frontend: `nombre.toUpperCase().trim()`
2. Obtiene el rol actual de la BD
3. Compara: `normalizedNombre !== currentRole.nombre`
4. Si son diferentes, verifica si existe otro rol con ese nombre
5. Si no existe, actualiza el nombre

## Posible problema

Si `currentRole.nombre` en la BD ya está normalizado (en mayúsculas), la comparación debería funcionar. 

Pero hay un caso edge: si el nombre viene exactamente igual desde el frontend, la comparación `normalizedNombre !== currentRole.nombre` devolvería `false`, y no intentaría actualizar el nombre, lo cual está bien.

Sin embargo, el error 23505 se está capturando en el catch, lo que significa que algo está fallando en la actualización de la base de datos.

## Posibles causas:

1. El nombre en la BD no está normalizado y tiene espacios
2. Hay un problema con la transacción (aunque no estamos usando transacciones explícitas)
3. El error viene de otro lugar (aunque el mensaje dice que es del nombre)

## Lo que debemos verificar:

1. ¿El nombre en la BD está normalizado? (en mayúsculas)
2. ¿Hay espacios o caracteres especiales?
3. ¿El error viene realmente del UPDATE del nombre o de otra operación?




