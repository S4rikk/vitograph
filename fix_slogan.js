const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'apps/web/src/i18n/messages');
const LOCALES = ['en', 'ru', 'de', 'fr', 'es', 'pt', 'zh', 'ja', 'ko', 'tr', 'ar'];

console.log("Forcing English slogan on all localized files...");

let fixedCount = 0;

for (const lang of LOCALES) {
  const targetPath = path.join(dir, lang + '.json');
  
  if (fs.existsSync(targetPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      
      if (data.common) {
        data.common.slogan = "Feed your cells, find balance";
        fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8');
        fixedCount++;
        console.log(`✅ Set English slogan for ${lang}.json`);
      }
    } catch (e) {
      console.error(`Failed to parse ${lang}.json: ${e.message}`);
    }
  }
}

console.log(`\nDone! Slogan enforced on ${fixedCount} files.`);
