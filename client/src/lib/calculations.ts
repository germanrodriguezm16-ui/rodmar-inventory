interface TripCalculationData {
  peso: number;
  precioCompraTon: number;
  ventaTon: number;
  fleteTon: number;
  otrosGastosFlete?: number;
}

interface TripCalculationResult {
  totalVenta: number;
  totalCompra: number;
  totalFlete: number;
  valorConsignar: number;
  ganancia: number;
  vut: number; // Valor Unitario Total (Venta)
  cut: number; // Costo Unitario Total (Compra)
  fut: number; // Flete Unitario Total
}

export function calculateTripFinancials(data: TripCalculationData): TripCalculationResult {
  const { peso, precioCompraTon, ventaTon, fleteTon, otrosGastosFlete = 0 } = data;

  // Calculate totals
  const totalVenta = peso * ventaTon;
  const totalCompra = peso * precioCompraTon;
  const totalFleteBase = peso * fleteTon;
  const totalFlete = totalFleteBase + otrosGastosFlete;

  // Calculate valor a consignar (amount to consign)
  // This is typically the total sale minus freight
  const valorConsignar = totalVenta - totalFlete;

  // Calculate profit (ganancia)
  // Ganancia = Total Venta - Total Compra - Total Flete
  const ganancia = totalVenta - totalCompra - totalFlete;

  // Unit values (per ton)
  const vut = ventaTon; // Valor Unitario Total
  const cut = precioCompraTon; // Costo Unitario Total
  const fut = fleteTon; // Flete Unitario Total

  return {
    totalVenta,
    totalCompra,
    totalFlete,
    valorConsignar,
    ganancia,
    vut,
    cut,
    fut,
  };
}

export function calculateBalance(transactions: Array<{ valor: string; concepto: string }>) {
  let total = 0;
  
  transactions.forEach(transaction => {
    const amount = parseFloat(transaction.valor);
    
    // Determine if this is a credit or debit based on concept
    // This would need to be customized based on business rules
    if (transaction.concepto.toLowerCase().includes('pago') || 
        transaction.concepto.toLowerCase().includes('abono') ||
        transaction.concepto.toLowerCase().includes('credito')) {
      total += amount;
    } else {
      total -= amount;
    }
  });
  
  return total;
}

export function calculateMinaBalance(viajes: any[], transacciones: any[]) {
  // Ingresos por viajes completados (lo que RodMar paga a la mina)
  const ingresosViajes = viajes
    .filter(v => v.fechaDescargue && v.estado === "completado")
    .reduce((sum, v) => sum + parseFloat(v.totalCompra || '0'), 0);

  // Transacciones netas (solo transacciones manuales, excluyendo viajes)
  const transaccionesNetas = transacciones
    .filter(t => t.tipo !== "Viaje") // Excluir transacciones de viajes
    .reduce((sum, t) => {
      const valor = parseFloat(t.valor || '0');
      if (t.deQuienTipo === 'mina') {
        // Transacciones desde la mina = ingresos positivos (mina vende/recibe)
        return sum + valor;
      } else if (t.paraQuienTipo === 'mina') {
        // Transacciones hacia la mina = egresos negativos
        return sum - valor;
      } else if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
        // Transacciones hacia RodMar/Banco = ingresos positivos
        return sum + valor;
      }
      return sum;
    }, 0);

  return ingresosViajes + transaccionesNetas;
}

export function calculateCompradorBalance(viajes: any[], transacciones: any[]) {
  // Calculate balance for a buyer
  // Total Ventas - Abonos/Saldos + Préstamos
  
  let totalVentas = 0;
  let totalAbonos = 0;
  let totalPrestamos = 0;
  
  // Sum up total sales from completed trips
  viajes.forEach(viaje => {
    if (viaje.estado === 'completado' && viaje.totalVenta) {
      totalVentas += parseFloat(viaje.totalVenta);
    }
  });
  
  // Sum up payments and loans
  transacciones.forEach(transaccion => {
    const amount = parseFloat(transaccion.valor);
    if (transaccion.concepto.toLowerCase().includes('abono') ||
        transaccion.concepto.toLowerCase().includes('pago')) {
      totalAbonos += amount;
    } else if (transaccion.concepto.toLowerCase().includes('prestamo')) {
      totalPrestamos += amount;
    }
  });
  
  const balanceFinal = totalVentas - totalAbonos + totalPrestamos;
  const totalViajes = viajes.filter(v => v.estado === 'completado').length;
  
  return {
    totalIngresos: totalVentas,
    totalTransacciones: totalAbonos - totalPrestamos,
    balanceFinal,
    totalViajes
  };
}

export function calculateVolqueteroBalance(transacciones: any[]) {
  // Calculate balance for a trucker
  // (Pagos + Préstamos) * (-1) + Saldos a Favor
  
  let totalPagos = 0;
  let totalPrestamos = 0;
  let saldosAFavor = 0;
  
  transacciones.forEach(transaccion => {
    const amount = parseFloat(transaccion.valor);
    
    if (transaccion.concepto.toLowerCase().includes('pago')) {
      totalPagos += amount;
    } else if (transaccion.concepto.toLowerCase().includes('prestamo')) {
      totalPrestamos += amount;
    } else if (transaccion.concepto.toLowerCase().includes('saldo') &&
               transaccion.concepto.toLowerCase().includes('favor')) {
      saldosAFavor += amount;
    }
  });
  
  return (totalPagos + totalPrestamos) * -1 + saldosAFavor;
}

/**
 * Resultado de cálculo de balance con desglose de positivos y negativos
 */
export interface BalanceResult {
  positivos: number;
  negativos: number;
  balance: number;
}

/**
 * Calcula el balance de una entidad tipo tercero
 * 
 * @param transactions - Array de transacciones
 * @param terceroId - ID del tercero
 * @returns BalanceResult con positivos, negativos y balance total
 * 
 * Lógica:
 * - Positivos: desde tercero (deQuienTipo='tercero' y deQuienId=terceroId) → RodMar le debe al tercero
 * - Negativos: hacia tercero (paraQuienTipo='tercero' y paraQuienId=terceroId) → El tercero le debe a RodMar
 */
export function calculateTerceroBalance(
  transactions: any[],
  terceroId: string | number
): BalanceResult {
  let positivos = 0;
  let negativos = 0;

  transactions.forEach((transaccion: any) => {
    const valor = parseFloat(
      typeof transaccion.valor === 'string' 
        ? transaccion.valor.replace(/[$,]/g, '') 
        : transaccion.valor || '0'
    );

    if (transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId.toString()) {
      positivos += valor; // Positivo: desde tercero (origen)
    } else if (transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId.toString()) {
      negativos += valor; // Negativo: hacia tercero (destino)
    }
  });

  return {
    positivos,
    negativos,
    balance: positivos - negativos
  };
}

/**
 * Calcula el balance de una cuenta RodMar específica
 * 
 * @param transactions - Array de transacciones
 * @param cuentaId - ID de la cuenta RodMar (ej: 'bemovil', 'efectivo', etc.)
 * @returns BalanceResult con positivos, negativos y balance total
 * 
 * Lógica:
 * - Positivos: ingresos a la cuenta (paraQuienTipo='rodmar' y paraQuienId=cuentaId) o inversiones positivas
 * - Negativos: egresos de la cuenta (deQuienTipo='rodmar' y deQuienId=cuentaId) o inversiones negativas
 */
export function calculateRodMarCuentaBalance(
  transactions: any[],
  cuentaId: string
): BalanceResult {
  let positivos = 0;
  let negativos = 0;

  transactions.forEach((transaccion: any) => {
    const valor = parseFloat(
      typeof transaccion.valor === 'string' 
        ? transaccion.valor.replace(/[$,]/g, '') 
        : transaccion.valor || '0'
    );

    // Lógica específica para inversiones
    if (transaccion.esInversion) {
      if (transaccion.esPositiva) {
        positivos += valor;
      } else {
        negativos += valor;
      }
      return;
    }

    const esIngresoACuenta = transaccion.paraQuienTipo === 'rodmar' && 
                             transaccion.paraQuienId && 
                             transaccion.paraQuienId === cuentaId;

    const esEgresoDeEstaCuenta = transaccion.deQuienTipo === 'rodmar' && 
                                 transaccion.deQuienId && 
                                 transaccion.deQuienId === cuentaId;

    // Para transacciones temporales con origen en esta cuenta: siempre contar como negativo
    if (transaccion.esTemporal && transaccion.deQuienTipo === 'rodmar' && transaccion.deQuienId === cuentaId) {
      negativos += valor;
    } else if (esIngresoACuenta) {
      positivos += valor;
    } else if (esEgresoDeEstaCuenta) {
      negativos += valor;
    }
  });

  return {
    positivos,
    negativos,
    balance: positivos - negativos
  };
}

// Re-exportar funciones de formateo desde format-utils.ts para mantener compatibilidad hacia atrás
// TODO: Migrar gradualmente los imports a @/lib/format-utils
export {
  formatCurrency,
  formatNumber,
  parseNumericInput
} from './format-utils';
