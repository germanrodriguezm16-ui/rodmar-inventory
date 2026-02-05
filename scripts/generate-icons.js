import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '../client/public/RMICONO.png');
const outputDir = path.join(__dirname, '../client/public');

// Tamaños necesarios según manifest.json e index.html
const sizes = [
  { size: 72, name: 'rodmar-icon-72.png' },
  { size: 96, name: 'rodmar-icon-96.png' },
  { size: 128, name: 'rodmar-icon-128.png' },
  { size: 144, name: 'rodmar-android-chrome-144.png' },
  { size: 152, name: 'rodmar-apple-touch-152.png' },
  { size: 180, name: 'rodmar-apple-touch-180.png' },
  { size: 192, name: 'rodmar-circular-192.png' },
  { size: 256, name: 'rodmar-circular-256.png' },
  { size: 384, name: 'rodmar-icon-384.png' },
  { size: 512, name: 'rodmar-circular-512.png' },
];

async function generateIcons() {
  try {
    // Verificar que el archivo fuente existe
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ Error: No se encontró el archivo ${inputFile}`);
      process.exit(1);
    }

    console.log('🔄 Generando íconos desde RMICONO.png...\n');

    // Generar cada tamaño
    for (const { size, name } of sizes) {
      const outputPath = path.join(outputDir, name);
      await sharp(inputFile)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generado: ${name} (${size}x${size})`);
    }

    console.log('\n✨ ¡Todos los íconos han sido generados exitosamente!');
  } catch (error) {
    console.error('❌ Error generando íconos:', error);
    process.exit(1);
  }
}

generateIcons();
