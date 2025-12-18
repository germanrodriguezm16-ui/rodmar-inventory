/**
 * Helpers de fechas para Colombia (America/Bogota, UTC-5)
 *
 * Problema que resolvemos:
 * - `new Date("YYYY-MM-DD")` se interpreta como UTC, lo que en Colombia puede verse como el día anterior.
 *
 * Estrategia:
 * - Para "fechas calendario" (sin hora), creamos un Date que represente el **mediodía en Colombia**
 *   del día indicado. Eso evita corrimientos por offset al serializar/parsear y al renderizar.
 *
 * Nota:
 * - Colombia no usa DST, así que el offset UTC-5 es estable.
 */

export function parseColombiaDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  // Acepta "YYYY-MM-DD" o strings ISO; para ISO tomamos solo la parte de fecha.
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));

  if (!y || !m || !d) {
    // Fallback: dejar que JS intente parsear (último recurso)
    return new Date(value);
  }

  // Mediodía Colombia (UTC-5) equivale a 17:00 UTC.
  return new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
}


