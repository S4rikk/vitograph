// Overwrite ALL splash.png files in every density-specific drawable directory
const sharp = require(require.resolve('sharp', { paths: ['C:/project/VITOGRAPH/apps/web/node_modules'] }));
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'icon-source.svg');
const svgBuffer = fs.readFileSync(svgPath);
const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Density-specific splash sizes for portrait and landscape
const splashConfigs = {
  'drawable-port-mdpi':    { w: 320, h: 480 },
  'drawable-port-hdpi':    { w: 480, h: 800 },
  'drawable-port-xhdpi':   { w: 720, h: 1280 },
  'drawable-port-xxhdpi':  { w: 1080, h: 1920 },
  'drawable-port-xxxhdpi': { w: 1440, h: 2560 },
  'drawable-land-mdpi':    { w: 480, h: 320 },
  'drawable-land-hdpi':    { w: 800, h: 480 },
  'drawable-land-xhdpi':   { w: 1280, h: 720 },
  'drawable-land-xxhdpi':  { w: 1920, h: 1080 },
  'drawable-land-xxxhdpi': { w: 2560, h: 1440 },
};

async function generateSplash() {
  for (const [dir, size] of Object.entries(splashConfigs)) {
    const outDir = path.join(resDir, dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Logo size = 30% of shortest dimension
    const logoSize = Math.round(Math.min(size.w, size.h) * 0.35);

    // Render SVG to PNG at logo size
    const logoPng = await sharp(svgBuffer)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Center logo on white background
    const left = Math.round((size.w - logoSize) / 2);
    const top = Math.round((size.h - logoSize) / 2);

    await sharp({
      create: {
        width: size.w,
        height: size.h,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 }
      }
    })
      .composite([{ input: logoPng, left, top }])
      .png()
      .toFile(path.join(outDir, 'splash.png'));

    console.log(`✅ ${dir}: ${size.w}x${size.h} (logo ${logoSize}px)`);
  }

  // Also update the base drawable/splash.png
  const baseLogoSize = 240;
  const baseLogo = await sharp(svgBuffer)
    .resize(baseLogoSize, baseLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 480, height: 480, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
  })
    .composite([{ input: baseLogo, left: 120, top: 120 }])
    .png()
    .toFile(path.join(resDir, 'drawable', 'splash.png'));

  console.log('✅ drawable/splash.png: 480x480');
  console.log('\n🎉 All splash screens generated!');
}

generateSplash().catch(err => { console.error(err); process.exit(1); });
