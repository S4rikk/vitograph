const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// Fix 1: Remove DeviceWidgetCard import
const importPattern = /import\s+\{.*DeviceWidgetCard.*\}\s+from\s+['"].\/DeviceWidgetCard['"];?\r?\n?/g;
c = c.replace(importPattern, '');

// Fix 2: Remove confidence property assignment in setOcrResult or handle WearableSave
const confidencePattern = /,\s*confidence:\s*[^}]+/g;
// Wait, I don't know the exact string for the second error. Let's just use string replace.
// Let's print line 1524 first.
fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed import. Let us check line 1524.');
