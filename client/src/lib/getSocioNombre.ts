import type { Mina, Comprador, Volquetero } from "@shared/schema";

/**
 * Obtiene el nombre de un socio basado en su tipo e ID
 * @param tipo Tipo del socio (mina, comprador, volquetero, rodmar, banco, lcdm, postobon)
 * @param id ID o nombre del socio
 * @param minas Lista de minas (opcional)
 * @param compradores Lista de compradores (opcional)
 * @param volqueteros Lista de volqueteros (opcional)
 * @returns Nombre del socio o null si no se encuentra
 */
export function getSocioNombre(
  tipo: string | null | undefined,
  id: string | number | null | undefined,
  minas?: Mina[],
  compradores?: Comprador[],
  volqueteros?: Volquetero[]
): string | null {
  if (!tipo || !id) return null;

  const idStr = typeof id === 'number' ? id.toString() : id;

  switch (tipo) {
    case 'mina':
      if (minas) {
        const mina = minas.find(m => m.id.toString() === idStr);
        return mina?.nombre || null;
      }
      return null;
    
    case 'comprador':
      if (compradores) {
        const comprador = compradores.find(c => c.id.toString() === idStr);
        return comprador?.nombre || null;
      }
      return null;
    
    case 'volquetero':
      if (volqueteros) {
        const volquetero = volqueteros.find(v => v.id.toString() === idStr);
        return volquetero?.nombre || null;
      }
      // Si no hay lista, asumir que el ID es el nombre (para volqueteros)
      return idStr;
    
    case 'rodmar':
      const rodmarOptions: Record<string, string> = {
        'bemovil': 'Bemovil',
        'corresponsal': 'Corresponsal',
        'efectivo': 'Efectivo',
        'cuentas-german': 'Cuentas German',
        'cuentas-jhon': 'Cuentas Jhon',
        'otras': 'Otras',
      };
      return rodmarOptions[idStr] || idStr;
    
    case 'banco':
      return 'Banco';
    
    case 'lcdm':
      return 'La Casa del Motero';
    
    case 'postobon':
      return 'Postobón';
    
    default:
      return idStr;
  }
}

