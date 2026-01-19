# Cambios recientes (2026-01-19): Préstamos + Dev local

## 1) Préstamos: pausa, reanudación y nueva etapa

Se agregó un flujo para **cerrar/reabrir** préstamos sin romper coherencia:

- **Cerrar**: marca el préstamo como `closed` y guarda `pausedAt`.
- **Reabrir (mismo préstamo)**: reactiva (`status=active`) y guarda `resumeAt`.
  - Los intereses **no se pueden generar antes de `resumeAt`**.
- **Reabrir como nueva etapa**: crea un **nuevo préstamo** con el capital pendiente,
  conservando el historial del anterior.

**Campos nuevos** (DB):
- `tercero_loans.paused_at`
- `tercero_loans.resume_at`

**Endpoints nuevos**:
- `PATCH /api/terceros/:id/loans/:loanId/reopen`
- `POST /api/terceros/:id/loans/:loanId/reopen-stage`

## 2) Intereses: fecha elegida y eliminación segura

Ahora el interés se puede **generar para una fecha específica** (periodo `YYYY-MM`):

- `POST /api/terceros/:id/loans/:loanId/generate-interest`
  - Body: `{ periodDate: "YYYY-MM-DD" }`
  - Solo 1 interés por periodo.

El interés generado se puede **eliminar** si no tiene pagos aplicados:

- `DELETE /api/terceros/:id/loans/:loanId/interest/:runId`

## 3) Pagos: desvincular sin borrar transacciones

Se permite **desvincular** un pago aplicado a un préstamo sin borrar la transacción:

- `DELETE /api/terceros/:id/loans/:loanId/payments/:paymentTransactionId`

## 4) UI Préstamos (Tercero)

- Nuevo modal para **generar interés con fecha**.
- Nuevo modal para **reabrir** con dos modos (retomar / nueva etapa).
- Botón **Eliminar** ahora es ícono con confirmación.
- “Generar interés” y “Aplicar pago” se desactivan si el préstamo está cerrado.

## 5) Dev local: arranque más rápido + backend watch

### 5.1 Backend con reinicio automático
- `npm run dev` ahora usa `tsx watch`.

### 5.2 Backend API-only en dev (evita doble UI)
- Variable `DEV_SERVER_UI=off` por defecto.
- UI oficial de dev: `http://localhost:5173`.

### 5.3 Migraciones históricas bajo demanda
Para evitar arranques lentos en Railway/local:

- `MIGRATIONS_ON_BOOT=off | background | blocking`
- Script manual:
  - `npm run migrations:run`

## Archivos clave

- `server/routes.ts`
- `shared/schema.ts`
- `client/src/pages/tercero-detail.tsx`
- `server/init-db.ts`
- `server/run-migrations.ts`
- `package.json`
- `server/index.ts`
- `README.md`
- `ENV_EXAMPLE.md`
