const fs = require('fs');
let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');
c = c.replace(/\n\s*\/>\r?\n\s*\)\}\r?\n\s*<DynamicOcrDialog/, '\n            <DynamicOcrDialog');
fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed syntax error!');
