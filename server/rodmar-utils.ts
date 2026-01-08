/**
 * Normaliza un nombre de cuenta RodMar a un código único
 * Elimina acentos, convierte espacios a guiones bajos, mayúsculas, y elimina caracteres especiales
 * 
 * Ejemplos:
 * "Refácil Colombia" → "REFAcil_COLOMBIA"
 * "Cuenta Principal" → "CUENTA_PRINCIPAL"
 * "Bemovil" → "BEMOVIL"
 */
export function normalizeNombreToCodigo(nombre: string): string {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre no puede estar vacío');
  }

  // 1. Eliminar acentos y caracteres especiales
  const sinAcentos = nombre
    .normalize('NFD') // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos (acentos)
    .replace(/ñ/g, 'N') // Preservar ñ → N
    .replace(/Ñ/g, 'N'); // Preservar Ñ → N

  // 2. Convertir a mayúsculas
  const mayusculas = sinAcentos.toUpperCase();

  // 3. Reemplazar espacios múltiples por uno solo
  const sinEspaciosMultiples = mayusculas.replace(/\s+/g, ' ');

  // 4. Reemplazar espacios por guiones bajos
  const conGuionesBajos = sinEspaciosMultiples.replace(/\s/g, '_');

  // 5. Eliminar caracteres que no sean letras, números o guiones bajos
  const soloAlfanumericos = conGuionesBajos.replace(/[^A-Z0-9_]/g, '');

  // 6. Eliminar guiones bajos múltiples
  const sinGuionesMultiples = soloAlfanumericos.replace(/_+/g, '_');

  // 7. Eliminar guiones bajos al inicio y final
  const codigo = sinGuionesMultiples.replace(/^_+|_+$/g, '');

  if (!codigo || codigo.length === 0) {
    throw new Error(`No se pudo generar un código válido a partir del nombre: "${nombre}"`);
  }

  return codigo;
}

/**
 * Mapeo de nombres antiguos a códigos nuevos
 * Para compatibilidad con permisos existentes
 */
export const nombreToCodigoMap: Record<string, string> = {
  'Bemovil': 'BEMOVIL',
  'Corresponsal': 'CORRESPONSAL',
  'Efectivo': 'EFECTIVO',
  'Cuentas German': 'CUENTAS_GERMAN',
  'Cuentas Jhon': 'CUENTAS_JHON',
  'Otros': 'OTROS',
};



