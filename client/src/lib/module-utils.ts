/**
 * Utilidades para determinar módulos disponibles según permisos
 */

export type Module = "principal" | "minas" | "compradores" | "volqueteros" | "transacciones" | "rodmar";

/**
 * Mapeo de módulos a sus permisos requeridos
 */
export const modulePermissions: Record<Module, string> = {
  principal: "module.PRINCIPAL.view",
  minas: "module.MINAS.view",
  compradores: "module.COMPRADORES.view",
  volqueteros: "module.VOLQUETEROS.view",
  transacciones: "module.TRANSACCIONES.view",
  rodmar: "module.RODMAR.view",
};

/**
 * Orden de prioridad para determinar el módulo inicial
 * (el orden en que se verificarán los módulos)
 */
export const modulePriority: Module[] = [
  "principal",
  "minas",
  "compradores",
  "volqueteros",
  "transacciones",
  "rodmar",
];

/**
 * Determina el primer módulo disponible según los permisos del usuario
 * @param userPermissions Array de permisos del usuario
 * @returns El primer módulo disponible, o "principal" como fallback
 */
export function getFirstAvailableModule(userPermissions: string[]): Module {
  // Verificar módulos en orden de prioridad
  for (const module of modulePriority) {
    const requiredPermission = modulePermissions[module];
    if (userPermissions.includes(requiredPermission)) {
      return module;
    }
  }
  
  // Si no tiene ningún permiso, retornar "principal" como fallback
  // (aunque no debería pasar si el sistema está bien configurado)
  return "principal";
}

/**
 * Verifica si un usuario tiene permiso para acceder a un módulo específico
 * @param userPermissions Array de permisos del usuario
 * @param module Módulo a verificar
 * @returns true si el usuario tiene permiso, false en caso contrario
 */
export function hasModulePermission(userPermissions: string[], module: Module): boolean {
  const requiredPermission = modulePermissions[module];
  return userPermissions.includes(requiredPermission);
}









