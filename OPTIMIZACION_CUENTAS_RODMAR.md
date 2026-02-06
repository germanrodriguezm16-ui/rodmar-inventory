# Optimización de Carga de Cuentas RodMar

## Problema Identificado
La pestaña de Cuentas en RodMar demoraba varios segundos en cargar debido a que:
1. Se cargaban TODAS las transacciones de la BD sin filtrar
2. Se iteraba sobre todas las transacciones para cada cuenta (O(n×m))
3. No había índices en los campos de búsqueda

## Optimizaciones Implementadas

### 1. Filtrado en Base de Datos (✅ Implementado)
**Archivo**: `server/routes.ts` (línea 8694-8711)

**Cambio**:
- Antes: `storage.getTransacciones()` - cargaba todas las transacciones
- Ahora: Query filtrada que solo obtiene transacciones con `deQuienTipo = 'rodmar'` o `paraQuienTipo = 'rodmar'`

**Impacto**:
- Reduce significativamente el número de transacciones procesadas
- Mantiene la lógica exacta de cálculo (referenciasPosibles, slugs legacy, etc.)
- No afecta la funcionalidad, solo mejora el rendimiento

### 2. Índices en Base de Datos (✅ Agregados al Schema)
**Archivo**: `shared/schema.ts` (línea 209-217)

**Índices agregados**:
- `idx_transacciones_de_quien_tipo`: En `deQuienTipo`
- `idx_transacciones_para_quien_tipo`: En `paraQuienTipo`
- `idx_transacciones_de_quien_id`: En `deQuienId`
- `idx_transacciones_para_quien_id`: En `paraQuienId`
- `idx_transacciones_de_quien`: Compuesto en `(deQuienTipo, deQuienId)`
- `idx_transacciones_para_quien`: Compuesto en `(paraQuienTipo, paraQuienId)`

**⚠️ IMPORTANTE: Migración Requerida**
Los índices están definidos en el schema pero necesitan ser creados en la base de datos. Ejecutar:

```bash
npm run db:generate
npm run db:push
```

O manualmente en la BD:
```sql
CREATE INDEX IF NOT EXISTS idx_transacciones_de_quien_tipo ON transacciones(de_quien_tipo);
CREATE INDEX IF NOT EXISTS idx_transacciones_para_quien_tipo ON transacciones(para_quien_tipo);
CREATE INDEX IF NOT EXISTS idx_transacciones_de_quien_id ON transacciones(de_quien_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_para_quien_id ON transacciones(para_quien_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_de_quien ON transacciones(de_quien_tipo, de_quien_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_para_quien ON transacciones(para_quien_tipo, para_quien_id);
```

## Mejoras de Rendimiento Esperadas

### Antes de la optimización:
- Con 10,000 transacciones: ~2-5 segundos
- Con 50,000 transacciones: ~10-20 segundos

### Después de la optimización:
- Con 10,000 transacciones (solo ~500 RodMar): ~0.3-0.5 segundos
- Con 50,000 transacciones (solo ~2,500 RodMar): ~0.5-1 segundo
- Con índices: ~0.1-0.3 segundos adicionales de mejora

## Compatibilidad

✅ **Totalmente compatible**:
- Mantiene la lógica exacta de `referenciasPosibles` (ID, código, slug legacy)
- No cambia el cálculo de balances
- No afecta otras funciones que usan transacciones
- Solo optimiza el filtrado previo

## Notas Técnicas

- La lógica de cálculo se mantiene exactamente igual (líneas 8771-8827)
- Solo se optimiza el filtrado previo (línea 8694-8711)
- Los índices mejoran el rendimiento de las queries pero no son críticos para el funcionamiento
- Si los índices no se crean, la optimización de filtrado seguirá funcionando (solo será un poco más lenta)
