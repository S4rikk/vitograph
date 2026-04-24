// Generate Android adaptive icon PNGs from SVG
// Uses sharp from the web package

const sharp = require(require.resolve('sharp', { paths: ['C:/project/VITOGRAPH/apps/web/node_modules'] }));
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'icon-source.svg');
const svgBuffer = fs.readFileSync(svgPath);

// Android adaptive icon sizes (foreground layer)
// Foreground must be 108dp (with 72dp visible, 18dp padding on each side)
const iconSizes = {
  'mdpi': 108,
  'hdpi': 162,
  'xhdpi': 216,
  'xxhdpi': 324,
  'xxxhdpi': 432,
};

// Also generate a full icon (for legacy/round)
const legacyIconSizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192,
};

// Splash screen
const splashSize = 480;

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  // 1. Generate foreground icons (with padding for adaptive icon safe zone)
  for (const [density, size] of Object.entries(iconSizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Foreground: icon centered with padding
    const iconSize = Math.round(size * 0.667); // 72/108 ratio = visible area
    const padding = Math.round((size - iconSize) / 2);

    const iconBuffer = await sharp(svgBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Composite onto transparent canvas with padding
    const foreground = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: iconBuffer, left: padding, top: padding }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`✅ Foreground ${density}: ${size}x${size}px`);
  }

  // 2. Generate legacy launcher icons (with white background, rounded)
  for (const [density, size] of Object.entries(legacyIconSizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const iconPadding = Math.round(size * 0.15);
    const iconInner = size - iconPadding * 2;

    const innerIcon = await sharp(svgBuffer)
      .resize(iconInner, iconInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Square icon with white background
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 }
      }
    })
      .composite([{ input: innerIcon, left: iconPadding, top: iconPadding }])
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Round icon (same as square — Android will apply mask)
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 }
      }
    })
      .composite([{ input: innerIcon, left: iconPadding, top: iconPadding }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`✅ Legacy ${density}: ${size}x${size}px`);
  }

  // 3. Generate splash screen drawable
  const drawableDir = path.join(resDir, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  await sharp(svgBuffer)
    .resize(splashSize, splashSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 255 } })
    .png()
    .toFile(path.join(drawableDir, 'splash.png'));

  console.log(`✅ Splash screen: ${splashSize}x${splashSize}px`);

  // 4. Create/update adaptive icon XML
  const mipmapAnydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  if (!fs.existsSync(mipmapAnydpiDir)) fs.mkdirSync(mipmapAnydpiDir, { recursive: true });

  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  fs.writeFileSync(path.join(mipmapAnydpiDir, 'ic_launcher.xml'), adaptiveIconXml);
  fs.writeFileSync(path.join(mipmapAnydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml);

  // 5. Update background color to white
  const valuesDir = path.join(resDir, 'values');
  const bgColorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), bgColorXml);

  console.log(`\n🎉 All icons generated successfully!`);
}

generateIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
