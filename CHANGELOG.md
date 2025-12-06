# Changelog - RodMar Inventory v2.1.0

## 📅 Cambios Recientes (Enero 2025)

> **📋 Documentación Completa**: 
> - Ver [MEJORAS_RECIENTES.md](./MEJORAS_RECIENTES.md) para documentación detallada de todas las mejoras.
> - Ver [MEJORAS_INTERACCION_TARJETAS.md](./MEJORAS_INTERACCION_TARJETAS.md) para mejoras de interacción en tarjetas.

### 🖱️ v2.1.1 - Mejoras de Interacción en Tarjetas (Enero 2025)

#### ✨ Nuevas Funcionalidades

**1. Interacción Mejorada con Tarjetas de Listado**
- ✅ Click simple en cualquier parte de la tarjeta: Abre la página de detalles
- ✅ Doble click en el nombre: Activa modo de edición inline sin abrir detalles
- ✅ Prevención de conflictos: El doble click no activa el click simple
- ✅ Áreas específicas protegidas: Contadores y botones no navegan accidentalmente

**2. Componente EditableTitle Mejorado**
- ✅ `handleNameClick`: Permite que clicks simples se propaguen al padre
- ✅ `handleDoubleClick`: Activa edición con `stopPropagation` para prevenir navegación
- ✅ Tooltip informativo: "Doble click para editar"
- ✅ Cursor visual: `cursor-text` para indicar que el nombre es editable

#### 🔧 Correcciones de Interacción

**1. Página de Minas (`minas.tsx`)**
- ✅ Removido `stopPropagation` del div principal
- ✅ Movido `stopPropagation` solo al área de "Viajes" y botón eliminar
- ✅ Click ahora funciona en nombre, ícono y balance

**2. Página de Compradores (`compradores.tsx`)**
- ✅ Removido `stopPropagation` del div principal
- ✅ Movido `stopPropagation` solo al área de "Viajes" y botón eliminar
- ✅ Mismo comportamiento mejorado que Minas

**3. Página de Volqueteros (`volqueteros.tsx`)**
- ✅ Reemplazado `Link` component por `onClick` directo en el `Card`
- ✅ Removido `stopPropagation` del div principal
- ✅ Movido `stopPropagation` solo al área de balance
- ✅ Agregado `handleViewVolquetero` para navegación programática
- ✅ Click ahora funciona en toda la tarjeta (nombre, ícono, placas, contador)

#### 📝 Archivos Modificados

**Componentes:**
- ✅ `client/src/components/EditableTitle.tsx`
  - Agregado `handleNameClick` para permitir propagación de clicks simples
  - Agregado `handleDoubleClick` con `stopPropagation`
  - Removido `stopPropagation` del div principal

**Páginas:**
- ✅ `client/src/pages/minas.tsx`
- ✅ `client/src/pages/compradores.tsx`
- ✅ `client/src/pages/volqueteros.tsx`

#### 🎯 Beneficios

- **UX Mejorada**: Interacción más intuitiva y natural
- **Menos Clicks**: No es necesario hacer click en áreas específicas
- **Edición Rápida**: Doble click permite editar sin abrir la página
- **Código Limpio**: Separación clara de responsabilidades
- **Consistencia**: Mismo comportamiento en todas las páginas de listado

---

### 🚀 v2.1.0 - Actualizaciones en Tiempo Real y Optimizaciones (Enero 2025)

#### ✨ Nuevas Funcionalidades

**1. Sistema de Actualizaciones en Tiempo Real (WebSockets)**
- ✅ Implementado Socket.io para actualizaciones en tiempo real
- ✅ Balances se actualizan automáticamente en todos los usuarios conectados
- ✅ Eventos específicos por tipo de cambio (transacciones, balances, tarjetas)
- ✅ Invalidación inteligente de queries React Query
- ✅ Refetch automático de datos relevantes

**2. Refactorización del Componente de Upload de Imágenes**
- ✅ Eliminado campo de texto para número de voucher
- ✅ Botón de cámara para tomar foto directamente (`capture="environment"`)
- ✅ Botón de upload para seleccionar desde galería
- ✅ Solo íconos (sin texto) para ahorrar espacio
- ✅ Mejora de calidad de imagen (1200x900px, 85% calidad, 500KB objetivo)

#### ⚡ Optimizaciones de Performance

**1. Operaciones de Ocultar/Mostrar Transacciones**
- ✅ Optimizadas mutations para solo invalidar queries específicas
- ✅ Eliminado refetch global innecesario
- ✅ Implementado optimistic updates en Compradores
- ✅ Endpoints específicos para operaciones de "mostrar todas las ocultas"

**2. Cálculo de Balances**
- ✅ Recalculo sincrónico inmediato después de cambios
- ✅ Marcado de `balanceDesactualizado` optimizado
- ✅ Separación clara entre balance real (encabezado) y balance visible (pestaña)

#### 📱 Mejoras de UI/UX para Móviles

**1. Componentes Responsive**
- ✅ Floating Action Button (FAB) ajustado para móviles
- ✅ Bottom Navigation Bar estática y responsive
- ✅ Paginación responsive (solo íconos en móviles)
- ✅ Encabezados de módulos más compactos

**2. Listas y Tarjetas**
- ✅ Encabezado de Minas reorganizado en 3 filas
- ✅ Encabezado de Compradores similar a Minas
- ✅ Tarjetas de Compradores: eliminado ID, balance en fila completa
- ✅ Tarjetas de Volqueteros: eliminados botones redundantes
- ✅ Tarjetas de RodMar: solo balance neto (sin desglose)

**3. Módulo de Transacciones**
- ✅ Encabezado más compacto (menos padding, márgenes, texto)
- ✅ Truncamiento de nombres largos de socios
- ✅ Filtros responsive con `grid-cols-1 sm:grid-cols-2`

#### 🐛 Correcciones de Bugs

- ✅ Eliminación de transacciones ahora actualiza ambos socios correctamente
- ✅ Endpoints de ocultar/mostrar corregidos (404/405 resueltos)
- ✅ Balance de Volqueteros corregido (eliminado ABS incorrecto)
- ✅ Discrepancias de balance entre encabezado y lista resueltas
- ✅ Modales de editar/eliminar ahora se abren correctamente en Compradores

#### 🔧 Mejoras Técnicas

**Backend:**
- ✅ Nuevos endpoints específicos para operaciones de mostrar ocultas
- ✅ Funciones de DB optimizadas con `.returning()`
- ✅ Eliminado filtro `userId` de operaciones de eliminación
- ✅ Emisión de eventos WebSocket después de operaciones CRUD

**Frontend:**
- ✅ Hook `useSocket` para manejar conexión y eventos WebSocket
- ✅ Integración de WebSockets en hooks de balances
- ✅ Optimización de invalidación de queries
- ✅ Mejora de manejo de errores y validaciones

---

## 📅 Cambios Anteriores (2025-01-XX)

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

