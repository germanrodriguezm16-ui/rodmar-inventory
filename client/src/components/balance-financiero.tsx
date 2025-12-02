import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ViajeWithDetails } from '@shared/schema';

interface BalanceFinancieroProps {
  viajes: ViajeWithDetails[];
  className?: string;
}

export function BalanceFinanciero({ viajes, className = '' }: BalanceFinancieroProps) {
  // Calcular métricas usando useMemo para optimización
  const metricas = useMemo(() => {
    if (!viajes || viajes.length === 0) {
      return {
        totalViajes: 0,
        totalPeso: 0,
        totalVentas: 0,
        totalCompra: 0,
        totalFlete: 0,
        totalOGF: 0,
        gananciaNeta: 0,
        totalConsignar: 0,
        promedios: {
          pesoPorViaje: 0,
          compraPorTon: 0,
          ventaPorTon: 0,
          fletePorTon: 0,
          promedioOGF: 0,
          gananciaPorViaje: 0,
          gananciaPorTon: 0
        },
        metricas: {
          margenGanancia: 0,
          ratioFleteVenta: 0
        }
      };
    }

    // Filtrar solo viajes con fechaDescargue (completados)
    const viajesCompletados = viajes.filter(v => v.fechaDescargue);

    // Sumatorias
    const totalViajes = viajes.length;
    const totalPeso = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.peso?.toString() || '0') || 0), 0);
    const totalVentas = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.totalVenta?.toString() || '0') || 0), 0);
    const totalCompra = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.totalCompra?.toString() || '0') || 0), 0);
    const totalFlete = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.totalFlete?.toString() || '0') || 0), 0);
    const totalOGF = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.otrosGastosFlete?.toString() || '0') || 0), 0);
    const gananciaNeta = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.ganancia?.toString() || '0') || 0), 0);
    const totalConsignar = viajesCompletados.reduce((acc, v) => acc + (parseFloat(v.valorConsignar?.toString() || '0') || 0), 0);

    // Promedios (solo viajes completados con datos válidos)
    const viajesConPeso = viajesCompletados.filter(v => v.peso && parseFloat(v.peso.toString()) > 0);
    const viajesConPrecio = viajesCompletados.filter(v => v.precioCompraTon && parseFloat(v.precioCompraTon.toString()) > 0);
    const viajesConVenta = viajesCompletados.filter(v => v.ventaTon && parseFloat(v.ventaTon.toString()) > 0);
    const viajesConFlete = viajesCompletados.filter(v => v.fleteTon && parseFloat(v.fleteTon.toString()) > 0);
    const viajesConOGF = viajesCompletados.filter(v => v.otrosGastosFlete && parseFloat(v.otrosGastosFlete.toString()) > 0);

    const pesoPorViaje = viajesConPeso.length > 0 ? totalPeso / viajesConPeso.length : 0;
    const compraPorTon = viajesConPrecio.length > 0 
      ? viajesConPrecio.reduce((acc, v) => acc + (parseFloat(v.precioCompraTon?.toString() || '0') || 0), 0) / viajesConPrecio.length 
      : 0;
    const ventaPorTon = viajesConVenta.length > 0 
      ? viajesConVenta.reduce((acc, v) => acc + (parseFloat(v.ventaTon?.toString() || '0') || 0), 0) / viajesConVenta.length 
      : 0;
    const fletePorTon = viajesConFlete.length > 0 
      ? viajesConFlete.reduce((acc, v) => acc + (parseFloat(v.fleteTon?.toString() || '0') || 0), 0) / viajesConFlete.length 
      : 0;
    const promedioOGF = viajesConOGF.length > 0 
      ? viajesConOGF.reduce((acc, v) => acc + (parseFloat(v.otrosGastosFlete?.toString() || '0') || 0), 0) / viajesConOGF.length 
      : 0;
    const gananciaPorViaje = viajesCompletados.length > 0 ? gananciaNeta / viajesCompletados.length : 0;
    const gananciaPorTon = totalPeso > 0 ? gananciaNeta / totalPeso : 0;

    // Métricas inteligentes
    const margenGanancia = totalVentas > 0 ? (gananciaNeta / totalVentas) * 100 : 0;
    const ratioFleteVenta = totalVentas > 0 ? (totalFlete / totalVentas) * 100 : 0;

    return {
      totalViajes,
      totalPeso,
      totalVentas,
      totalCompra,
      totalFlete,
      totalOGF,
      gananciaNeta,
      totalConsignar,
      promedios: {
        pesoPorViaje,
        compraPorTon,
        ventaPorTon,
        fletePorTon,
        promedioOGF,
        gananciaPorViaje,
        gananciaPorTon
      },
      metricas: {
        margenGanancia,
        ratioFleteVenta
      }
    };
  }, [viajes]);

  // Función para formatear números como peso colombiano
  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Función para formatear números decimales
  const formatDecimal = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  // Función para formatear porcentajes
  const formatPercentage = (value: number) => {
    return `${formatDecimal(value, 1)}%`;
  };

  // No mostrar si no hay viajes
  if (metricas.totalViajes === 0) {
    return null;
  }

  return (
    <Card className={`p-4 mt-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 border-blue-200 dark:border-blue-800 ${className}`}>
      <div className="space-y-4">
        <div className="text-center border-b border-blue-200 dark:border-blue-700 pb-2">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            📊 Balance Financiero
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {metricas.totalViajes} viajes filtrados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sumatorias */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">💰 Totales</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Peso Total:</span>
                <span className="font-medium">{formatDecimal(metricas.totalPeso)} ton</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Ventas:</span>
                <span className="font-medium text-green-600 dark:text-green-400">{formatCOP(metricas.totalVentas)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Compra:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{formatCOP(metricas.totalCompra)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Flete:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">{formatCOP(metricas.totalFlete)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">OGF:</span>
                <span className="font-medium text-purple-600 dark:text-purple-400">{formatCOP(metricas.totalOGF)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-800 dark:text-gray-200 font-medium">Ganancia:</span>
                <span className={`font-bold ${metricas.gananciaNeta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCOP(metricas.gananciaNeta)}
                </span>
              </div>
            </div>
          </div>

          {/* Promedios */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📈 Promedios</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Por Viaje:</span>
                <span className="font-medium">{formatDecimal(metricas.promedios.pesoPorViaje)} ton</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Venta/Ton:</span>
                <span className="font-medium text-green-600 dark:text-green-400">{formatCOP(metricas.promedios.ventaPorTon)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Compra/Ton:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{formatCOP(metricas.promedios.compraPorTon)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Flete/Ton:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">{formatCOP(metricas.promedios.fletePorTon)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">OGF Promedio:</span>
                <span className="font-medium text-purple-600 dark:text-purple-400">{formatCOP(metricas.promedios.promedioOGF)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-800 dark:text-gray-200 font-medium">Ganancia/Viaje:</span>
                <span className={`font-bold ${metricas.promedios.gananciaPorViaje >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCOP(metricas.promedios.gananciaPorViaje)}
                </span>
              </div>
            </div>
          </div>

          {/* Métricas Inteligentes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">🎯 Métricas</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Margen Ganancia:</span>
                <span className={`font-medium ${metricas.metricas.margenGanancia >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercentage(metricas.metricas.margenGanancia)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Ratio Flete/Venta:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">{formatPercentage(metricas.metricas.ratioFleteVenta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Ganancia/Ton:</span>
                <span className={`font-medium ${metricas.promedios.gananciaPorTon >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCOP(metricas.promedios.gananciaPorTon)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-800 dark:text-gray-200 font-medium">A Consignar:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{formatCOP(metricas.totalConsignar)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}