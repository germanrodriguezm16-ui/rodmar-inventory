import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Intentar usar JPG primero, luego SVG
const sourceIconJpg = join(__dirname, 'client', 'public', 'icon-source.jpg');
const sourceIconSvg = join(__dirname, 'client', 'public', 'icon-source.svg');
const foregroundIcon = join(__dirname, 'client', 'public', 'icon-foreground.svg');
const androidResPath = join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Determinar qué archivo usar
let sourceIcon = sourceIconSvg;
if (existsSync(sourceIconJpg)) {
  sourceIcon = sourceIconJpg;
  console.log('📷 Usando archivo JPG como fuente');
} else if (existsSync(sourceIconSvg)) {
  sourceIcon = sourceIconSvg;
  console.log('🎨 Usando archivo SVG como fuente');
} else {
  throw new Error('No se encontró icon-source.jpg ni icon-source.svg');
}

// Tamaños para Android mipmap
const androidSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
  console.log('🎨 Generando íconos para Android...\n');

  // Leer el archivo fuente (JPG, PNG o SVG)
  const sourceBuffer = readFileSync(sourceIcon);
  
  // Generar íconos para cada resolución
  for (const [folder, size] of Object.entries(androidSizes)) {
    const folderPath = join(androidResPath, folder);
    
    // Crear carpeta si no existe
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    console.log(`📦 Generando ${folder} (${size}x${size})...`);

    // Generar ic_launcher.png (ícono completo)
    // Usar 'contain' para que no se recorte y quede centrado
    await sharp(sourceBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fondo transparente
      })
      .png()
      .toFile(join(folderPath, 'ic_launcher.png'));

    // Generar ic_launcher_round.png (ícono redondo)
    await sharp(sourceBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fondo transparente
      })
      .png()
      .toFile(join(folderPath, 'ic_launcher_round.png'));

    // Generar ic_launcher_foreground.png (para Adaptive Icons)
    // Usar 'contain' para que el ícono quede centrado en la zona segura
    // El fondo se maneja por separado en el XML
    await sharp(sourceBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fondo transparente
      })
      .png()
      .toFile(join(folderPath, 'ic_launcher_foreground.png'));

    console.log(`   ✅ Generado: ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png\n`);
  }

  console.log('✨ ¡Todos los íconos han sido generados exitosamente!');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Ejecuta: npm run cap:sync');
  console.log('   2. Abre Android Studio y regenera el APK');
}

generateIcons().catch(console.error);


