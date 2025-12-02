import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, locale = 'es-CO', currency = 'COP') {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '$0';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

export function formatNumber(amount: number | string, locale = 'es-CO') {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '0';
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export function formatDate(date: string | Date | null, format = 'short'): string {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  
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
}

export function parseNumericInput(value: string): number {
  // Remove currency symbols, spaces, and other non-numeric characters except decimals
  const cleanValue = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function generateTripId(counter: number): string {
  return `TRP${counter.toString().padStart(3, '0')}`;
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'completado':
      return 'text-success';
    case 'pendiente':
      return 'text-warning';
    case 'cancelado':
      return 'text-error';
    default:
      return 'text-muted-foreground';
  }
}

export function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'completado':
      return 'default';
    case 'pendiente':
      return 'secondary';
    case 'cancelado':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function calculateDaysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDateRangeFilter(filterType: string, customDate?: Date, endDate?: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filterType) {
    case 'exactamente':
      if (!customDate) return null;
      const exact = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
      return {
        start: exact,
        end: new Date(exact.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'entre':
      if (!customDate || !endDate) return null;
      return {
        start: new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate()),
        end: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
      };
    
    case 'despues_de':
      if (!customDate) return null;
      return {
        start: new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate() + 1),
        end: new Date(2099, 11, 31) // Far future date
      };
    
    case 'antes_de':
      if (!customDate) return null;
      return {
        start: new Date(1900, 0, 1), // Far past date
        end: new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate() - 1, 23, 59, 59, 999)
      };
    
    case 'hoy':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'ayer':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: yesterday,
        end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'esta_semana':
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {
        start: startOfWeek,
        end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'semana_pasada':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      return {
        start: lastWeekStart,
        end: new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
      };
    
    case 'este_mes':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start: startOfMonth,
        end: endOfMonth
      };
    
    case 'mes_pasado':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return {
        start: lastMonthStart,
        end: lastMonthEnd
      };
    
    case 'este_año':
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        start: startOfYear,
        end: endOfYear
      };
    
    case 'año_pasado':
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return {
        start: lastYearStart,
        end: lastYearEnd
      };
    
    default:
      return null;
  }
}

export function isDateInRange(date: string | Date, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  
  const d = new Date(date);
  return d >= range.start && d < range.end;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function validatePlaca(placa: string): boolean {
  // Colombian license plate format: ABC-123 or ABC123
  const placaRegex = /^[A-Z]{3}-?\d{3}$/;
  return placaRegex.test(placa.toUpperCase());
}

export function formatPlaca(placa: string): string {
  // Format placa to ABC-123 format
  const clean = placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length >= 6) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 6)}`;
  }
  return clean;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  // Colombian phone number validation
  const phoneRegex = /^(\+57|57)?[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function generateReceipt(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `REC-${timestamp}-${random}`.toUpperCase();
}

export function sortByDate<T>(array: T[], dateField: keyof T, order: 'asc' | 'desc' = 'desc'): T[] {
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateField] as string).getTime();
    const dateB = new Date(b[dateField] as string).getTime();
    
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

export function groupByDate<T>(array: T[], dateField: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const date = new Date(item[dateField] as string).toDateString();
    
    if (!groups[date]) {
      groups[date] = [];
    }
    
    groups[date].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
