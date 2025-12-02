// Utilidades de formateo optimizadas para RodMar

export const formatCurrency = (amount: string | number | null | undefined, compact = false): string => {
  if (!amount) return "N/A";
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return "N/A";
  
  if (compact) {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
  }
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

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