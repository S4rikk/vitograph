// Generate a single high-res logo PNG for splash windowBackground
const { chromium } = require('playwright');
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
  
  const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent;width:720px;height:720px;display:flex;align-items:center;justify-content:center">${LOGO_SVG.replace('viewBox="-200 -200 400 400"', 'viewBox="-200 -200 400 400" width="650" height="650"')}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  
  const logoBuffer = await page.screenshot({ omitBackground: true });
  
  // Save to drawable-nodpi (no density scaling — pixel-perfect)
  const nodpiDir = path.join(resDir, 'drawable-nodpi');
  if (!fs.existsSync(nodpiDir)) fs.mkdirSync(nodpiDir, { recursive: true });
  fs.writeFileSync(path.join(nodpiDir, 'splash_logo.png'), logoBuffer);
  
  console.log(`✅ splash_logo.png: ${logoBuffer.length} bytes → drawable-nodpi/`);
  
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
