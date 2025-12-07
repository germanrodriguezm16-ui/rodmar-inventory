import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceIcon = join(__dirname, 'client', 'public', 'icon-source-improved.svg');
const publicPath = join(__dirname, 'client', 'public');

// Tamaños para PWA/web
const webSizes = [
  { size: 72, name: 'rodmar-icon-72.png' },
  { size: 96, name: 'rodmar-icon-96.png' },
  { size: 128, name: 'rodmar-icon-128.png' },
  { size: 144, name: 'rodmar-android-chrome-144.png' },
  { size: 152, name: 'rodmar-apple-touch-152.png' },
  { size: 180, name: 'rodmar-apple-touch-180.png' },
  { size: 192, name: 'rodmar-icon-192.png' },
  { size: 256, name: 'rodmar-icon-256.png' },
  { size: 384, name: 'rodmar-icon-384.png' },
  { size: 512, name: 'rodmar-icon-512.png' },
];

// Tamaños circulares (maskable)
const circularSizes = [
  { size: 192, name: 'rodmar-circular-192.png' },
  { size: 256, name: 'rodmar-circular-256.png' },
  { size: 512, name: 'rodmar-circular-512.png' },
];

async function generateWebIcons() {
  console.log('🌐 Generando íconos para web/PWA...\n');

  const svgBuffer = readFileSync(sourceIcon);

  // Generar íconos estándar
  console.log('📦 Generando íconos estándar...');
  for (const { size, name } of webSizes) {
    const outputPath = join(publicPath, name);
    
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`   ✅ ${name} (${size}x${size})`);
  }

  // Generar íconos circulares (maskable)
  console.log('\n📦 Generando íconos circulares (maskable)...');
  for (const { size, name } of circularSizes) {
    const outputPath = join(publicPath, name);
    
    // Crear un círculo con el ícono dentro
    const roundedCorners = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      </svg>`
    );

    // Primero redimensionar el ícono
    const resizedIcon = await sharp(svgBuffer)
      .resize(size - 20, size - 20, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    // Luego aplicar la máscara circular
    await sharp(resizedIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(outputPath);

    console.log(`   ✅ ${name} (${size}x${size})`);
  }

  console.log('\n✨ ¡Todos los íconos web han sido generados exitosamente!');
}

generateWebIcons().catch(console.error);

