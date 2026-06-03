const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const strStart = '                    title={dialogConfig[activeManualEntry].title}';
const strEnd = '            )}'; // Wait, let's just find "Delete Confirmation Modal" and cut up to there

const deleteModalIdx = c.indexOf('{/* Delete Confirmation Modal */}');
if (deleteModalIdx !== -1) {
    // Cut from title={dialogConfig... up to Delete Confirmation Modal
    const startIdx = c.indexOf('                    title={dialogConfig[activeManualEntry].title}');
    if (startIdx !== -1) {
        c = c.substring(0, startIdx) + '\n            ' + c.substring(deleteModalIdx);
        fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
        console.log('Fixed hanging tags!');
    } else {
        console.log('Start index not found');
    }
} else {
    console.log('Delete modal not found');
}
