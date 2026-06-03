const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const strStart = '{activeManualEntry && dialogConfig[activeManualEntry] && (';
const strEnd = '</ManualEntryDialog>\\r\\n            )}'; // or without regex

let idx1 = c.indexOf(strStart);
if (idx1 !== -1) {
    // Also remove the comment before it
    let commentIdx = c.lastIndexOf('{/* ', idx1);
    let endIdx = c.indexOf(')}', idx1 + strStart.length);
    endIdx = c.indexOf(')}', endIdx + 2); // find the closing )}
    if (commentIdx !== -1 && endIdx !== -1) {
        c = c.substring(0, commentIdx) + c.substring(endIdx + 2);
        fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
        console.log('Fixed UserProfileSheet.tsx by slicing out activeManualEntry block.');
    }
} else {
    console.log('activeManualEntry block not found via exact string.');
}
