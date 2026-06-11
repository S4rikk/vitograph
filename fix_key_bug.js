const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// Replace all m.semanticMeaning || m.originalName with m.originalName || m.semanticMeaning
c = c.replace(/m\.semanticMeaning \|\| m\.originalName/g, 'm.originalName || m.semanticMeaning');
c = c.replace(/anyM\.semanticMeaning \|\| anyM\.originalName/g, 'anyM.originalName || anyM.semanticMeaning');

fs.writeFileSync(path, c);
console.log('Fixed name priority bug!');
