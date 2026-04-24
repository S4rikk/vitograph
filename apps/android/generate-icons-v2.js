// Regenerate ALL icons using Playwright (pixel-perfect Chrome rendering)
const { chromium } = require('playwright');
const sharp = require(require.resolve('sharp', { paths: ['C:/project/VITOGRAPH/apps/web/node_modules'] }));
const fs = require('fs');
const path = require('path');

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

// Adaptive icon foreground sizes (108dp per density)
const foregroundSizes = {
  'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432,
};

// Legacy icon sizes
const legacySizes = {
  'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192,
};

async function main() {
  console.log('🚀 Launching headless Chrome...');
  const browser = await chromium.launch({ headless: true });
  
  // Render base logo at 1024x1024
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent;width:1024px;height:1024px;display:flex;align-items:center;justify-content:center">${LOGO_SVG.replace('viewBox="-200 -200 400 400"', 'viewBox="-200 -200 400 400" width="900" height="900"')}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  const logoBuffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync(path.join(__dirname, 'logo-1024.png'), logoBuffer);
  console.log('✅ Base logo rendered via Chrome: 1024x1024');
  
  await browser.close();

  // Generate foreground icons
  for (const [density, size] of Object.entries(foregroundSizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const iconSize = Math.round(size * 0.667); // visible area (72/108)
    const padding = Math.round((size - iconSize) / 2);

    const iconPng = await sharp(logoBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();

    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: iconPng, left: padding, top: padding }])
      .png().toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`✅ Foreground ${density}: ${size}x${size}`);
  }

  // Generate legacy icons
  for (const [density, size] of Object.entries(legacySizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    const pad = Math.round(size * 0.12);
    const inner = size - pad * 2;

    const innerPng = await sharp(logoBuffer)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();

    const makeIcon = async (file) => {
      await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } } })
        .composite([{ input: innerPng, left: pad, top: pad }])
        .png().toFile(path.join(dir, file));
    };

    await makeIcon('ic_launcher.png');
    await makeIcon('ic_launcher_round.png');
    console.log(`✅ Legacy ${density}: ${size}x${size}`);
  }

  console.log('\n🎉 All icons regenerated with Playwright quality!');
}

main().catch(err => { console.error(err); process.exit(1); });
