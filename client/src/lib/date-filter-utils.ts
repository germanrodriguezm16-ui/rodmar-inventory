/**
 * Utilidades centralizadas para filtrado de fechas
 * 
 * IMPORTANTE: Usa strings YYYY-MM-DD para evitar problemas de zona horaria.
 * Todas las funciones devuelven strings en formato YYYY-MM-DD en lugar de objetos Date.
 */

export type DateFilterType = "todos" | "exactamente" | "entre" | "despues-de" | 
  "antes-de" | "hoy" | "ayer" | "esta-semana" | "semana-pasada" | 
  "este-mes" | "mes-pasado" | "este-año" | "año-pasado";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Formatea una fecha Date a string YYYY-MM-DD usando métodos locales (evita problemas de zona horaria)
 */
function formatDateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Obtiene el rango de fechas según el tipo de filtro
 * 
 * @param filterType Tipo de filtro de fecha
 * @param filterValue Valor de fecha específica (para "exactamente", "despues-de", "antes-de") en formato YYYY-MM-DD
 * @param filterValueEnd Valor de fecha final (para "entre") en formato YYYY-MM-DD
 * @returns Rango de fechas en formato { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } o null
 */
export function getDateRangeFromFilter(
  filterType: DateFilterType,
  filterValue?: string,
  filterValueEnd?: string
): DateRange | null {
  if (filterType === "todos") {
    return null;
  }

  const today = new Date();
  const todayStr = formatDateToString(today);

  switch (filterType) {
    case "exactamente":
      return filterValue ? { start: filterValue, end: filterValue } : null;
    
    case "entre":
      return (filterValue && filterValueEnd) ? { start: filterValue, end: filterValueEnd } : null;
    
    case "despues-de":
      return filterValue ? { start: filterValue, end: "9999-12-31" } : null;
    
    case "antes-de":
      return filterValue ? { start: "1900-01-01", end: filterValue } : null;
    
    case "hoy":
      return { start: todayStr, end: todayStr };
    
    case "ayer": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = formatDateToString(yesterday);
      return { start: yesterdayStr, end: yesterdayStr };
    }
    
    case "esta-semana": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfWeekStr = formatDateToString(startOfWeek);
      return { start: startOfWeekStr, end: todayStr };
    }
    
    case "semana-pasada": {
      const startOfLastWeek = new Date(today);
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      return { start: formatDateToString(startOfLastWeek), end: formatDateToString(endOfLastWeek) };
    }
    
    case "este-mes": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDateToString(startOfMonth), end: todayStr };
    }
    
    case "mes-pasado": {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDateToString(startOfLastMonth), end: formatDateToString(endOfLastMonth) };
    }
    
    case "este-año": {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return { start: formatDateToString(startOfYear), end: todayStr };
    }
    
    case "año-pasado": {
      const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
      return { start: formatDateToString(startOfLastYear), end: formatDateToString(endOfLastYear) };
    }
    
    default:
      return null;
  }
}

/**
 * Filtra transacciones por rango de fechas
 * Usa comparación de strings (YYYY-MM-DD) para evitar problemas de zona horaria
 * 
 * @param transactions Array de transacciones con campo 'fecha'
 * @param dateRange Rango de fechas en formato { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns Array filtrado de transacciones
 */
export function filterTransactionsByDateRange<T extends { fecha: string | Date }>(
  transactions: T[],
  dateRange: DateRange | null
): T[] {
  if (!dateRange) {
    return transactions;
  }

  return transactions.filter(transaction => {
    // Extraer solo la parte de fecha como string (YYYY-MM-DD) de la transacción usando métodos locales
    let fechaTransStr: string;
    if (typeof transaction.fecha === 'string') {
      // Si es string ISO, tomar solo la parte de fecha
      fechaTransStr = transaction.fecha.split('T')[0];
    } else {
      // Si es Date, usar métodos locales para evitar problemas de zona horaria
      const date = new Date(transaction.fecha);
      fechaTransStr = formatDateToString(date);
    }
    
    // Comparar strings directamente (YYYY-MM-DD) para evitar problemas de zona horaria
    return fechaTransStr >= dateRange.start && fechaTransStr <= dateRange.end;
  });
}

