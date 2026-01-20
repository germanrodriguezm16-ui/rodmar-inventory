# Cambios recientes (2026-01-20): Imagen descargable RodMar (Cuentas) + Banco

## Objetivo
Corregir la **vista previa / descarga de imagen** para:
- **Cuentas RodMar individuales**: el encabezado mostraba balance en **0** y los valores aparecían **grises** (sin signo).
- **Banco (módulo RodMar)**: la imagen no calculaba totales/colores correctamente para `accountType="banco"`.

## Hallazgo raíz
En el modal de cuentas RodMar (`RodMarCuentasImageModal`) el cálculo de ingresos/egresos depende de poder identificar si una transacción es **entrada/salida** de la cuenta específica.  
Cuando el modal abría con `cuentaCodigo` y `cuentaIdentificadores` en **`undefined`**, `matchCuenta()` no podía clasificar ninguna fila ⇒ todo quedaba gris y el resumen quedaba en 0.

## Cambios implementados

### 1) Cuentas RodMar: pasar identificadores correctos al modal de imagen
- Archivo: `client/src/pages/rodmar-cuenta-detail.tsx`
- Se aseguró que el modal reciba:
  - `cuentaCodigo`
  - `cuentaIdentificadores`
- Se robusteció `cuentaIdentificadores` para incluir:
  - el ID numérico del slug (`/rodmar/cuenta/4` ⇒ `"4"`)
  - `cuentaEncontrada.codigo` (cuando está disponible)
  - `cuentaEncontrada.id`
  - `cuentaNombre` (fallback)
  - un identificador inferido desde transacciones (`cuentaCodigoInferido`)

> Nota: Se agregó el script `scripts/patch-rodmar-cuenta-image.cjs` como herramienta de parcheo rápido para dejar el archivo de la página en el estado correcto cuando había divergencias entre “archivo en disco” vs “editor con cambios sin guardar”.

### 2) Cuentas RodMar: no depender de flags precalculados al sumar totales
- Archivo: `client/src/components/modals/rodmar-cuentas-image-modal.tsx`
- Se ajustó el cálculo para **recalcular siempre** ingresos/egresos desde:
  - `deQuienTipo/deQuienId`
  - `paraQuienTipo/paraQuienId`
en lugar de confiar en flags opcionales que podían venir `false` y bloquear el cálculo.

### 3) Banco: soportar `accountType="banco"` en la imagen del módulo RodMar
- Archivo: `client/src/components/modals/rodmar-transacciones-image-modal.tsx`
- Se agregó lógica análoga a LCDM/Postobón:
  - **positivos**: `deQuienTipo === 'banco'`
  - **negativos**: `paraQuienTipo === 'banco'`
  - color/signo por fila basado en `paraQuienTipo === 'banco'` (rojo/`-`) vs caso contrario (verde/`+`).

## Archivos tocados
- `client/src/pages/rodmar-cuenta-detail.tsx`
- `client/src/components/modals/rodmar-cuentas-image-modal.tsx`
- `client/src/components/modals/rodmar-transacciones-image-modal.tsx`
- `scripts/patch-rodmar-cuenta-image.cjs`

## Cómo verificar
1) Abrir una cuenta RodMar: `RodMar → Cuentas → (cuenta) → Img`
   - Debe mostrarse el resumen con ingresos/egresos/balance **no cero** (si hay datos).
   - Los valores deben verse **en verde/rojo** con **signo**.
2) Abrir `RodMar → Banco → Img`
   - Debe calcular y colorear totales para Banco correctamente.

