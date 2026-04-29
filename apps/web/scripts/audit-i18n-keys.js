const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'src', 'i18n', 'messages');
const srcDir = path.join(__dirname, '..', 'src');

// Load ru.json as reference
const ru = JSON.parse(fs.readFileSync(path.join(messagesDir, 'ru.json'), 'utf8'));

function hasKey(obj, dotKey) {
  const parts = dotKey.split('.');
  let c = obj;
  for (const p of parts) {
    if (!c || typeof c !== 'object' || !(p in c)) return false;
    c = c[p];
  }
  return true;
}

const missing = new Set();

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find all useTranslations("namespace") calls
  const nsRegex = /useTranslations\(["'](\w+)["']\)/g;
  const namespaces = [];
  let m;
  while ((m = nsRegex.exec(content)) !== null) {
    namespaces.push(m[1]);
  }
  if (namespaces.length === 0) return;

  // Find all t("key"), tProfile("key"), tLifestyle("key.subkey") etc.
  const keyRegex = /\bt\w*\(["']([a-zA-Z0-9_.]+)["']\)/g;
  while ((m = keyRegex.exec(content)) !== null) {
    const key = m[1];
    // Check if any namespace has this key
    let found = false;
    for (const ns of namespaces) {
      if (hasKey(ru, ns + '.' + key) || hasKey(ru[ns], key)) {
        found = true;
        break;
      }
    }
    if (!found) {
      // Try each namespace separately
      for (const ns of namespaces) {
        const fullKey = ns + '.' + key;
        missing.add(fullKey + ' ← ' + path.relative(srcDir, filePath));
      }
    }
  }
}

function scanDir(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'node_modules' || item.name === '.next') continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      scanDir(full);
    } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
      scanFile(full);
    }
  }
}

scanDir(srcDir);

if (missing.size === 0) {
  console.log('✅ No missing translation keys found!');
} else {
  console.log(`⚠ Found ${missing.size} potentially missing keys:\n`);
  [...missing].sort().forEach(k => console.log('  ' + k));
}
