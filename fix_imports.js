const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/    BrainCircuit,/, `    BrainCircuit,
    Clock,`);

fs.writeFileSync(path, c);
console.log('Added Clock import!');
