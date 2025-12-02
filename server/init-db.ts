import { db } from './db';
import { minas, compradores, volqueteros, viajes, transacciones } from '../shared/schema';

export async function initializeDatabase() {
  console.log('=== INICIALIZANDO BASE DE DATOS POSTGRESQL ===');
  
  try {
    // Verificar si ya hay datos
    const existingMinas = await db.select().from(minas);
    
    if (existingMinas.length > 0) {
      console.log('=== Base de datos ya tiene datos, omitiendo inicialización ===');
      return;
    }

    // Crear datos iniciales
    console.log('=== Creando minas iniciales ===');
    const mina1 = await db.insert(minas).values({
      nombre: 'Mina El Dorado',
      saldo: '315000',
      createdAt: new Date()
    }).returning();

    const mina2 = await db.insert(minas).values({
      nombre: 'Mina La Esperanza',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando compradores iniciales ===');
    const comprador1 = await db.insert(compradores).values({
      nombre: 'Cemex S.A.',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    const comprador2 = await db.insert(compradores).values({
      nombre: 'Argos Colombia',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando volqueteros iniciales ===');
    const volquetero1 = await db.insert(volqueteros).values({
      nombre: 'Uver',
      placa: 'SRS148',
      saldo: '0',
      createdAt: new Date()
    }).returning();

    console.log('=== Creando viaje inicial TRP001 ===');
    const viajeInicial = await db.insert(viajes).values({
      id: 'TRP001',
      fechaCargue: new Date('2025-06-25T05:00:00Z'),
      fechaDescargue: new Date('2025-06-25T10:00:00Z'),
      conductor: 'Uver',
      tipoCarro: 'Sencillo',
      placa: 'SRS148',
      minaId: mina1[0].id,
      compradorId: comprador1[0].id,
      peso: '21',
      precioCompraTon: '100000',
      ventaTon: '150000',
      fleteTon: '40000',
      otrosGastosFlete: '0',
      vut: '3150000',
      cut: '2100000',
      fut: '840000',
      totalVenta: '3150000',
      totalCompra: '2100000',
      totalFlete: '840000',
      valorConsignar: '2310000',
      ganancia: '210000',
      estado: 'completado',
      quienPagaFlete: 'Tú',
      voucher: null,
      recibo: null,
      comentario: null,
      createdAt: new Date()
    }).returning();

    console.log('=== Creando transacción inicial para el viaje ===');
    await db.insert(transacciones).values({
      tipoSocio: 'comprador',
      socioId: comprador1[0].id,
      concepto: 'Viaje TRP001',
      valor: '-2310000',
      fecha: new Date('2025-06-25T10:00:00Z'),
      formaPago: 'Efectivo',
      voucher: null,
      comentario: 'Valor a consignar del viaje TRP001',
      createdAt: new Date()
    });

    console.log('=== BASE DE DATOS INICIALIZADA EXITOSAMENTE ===');
    console.log(`- Minas creadas: ${mina1.length + mina2.length}`);
    console.log(`- Compradores creados: ${comprador1.length + comprador2.length}`);
    console.log(`- Volqueteros creados: ${volquetero1.length}`);
    console.log(`- Viajes creados: ${viajeInicial.length}`);
    console.log('- Transacciones creadas: 1');
    
  } catch (error) {
    console.error('=== ERROR INICIALIZANDO BASE DE DATOS ===', error);
    throw error;
  }
}