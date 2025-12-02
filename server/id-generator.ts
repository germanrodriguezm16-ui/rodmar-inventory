import { db } from './db';
import { viajes } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Generador de IDs consecutivos lógicos para viajes
 * Mantiene la secuencia A1-A100, B1-B100, etc.
 * Reutiliza IDs eliminados para mantener integridad
 */

export class ViajeIdGenerator {
  /**
   * Genera el siguiente ID disponible siguiendo la lógica consecutiva
   * @param userId - ID del usuario para filtrar viajes
   * @returns El siguiente ID disponible (ej: "G24", "A5", etc.)
   */
  static async getNextAvailableId(userId: string): Promise<string> {
    // Obtener todos los IDs existentes para este usuario
    const existingIds = await db
      .select({ id: viajes.id })
      .from(viajes)
      .where(sql`${viajes.userId} = ${userId}`);

    const existingIdSet = new Set(existingIds.map(v => v.id));

    // Buscar el primer ID disponible en orden consecutivo
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    for (const letter of letters) {
      for (let num = 1; num <= 100; num++) {
        const candidateId = `${letter}${num}`;
        if (!existingIdSet.has(candidateId)) {
          return candidateId;
        }
      }
    }

    // Si llegamos aquí, necesitamos expandir más allá de Z100
    throw new Error('Se ha excedido el límite de IDs disponibles (Z100)');
  }

  /**
   * Verifica si un ID está disponible
   * @param id - ID a verificar
   * @param userId - ID del usuario
   * @returns true si está disponible, false si ya existe
   */
  static async isIdAvailable(id: string, userId: string): Promise<boolean> {
    const existing = await db
      .select({ id: viajes.id })
      .from(viajes)
      .where(sql`${viajes.id} = ${id} AND ${viajes.userId} = ${userId}`)
      .limit(1);

    return existing.length === 0;
  }

  /**
   * Obtiene estadísticas del uso de IDs por letra
   * @param userId - ID del usuario
   * @returns Objeto con estadísticas por letra
   */
  static async getIdStats(userId: string): Promise<Record<string, { used: number; available: number }>> {
    const existingIds = await db
      .select({ id: viajes.id })
      .from(viajes)
      .where(sql`${viajes.userId} = ${userId}`);

    const stats: Record<string, { used: number; available: number }> = {};
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (const letter of letters) {
      const usedInLetter = existingIds.filter(v => v.id.startsWith(letter)).length;
      stats[letter] = {
        used: usedInLetter,
        available: 100 - usedInLetter
      };
    }

    return stats;
  }

  /**
   * Encuentra IDs eliminados (huecos en la secuencia) por letra
   * @param userId - ID del usuario
   * @param letter - Letra específica a verificar (opcional)
   * @returns Array de IDs faltantes
   */
  static async findMissingIds(userId: string, letter?: string): Promise<string[]> {
    const existingIds = await db
      .select({ id: viajes.id })
      .from(viajes)
      .where(sql`${viajes.userId} = ${userId}`);

    const existingIdSet = new Set(existingIds.map(v => v.id));
    const missingIds: string[] = [];
    
    const lettersToCheck = letter ? [letter] : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (const checkLetter of lettersToCheck) {
      // Solo buscar huecos hasta el número más alto usado en esa letra
      const idsInLetter = existingIds
        .filter(v => v.id.startsWith(checkLetter))
        .map(v => parseInt(v.id.substring(1)))
        .sort((a, b) => a - b);

      if (idsInLetter.length > 0) {
        const maxNum = Math.max(...idsInLetter);
        for (let num = 1; num <= maxNum; num++) {
          const candidateId = `${checkLetter}${num}`;
          if (!existingIdSet.has(candidateId)) {
            missingIds.push(candidateId);
          }
        }
      }
    }

    return missingIds.sort((a, b) => {
      // Ordenar por letra y luego por número
      const letterA = a.charAt(0);
      const letterB = b.charAt(0);
      if (letterA !== letterB) {
        return letterA.localeCompare(letterB);
      }
      const numA = parseInt(a.substring(1));
      const numB = parseInt(b.substring(1));
      return numA - numB;
    });
  }

  /**
   * Valida que un ID tenga el formato correcto
   * @param id - ID a validar
   * @returns true si es válido, false si no
   */
  static validateIdFormat(id: string): boolean {
    const regex = /^[A-Z]\d{1,3}$/;
    return regex.test(id);
  }
}