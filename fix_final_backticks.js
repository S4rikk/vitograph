const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/\\\`/g, '`');
c = c.replace(/\\\$/g, '$');

fs.writeFileSync(path, c);
console.log('Fixed backticks in the final file!');
