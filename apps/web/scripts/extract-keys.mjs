import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('C:/project/VITOGRAPH/apps/web/src');
const ruJsonPath = path.resolve('C:/project/VITOGRAPH/apps/web/src/i18n/messages/ru.json');

const ruJson = JSON.parse(fs.readFileSync(ruJsonPath, 'utf8'));

// Regex to match: const tProfile = useTranslations('profile');
const hookRegex = /const\s+(\w+)\s*=\s*useTranslations\(['"]([^'"]+)['"]\)/g;
// Regex to match: tProfile('someKey') or t('some.key')
const tRegex = /(\w+)\(['"]([a-zA-Z0-9_.-]+)['"]\)/g;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Find all hook usages in this file to map translator variable to namespace
      const varToNs = { 't': 'common' }; // default
      let hookMatch;
      while ((hookMatch = hookRegex.exec(content)) !== null) {
        varToNs[hookMatch[1]] = hookMatch[2];
      }

      // Find all t(...) calls
      let tMatch;
      while ((tMatch = tRegex.exec(content)) !== null) {
        const funcName = tMatch[1];
        let key = tMatch[2];
        
        // Skip things that don't look like translation calls
        if (!funcName.startsWith('t')) continue;
        
        let ns = varToNs[funcName] || 'common';
        
        if (key.includes('.')) {
          const parts = key.split('.');
          ns = parts[0];
          key = parts.slice(1).join('.');
        }

        if (!ruJson[ns]) {
          ruJson[ns] = {};
        }

        if (ruJson[ns][key] === undefined) {
          console.log(`Found missing key: [${ns}] ${key}`);
          // Put the key itself as the default value to be translated
          ruJson[ns][key] = `[TODO: ${key}]`;
        }
      }
    }
  }
}

scanDir(srcDir);

fs.writeFileSync(ruJsonPath, JSON.stringify(ruJson, null, 2), 'utf8');
console.log('Done! Check ru.json');
