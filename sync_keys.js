const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'apps/web/src/i18n/messages');
const LOCALES = ['en', 'de', 'fr', 'es', 'pt', 'zh', 'ja', 'ko', 'tr', 'ar'];

const ruPath = path.join(dir, 'ru.json');
const ruJson = JSON.parse(fs.readFileSync(ruPath, 'utf8'));

// Recursive function to sync keys
function syncKeys(ruNode, targetNode) {
  if (typeof ruNode !== 'object' || ruNode === null) {
    return targetNode !== undefined ? targetNode : "TODO";
  }

  const result = {};
  for (const key of Object.keys(ruNode)) {
    // If targetNode doesn't exist or is not an object, pass undefined
    const targetValue = (targetNode && typeof targetNode === 'object') ? targetNode[key] : undefined;
    result[key] = syncKeys(ruNode[key], targetValue);
  }
  return result;
}

console.log("Synchronizing all language files to match ru.json structure...");

for (const lang of LOCALES) {
  const targetPath = path.join(dir, lang + '.json');
  let targetJson = {};
  
  if (fs.existsSync(targetPath)) {
    targetJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  }

  const syncedJson = syncKeys(ruJson, targetJson);
  
  fs.writeFileSync(targetPath, JSON.stringify(syncedJson, null, 2), 'utf8');
  console.log(`✅ Synced ${lang}.json`);
}

console.log("\nDone! All files now perfectly match ru.json structure. Any missing strings are set to 'TODO'.");
