# Changelog - RodMar Inventory v2.0.0

## 📅 Cambios Recientes (2025-01-XX)

### ✨ Mejoras en Balances del Encabezado

#### Balance Real en Encabezados (Minas, Compradores, Volqueteros)
- **Implementado**: Balance del encabezado ahora incluye **todas las transacciones y viajes** (ocultos y visibles)
- **Comportamiento**: El balance del encabezado **NO cambia** al ocultar/mostrar transacciones
- **Separación de balances**:
  - **Balance del encabezado**: Balance real que incluye todas las transacciones (ocultas y visibles)
  - **Balance de la pestaña de transacciones**: Balance dinámico que refleja solo las transacciones visibles/filtradas
- **Aplicado en**:
  - ✅ Página de detalles de Minas
  - ✅ Página de detalles de Compradores
  - ✅ Página de detalles de Volqueteros (nuevo)

#### Optimizaciones
- Queries separadas para balance del encabezado (`includeHidden=true`)
- Uso de `useMemo` para cálculos optimizados
- Endpoints del backend actualizados para soportar `includeHidden=true` en viajes

#### Correcciones
- **Fix**: Botón "Mostrar ocultas" en Volqueteros ahora cuenta correctamente los viajes ocultos usando `todosViajesIncOcultos` en lugar de `viajesVolquetero`

### 🔧 Cambios Técnicos

**Backend (`server/routes.ts`)**:
- Endpoint `/api/viajes/comprador/:compradorId` ahora acepta `includeHidden=true`
- Endpoint `/api/minas/:id/viajes` ahora acepta `includeHidden=true`
- Endpoint `/api/volqueteros/:id/viajes` ahora acepta `includeHidden=true`

**Frontend**:
- `comprador-detail.tsx`: Nueva query `todosViajesIncOcultos` y `balanceNetoReal` actualizado
- `mina-detail.tsx`: Nueva query `todosViajesIncOcultos` y `balanceMina` actualizado
- `volquetero-detail.tsx`: Nueva query `todosViajesIncOcultos`, nuevo `balanceEncabezado`, y corrección del conteo de ocultos

---

## 🎉 Reconstrucción Completa

### Cambios Principales

#### ✨ Nueva Estructura
- **Sistema de autenticación independiente**: Eliminada dependencia de Replit Auth
- **Middleware organizado**: Autenticación y sesiones en módulos separados
- **Código limpio**: Eliminados archivos redundantes y temporales

#### 🗑️ Archivos Eliminados
- Scripts de generación de iconos (create-*.mjs)
- Scripts de corrección de fechas (fix-*.mjs)
- Archivos de prueba (test-*.csv, test-*.xlsx)
- Archivos de backup (.backup, .temp)
- Archivos relacionados con Replit (replitAuth.ts, auth-fallback.ts, replit.md)
- Archivos temporales y de configuración obsoletos

#### 🔧 Mejoras Técnicas
- **Autenticación simplificada**: Sistema de autenticación simple y portable
- **Sesiones mejoradas**: Soporte para PostgreSQL o memoria según disponibilidad
- **Configuración limpia**: package.json sin dependencias de Replit
- **Vite configurado**: Sin plugins específicos de Replit

#### 📝 Documentación
- README.md actualizado con instrucciones claras
- .env.example creado para configuración
- .gitignore actualizado

### Migración desde v1.0

1. **Actualizar variables de entorno**:
   - Agregar `DATABASE_URL` si no existe
   - Configurar `SESSION_SECRET`
   - Opcional: `REQUIRE_AUTH=true` para producción

2. **Reinstalar dependencias**:
   ```bash
   npm install
   ```

3. **La base de datos es compatible**: No se requieren cambios en el schema

### Notas

- El sistema mantiene toda la funcionalidad original
- La autenticación ahora es más simple y portable
- Compatible con cualquier entorno de deploy (no solo Replit)

