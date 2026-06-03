const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

c = 'import DynamicOcrDialog from "./DynamicOcrDialog";\n' + c;

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Added import!');
