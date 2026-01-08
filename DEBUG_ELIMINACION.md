# 🔍 Debug: Problema Persistente con Eliminación de Minas

## Problema Reportado
- Usuario crea mina → aparece
- Intenta eliminarla → dice "mina no encontrada"  
- Refresca app → mina no aparece (sugiere que sí se eliminó)

## Posibles Causas

### 1. Verificación de Viajes Incluye Viajes Ocultos
`getViajesByMina(minaId)` puede estar devolviendo viajes ocultos que deberían ignorarse.

### 2. Verificación de Transacciones
`getTransaccionesBySocio("mina", minaId)` puede estar encontrando transacciones que deberían ignorarse (ocultas, pendientes, etc).

### 3. El deleteResult Devuelve false
Puede haber un problema con `deleteMina` cuando no se pasa userId.

## Solución Propuesta

Verificar que las validaciones en DELETE solo consideren:
- Viajes NO ocultos (estado !== 'oculta')
- Transacciones NO ocultas y completadas (no pendientes)











