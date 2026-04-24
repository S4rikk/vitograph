// Render SVG to PNG using Playwright (headless Chrome)
// This gives pixel-perfect SVG rendering identical to browser

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const sharp = require(require.resolve('sharp', { paths: ['C:/project/VITOGRAPH/apps/web/node_modules'] }));

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <g id="fish-outline">
      <path d="M 15 0 Q 80 -50 160 25 M 15 0 Q 80 50 160 -25" 
            fill="none" stroke="url(#grad1)" stroke-width="8" stroke-linecap="round"/>
    </g>
  </defs>
  <g transform="rotate(-90)">
    <g><use href="#fish-outline"/><line x1="40" y1="-18.77" x2="40" y2="18.77" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="56" y1="-23.69" x2="56" y2="23.69" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="72" y1="-25.76" x2="72" y2="25.76" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="88" y1="-23.78" x2="88" y2="23.78" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="104" y1="-18.73" x2="104" y2="18.73" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="120" y1="-12.75" x2="120" y2="12.75" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/></g>
    <g transform="rotate(120)"><use href="#fish-outline"/><line x1="40" y1="-18.79" x2="40" y2="18.79" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="56" y1="-23.86" x2="56" y2="23.86" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="72" y1="-25.50" x2="72" y2="25.50" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="88" y1="-23.53" x2="88" y2="23.53" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="104" y1="-18.51" x2="104" y2="18.51" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="120" y1="-12.53" x2="120" y2="12.53" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/></g>
    <g transform="rotate(240)"><use href="#fish-outline"/><line x1="40" y1="-18.48" x2="40" y2="18.48" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="56" y1="-23.54" x2="56" y2="23.54" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="72" y1="-25.52" x2="72" y2="25.52" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="88" y1="-23.54" x2="88" y2="23.54" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><line x1="104" y1="-18.54" x2="104" y2="18.54" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><line x1="120" y1="-12.52" x2="120" y2="12.52" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/></g>
    <circle cx="0" cy="0" r="8" fill="#0ea5e9" />
  </g>
</svg>`;

// Splash configs: full-screen images with logo centered
const splashConfigs = {
  'drawable':               { w: 480, h: 480 },
  'drawable-port-mdpi':     { w: 320, h: 480 },
  'drawable-port-hdpi':     { w: 480, h: 800 },
  'drawable-port-xhdpi':    { w: 720, h: 1280 },
  'drawable-port-xxhdpi':   { w: 1080, h: 1920 },
  'drawable-port-xxxhdpi':  { w: 1440, h: 2560 },
  'drawable-land-mdpi':     { w: 480, h: 320 },
  'drawable-land-hdpi':     { w: 800, h: 480 },
  'drawable-land-xhdpi':    { w: 1280, h: 720 },
  'drawable-land-xxhdpi':   { w: 1920, h: 1080 },
  'drawable-land-xxxhdpi':  { w: 2560, h: 1440 },
};

async function main() {
  console.log('🚀 Launching headless Chrome...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

  // Render SVG at 1024x1024 via browser (perfect quality)
  const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:1024px;height:1024px">${LOGO_SVG.replace('viewBox="-200 -200 400 400"', 'viewBox="-200 -200 400 400" width="900" height="900"')}</body></html>`;
  
  await page.setContent(html, { waitUntil: 'networkidle' });

  // Screenshot just the SVG with transparent background
  const logoPath = path.join(__dirname, 'logo-1024.png');
  await page.screenshot({ path: logoPath, omitBackground: true });
  console.log('✅ Base logo: logo-1024.png (1024x1024)');

  await browser.close();

  // Now use sharp to composite logo onto splash screens
  const logoPng = fs.readFileSync(logoPath);

  for (const [dir, size] of Object.entries(splashConfigs)) {
    const outDir = path.join(resDir, dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Logo = 75% of shortest side (BIG and prominent)
    const logoSize = Math.round(Math.min(size.w, size.h) * 0.75);
    const left = Math.round((size.w - logoSize) / 2);
    const top = Math.round((size.h - logoSize) / 2);

    const resizedLogo = await sharp(logoPng)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: { width: size.w, height: size.h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
    })
      .composite([{ input: resizedLogo, left, top }])
      .png()
      .toFile(path.join(outDir, 'splash.png'));

    console.log(`✅ ${dir}: ${size.w}x${size.h} (logo ${logoSize}px)`);
  }

  console.log('\n🎉 All splash screens regenerated with big logo!');
}

main().catch(err => { console.error(err); process.exit(1); });
