const fs = require('fs');
const path = 'apps/web/src/components/profile/UserProfileSheet.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/<div>(\s*<label)/g, '<div className="flex flex-col h-full">$1');
content = content.replace(/className="w-full /g, 'className="mt-auto w-full ');
fs.writeFileSync(path, content);
console.log('Done');
