# RodMar - Guía de Instalación para Usuarios

## Opción 1: Usar en Replit (Recomendado para principiantes)

### Paso 1: Hacer Fork del Proyecto
1. Ve al proyecto en Replit
2. Haz clic en "Fork" para crear tu propia copia
3. El proyecto se copiará a tu cuenta de Replit

### Paso 2: Configurar Base de Datos
1. En tu fork, ve a la pestaña "Secrets" (🔒)
2. Crea un nuevo secret llamado `DATABASE_URL`
3. Ve a [Neon](https://neon.tech) y crea una cuenta gratuita
4. Crea una nueva base de datos PostgreSQL
5. Copia la connection string y pégala en el secret `DATABASE_URL`

### Paso 3: Inicializar la Aplicación
1. Haz clic en "Run" en tu proyecto de Replit
2. La aplicación se iniciará automáticamente
3. Se crearán las tablas de base de datos automáticamente
4. ¡Ya puedes usar la aplicación!

### Paso 4: Deploy (Opcional)
1. Haz clic en "Deploy" en Replit
2. Sigue las instrucciones para hacer deploy público
3. Obtendrás una URL pública para acceder desde cualquier dispositivo

## Opción 2: Hosting Independiente

### Requisitos Técnicos
- Node.js 18 o superior
- Base de datos PostgreSQL
- Conocimientos básicos de terminal/línea de comandos

### Paso 1: Descargar el Código
```bash
git clone [URL_DEL_REPOSITORIO]
cd rodmar
```

### Paso 2: Instalar Dependencias
```bash
npm install
```

### Paso 3: Configurar Variables de Entorno
Crea un archivo `.env` con:
```
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/base_datos
PORT=5000
NODE_ENV=production
```

### Paso 4: Configurar Base de Datos
```bash
npm run db:push
```

### Paso 5: Compilar para Producción
```bash
npm run build
```

### Paso 6: Iniciar Aplicación
```bash
npm start
```

## Configuración Inicial de Datos

Una vez que la aplicación esté funcionando:

1. **Crear Minas**: Ve al módulo "Minas" y agrega las minas de tu operación
2. **Crear Compradores**: Ve al módulo "Compradores" y agrega tus clientes
3. **Crear Volqueteros**: Ve al módulo "Volqueteros" y agrega los transportistas
4. **Comenzar a Registrar Viajes**: Usa el módulo principal para registrar viajes

## Soporte y Personalización

### Cambios Básicos que Puedes Hacer:
- **Nombre de la empresa**: Editar en `index.html` el título
- **Colores**: Modificar `index.css` para cambiar la paleta de colores
- **Moneda**: Por defecto usa pesos colombianos (COP)

### Para Cambios Avanzados:
- Contacta al desarrollador original
- Considera contratar un desarrollador para personalizaciones específicas

## Datos de Ejemplo

La aplicación incluye datos de ejemplo para que puedas probar todas las funcionalidades:
- Minas de ejemplo
- Compradores de muestra
- Viajes de prueba
- Transacciones de ejemplo

Puedes eliminar estos datos una vez que empieces a usar la aplicación con tus datos reales.

## Backup y Seguridad

### Backup de Datos:
1. Exporta regularmente tus viajes a Excel desde el módulo principal
2. Considera hacer backup de tu base de datos periódicamente

### Seguridad:
- Cambia las credenciales por defecto
- Usa contraseñas seguras para tu base de datos
- Mantén actualizadas las dependencias

## Solución de Problemas Comunes

### La aplicación no inicia:
- Verifica que `DATABASE_URL` esté configurado correctamente
- Asegúrate de que la base de datos esté accesible

### Errores de conexión:
- Revisa los logs en la consola
- Verifica que el puerto 5000 esté disponible

### Problemas con Excel:
- Asegúrate de usar archivos .xlsx válidos
- Verifica que las columnas estén en el formato correcto

## Contacto

Para soporte técnico o personalizaciones, contacta al desarrollador original del proyecto.