import { format } from "date-fns";

/**
 * IMPORTANTE: ZONA HORARIA COLOMBIANA (UTC-5)
 * 
 * Al crear funciones que trabajen con fechas, SIEMPRE tener en cuenta la zona horaria colombiana (UTC-5).
 * 
 * Problemas comunes:
 * - Al crear `new Date()` desde un string ISO (ej: "2025-12-07T00:00:00.000Z"), JavaScript interpreta en UTC.
 *   En Colombia (UTC-5), medianoche UTC se muestra como 7pm del día anterior.
 * 
 * Soluciones recomendadas:
 * 1. Extraer solo la parte de fecha (YYYY-MM-DD) y crear fecha en mediodía local:
 *    const [year, month, day] = dateString.split('-').map(Number);
 *    const date = new Date(year, month - 1, day, 12, 0, 0);
 * 
 * 2. Usar funciones de este archivo que ya manejan correctamente la zona horaria.
 * 
 * 3. Para fechas de finalización (updatedAt), usar directamente el timestamp sin conversión.
 */

/**
 * Formatea una fecha mostrando las iniciales del día de la semana
 * Ejemplo: "Lun. 29/06/2025"
 */
export function formatDateWithDay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const dayAbbr = format(dateObj, 'eee', { locale: undefined }).slice(0, 3) + '.';
  const dateStr = format(dateObj, 'dd/MM/yyyy');
  
  return `${dayAbbr} ${dateStr}`;
}

/**
 * Convierte iniciales de días en español a formato estándar
 */
const dayTranslations: Record<string, string> = {
  'Sun': 'Dom',
  'Mon': 'Lun', 
  'Tue': 'Mar',
  'Wed': 'Mié',
  'Thu': 'Jue',
  'Fri': 'Vie',
  'Sat': 'Sáb'
};

/**
 * Formatea una fecha mostrando las iniciales del día en español
 * Ejemplo: "Lun. 29/06/2025"
 * CORREGIDO: Evita problemas de zona horaria procesando solo la fecha
 */
export function formatDateWithDaySpanish(date: Date | string): string {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Si es string, extraer solo la parte de fecha para evitar problemas de zona horaria
    const dateString = date.includes('T') ? date.split('T')[0] : date;
    dateObj = new Date(dateString + 'T12:00:00'); // Mediodía para evitar problemas de zona horaria
  } else {
    // Si ya es Date, crear nueva fecha con solo la parte de fecha
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dateObj = new Date(dateString + 'T12:00:00');
  }
  
  const dayEn = format(dateObj, 'EEE');
  const dayEs = dayTranslations[dayEn] || dayEn;
  const dateStr = format(dateObj, 'dd/MM/yyyy');
  
  return `${dayEs}. ${dateStr}`;
}

/**
 * Formatea fecha para inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Crea una fecha local evitando problemas de zona horaria UTC
 * Agrega T00:00:00 para inicio del día o T23:59:59 para final del día
 */
export function createLocalDate(dateString: string, isEndOfDay: boolean = false): Date {
  const suffix = isEndOfDay ? 'T23:59:59' : 'T00:00:00';
  return new Date(dateString + suffix);
}

/**
 * Formatea una fecha de forma simple evitando problemas de zona horaria
 * Extrae directamente los componentes de la fecha sin crear objetos Date
 * Ejemplo: "02/07/25"
 */
export function formatDateSimple(date: Date | string): string {
  // Debug temporal
  console.log('formatDateSimple - Input:', {
    value: date,
    type: typeof date,
    isDate: date instanceof Date,
    toString: String(date)
  });
  
  let dateString: string;
  
  if (typeof date === 'string') {
    // Si es string UTC (ej: "2025-07-02T00:00:00.000Z"), extraer solo la parte de fecha
    dateString = date.includes('T') ? date.split('T')[0] : date;
    console.log('formatDateSimple - String processed:', dateString);
  } else if (date instanceof Date) {
    // Si es objeto Date, extraer componentes locales para evitar problema UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dateString = `${year}-${month}-${day}`;
    console.log('formatDateSimple - Date processed:', dateString, 'from Date:', date.toISOString());
  } else {
    console.log('formatDateSimple - Invalid date type');
    return 'Fecha inválida';
  }
  
  // Dividir YYYY-MM-DD en componentes
  const [year, month, day] = dateString.split('-');
  
  if (!year || !month || !day) {
    console.log('formatDateSimple - Invalid components:', {year, month, day});
    return 'Fecha inválida';
  }
  
  // Formatear como DD/MM/YY
  const result = `${day}/${month}/${year.slice(-2)}`;
  console.log('formatDateSimple - Final result:', result);
  return result;
}