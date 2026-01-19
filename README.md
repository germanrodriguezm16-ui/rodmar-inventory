# RodMar Inventory - Sistema de Gestión Minera

Sistema completo de gestión de operaciones mineras y logística de transporte.

## 🚀 Instalación

### Requisitos Previos

- Node.js 18+ 
- PostgreSQL (local o remoto)
- npm o yarn

### Configuración

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd RodMarInventory
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   DATABASE_URL=postgresql://usuario:password@localhost:5432/rodmar_db
   SESSION_SECRET=tu-secret-key-segura-aqui
   PORT=5000
   NODE_ENV=development
   # UI en el backend (dev). Por defecto está apagada para evitar confusión con 5173.
   DEV_SERVER_UI=off
   # Opcional: control del sync masivo de permisos al iniciar (puede ser lento con muchas entidades)
   # En desarrollo (local) el default es OFF para arranque rápido y silencioso.
   # PERMISSIONS_SYNC_ON_BOOT=background | off | blocking
   PERMISSIONS_SYNC_ON_BOOT=off
   # Migraciones históricas (desactivadas por defecto)
   # MIGRATIONS_ON_BOOT=off | background | blocking
   MIGRATIONS_ON_BOOT=off
   # Opcional: logs detallados del sync (por defecto es resumen)
   PERMISSIONS_SYNC_VERBOSE=0
   ```

4. **Configurar base de datos**
   ```bash
   # Crear la base de datos en PostgreSQL
   createdb rodmar_db
   
   # Ejecutar migraciones
   npm run db:push
   ```

5. **Iniciar el servidor**
   ```bash
   # Modo desarrollo
   npm run dev
   
   # Modo producción
   npm run build
   npm start
   ```

### Frontend (dev)

En desarrollo, el frontend corre en **`http://localhost:5173/`** (puerto fijo para evitar confusiones).
Nota: `http://localhost:5000` es solo API en local; la UI oficial de dev es `5173`.

### Nota sobre permisos (dev local)

Si tienes muchas entidades, el “sync” masivo de permisos puede tardar. En desarrollo el default es **rápido y silencioso** (no corre en boot).
Ver `ENV_EXAMPLE.md` y `CAMBIOS_RECIENTES_2026-01-18_PERMISOS_Y_UI.md`.

## 📱 Funcionalidades

- ✅ **Gestión de Viajes**: Registro de cargue y descargue con cálculos automáticos
- ✅ **Gestión de Minas**: Control de ubicaciones de extracción con balances
- ✅ **Gestión de Compradores**: Administración de clientes y saldos
- ✅ **Gestión de Volqueteros**: Control de transportistas y vehículos
- ✅ **Transacciones Financieras**: Sistema bidireccional de movimientos
- ✅ **Módulo RodMar**: Panel de administración con cuentas internas
- ✅ **Inversiones**: Sistema de inversiones entre cuentas
- ✅ **Fusión de Entidades**: Unificación de minas, compradores o volqueteros
- ✅ **Importación/Exportación Excel**: Manejo de datos masivos
- ✅ **Reportes y Análisis**: Visualización de datos financieros

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Base de Datos**: PostgreSQL + Drizzle ORM
- **UI Components**: Radix UI
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Charts**: Chart.js / Recharts

## 📁 Estructura del Proyecto

```
RodMarInventory/
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Componentes organizados por módulo
│   │   ├── pages/       # Páginas principales
│   │   ├── hooks/       # Custom hooks
│   │   ├── lib/         # Utilidades y configuraciones
│   │   └── App.tsx
│   └── public/
├── server/              # Backend Express
│   ├── middleware/      # Middlewares (auth, session)
│   ├── routes.ts        # Rutas API
│   ├── storage.ts       # Interface de almacenamiento
│   ├── db-storage.ts    # Implementación PostgreSQL
│   └── index.ts         # Punto de entrada
├── shared/              # Código compartido
│   └── schema.ts        # Esquemas de DB y validación
└── package.json
```

## 🔐 Autenticación

El sistema incluye autenticación simple por defecto. En desarrollo, se usa un usuario principal automático. Para producción, configura `REQUIRE_AUTH=true` en las variables de entorno.

## 📊 Base de Datos

El sistema usa PostgreSQL con Drizzle ORM. Las migraciones se manejan con `drizzle-kit`.

### Comandos de Base de Datos

```bash
# Generar migraciones desde el schema
npm run db:generate

# Aplicar migraciones a la base de datos
npm run db:push

# Abrir Drizzle Studio (interfaz visual)
npm run db:studio
```

## 🚢 Deploy

### Opciones de Deploy

1. **Vercel / Netlify**: Para frontend estático
2. **Railway / Render**: Para full-stack
3. **VPS**: Con PM2 o similar
4. **Docker**: (próximamente)

### Variables de Entorno en Producción

Asegúrate de configurar:
- `DATABASE_URL`: URL de conexión a PostgreSQL
- `SESSION_SECRET`: Clave secreta para sesiones
- `NODE_ENV=production`
- `PORT`: Puerto del servidor (opcional)

## 📝 Scripts Disponibles

- `npm run dev`: Backend en modo desarrollo con reinicio automático (watch). Por defecto no sirve UI.
- `npm run migrations:run`: Ejecuta migraciones históricas bajo demanda
- `npm run build`: Construye la aplicación para producción
- `npm start`: Inicia servidor en modo producción
- `npm run check`: Verifica tipos TypeScript
- `npm run db:push`: Aplica migraciones a la base de datos
- `npm run db:generate`: Genera migraciones desde el schema
- `npm run db:studio`: Abre Drizzle Studio

## 🐛 Solución de Problemas

### Error de conexión a base de datos
- Verifica que PostgreSQL esté corriendo
- Confirma que `DATABASE_URL` sea correcta
- Asegúrate de que la base de datos exista

### Error de autenticación
- En desarrollo, el sistema usa autenticación automática
- Verifica que las sesiones estén configuradas correctamente

### Problemas con migraciones
- Ejecuta `npm run db:push` para aplicar cambios
- Si hay conflictos, revisa el schema en `shared/schema.ts`

## 📞 Soporte

Para más información, consulta la documentación en el código o crea un issue en el repositorio.

## 📄 Licencia

MIT

---

**Desarrollado para operaciones mineras** 🇨🇴
