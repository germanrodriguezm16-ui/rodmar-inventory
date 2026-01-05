/**
 * Utilidades de formateo centralizadas para RodMar
 * 
 * Este archivo contiene todas las funciones de formateo utilizadas en la aplicación.
 * Se mantiene aquí para evitar duplicación y asegurar consistencia.
 */

/**
 * Formatea un monto como moneda en pesos colombianos (COP)
 * 
 * @param amount - Cantidad a formatear (string, number, null o undefined)
 * @param compact - Si es true, usa formato compacto (K para miles, M para millones). Si es false, usa formato completo
 * @param locale - Locale para formateo (por defecto 'es-CO')
 * @param currency - Moneda (por defecto 'COP')
 * @returns String formateado o "N/A" si el valor es inválido
 * 
 * @example
 * formatCurrency(1000000) // "$1.000.000"
 * formatCurrency(1000000, true) // "$1.0M"
 * formatCurrency("1500", true) // "$2K"
 */
export const formatCurrency = (
  amount: string | number | null | undefined,
  compact: boolean = false,
  locale: string = 'es-CO',
  currency: string = 'COP'
): string => {
  if (amount === null || amount === undefined) return "N/A";
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return "N/A";
  
  // Formato compacto (K/M)
  if (compact) {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
  }
  
  // Formato completo con Intl.NumberFormat
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Formatea un número sin símbolo de moneda
 * 
 * @param amount - Cantidad a formatear (string o number)
 * @param locale - Locale para formateo (por defecto 'es-CO')
 * @returns String formateado o "0" si el valor es inválido
 * 
 * @example
 * formatNumber(1234567.89) // "1.234.567,89"
 */
export const formatNumber = (amount: number | string, locale: string = 'es-CO'): string => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '0';
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

/**
 * Formatea una fecha con el día de la semana en español
 * 
 * @param dateStr - Fecha como string, Date, null o undefined
 * @returns String formateado como "Lun. 25/11/24" o mensaje de error
 * 
 * @example
 * formatDateWithDaySpanish("2024-11-25") // "Lun. 25/11/24"
 */
export const formatDateWithDaySpanish = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "Sin fecha";
  
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    if (isNaN(date.getTime())) return "Fecha inválida";
    
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayName = dayNames[date.getDay()];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    return `${dayName}. ${day}/${month}/${year}`;
  } catch (error) {
    return "Error fecha";
  }
};

/**
 * Formatea una fecha en diferentes formatos
 * 
 * @param date - Fecha como string, Date, null o undefined
 * @param format - Formato deseado: 'short' (25/11/2024), 'long' (lunes, 25 de noviembre de 2024), o default (formato estándar)
 * @returns String formateado o "N/A" si la fecha es inválida
 * 
 * @example
 * formatDate("2024-11-25", "short") // "25/11/2024"
 * formatDate("2024-11-25", "long") // "lunes, 25 de noviembre de 2024"
 */
export const formatDate = (date: string | Date | null | undefined, format: 'short' | 'long' = 'short'): string => {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'N/A';
  
  if (format === 'short') {
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return d.toLocaleDateString('es-CO');
};

/**
 * Parsea un valor numérico de una cadena que puede contener símbolos de moneda y formato
 * 
 * @param value - String que contiene el valor numérico (puede incluir símbolos de moneda, puntos, comas, etc.)
 * @returns Número parseado o 0 si no se puede parsear
 * 
 * @example
 * parseNumericInput("$1.234.567,89") // 1234567.89
 * parseNumericInput("1,234.50") // 1234.5
 */
export const parseNumericInput = (value: string): number => {
  // Eliminar símbolos de moneda y caracteres no numéricos excepto punto y coma
  const cleanValue = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleanValue) || 0;
};